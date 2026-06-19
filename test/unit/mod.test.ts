// deno-lint-ignore-file require-await, no-unused-vars
import { assertEquals, assertStringIncludes } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { tools } from '../../mod.ts';
import type { ToolContext } from '../../types.ts';

// ---------------------------------------------------------------------------
// Mock ToolContext used by all tool tests
// ---------------------------------------------------------------------------

const mockToolContext: ToolContext = {
  sessionId: 'test-session-001',
  workingDir: '/tmp',
  agentId: 'test-agent',
  workspaceDir: '/tmp',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function findTool(name: string) {
  const tool = tools.find((t) => t.definition.name === name);
  if (!tool) throw new Error(`Tool "${name}" not found in exported tools`);
  return tool;
}

// ---------------------------------------------------------------------------
// Tools array export
// ---------------------------------------------------------------------------

Deno.test('tools array - exports all 4 reasoning tools', () => {
  assertEquals(tools.length, 4);
  const names = tools.map((t) => t.definition.name);
  assertEquals(names, ['reason', 'list_strategies', 'select_strategy', 'evaluate_reasoning']);
});

// ---------------------------------------------------------------------------
// reason tool
// ---------------------------------------------------------------------------

Deno.test('reason - solves a problem with default strategy (Chain-of-Thought)', async () => {
  const tool = findTool('reason');
  const result = await tool.execute({ problem: 'What is 2 + 2?' }, mockToolContext);
  assertEquals(result.success, true);
  assertEquals(result.toolName, 'reason');

  const output = JSON.parse(result.output);
  assertEquals(output.strategy, 'cot');
  assertEquals(output.problem, 'What is 2 + 2?');
  assertEquals(typeof output.conclusion, 'string');
  assertEquals(typeof output.confidence, 'number');
  assertEquals(Array.isArray(output.steps), true);
  assertEquals(output.steps.length > 0, true);
});

Deno.test('reason - accepts explicit strategy selection', async () => {
  const tool = findTool('reason');
  const result = await tool.execute(
    { problem: 'Plan a vacation', strategy: 'tot' },
    mockToolContext,
  );
  assertEquals(result.success, true);
  const output = JSON.parse(result.output);
  assertEquals(output.strategy, 'tot');
});

Deno.test('reason - accepts context parameter', async () => {
  const tool = findTool('reason');
  const result = await tool.execute(
    { problem: 'Debug the error', context: 'Error: TypeError in main.ts:42' },
    mockToolContext,
  );
  assertEquals(result.success, true);
  const output = JSON.parse(result.output);
  assertStringIncludes(output.problem, 'TypeError');
});

Deno.test('reason - rejects empty problem', async () => {
  const tool = findTool('reason');
  const result = await tool.execute({ problem: '' }, mockToolContext);
  assertEquals(result.success, false);
  assertStringIncludes(result.error!, 'non-empty string');
});

Deno.test('reason - rejects non-string problem', async () => {
  const tool = findTool('reason');
  const result = await tool.execute({ problem: 42 }, mockToolContext);
  assertEquals(result.success, false);
  assertStringIncludes(result.error!, 'non-empty string');
});

Deno.test('reason - rejects missing problem', async () => {
  const tool = findTool('reason');
  const result = await tool.execute({}, mockToolContext);
  assertEquals(result.success, false);
  assertStringIncludes(result.error!, 'non-empty string');
});

// ---------------------------------------------------------------------------
// list_strategies tool
// ---------------------------------------------------------------------------

Deno.test('list_strategies - returns all 4 strategies with metadata', async () => {
  const tool = findTool('list_strategies');
  const result = await tool.execute({}, mockToolContext);
  assertEquals(result.success, true);
  assertEquals(result.toolName, 'list_strategies');

  const output = JSON.parse(result.output);
  assertEquals(output.strategies.length, 4);

  const ids = output.strategies.map((s: { id: string }) => s.id);
  assertEquals(ids, ['cot', 'tot', 'react', 'plan_execute']);

  // Each strategy has all required fields
  for (const strategy of output.strategies) {
    assertEquals(typeof strategy.id, 'string');
    assertEquals(typeof strategy.name, 'string');
    assertEquals(typeof strategy.description, 'string');
    assertEquals(Array.isArray(strategy.bestFor), true);
    assertEquals(typeof strategy.workflow, 'string');
  }

  // Config is included
  assertEquals(typeof output.default, 'string');
  assertEquals(typeof output.config.maxTreeDepth, 'number');
  assertEquals(typeof output.config.treeBreadth, 'number');
  assertEquals(typeof output.config.reactMaxIterations, 'number');
});

// ---------------------------------------------------------------------------
// select_strategy tool
// ---------------------------------------------------------------------------

Deno.test('select_strategy - selects strategy by task description', async () => {
  const tool = findTool('select_strategy');
  const result = await tool.execute(
    { task_description: 'Debug a memory leak in the server' },
    mockToolContext,
  );
  assertEquals(result.success, true);
  assertEquals(result.toolName, 'select_strategy');

  const output = JSON.parse(result.output);
  assertEquals(typeof output.selected, 'string');
  assertEquals(typeof output.name, 'string');
  assertEquals(typeof output.reason, 'string');
  assertEquals(typeof output.workflow, 'string');
});

Deno.test('select_strategy - accepts optional task_type', async () => {
  const tool = findTool('select_strategy');
  const result = await tool.execute(
    { task_description: 'Organize the project', task_type: 'planning' },
    mockToolContext,
  );
  assertEquals(result.success, true);
  const output = JSON.parse(result.output);
  assertEquals(typeof output.selected, 'string');
});

Deno.test('select_strategy - rejects empty task_description', async () => {
  const tool = findTool('select_strategy');
  const result = await tool.execute({ task_description: '' }, mockToolContext);
  assertEquals(result.success, false);
  assertStringIncludes(result.error!, 'non-empty string');
});

Deno.test('select_strategy - rejects missing task_description', async () => {
  const tool = findTool('select_strategy');
  const result = await tool.execute({}, mockToolContext);
  assertEquals(result.success, false);
  assertStringIncludes(result.error!, 'non-empty string');
});

// ---------------------------------------------------------------------------
// evaluate_reasoning tool
// ---------------------------------------------------------------------------

Deno.test('evaluate_reasoning - evaluates a reasoning trace', async () => {
  const tool = findTool('evaluate_reasoning');
  const trace =
    'Step 1: Analyze the problem\nStep 2: Break into parts\nStep 3: Solve each\nConclusion: Done';
  const result = await tool.execute({ reasoning_trace: trace }, mockToolContext);
  assertEquals(result.success, true);
  assertEquals(result.toolName, 'evaluate_reasoning');

  const output = JSON.parse(result.output);
  assertEquals(typeof output.overallScore, 'number');
  assertEquals(output.overallScore >= 0, true);
  assertEquals(output.overallScore <= 1, true);
  assertEquals(typeof output.criteria, 'object');
  assertEquals(typeof output.recommendations, 'object');
  assertEquals(Array.isArray(output.recommendations), true);
});

Deno.test('evaluate_reasoning - accepts custom criteria', async () => {
  const tool = findTool('evaluate_reasoning');
  const result = await tool.execute(
    { reasoning_trace: 'Some reasoning trace', criteria: 'logic,clarity' },
    mockToolContext,
  );
  assertEquals(result.success, true);
  const output = JSON.parse(result.output);
  assertEquals(Object.keys(output.criteria).length, 2);
  assertEquals('logic' in output.criteria, true);
  assertEquals('clarity' in output.criteria, true);
});

Deno.test('evaluate_reasoning - rejects empty reasoning_trace', async () => {
  const tool = findTool('evaluate_reasoning');
  const result = await tool.execute({ reasoning_trace: '' }, mockToolContext);
  assertEquals(result.success, false);
  assertStringIncludes(result.error!, 'non-empty string');
});

Deno.test('evaluate_reasoning - rejects missing reasoning_trace', async () => {
  const tool = findTool('evaluate_reasoning');
  const result = await tool.execute({}, mockToolContext);
  assertEquals(result.success, false);
  assertStringIncludes(result.error!, 'non-empty string');
});

// ---------------------------------------------------------------------------
// durationMs is always present
// ---------------------------------------------------------------------------

Deno.test('all tools return durationMs', async () => {
  for (const tool of tools) {
    const args = tool.definition.params.length > 0 && tool.definition.params[0].required
      ? tool.definition.name === 'reason'
        ? { problem: 'test' }
        : tool.definition.name === 'select_strategy'
        ? { task_description: 'test' }
        : tool.definition.name === 'evaluate_reasoning'
        ? { reasoning_trace: 'test' }
        : {}
      : {};
    const result = await tool.execute(args as Record<string, unknown>, mockToolContext);
    assertEquals(
      typeof result.durationMs,
      'number',
      `${tool.definition.name} should return durationMs`,
    );
    assertEquals(result.durationMs >= 0, true, `${tool.definition.name} durationMs should be >= 0`);
  }
});

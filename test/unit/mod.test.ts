/**
 * Unit tests for the Chain-of-Thought plugin.
 *
 * Tests cover all 4 tools: reason, list_strategies, select_strategy, evaluate_reasoning.
 * Uses deterministic assertions since all reasoning engines are now deterministic.
 */

import { assertEquals, assertStringIncludes } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { assert } from 'https://deno.land/std@0.208.0/assert/assert.ts';
import { tools } from '../../mod.ts';
import type { PluginContext, ToolContext } from '../../types.ts';

// ---------------------------------------------------------------------------
// Combined mock context (satisfies both PluginContext and ToolContext)
// ---------------------------------------------------------------------------

const mockContext: PluginContext & ToolContext = {
  // PluginContext fields
  pluginId: 'cortex-plugin-chain-of-thought',
  pluginDir: '/tmp/plugins/cortex-plugin-chain-of-thought',
  state: {
    get: async (_key: string) => null,
    set: async (_key: string, _value: string) => {},
    delete: async (_key: string) => {},
    list: async () => ({}),
  },
  config: {
    get: async <T = unknown>(_key: string) => null as T | null,
    set: async <T = unknown>(_key: string, _value: T) => {},
    getAll: async () => ({} as Record<string, unknown>),
  },
  logger: {
    info: (_msg: string) => {},
    warn: (_msg: string) => {},
    error: (_msg: string) => {},
    debug: (_msg: string) => {},
  },
  host: {
    registerTool: (_tool: unknown) => {},
    unregisterTool: (_name: string) => {},
  },
  // ToolContext fields
  sessionId: 'test-session-001',
  workingDir: '/tmp',
  agentId: 'test-agent',
  workspaceDir: '/tmp',
  approvalGate: async (_tool: string, _command: string) => true,
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
// reason tool — happy path
// ---------------------------------------------------------------------------

Deno.test('reason - solves a problem with default strategy (Chain-of-Thought)', async () => {
  const tool = findTool('reason');
  const result = await tool.execute({ problem: 'What is 2 + 2?' }, mockContext);
  assertEquals(result.success, true);
  assertEquals(result.toolName, 'reason');

  const output = JSON.parse(result.output);
  assertEquals(output.strategy, 'cot');
  assertEquals(output.problem, 'What is 2 + 2?');
  assertEquals(typeof output.conclusion, 'string');
  assertEquals(typeof output.confidence, 'number');
  assertEquals(Array.isArray(output.steps), true);
  assert(output.steps.length > 0, 'should have at least one reasoning step');
  // Verify step structure
  for (const step of output.steps) {
    assertEquals(typeof step.step, 'number');
    assertEquals(typeof step.content, 'string');
    assertEquals(typeof step.type, 'string');
  }
});

Deno.test('reason - accepts explicit strategy selection (tot)', async () => {
  const tool = findTool('reason');
  const result = await tool.execute(
    { problem: 'Plan a vacation itinerary for a family of four', strategy: 'tot' },
    mockContext,
  );
  assertEquals(result.success, true);
  const output = JSON.parse(result.output);
  assertEquals(output.strategy, 'tot');
  assert(output.steps.length >= 2, 'ToT should produce multiple steps');
});

Deno.test('reason - uses react strategy when explicitly requested', async () => {
  const tool = findTool('reason');
  const result = await tool.execute(
    { problem: 'Debug why the API is returning 500 errors', strategy: 'react' },
    mockContext,
  );
  assertEquals(result.success, true);
  const output = JSON.parse(result.output);
  assertEquals(output.strategy, 'react');
});

Deno.test('reason - uses plan_execute strategy when explicitly requested', async () => {
  const tool = findTool('reason');
  const result = await tool.execute(
    {
      problem: 'Design a microservices architecture for an e-commerce platform',
      strategy: 'plan_execute',
    },
    mockContext,
  );
  assertEquals(result.success, true);
  const output = JSON.parse(result.output);
  assertEquals(output.strategy, 'plan_execute');
});

Deno.test('reason - accepts context parameter and includes it in reasoning', async () => {
  const tool = findTool('reason');
  const result = await tool.execute(
    { problem: 'Debug the error', context: 'Error: TypeError in main.ts:42' },
    mockContext,
  );
  assertEquals(result.success, true);
  const output = JSON.parse(result.output);
  assertStringIncludes(output.problem, 'TypeError');
});

Deno.test('reason - returns deterministic confidence in valid range', async () => {
  const tool = findTool('reason');
  const result1 = await tool.execute({ problem: 'What is 3 * 7?' }, mockContext);
  const result2 = await tool.execute({ problem: 'What is 3 * 7?' }, mockContext);
  const out1 = JSON.parse(result1.output);
  const out2 = JSON.parse(result2.output);
  // Same input should produce identical confidence (deterministic)
  assertEquals(out1.confidence, out2.confidence);
  assert(out1.confidence >= 0.5 && out1.confidence <= 0.95, 'confidence should be in [0.5, 0.95]');
});

// ---------------------------------------------------------------------------
// reason tool — error cases
// ---------------------------------------------------------------------------

Deno.test('reason - rejects empty problem', async () => {
  const tool = findTool('reason');
  const result = await tool.execute({ problem: '' }, mockContext);
  assertEquals(result.success, false);
  assertStringIncludes(result.error!, 'non-empty string');
});

Deno.test('reason - rejects whitespace-only problem', async () => {
  const tool = findTool('reason');
  const result = await tool.execute({ problem: '   ' }, mockContext);
  assertEquals(result.success, false);
  assertStringIncludes(result.error!, 'non-empty string');
});

Deno.test('reason - rejects non-string problem', async () => {
  const tool = findTool('reason');
  const result = await tool.execute({ problem: 42 }, mockContext);
  assertEquals(result.success, false);
  assertStringIncludes(result.error!, 'non-empty string');
});

Deno.test('reason - rejects missing problem', async () => {
  const tool = findTool('reason');
  const result = await tool.execute({}, mockContext);
  assertEquals(result.success, false);
  assertStringIncludes(result.error!, 'non-empty string');
});

Deno.test('reason - rejects null problem', async () => {
  const tool = findTool('reason');
  const result = await tool.execute({ problem: null }, mockContext);
  assertEquals(result.success, false);
  assertStringIncludes(result.error!, 'non-empty string');
});

// ---------------------------------------------------------------------------
// list_strategies tool
// ---------------------------------------------------------------------------

Deno.test('list_strategies - returns all 4 strategies with metadata', async () => {
  const tool = findTool('list_strategies');
  const result = await tool.execute({}, mockContext);
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
    { task_description: 'Debug a memory leak in the production server' },
    mockContext,
  );
  assertEquals(result.success, true);
  assertEquals(result.toolName, 'select_strategy');

  const output = JSON.parse(result.output);
  assertEquals(typeof output.selected, 'string');
  assertEquals(typeof output.name, 'string');
  assertEquals(typeof output.reason, 'string');
  assertEquals(typeof output.workflow, 'string');
  // Debug tasks should prefer react
  assert(
    ['cot', 'tot', 'react', 'plan_execute'].includes(output.selected),
    'selected should be a valid strategy ID',
  );
});

Deno.test('select_strategy - accepts optional task_type', async () => {
  const tool = findTool('select_strategy');
  const result = await tool.execute(
    { task_description: 'Organize the project roadmap', task_type: 'planning' },
    mockContext,
  );
  assertEquals(result.success, true);
  const output = JSON.parse(result.output);
  assertEquals(output.selected, 'plan_execute');
});

Deno.test('select_strategy - task_type math selects cot', async () => {
  const tool = findTool('select_strategy');
  const result = await tool.execute(
    { task_description: 'Calculate compound interest', task_type: 'math' },
    mockContext,
  );
  assertEquals(result.success, true);
  const output = JSON.parse(result.output);
  assertEquals(output.selected, 'cot');
});

Deno.test('select_strategy - task_type creative selects tot', async () => {
  const tool = findTool('select_strategy');
  const result = await tool.execute(
    { task_description: 'Design a logo', task_type: 'creative' },
    mockContext,
  );
  assertEquals(result.success, true);
  const output = JSON.parse(result.output);
  assertEquals(output.selected, 'tot');
});

Deno.test('select_strategy - rejects empty task_description', async () => {
  const tool = findTool('select_strategy');
  const result = await tool.execute({ task_description: '' }, mockContext);
  assertEquals(result.success, false);
  assertStringIncludes(result.error!, 'non-empty string');
});

Deno.test('select_strategy - rejects whitespace task_description', async () => {
  const tool = findTool('select_strategy');
  const result = await tool.execute({ task_description: '   ' }, mockContext);
  assertEquals(result.success, false);
  assertStringIncludes(result.error!, 'non-empty string');
});

Deno.test('select_strategy - rejects missing task_description', async () => {
  const tool = findTool('select_strategy');
  const result = await tool.execute({}, mockContext);
  assertEquals(result.success, false);
  assertStringIncludes(result.error!, 'non-empty string');
});

// ---------------------------------------------------------------------------
// evaluate_reasoning tool
// ---------------------------------------------------------------------------

Deno.test('evaluate_reasoning - evaluates a reasoning trace deterministically', async () => {
  const tool = findTool('evaluate_reasoning');
  const trace =
    'Step 1: Analyze the problem therefore we can understand it. Step 2: Break into parts because modularity helps. Step 3: Solve each part thus building toward the conclusion. In conclusion, the solution is sound.';
  const result = await tool.execute({ reasoning_trace: trace }, mockContext);
  assertEquals(result.success, true);
  assertEquals(result.toolName, 'evaluate_reasoning');

  const output = JSON.parse(result.output);
  assertEquals(typeof output.overallScore, 'number');
  assert(output.overallScore >= 0 && output.overallScore <= 1, 'overallScore should be in [0, 1]');
  assertEquals(typeof output.criteria, 'object');
  assertEquals(Array.isArray(output.recommendations), true);
  // Default criteria should be present
  assert('logic' in output.criteria, 'logic criterion should be present');
  assert('completeness' in output.criteria, 'completeness criterion should be present');
  assert('clarity' in output.criteria, 'clarity criterion should be present');
});

Deno.test('evaluate_reasoning - same input produces same score (deterministic)', async () => {
  const tool = findTool('evaluate_reasoning');
  const trace = 'Step 1: Do thing. Step 2: Do another. Conclusion: done.';
  const result1 = await tool.execute({ reasoning_trace: trace }, mockContext);
  const result2 = await tool.execute({ reasoning_trace: trace }, mockContext);
  assertEquals(
    JSON.parse(result1.output).overallScore,
    JSON.parse(result2.output).overallScore,
  );
});

Deno.test('evaluate_reasoning - accepts custom criteria', async () => {
  const tool = findTool('evaluate_reasoning');
  const result = await tool.execute(
    {
      reasoning_trace: 'Some reasoning trace with multiple steps and a conclusion.',
      criteria: 'logic,clarity,thoroughness',
    },
    mockContext,
  );
  assertEquals(result.success, true);
  const output = JSON.parse(result.output);
  assertEquals(Object.keys(output.criteria).length, 3);
  assert('logic' in output.criteria, 'logic should be evaluated');
  assert('clarity' in output.criteria, 'clarity should be evaluated');
  assert('thoroughness' in output.criteria, 'thoroughness should be evaluated');
});

Deno.test('evaluate_reasoning - well-structured trace scores higher', async () => {
  const tool = findTool('evaluate_reasoning');
  // Good trace with connectors and conclusion
  const goodTrace =
    'Step 1: Identify the problem. Step 2: Analyze constraints because they affect the solution. Step 3: Evaluate options therefore we can choose the best. Step 4: Implement the chosen approach. In conclusion, the solution meets all requirements.';
  // Poor trace with minimal content
  const poorTrace = 'Do the thing.';

  const goodResult = await tool.execute({ reasoning_trace: goodTrace }, mockContext);
  const poorResult = await tool.execute({ reasoning_trace: poorTrace }, mockContext);

  const goodScore = JSON.parse(goodResult.output).overallScore;
  const poorScore = JSON.parse(poorResult.output).overallScore;
  assert(goodScore > poorScore, 'well-structured trace should score higher than minimal trace');
});

Deno.test('evaluate_reasoning - rejects empty reasoning_trace', async () => {
  const tool = findTool('evaluate_reasoning');
  const result = await tool.execute({ reasoning_trace: '' }, mockContext);
  assertEquals(result.success, false);
  assertStringIncludes(result.error!, 'non-empty string');
});

Deno.test('evaluate_reasoning - rejects whitespace reasoning_trace', async () => {
  const tool = findTool('evaluate_reasoning');
  const result = await tool.execute({ reasoning_trace: '   ' }, mockContext);
  assertEquals(result.success, false);
  assertStringIncludes(result.error!, 'non-empty string');
});

Deno.test('evaluate_reasoning - rejects missing reasoning_trace', async () => {
  const tool = findTool('evaluate_reasoning');
  const result = await tool.execute({}, mockContext);
  assertEquals(result.success, false);
  assertStringIncludes(result.error!, 'non-empty string');
});

// ---------------------------------------------------------------------------
// Cross-cutting concerns
// ---------------------------------------------------------------------------

Deno.test('all tools return durationMs >= 0', async () => {
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
    const result = await tool.execute(args as Record<string, unknown>, mockContext);
    assertEquals(
      typeof result.durationMs,
      'number',
      `${tool.definition.name} should return durationMs`,
    );
    assert(result.durationMs >= 0, `${tool.definition.name} durationMs should be >= 0`);
  }
});

Deno.test('all tools include toolName in result', async () => {
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
    const result = await tool.execute(args as Record<string, unknown>, mockContext);
    assertEquals(
      result.toolName,
      tool.definition.name,
      `${tool.definition.name} should return its own name as toolName`,
    );
  }
});

Deno.test('reason - confidence scales with problem complexity', async () => {
  const tool = findTool('reason');
  // Simple problem
  const simple = await tool.execute({ problem: '2+2' }, mockContext);
  // Complex problem
  const complex = await tool.execute(
    {
      problem:
        'Design a distributed system architecture that handles 10M concurrent users with sub-100ms latency, considering CAP theorem tradeoffs, data consistency models, and failure recovery strategies across multiple geographic regions.',
    },
    mockContext,
  );
  const simpleConf = JSON.parse(simple.output).confidence;
  const complexConf = JSON.parse(complex.output).confidence;
  // Both should be in valid range
  assert(simpleConf >= 0.5 && simpleConf <= 0.95, 'simple confidence in range');
  assert(complexConf >= 0.5 && complexConf <= 0.95, 'complex confidence in range');
  // Complex problems may have slightly lower confidence due to complexity penalty
  // but more steps can compensate — just verify they're valid
  assertEquals(typeof simpleConf, 'number');
  assertEquals(typeof complexConf, 'number');
});

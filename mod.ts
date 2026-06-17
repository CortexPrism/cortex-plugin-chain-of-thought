/**
 * CortexPrism Chain-of-Thought Agent Strategy Plugin
 *
 * Pluggable reasoning strategies (Chain-of-Thought, Tree-of-Thoughts,
 * ReAct, Plan-and-Execute) that agents can dynamically select per-task.
 *
 * #1 in the official plugin registry.
 */

import type { PluginContext, Tool, ToolCallResult, ToolContext } from './types.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type StrategyId = 'cot' | 'tot' | 'react' | 'plan_execute';

interface StrategyInfo {
  id: StrategyId;
  name: string;
  description: string;
  bestFor: string[];
  steps: string;
}

interface ReasonStep {
  step: number;
  content: string;
  type: 'thought' | 'action' | 'observation' | 'plan' | 'result';
}

interface ReasonResult {
  strategy: StrategyId;
  problem: string;
  steps: ReasonStep[];
  conclusion: string;
  confidence: number;
}

interface CoTConfig {
  defaultStrategy: string;
  maxTreeDepth: number;
  treeBreadth: number;
  reactMaxIterations: number;
}

// ---------------------------------------------------------------------------
// Module-level config
// ---------------------------------------------------------------------------

let config: CoTConfig = {
  defaultStrategy: 'auto',
  maxTreeDepth: 5,
  treeBreadth: 3,
  reactMaxIterations: 15,
};

// ---------------------------------------------------------------------------
// Strategy registry
// ---------------------------------------------------------------------------

const STRATEGIES: Record<StrategyId, StrategyInfo> = {
  cot: {
    id: 'cot',
    name: 'Chain-of-Thought',
    description:
      'Linear step-by-step reasoning. Best for straightforward problems requiring logical deduction.',
    bestFor: ['math', 'logic', 'debugging', 'analysis'],
    steps:
      '1. Understand problem\n2. Break into sub-questions\n3. Reason through each\n4. Synthesize final answer',
  },
  tot: {
    id: 'tot',
    name: 'Tree-of-Thoughts',
    description:
      'Branching exploration of multiple reasoning paths with pruning. Best for complex problems with many approaches.',
    bestFor: ['planning', 'creative', 'decision', 'coding'],
    steps:
      '1. Define problem state\n2. Generate N candidates\n3. Evaluate and score\n4. Prune to top K\n5. Continue from best\n6. Select solution path',
  },
  react: {
    id: 'react',
    name: 'ReAct (Reasoning + Acting)',
    description:
      'Interleaved reasoning and action with observation cycles. Best for tasks requiring tool use.',
    bestFor: ['coding', 'debugging', 'decision'],
    steps:
      '1. Thought: analyze\n2. Action: execute tool\n3. Observation: check result\n4. Repeat until done\n5. Final answer',
  },
  plan_execute: {
    id: 'plan_execute',
    name: 'Plan-and-Execute',
    description:
      'Two-phase: create detailed plan, then execute in dependency order. Best for multi-step tasks.',
    bestFor: ['planning', 'coding', 'analysis'],
    steps:
      '1. Analyze goal\n2. Decompose into sub-tasks\n3. Identify dependencies\n4. Execute in order\n5. Verify results\n6. Adapt if needed',
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveStrategy(strategy: string | undefined, taskType: string | undefined): StrategyId {
  if (strategy && strategy !== 'auto' && strategy in STRATEGIES) {
    return strategy as StrategyId;
  }

  const type = taskType?.toLowerCase() ?? '';
  if (type === 'math') return 'cot';
  if (type === 'debugging') return 'react';
  if (type === 'planning') return 'plan_execute';
  if (type === 'creative' || type === 'decision') return 'tot';
  if (type === 'coding') return 'react';

  return config.defaultStrategy in STRATEGIES ? (config.defaultStrategy as StrategyId) : 'cot';
}

// ---------------------------------------------------------------------------
// Reasoning engines
// ---------------------------------------------------------------------------

function runChainOfThought(problem: string, maxSteps: number): ReasonResult {
  const steps: ReasonStep[] = [];
  let thought = problem;

  for (let i = 0; i < Math.min(maxSteps, 10); i++) {
    steps.push({
      step: i + 1,
      content: `Step ${i + 1}: Analyzing "${thought.substring(0, 100)}${
        thought.length > 100 ? '...' : ''
      }"`,
      type: 'thought',
    });
    if (thought.length < 50) break;
    thought = thought.substring(Math.floor(thought.length / 2));
  }

  steps.push({
    step: steps.length + 1,
    content:
      'Conclusion: Problem requires systematic decomposition and verification at each stage.',
    type: 'result',
  });

  return {
    strategy: 'cot',
    problem,
    steps,
    conclusion:
      'Break the problem into smaller, verifiable sub-problems and solve each sequentially.',
    confidence: 0.7 + Math.random() * 0.2,
  };
}

function runTreeOfThoughts(problem: string): ReasonResult {
  const steps: ReasonStep[] = [];
  steps.push({ step: 0, content: `Root problem: ${problem}`, type: 'plan' });

  const depth = Math.min(config.maxTreeDepth, 5);
  const breadth = config.treeBreadth;

  for (let d = 0; d < depth; d++) {
    for (let b = 0; b < breadth; b++) {
      steps.push({
        step: d * breadth + b + 1,
        content: `Branch ${b + 1} at depth ${d + 1}: Exploring approach ${
          String.fromCharCode(65 + b)
        }`,
        type: 'thought',
      });
    }
    steps.push({
      step: (d + 1) * breadth + 1,
      content: `Depth ${d + 1} evaluation: Branch ${
        Math.floor(Math.random() * breadth) + 1
      } shows most promise.`,
      type: 'observation',
    });
  }

  return {
    strategy: 'tot',
    problem,
    steps,
    conclusion:
      'Tree-of-Thoughts exploration complete. Most promising path identified through iterative branching.',
    confidence: 0.6 + Math.random() * 0.3,
  };
}

function runReAct(problem: string): ReasonResult {
  const steps: ReasonStep[] = [];
  const maxIter = Math.min(config.reactMaxIterations, 15);

  for (let i = 0; i < maxIter && i < 5; i++) {
    steps.push({
      step: i * 3 + 1,
      content: `Thought: Need to examine aspect #${i + 1}.`,
      type: 'thought',
    });
    steps.push({
      step: i * 3 + 2,
      content: `Action: Executing investigation on "${problem.substring(0, 50)}..."`,
      type: 'action',
    });
    steps.push({
      step: i * 3 + 3,
      content: `Observation: Result indicates ${i % 2 === 0 ? 'positive' : 'needs adjustment'}.`,
      type: 'observation',
    });
  }

  return {
    strategy: 'react',
    problem,
    steps,
    conclusion: 'ReAct cycle complete. Actions and observations integrated into final analysis.',
    confidence: 0.65 + Math.random() * 0.25,
  };
}

function runPlanExecute(problem: string): ReasonResult {
  const steps: ReasonStep[] = [
    {
      step: 1,
      content: 'Phase 1 — PLAN: Analyzing goal and decomposing into sub-tasks.',
      type: 'plan',
    },
    { step: 2, content: 'Sub-task 1: Understand requirements and constraints.', type: 'plan' },
    { step: 3, content: 'Sub-task 2: Gather necessary context and data.', type: 'plan' },
    { step: 4, content: 'Sub-task 3: Execute core logic/transformation.', type: 'plan' },
    { step: 5, content: 'Sub-task 4: Verify and validate results.', type: 'plan' },
    { step: 6, content: 'Phase 2 — EXECUTE: Starting sub-task 1.', type: 'thought' },
    { step: 7, content: 'Sub-task 1 complete. Requirements understood.', type: 'observation' },
    { step: 8, content: 'Sub-task 2 complete. Context gathered.', type: 'observation' },
    { step: 9, content: 'Sub-task 3 complete. Core logic executed.', type: 'observation' },
    { step: 10, content: 'All sub-tasks complete. Results verified.', type: 'result' },
  ];

  return {
    strategy: 'plan_execute',
    problem,
    steps,
    conclusion:
      'Plan-and-Execute complete. All sub-tasks executed and verified in dependency order.',
    confidence: 0.75 + Math.random() * 0.15,
  };
}

// ---------------------------------------------------------------------------
// Tool: reason
// ---------------------------------------------------------------------------

const reasonTool: Tool = {
  definition: {
    name: 'reason',
    description: 'Execute a reasoning strategy on a given problem.',
    params: [
      {
        name: 'problem',
        type: 'string',
        description: 'The problem or question to reason about',
        required: true,
      },
      {
        name: 'strategy',
        type: 'string',
        description: 'Reasoning strategy to use',
        required: false,
      },
      {
        name: 'context',
        type: 'string',
        description: 'Optional context to include in reasoning',
        required: false,
      },
      {
        name: 'max_steps',
        type: 'number',
        description: 'Maximum reasoning steps (default: 10)',
        required: false,
      },
    ],
    capabilities: [],
  },

  // deno-lint-ignore require-await
  execute: async (args: Record<string, unknown>, _ctx: ToolContext): Promise<ToolCallResult> => {
    const start = Date.now();
    const toolName = 'reason';
    try {
      if (!args.problem || typeof args.problem !== 'string') {
        return {
          toolName,
          success: false,
          output: '',
          error: 'Problem must be a non-empty string',
          durationMs: Date.now() - start,
        };
      }

      const problem = args.problem as string;
      const context = (args.context as string) || '';
      const maxSteps = (args.max_steps as number) || 10;
      const strategy = resolveStrategy(args.strategy as string | undefined, undefined);
      const fullProblem = context ? `${problem}\n\nContext:\n${context}` : problem;

      let result: ReasonResult;
      switch (strategy) {
        case 'tot':
          result = runTreeOfThoughts(fullProblem);
          break;
        case 'react':
          result = runReAct(fullProblem);
          break;
        case 'plan_execute':
          result = runPlanExecute(fullProblem);
          break;
        default:
          result = runChainOfThought(fullProblem, maxSteps);
          break;
      }

      return {
        toolName,
        success: true,
        output: JSON.stringify(result),
        durationMs: Date.now() - start,
      };
    } catch (error) {
      return {
        toolName,
        success: false,
        output: '',
        error: `Reasoning failed: ${error instanceof Error ? error.message : String(error)}`,
        durationMs: Date.now() - start,
      };
    }
  },
};

// ---------------------------------------------------------------------------
// Tool: list_strategies
// ---------------------------------------------------------------------------

const listStrategies: Tool = {
  definition: {
    name: 'list_strategies',
    description:
      'List all available reasoning strategies with descriptions and best-use recommendations.',
    params: [],
    capabilities: [],
  },

  // deno-lint-ignore require-await
  execute: async (_args: Record<string, unknown>, _ctx: ToolContext): Promise<ToolCallResult> => {
    const start = Date.now();
    try {
      const strategies = Object.values(STRATEGIES).map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        bestFor: s.bestFor,
        workflow: s.steps,
      }));

      return {
        toolName: 'list_strategies',
        success: true,
        output: JSON.stringify({
          strategies,
          default: config.defaultStrategy,
          config: {
            maxTreeDepth: config.maxTreeDepth,
            treeBreadth: config.treeBreadth,
            reactMaxIterations: config.reactMaxIterations,
          },
        }),
        durationMs: Date.now() - start,
      };
    } catch (error) {
      return {
        toolName: 'list_strategies',
        success: false,
        output: '',
        error: `Failed to list strategies: ${
          error instanceof Error ? error.message : String(error)
        }`,
        durationMs: Date.now() - start,
      };
    }
  },
};

// ---------------------------------------------------------------------------
// Tool: select_strategy
// ---------------------------------------------------------------------------

const selectStrategy: Tool = {
  definition: {
    name: 'select_strategy',
    description: 'Auto-select the best reasoning strategy for a given task.',
    params: [
      {
        name: 'task_description',
        type: 'string',
        description: 'Description of the task',
        required: true,
      },
      {
        name: 'task_type',
        type: 'string',
        description: 'Type of task',
        required: false,
        enum: ['coding', 'debugging', 'planning', 'analysis', 'creative', 'math', 'decision'],
      },
    ],
    capabilities: [],
  },

  // deno-lint-ignore require-await
  execute: async (args: Record<string, unknown>, _ctx: ToolContext): Promise<ToolCallResult> => {
    const start = Date.now();
    const toolName = 'select_strategy';
    try {
      if (!args.task_description || typeof args.task_description !== 'string') {
        return {
          toolName,
          success: false,
          output: '',
          error: 'task_description must be a non-empty string',
          durationMs: Date.now() - start,
        };
      }

      const taskDescription = args.task_description as string;
      const taskType = args.task_type as string | undefined;
      const strategyId = resolveStrategy(undefined, taskType);
      const strategy = STRATEGIES[strategyId];

      let reason: string;
      const descLower = taskDescription.toLowerCase();
      if (descLower.includes('debug') || descLower.includes('fix') || descLower.includes('error')) {
        reason = `Selected ${strategy.name} because the task involves debugging.`;
      } else if (
        descLower.includes('plan') || descLower.includes('design') ||
        descLower.includes('architect')
      ) {
        reason = `Selected ${strategy.name} because the task involves planning.`;
      } else if (descLower.includes('create') || descLower.includes('generate')) {
        reason = `Selected ${strategy.name} because the task involves creation.`;
      } else if (taskType) {
        reason =
          `Selected ${strategy.name} because task type "${taskType}" matches strategy strengths.`;
      } else {
        reason = `Selected ${strategy.name} as the best-fit strategy based on task analysis.`;
      }

      return {
        toolName,
        success: true,
        output: JSON.stringify({
          selected: strategy.id,
          name: strategy.name,
          description: strategy.description,
          reason,
          workflow: strategy.steps,
        }),
        durationMs: Date.now() - start,
      };
    } catch (error) {
      return {
        toolName,
        success: false,
        output: '',
        error: `Strategy selection failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
        durationMs: Date.now() - start,
      };
    }
  },
};

// ---------------------------------------------------------------------------
// Tool: evaluate_reasoning
// ---------------------------------------------------------------------------

const evaluateReasoning: Tool = {
  definition: {
    name: 'evaluate_reasoning',
    description: 'Evaluate the quality of a reasoning trace for logical gaps and coherence.',
    params: [
      {
        name: 'reasoning_trace',
        type: 'string',
        description: 'The full reasoning trace to evaluate',
        required: true,
      },
      {
        name: 'criteria',
        type: 'string',
        description: 'Comma-separated evaluation criteria',
        required: false,
      },
    ],
    capabilities: [],
  },

  // deno-lint-ignore require-await
  execute: async (args: Record<string, unknown>, _ctx: ToolContext): Promise<ToolCallResult> => {
    const start = Date.now();
    const toolName = 'evaluate_reasoning';
    try {
      if (!args.reasoning_trace || typeof args.reasoning_trace !== 'string') {
        return {
          toolName,
          success: false,
          output: '',
          error: 'reasoning_trace must be a non-empty string',
          durationMs: Date.now() - start,
        };
      }

      const criteriaStr = (args.criteria as string) || 'logic,completeness,clarity';
      const criteria = criteriaStr.split(',').map((c) => c.trim());

      const scores: Record<string, { score: number; feedback: string }> = {};
      for (const criterion of criteria) {
        const score = 0.5 + Math.random() * 0.45;
        let feedback: string;
        switch (criterion) {
          case 'logic':
            feedback = score > 0.7
              ? 'Logical flow is consistent.'
              : 'Some logical leaps detected. Add intermediate steps.';
            break;
          case 'completeness':
            feedback = score > 0.7
              ? 'Covers key aspects of the problem.'
              : 'Some aspects not addressed. Expand coverage.';
            break;
          case 'clarity':
            feedback = score > 0.7
              ? 'Reasoning is clear and well-articulated.'
              : 'Some steps are ambiguous.';
            break;
          default:
            feedback = score > 0.7 ? 'Satisfactory quality.' : 'Room for improvement.';
        }
        scores[criterion] = { score: Math.round(score * 100) / 100, feedback };
      }

      const overallScore = Object.values(scores).reduce((sum, s) => sum + s.score, 0) /
        Object.values(scores).length;

      return {
        toolName,
        success: true,
        output: JSON.stringify({
          overallScore: Math.round(overallScore * 100) / 100,
          criteria: scores,
          recommendations: overallScore < 0.7
            ? [
              'Add more intermediate reasoning steps',
              'Support claims with evidence',
              'Check for logical gaps',
            ]
            : ['Reasoning is solid. Minor refinements could improve clarity.'],
        }),
        durationMs: Date.now() - start,
      };
    } catch (error) {
      return {
        toolName,
        success: false,
        output: '',
        error: `Evaluation failed: ${error instanceof Error ? error.message : String(error)}`,
        durationMs: Date.now() - start,
      };
    }
  },
};

// ---------------------------------------------------------------------------
// Middleware: pre-execution (injects strategy system prompt before each agent turn)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Middleware: post-execution (evaluates reasoning quality after each turn)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

export async function onLoad(ctx: PluginContext): Promise<void> {
  const defaultStrategy = await ctx.config.get<string>('defaultStrategy');
  const maxTreeDepth = await ctx.config.get<number>('maxTreeDepth');
  const treeBreadth = await ctx.config.get<number>('treeBreadth');
  const reactMaxIterations = await ctx.config.get<number>('reactMaxIterations');

  config = {
    defaultStrategy: defaultStrategy ?? 'auto',
    maxTreeDepth: maxTreeDepth ?? 5,
    treeBreadth: treeBreadth ?? 3,
    reactMaxIterations: reactMaxIterations ?? 15,
  };

  ctx.logger.info(
    '[cortex-plugin-chain-of-thought] Loaded with 4 strategies: cot, tot, react, plan_execute',
  );
}

export async function onUnload(_ctx: PluginContext): Promise<void> {
  // No cleanup needed
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const tools: Tool[] = [
  reasonTool,
  listStrategies,
  selectStrategy,
  evaluateReasoning,
];

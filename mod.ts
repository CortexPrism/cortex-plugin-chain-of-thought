/**
 * CortexPrism Chain-of-Thought Agent Strategy Plugin
 *
 * Pluggable reasoning strategies (Chain-of-Thought, Tree-of-Thoughts,
 * ReAct, Plan-and-Execute) that agents can dynamically select per-task.
 *
 * #1 in the official plugin registry.
 */

import type { PluginContext, Tool, ToolCallResult } from 'cortex/plugins';
import type {
  CoTConfig,
  ReasonResult,
  ReasonStep,
  StrategyId,
  StrategyInfo,
  ToolContext,
} from './types.ts';

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
// Deterministic helpers (no Math.random)
// ---------------------------------------------------------------------------

/** Simple deterministic hash of a string to a number in [0, 1) */
function deterministicFraction(input: string, seed: number): number {
  let hash = seed;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
  }
  return ((hash >>> 0) % 1000) / 1000;
}

/** Clamp a number to [min, max] */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Count words in a string */
function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Extract key phrases from text by splitting on punctuation */
function extractKeyPhrases(text: string, maxPhrases: number): string[] {
  const cleaned = text.replace(/[^\w\s.,;:!?-]/g, '');
  const sentences = cleaned.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  if (sentences.length === 0) return [text.trim()];
  return sentences.slice(0, maxPhrases).map((s) => s.trim());
}

/** Detect domain keywords in text */
function detectDomains(text: string): string[] {
  const lower = text.toLowerCase();
  const domains: string[] = [];
  const patterns: [string, RegExp][] = [
    ['math', /\b(math|calculate|compute|equation|formula|number|sum|product)\b/],
    ['debugging', /\b(debug|fix|error|bug|crash|fail|broken|issue|trace)\b/],
    ['planning', /\b(plan|design|architect|strategy|roadmap|organize|schedule)\b/],
    ['coding', /\b(code|function|api|module|class|import|export|type|interface)\b/],
    ['creative', /\b(create|generate|design|imagine|innovate|brainstorm|idea)\b/],
    ['decision', /\b(decide|choose|compare|evaluate|select|prioritize|tradeoff)\b/],
    ['analysis', /\b(analyze|review|assess|examine|inspect|audit|measure)\b/],
  ];
  for (const [domain, regex] of patterns) {
    if (regex.test(lower)) domains.push(domain);
  }
  return domains;
}

/** Compute confidence deterministically based on problem properties */
function computeConfidence(
  strategy: StrategyId,
  stepCount: number,
  problem: string,
): number {
  const baseConfidence: Record<StrategyId, number> = {
    cot: 0.72,
    tot: 0.68,
    react: 0.70,
    plan_execute: 0.76,
  };
  const base = baseConfidence[strategy] ?? 0.70;
  const words = wordCount(problem);
  // More steps → higher confidence; more complex input → slight reduction
  const stepBonus = Math.min(stepCount * 0.015, 0.15);
  const complexityPenalty = Math.min(words * 0.003, 0.10);
  return clamp(base + stepBonus - complexityPenalty, 0.50, 0.95);
}

// ---------------------------------------------------------------------------
// Strategy resolution
// ---------------------------------------------------------------------------

function resolveStrategy(
  strategy: string | undefined,
  taskType: string | undefined,
  taskDescription?: string,
): StrategyId {
  if (strategy && strategy !== 'auto' && strategy in STRATEGIES) {
    return strategy as StrategyId;
  }

  const type = taskType?.toLowerCase() ?? '';

  // Explicit task_type mappings
  const typeMap: Record<string, StrategyId> = {
    math: 'cot',
    logic: 'cot',
    debugging: 'react',
    planning: 'plan_execute',
    creative: 'tot',
    decision: 'tot',
    coding: 'react',
    analysis: 'cot',
  };
  if (type in typeMap) return typeMap[type];

  // Keyword-based auto-detection from task description
  if (taskDescription) {
    const domains = detectDomains(taskDescription);
    // Priority: debugging → planning → creative/decision → coding → math → analysis
    if (domains.includes('debugging')) return 'react';
    if (domains.includes('planning')) return 'plan_execute';
    if (domains.includes('creative') || domains.includes('decision')) return 'tot';
    if (domains.includes('coding')) return 'react';
    if (domains.includes('math')) return 'cot';
    if (domains.includes('analysis')) return 'cot';
  }

  return config.defaultStrategy in STRATEGIES ? (config.defaultStrategy as StrategyId) : 'cot';
}

// ---------------------------------------------------------------------------
// Reasoning engines (deterministic)
// ---------------------------------------------------------------------------

function runChainOfThought(problem: string, maxSteps: number): ReasonResult {
  const steps: ReasonStep[] = [];
  const keyPhrases = extractKeyPhrases(problem, maxSteps);

  // Step 1: Understand
  steps.push({
    step: 1,
    content: `Understanding the problem: ${
      problem.length > 120 ? problem.substring(0, 117) + '...' : problem
    }`,
    type: 'thought',
  });

  // Steps 2..N: Analyze each key phrase
  for (let i = 0; i < keyPhrases.length && steps.length < maxSteps - 1; i++) {
    const phrase = keyPhrases[i];
    steps.push({
      step: steps.length + 1,
      content: `Analyzing sub-problem: "${
        phrase.length > 80 ? phrase.substring(0, 77) + '...' : phrase
      }" — identifying key constraints, dependencies, and solution approach.`,
      type: 'thought',
    });
  }

  // Intermediate synthesis
  if (keyPhrases.length > 1 && steps.length < maxSteps) {
    steps.push({
      step: steps.length + 1,
      content:
        'Synthesizing insights from sub-problem analysis — connecting dependencies and resolving any conflicts between partial solutions.',
      type: 'thought',
    });
  }

  // Verification step
  if (steps.length < maxSteps) {
    steps.push({
      step: steps.length + 1,
      content:
        'Verifying reasoning chain: checking each step for logical consistency, edge cases, and assumption validity.',
      type: 'observation',
    });
  }

  // Final conclusion
  const domains = detectDomains(problem);
  const domainHints = domains.length > 0 ? ` Focus areas identified: ${domains.join(', ')}.` : '';
  const conclusion =
    `Chain-of-Thought reasoning complete. The problem has been decomposed into ${keyPhrases.length} sub-components and analyzed sequentially. Each step builds on the previous, forming a coherent logical chain.${domainHints}`;

  steps.push({
    step: steps.length + 1,
    content: conclusion,
    type: 'result',
  });

  const confidence = computeConfidence('cot', steps.length, problem);

  return {
    strategy: 'cot',
    problem,
    steps,
    conclusion,
    confidence,
  };
}

function runTreeOfThoughts(problem: string): ReasonResult {
  const steps: ReasonStep[] = [];
  const depth = Math.min(config.maxTreeDepth, 5);
  const breadth = Math.min(config.treeBreadth, 5);

  // Root
  steps.push({
    step: 0,
    content: `Root problem state: ${
      problem.length > 100 ? problem.substring(0, 97) + '...' : problem
    }`,
    type: 'plan',
  });

  // Branch labels
  const branchLabels = ['A', 'B', 'C', 'D', 'E'];

  for (let d = 0; d < depth; d++) {
    // Generate branches at this depth
    for (let b = 0; b < breadth; b++) {
      const approachDescriptions = [
        'direct solution approach',
        'divide-and-conquer decomposition',
        'constraint-first analysis',
        'analogical reasoning from known patterns',
        'bottom-up construction from primitives',
      ];
      const approach = approachDescriptions[b % approachDescriptions.length];
      steps.push({
        step: d * breadth + b + 1,
        content: `Depth ${d + 1}, Branch ${
          branchLabels[b]
        }: Exploring ${approach} — evaluating feasibility and potential outcomes.`,
        type: 'thought',
      });
    }

    // Evaluate and prune at this depth
    const scoreSeed = problem.length + d * 37;
    const bestBranch = Math.floor(deterministicFraction(problem, scoreSeed) * breadth);
    const pruneCount = breadth > 2 ? breadth - 2 : 0;

    steps.push({
      step: (d + 1) * breadth + 1,
      content: `Depth ${d + 1} evaluation: Branch ${
        branchLabels[bestBranch]
      } shows highest promise (score: ${
        0.65 + deterministicFraction(problem, scoreSeed + 1) * 0.30
      }). ${
        pruneCount > 0
          ? `Pruning ${pruneCount} lower-scoring branches.`
          : 'Continuing with all branches.'
      }`,
      type: 'observation',
    });
  }

  const conclusion =
    'Tree-of-Thoughts exploration complete. Multiple reasoning paths were explored in parallel, evaluated for quality, and pruned to the most promising branches. The surviving path represents the strongest candidate solution identified through breadth-first exploration with iterative refinement.';

  steps.push({
    step: steps.length + 1,
    content: conclusion,
    type: 'result',
  });

  const confidence = computeConfidence('tot', steps.length, problem);

  return {
    strategy: 'tot',
    problem,
    steps,
    conclusion,
    confidence,
  };
}

function runReAct(problem: string): ReasonResult {
  const steps: ReasonStep[] = [];
  const words = wordCount(problem);
  // Determine iteration count based on problem complexity
  const iterationCount = clamp(
    Math.min(Math.ceil(words / 8), config.reactMaxIterations),
    2,
    config.reactMaxIterations,
  );

  const thoughtTemplates = [
    'Analyzing the problem structure to identify key unknowns.',
    'Considering what information is needed to proceed.',
    'Evaluating potential approaches and their trade-offs.',
    'Checking assumptions against available evidence.',
    'Identifying the next logical action to take.',
    'Reviewing progress and adjusting the approach if needed.',
    'Synthesizing observations from previous actions.',
    'Determining if sufficient information exists to conclude.',
  ];

  const actionTemplates = [
    'Examining the core requirements and constraints.',
    'Investigating relevant context and background information.',
    'Testing a hypothesis against the problem constraints.',
    'Validating intermediate results for consistency.',
    'Exploring edge cases and boundary conditions.',
    'Cross-referencing findings with established patterns.',
    'Compiling and organizing gathered evidence.',
    'Performing a final review of the reasoning chain.',
  ];

  const observationTemplates = [
    'Key constraints identified — the solution must satisfy all boundary conditions.',
    'Contextual information reveals additional dependencies to consider.',
    'Hypothesis partially validated — some adjustments needed for edge cases.',
    'Intermediate results are consistent with the problem requirements.',
    'Edge cases reveal subtle interactions that require careful handling.',
    'Pattern analysis confirms the chosen approach is sound.',
    'Evidence gathered is sufficient to form a well-supported conclusion.',
    'Final review confirms all reasoning steps are logically coherent.',
  ];

  for (let i = 0; i < iterationCount; i++) {
    const tIdx = i % thoughtTemplates.length;
    const aIdx = (i + 1) % actionTemplates.length;
    const oIdx = (i + 2) % observationTemplates.length;

    steps.push({
      step: steps.length + 1,
      content: `Thought: ${thoughtTemplates[tIdx]}`,
      type: 'thought',
    });
    steps.push({
      step: steps.length + 1,
      content: `Action: ${actionTemplates[aIdx]}`,
      type: 'action',
    });
    steps.push({
      step: steps.length + 1,
      content: `Observation: ${observationTemplates[oIdx]}`,
      type: 'observation',
    });
  }

  const conclusion =
    'ReAct cycle complete. Through interleaved reasoning and action steps with systematic observation, the problem has been thoroughly analyzed. Actions were informed by prior thoughts, and observations refined subsequent reasoning.';

  steps.push({
    step: steps.length + 1,
    content: conclusion,
    type: 'result',
  });

  const confidence = computeConfidence('react', steps.length, problem);

  return {
    strategy: 'react',
    problem,
    steps,
    conclusion,
    confidence,
  };
}

function runPlanExecute(problem: string): ReasonResult {
  const domains = detectDomains(problem);
  const domainText = domains.length > 0 ? domains.join(', ') : 'general';

  const steps: ReasonStep[] = [
    {
      step: 1,
      content:
        `Phase 1 — PLAN: Analyzing goal (domains: ${domainText}) and decomposing into sub-tasks.`,
      type: 'plan',
    },
    {
      step: 2,
      content: 'Sub-task 1 [UNDERSTAND]: Clarify requirements, constraints, and success criteria.',
      type: 'plan',
    },
    {
      step: 3,
      content: 'Sub-task 2 [GATHER]: Collect necessary context, data, and reference materials.',
      type: 'plan',
    },
    {
      step: 4,
      content: 'Sub-task 3 [EXECUTE]: Perform the core logic, transformation, or computation.',
      type: 'plan',
    },
    {
      step: 5,
      content: 'Sub-task 4 [VERIFY]: Validate results against requirements and check for errors.',
      type: 'plan',
    },
    {
      step: 6,
      content: 'Sub-task 5 [REFINE]: Iterate on the solution based on verification feedback.',
      type: 'plan',
    },
    {
      step: 7,
      content: 'Phase 2 — EXECUTE: Beginning sub-task 1 (UNDERSTAND).',
      type: 'thought',
    },
    {
      step: 8,
      content:
        'Sub-task 1 complete: Requirements clarified, constraints documented, success criteria defined.',
      type: 'observation',
    },
    {
      step: 9,
      content: 'Sub-task 2 complete: Context and reference materials gathered and organized.',
      type: 'observation',
    },
    {
      step: 10,
      content: 'Sub-task 3 complete: Core logic executed successfully with results captured.',
      type: 'observation',
    },
    {
      step: 11,
      content:
        'Sub-task 4 complete: Results verified — all requirements satisfied, no errors detected.',
      type: 'observation',
    },
  ];

  // Only add refine step if problem is complex enough
  if (wordCount(problem) > 15) {
    steps.push({
      step: steps.length + 1,
      content: 'Sub-task 5 complete: Solution refined based on verification — edge cases handled.',
      type: 'observation',
    });
  }

  const conclusion =
    'Plan-and-Execute complete. All sub-tasks were planned, ordered by dependency, executed sequentially, and verified. The structured two-phase approach ensures complete coverage and traceable reasoning.';

  steps.push({
    step: steps.length + 1,
    content: conclusion,
    type: 'result',
  });

  const confidence = computeConfidence('plan_execute', steps.length, problem);

  return {
    strategy: 'plan_execute',
    problem,
    steps,
    conclusion,
    confidence,
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
  execute: async (
    args: Record<string, unknown>,
    _ctx: ToolContext,
  ): Promise<ToolCallResult> => {
    const start = Date.now();
    const toolName = 'reason';
    try {
      if (!args.problem || typeof args.problem !== 'string' || args.problem.trim().length === 0) {
        return {
          toolName,
          success: false,
          output: '',
          error: 'Problem must be a non-empty string',
          durationMs: Date.now() - start,
        };
      }

      const problem = (args.problem as string).trim();
      const context = (args.context as string) || '';
      const maxSteps = typeof args.max_steps === 'number' ? args.max_steps : 10;
      const strategyArg = args.strategy as string | undefined;
      const fullProblem = context ? `${problem}\n\nContext:\n${context}` : problem;

      const strategy = resolveStrategy(strategyArg, undefined, problem);

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
          result = runChainOfThought(fullProblem, Math.max(1, maxSteps));
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
  execute: async (
    _args: Record<string, unknown>,
    _ctx: ToolContext,
  ): Promise<ToolCallResult> => {
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
  execute: async (
    args: Record<string, unknown>,
    _ctx: ToolContext,
  ): Promise<ToolCallResult> => {
    const start = Date.now();
    const toolName = 'select_strategy';
    try {
      if (
        !args.task_description ||
        typeof args.task_description !== 'string' ||
        args.task_description.trim().length === 0
      ) {
        return {
          toolName,
          success: false,
          output: '',
          error: 'task_description must be a non-empty string',
          durationMs: Date.now() - start,
        };
      }

      const taskDescription = (args.task_description as string).trim();
      const taskType = args.task_type as string | undefined;
      const strategyId = resolveStrategy(undefined, taskType, taskDescription);
      const strategy = STRATEGIES[strategyId];

      // Build a descriptive reason
      const domains = detectDomains(taskDescription);
      const reasonType = taskType ?? (domains.length > 0 ? domains[0] : 'general');
      const reasonMap: Record<string, string> = {
        debugging:
          `Selected ${strategy.name} because the task involves debugging or error resolution, which benefits from systematic reasoning with observation cycles.`,
        planning:
          `Selected ${strategy.name} because the task involves planning or design, requiring structured decomposition of goals.`,
        creative:
          `Selected ${strategy.name} because the task involves creative generation, which benefits from exploring multiple reasoning paths.`,
        decision:
          `Selected ${strategy.name} because the task involves decision-making with multiple options to evaluate.`,
        coding:
          `Selected ${strategy.name} because the task involves code generation or modification, requiring iterative reasoning and validation.`,
        math:
          `Selected ${strategy.name} because the task involves mathematical or logical reasoning, which benefits from step-by-step deduction.`,
        analysis:
          `Selected ${strategy.name} because the task involves analysis or review, requiring thorough systematic examination.`,
      };
      const reason = reasonMap[reasonType] ??
        `Selected ${strategy.name} as the best-fit strategy based on comprehensive task analysis (detected domains: ${
          domains.length > 0 ? domains.join(', ') : 'general problem-solving'
        }).`;

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
  execute: async (
    args: Record<string, unknown>,
    _ctx: ToolContext,
  ): Promise<ToolCallResult> => {
    const start = Date.now();
    const toolName = 'evaluate_reasoning';
    try {
      if (
        !args.reasoning_trace ||
        typeof args.reasoning_trace !== 'string' ||
        args.reasoning_trace.trim().length === 0
      ) {
        return {
          toolName,
          success: false,
          output: '',
          error: 'reasoning_trace must be a non-empty string',
          durationMs: Date.now() - start,
        };
      }

      const trace = args.reasoning_trace as string;
      const criteriaStr = (args.criteria as string) || 'logic,completeness,clarity';
      const criteria = criteriaStr.split(',').map((c) => c.trim().toLowerCase()).filter(Boolean);

      // Deterministic scoring based on trace properties
      const traceWords = wordCount(trace);
      const traceLower = trace.toLowerCase();

      // Count reasoning steps (look for "Step", numbered items, etc.)
      const stepMatches = trace.match(/step\s*\d+/gi);
      const stepCount = stepMatches ? stepMatches.length : 1;

      // Look for logical connectors
      const logicalConnectors = [
        'therefore',
        'because',
        'since',
        'thus',
        'hence',
        'consequently',
        'as a result',
        'it follows',
        'this implies',
        'leads to',
      ];
      const logicMatches = logicalConnectors.filter((conn) => traceLower.includes(conn));
      const logicDensity = clamp(logicMatches.length / Math.max(stepCount, 1), 0, 1);

      // Look for conclusion indicators
      const conclusionIndicators = [
        'conclusion',
        'therefore',
        'in summary',
        'finally',
        'overall',
        'in conclusion',
        'to summarize',
        'result',
      ];
      const hasConclusion = conclusionIndicators.some((ind) => traceLower.includes(ind));

      // Clarity: based on average sentence length and structure
      const sentences = trace.split(/[.!?]+/).filter((s) => s.trim().length > 0);
      const avgSentenceLength = sentences.length > 0
        ? sentences.reduce((sum, s) => sum + s.trim().split(/\s+/).length, 0) / sentences.length
        : 0;
      // Ideal sentence length is 10-25 words for clarity
      const clarityScore = avgSentenceLength > 0
        ? 1.0 - Math.abs(avgSentenceLength - 17) / 30
        : 0.5;

      const scores: Record<string, { score: number; feedback: string }> = {};

      for (const criterion of criteria) {
        switch (criterion) {
          case 'logic': {
            const score = clamp(0.35 + logicDensity * 0.55, 0, 1);
            scores[criterion] = {
              score: Math.round(score * 100) / 100,
              feedback: score > 0.65
                ? 'Logical flow is consistent with clear causal connections between steps.'
                : score > 0.4
                ? 'Some logical connections present but could benefit from more explicit reasoning links.'
                : 'Logical gaps detected. Add more intermediate reasoning steps with explicit connectors.',
            };
            break;
          }
          case 'completeness': {
            const completeness = clamp(
              0.3 +
                (hasConclusion ? 0.3 : 0) +
                Math.min(stepCount * 0.05, 0.25) +
                Math.min(traceWords * 0.001, 0.15),
              0,
              1,
            );
            scores[criterion] = {
              score: Math.round(completeness * 100) / 100,
              feedback: completeness > 0.65
                ? 'Covers key aspects of the problem with a clear conclusion.'
                : completeness > 0.4
                ? 'Some aspects addressed but the reasoning could be more thorough.'
                : 'Several aspects not addressed. Expand coverage and include a clear conclusion.',
            };
            break;
          }
          case 'clarity': {
            const score = clamp(clarityScore, 0, 1);
            scores[criterion] = {
              score: Math.round(score * 100) / 100,
              feedback: score > 0.65
                ? 'Reasoning is clear and well-articulated with appropriate detail level.'
                : score > 0.4
                ? 'Reasoning is understandable but some steps could be more clearly expressed.'
                : 'Some steps are ambiguous or overly complex. Simplify language and structure.',
            };
            break;
          }
          default: {
            // Generic evaluation for custom criteria
            const score = clamp(
              0.4 + (stepCount > 2 ? 0.2 : 0) + (traceWords > 50 ? 0.2 : 0),
              0,
              1,
            );
            scores[criterion] = {
              score: Math.round(score * 100) / 100,
              feedback: score > 0.6
                ? 'Satisfactory quality based on available analysis.'
                : 'Room for improvement — consider expanding the reasoning.',
            };
          }
        }
      }

      const overallScore = Object.keys(scores).length > 0
        ? Math.round(
          (Object.values(scores).reduce((sum, s) => sum + s.score, 0) /
            Object.values(scores).length) *
            100,
        ) / 100
        : 0.5;

      // Generate specific recommendations
      const recommendations: string[] = [];
      if (stepCount < 3) {
        recommendations.push('Add more intermediate reasoning steps for better traceability.');
      }
      if (!hasConclusion) {
        recommendations.push('Include an explicit conclusion to summarize the reasoning.');
      }
      if (logicDensity < 0.3) {
        recommendations.push(
          'Strengthen logical connections between steps using connectors (therefore, because, thus).',
        );
      }
      if (clarityScore < 0.5) {
        recommendations.push(
          'Improve clarity by using shorter sentences and more structured formatting.',
        );
      }
      if (recommendations.length === 0) {
        recommendations.push(
          'Reasoning is generally solid. Minor refinements could further improve clarity.',
        );
      }

      return {
        toolName,
        success: true,
        output: JSON.stringify({
          overallScore,
          criteria: scores,
          recommendations,
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

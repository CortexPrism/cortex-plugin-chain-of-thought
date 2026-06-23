/**
 * TypeScript type definitions for the Chain-of-Thought plugin.
 *
 * Re-exports from the CortexPrism plugin SDK, with local interfaces
 * for test compatibility when running without SDK type resolution.
 */

// ---------------------------------------------------------------------------
// Re-export SDK types when available
// ---------------------------------------------------------------------------

export type {
  HostApi,
  PluginConfigStore,
  PluginContext,
  PluginLogger,
  PluginStateStore,
  Tool,
  ToolCallResult,
} from 'cortex/plugins';

// ---------------------------------------------------------------------------
// Tool context (passed to tool.execute)
// ---------------------------------------------------------------------------

export interface ToolContext {
  /** Current agent session ID */
  sessionId: string;
  /** Current working directory */
  workingDir: string;
  /** Agent executing this tool */
  agentId: string;
  /** Agent workspace root */
  workspaceDir: string;
  /** Optional approval gate for guarded operations */
  approvalGate?: (tool: string, command: string) => Promise<boolean>;
}

// ---------------------------------------------------------------------------
// Strategy types
// ---------------------------------------------------------------------------

export type StrategyId = 'cot' | 'tot' | 'react' | 'plan_execute';

export interface StrategyInfo {
  id: StrategyId;
  name: string;
  description: string;
  bestFor: string[];
  steps: string;
}

export interface ReasonStep {
  step: number;
  content: string;
  type: 'thought' | 'action' | 'observation' | 'plan' | 'result';
}

export interface ReasonResult {
  strategy: StrategyId;
  problem: string;
  steps: ReasonStep[];
  conclusion: string;
  confidence: number;
}

export interface CoTConfig {
  defaultStrategy: string;
  maxTreeDepth: number;
  treeBreadth: number;
  reactMaxIterations: number;
}

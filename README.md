# CortexPrism Chain-of-Thought Agent Strategy

Pluggable reasoning strategies that Cortex agents can dynamically select per-task for smarter, more
structured problem-solving. Includes Chain-of-Thought, Tree-of-Thoughts, ReAct, and Plan-and-Execute
strategies.

## Installation

```bash
cortex plugin install cortex-plugin-chain-of-thought
```

Or install from local development:

```bash
git clone https://github.com/CortexPrism/cortex-plugin-chain-of-thought.git
cd cortex-plugin-chain-of-thought
cortex plugin install .
```

## Reasoning Strategies

| Strategy                   | Best For                     | Description                                                       |
| -------------------------- | ---------------------------- | ----------------------------------------------------------------- |
| **Chain-of-Thought (CoT)** | Math, Logic, Debugging       | Linear step-by-step reasoning through a problem                   |
| **Tree-of-Thoughts (ToT)** | Planning, Creative, Decision | Branching exploration of multiple reasoning paths with pruning    |
| **ReAct**                  | Coding, Debugging, Decision  | Interleaved reasoning and action with observation cycles          |
| **Plan-and-Execute**       | Planning, Coding, Analysis   | Two-phase: create detailed plan, then execute in dependency order |

## Configuration

| Setting              | Type   | Default | Description                                                                          |
| -------------------- | ------ | ------- | ------------------------------------------------------------------------------------ |
| `defaultStrategy`    | string | `auto`  | Default strategy when none specified (`cot`, `tot`, `react`, `plan_execute`, `auto`) |
| `maxTreeDepth`       | number | `5`     | Maximum depth for Tree-of-Thoughts branching                                         |
| `treeBreadth`        | number | `3`     | Number of branches per node in Tree-of-Thoughts                                      |
| `reactMaxIterations` | number | `15`    | Maximum thought-action-observation cycles for ReAct                                  |

## Tools

### `reason`

Execute a reasoning strategy on a given problem.

```json
{
  "problem": "How do I optimize this database query that's taking 5 seconds?",
  "strategy": "react",
  "context": "SELECT * FROM users JOIN orders ON ...",
  "max_steps": 10
}
```

### `list_strategies`

List all available reasoning strategies with descriptions and recommendations.

```json
{}
```

### `select_strategy`

Auto-select the best strategy for a task.

```json
{
  "task_description": "Debug a failing CI pipeline",
  "task_type": "debugging"
}
```

### `evaluate_reasoning`

Evaluate the quality of a reasoning trace for logical gaps and coherence.

```json
{
  "reasoning_trace": "Step 1: ... Step 2: ...",
  "criteria": "logic,completeness,clarity"
}
```

## Usage Example

```
> I need to solve a complex architecture decision

1. select_strategy → { task_type: "decision" }
→ Selected: Tree-of-Thoughts

2. reason → { strategy: "tot", problem: "Monolith vs Microservices for our app..." }
→ Explores 3 branches, prunes 2, identifies best path with 0.82 confidence
```

## How It Works

This plugin operates as a **middleware** layer in the Cortex agent loop:

1. **Pre-middleware**: Before each agent turn, the plugin can inject the selected strategy's system
   prompt
2. **Tool execution**: The `reason` tool simulates running the strategy (in production, this
   delegates to the LLM with strategy-specific prompting)
3. **Post-middleware**: After each agent turn, the plugin can evaluate reasoning quality and suggest
   strategy adjustments

## Development

```bash
deno task test
deno fmt && deno lint

# Test reasoning
cortex plugin call cortex-plugin-chain-of-thought reason '{"problem":"What is 2+2?","strategy":"cot"}'
```

## License

MIT

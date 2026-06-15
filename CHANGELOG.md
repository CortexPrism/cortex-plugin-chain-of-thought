# Changelog — Chain-of-Thought Agent Strategy

## [1.0.0] — 2026-06-15

### Added
- Initial plugin scaffold: pluggable reasoning strategies for Cortex agents
- **4 reasoning strategies**: Chain-of-Thought, Tree-of-Thoughts, ReAct, Plan-and-Execute
- **4 tools**: `reason`, `list_strategies`, `select_strategy`, `evaluate_reasoning`
- Strategy auto-selection based on task type (coding, debugging, planning, etc.)
- Reasoning quality evaluation with per-criterion scoring (logic, completeness, clarity)
- Tree-of-Thoughts: configurable max depth and branching breadth
- ReAct: configurable maximum thought-action-observation iterations
- **Middleware support**: `preMiddleware` and `postMiddleware` exports for agent loop integration

### Changed
- (v1.0.0-rc1) Refactored to use spec-compliant `ToolContext` in all execute functions
- (v1.0.0-rc1) Moved strategy config to `onLoad` lifecycle hook (closure pattern)
- (v1.0.0-rc1) Fixed manifest `ui.settings` with proper `select` type and `options` array

### Dependencies
- Cortex >=1.0.0
- Deno v2.0+ runtime
- No external API dependencies

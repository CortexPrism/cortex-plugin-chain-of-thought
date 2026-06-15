# Changelog — Chain-of-Thought Agent Strategy

## [1.0.1] — 2026-06-15

### Fixed
- Removed `middleware:pre` and `middleware:post` capabilities — not yet implemented in Cortex runtime
- Removed `preMiddleware` and `postMiddleware` exports from mod.ts
- All reasoning tools (`reason`, `list_strategies`, `select_strategy`, `evaluate_reasoning`) continue to work

## [1.0.0] — 2026-06-15

### Added
- Initial plugin scaffold with 4 reasoning strategies and 4 tools

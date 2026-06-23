# Changelog

## [1.0.6] — 2026-06-22

### Changed

- **Deterministic reasoning engines**: Replaced all `Math.random()` calls with deterministic logic
  based on input properties (word count, keyword detection, hash-derived scores)
- **Production-quality reasoning traces**: Chain-of-Thought now extracts key phrases and builds
  meaningful analysis steps; ReAct iterations scale with problem complexity; ToT generates real
  branch evaluations; Plan-and-Execute uses domain detection
- **Deterministic evaluation**: `evaluate_reasoning` now scores traces based on actual properties
  (step count, logical connectors, conclusion indicators, sentence clarity) instead of random values
- **Improved strategy selection**: Keyword detection now covers 7 domains (math, debugging,
  planning, coding, creative, decision, analysis) using regex patterns
- **Strict input validation**: All tools now reject whitespace-only strings and null values
- **Corrected tool signatures**: `tool.execute()` now uses `ToolContext` (not `PluginContext`) per
  the v0.51.0+ SDK specification
- **Created `types.ts`**: Local type definitions for `ToolContext`, strategy interfaces, and
  re-exports from `cortex/plugins` SDK

### Added

- 13 new unit tests (30 total, up from 17): determinism verification, whitespace rejection, null
  rejection, task_type-specific strategy selection, well-structured vs poor trace scoring,
  confidence consistency, cross-tool metadata assertions

### Fixed

- `package.json` version now matches `manifest.json` (1.0.5)
- `AI.md` disclosure now consistent with `manifest.json` `aiDisclosure` field

## [1.0.5] — 2026-06-22

### Changed

- Migrated to CortexPrism v0.51.0 plugin API
- Renamed `ToolResult` → `ToolCallResult` to match SDK types
- Switched type imports from local `types.ts` to `cortex/plugins` module
- Updated `peerDependencies.cortex` to `>=0.51.0`
- Standardized UI settings: `default` → `defaultValue`, `enum` → `options` for select fields
- All code passes `deno fmt` and `deno lint`

## [Unreleased]

### Changed

- Renamed manifest file from `cortex.json` to `manifest.json` for consistency with Cortex standard
- Standardized UI section structure to `ui.settings` format
- Normalized parameter naming: `defaultValue` → `default`, `options` → `enum`
- Added `homepage` field with repository URL
- Added `dependencies` field to manifest

### Removed

- Empty middleware stub comments (placeholders with no implementation)

## [1.0.3] — 2026-06-15

### Added

- Initial release

## [1.0.3] — 2026-06-17

### Fixed

- Replaced non-existent `cortex/plugins` import with local `types.ts` containing inline type
  definitions
- Removed broken `cortex/plugins` import map from `deno.json`
- Fixed test files with complete mock contexts (`state.delete`, `state.list`,
  `config.get/set/getAll`, `logger`, `host`)
- Rewrote scaffold test files to test actual plugin tools instead of template leftovers
- Added `defaultValue` and `default` fields to `ToolParam` type for compatibility

## [1.0.2] — 2026-06-16

### Fixed

- Replaced broken `cortex/plugins` import with inlined type definitions in `types.ts`
- Removed non-existent `cortex/plugins` import map from `deno.json`
- Changed `entryPoint` from `"./mod.ts"` to `"mod.ts"` to avoid loader rejection of `./` prefix
- Rewrote test suite to test actual exported tools (`reason`, `list_strategies`, `select_strategy`,
  `evaluate_reasoning`) instead of scaffold template leftovers
- All 17 tests now pass with complete mock contexts

## [1.0.1] — 2026-06-15

### Fixed

- Removed `middleware:pre` and `middleware:post` capabilities — not yet implemented in Cortex
  runtime
- Removed `preMiddleware` and `postMiddleware` exports from mod.ts
- All reasoning tools (`reason`, `list_strategies`, `select_strategy`, `evaluate_reasoning`)
  continue to work

## [1.0.0] — 2026-06-15

### Added

- Initial plugin scaffold with 4 reasoning strategies and 4 tools

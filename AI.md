# AI Disclosure

This file documents any AI-assisted development used in this plugin.

## Tools Used

- Claude Code (Anthropic) — initial scaffold and implementation
- Kilo (DeepSeek) — production hardening and deterministic refactor

## Scope

AI assistance was used in the following areas:

- `mod.ts` — Core reasoning engine logic, strategy registry, tool implementations
- `types.ts` — TypeScript type definitions and re-exports
- `README.md` — Documentation structure and usage examples
- `test/unit/mod.test.ts` — Test cases for all 4 tools with deterministic assertions
- `manifest.json` — Manual configuration reviewed and verified

## Review

All AI-generated code was reviewed by a human developer, tested thoroughly (30 unit tests), and
verified to work correctly before being committed to this repository.

## Certification

I certify that I understand the code being submitted and take full responsibility for its behavior
and security.

---

## Disclosure in manifest.json

The `manifest.json` file includes this disclosure:

```json
{
  "aiDisclosure": {
    "tools": ["Claude Code (Anthropic) — initial scaffold and implementation"],
    "humanReview": true
  }
}
```

---

## Why This Matters

- **Trust** — Users know what to expect from the code
- **Review** — Marketplace reviewers can assess AI-generated vs. human-written code
- **Security** — Extra scrutiny is paid to AI-generated code for vulnerabilities
- **Attribution** — Proper credit for the development process

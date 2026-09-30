# Mokly xtask

`xtask` owns repository-local verification for the Mokly workspace. It is an
internal binary and is not published to npm or crates.io.

## Responsibilities

- Run the current source-level TypeScript, package, example, and Rust suite.
- Fail verification when the live dependency audit reports an advisory or error.
- Enforce the Rust file-length limit.
- Ratchet JavaScript/TypeScript length, protocol caps, and internal exports
  against the branch point, and published-package exports against release tags.
- Keep the complete local gate aligned with the approved independent CI suites.

## What This Crate Does

The crate provides the implementation behind `cargo xtask check` and
`cargo xtask rust-file-length-lint`. The Node unit/integration suite runs at
most two test files concurrently; individual concurrency tests and their
existing timeouts remain unchanged. The complete check starts with
`npm run dependencies:check`, covering all workspace dependency categories. It
requires registry access; an audit or network failure stops subsequent checks.
Packed-consumer smokes separately audit the consumer's resolved production
dependencies without workspace overrides.

The [CI verification contract](../docs/protocol/ci-verification.md) defines the
suite boundaries, shard evidence, and fail-closed CI aggregate. Selected suites
are partial verification; the unqualified command remains the complete gate. The
[repository ratchet contract](../docs/protocol/verification-ratchets.md) owns
the exact scopes and exceptions. Length, protocol-cap, and
unused-internal-export analysis compare against
`git merge-base HEAD origin/main`; module analysis covers `.ts`, `.tsx`, `.mts`,
`.cts`, `.js`, `.mjs`, and `.cjs` under the three source roots, the
internal-export baseline rejects entries absent at that merge base, and protocol
caps scan `docs/protocol/**` recursively except `fixtures/`. The
public-package-export ratchet instead compares each released package with its
newest matching release tag reachable from `HEAD`. Full history and tags are
required; when a release manifest records a release but the tag is unavailable,
fetch them with `git fetch --tags origin` and retry. All four checks belong to
the repository suite and complete gate.

The sole current unused-export exception is the component renderer imported by
generated consumer-module source: `src/build/consumer_entry.ts` emits that
re-export as source text, so there is no static module edge for the analyser to
follow. Its exact entry lives in the shrink-only reviewed baseline. A comparison
commit that predates the baseline file permits that one-time bootstrap; after
the file lands, candidate entries must already exist at the merge base. Ordinary
CI runs functional suites on the minimum Node 22.14 runtime. Release Please pull
requests add Node 24; CI resolves the latest patch in its repository
prerequisite and explicitly shares that exact result with dependent jobs,
keeping shard evidence consistent across runner caches. The single release
publishing job independently resolves the latest Node 24.

Hydration coverage discovers a separate browser test for every example route, so
adding screens does not consume one shared test deadline. The unsharded
`hydration` suite runs those filename-selected specs separately from `browser`.
Tests using `changedFixture` register servers and workers with
`fixture.onCleanup` to drain them before removing their working tree.

## Quick Start

```bash
cargo xtask check
cargo xtask check --suite repository
cargo xtask check --suite package
cargo xtask check --suite unit --shard 1/4
cargo xtask check --suite browser --shard 1/4
cargo xtask check --suite hydration
cargo xtask rust-file-length-lint --all
```

`--shard INDEX/TOTAL` is valid only for the unit and browser suites. Omitting it
runs the full selected suite. Package, unit, browser, and hydration suites
prepare their required output before invoking prepared npm scripts.

## Development

Run the crate tests directly when changing command orchestration:

```bash
cargo test --package xtask
```

### Key Code

- [`src/cli.rs`](./src/cli.rs) parses and dispatches commands.
- [`src/command.rs`](./src/command.rs) defines the injected command-runner
  boundary.
- [`src/check.rs`](./src/check.rs) defines the complete source, packed-consumer,
  browser, hydration, and Rust verification sequence.
- [`../scripts/package/browser_graph_analysis.mjs`](../scripts/package/browser_graph_analysis.mjs)
  validates the delivered browser module graph;
  [`../scripts/package/consumer_cases`](../scripts/package/consumer_cases) owns
  the five clean packed-consumer scenarios.
- [`../scripts/verification/repository-ratchets.mjs`](../scripts/verification/repository-ratchets.mjs)
  dispatches the repository ratchets, and
  [`../scripts/verification/ratchets/git.mjs`](../scripts/verification/ratchets/git.mjs)
  owns their merge-base workspace and reachable release-tag views.
- [`../scripts/verification/ratchets/typescript-length.mjs`](../scripts/verification/ratchets/typescript-length.mjs),
  [`protocol-caps.mjs`](../scripts/verification/ratchets/protocol-caps.mjs),
  [`internal-exports.mjs`](../scripts/verification/ratchets/internal-exports.mjs),
  and
  [`public-exports.mjs`](../scripts/verification/ratchets/public-exports.mjs)
  own the four policies.
  [`package-exports.mjs`](../scripts/verification/ratchets/package-exports.mjs)
  maps package export targets to source for both export audits, while
  [`public-export-surface.mjs`](../scripts/verification/ratchets/public-export-surface.mjs)
  expands relative star re-exports with the shared module resolver;
  [`module-commonjs.mjs`](../scripts/verification/ratchets/module-commonjs.mjs)
  and
  [`module-imports.mjs`](../scripts/verification/ratchets/module-imports.mjs)
  supply CommonJS export and import-use discovery, and
  [`unused-internal-exports.txt`](./unused-internal-exports.txt) is the sorted
  shrinking exception baseline.

### Related Docs

- [Repository README](../README.md)
- [CI and npm release contract](../docs/protocol/npm-release.md)
- [CI verification](../docs/protocol/ci-verification.md)
- [Dependency security](../docs/protocol/dependency-security.md)

# Mokly xtask

`xtask` owns repository-local verification for the Mokly workspace. It is an
internal binary and is not published to npm or crates.io.

## Responsibilities

- Run the current source-level TypeScript, package, example, and Rust suite.
- Fail verification when the live dependency audit reports an advisory or error.
- Enforce the Rust file-length limit.
- Keep the complete local gate aligned with the approved independent CI suites.

## What This Crate Does

The crate provides the implementation behind `cargo xtask check` and
`cargo xtask rust-file-length-lint`.
The Node unit/integration suite runs at most two test files concurrently;
individual concurrency tests and their existing timeouts remain unchanged.
The complete check starts with `npm run dependencies:check`, covering all
workspace dependency categories. It requires registry access; an audit or network
failure stops subsequent checks. Packed-consumer smokes separately audit the
consumer's resolved production dependencies without workspace overrides.

The [CI verification contract](../docs/protocol/ci-verification.md) defines the
suite boundaries, shard evidence, and fail-closed CI aggregate. Selected suites
are partial verification; the unqualified command remains the complete gate.
Ordinary CI runs functional suites on the minimum Node 22.14 runtime. Release
Please pull requests add Node 24; CI resolves that version in its repository
prerequisite and shares the exact result with dependent jobs, keeping shard
evidence consistent across runner caches.

Hydration coverage discovers a separate browser test for every example route,
so adding screens does not consume one shared test deadline. Tests using
`changedFixture` register servers and workers with `fixture.onCleanup` to drain
them before removing their working tree.

## Quick Start

```bash
cargo xtask check
cargo xtask check --suite repository
cargo xtask check --suite package
cargo xtask check --suite unit --shard 1/4
cargo xtask check --suite browser --shard 1/4
cargo xtask rust-file-length-lint --all
```

`--shard INDEX/TOTAL` is valid only for the unit and browser suites. Omitting it
runs the full selected suite. Package, unit, and browser suites prepare their
required output before invoking prepared npm scripts.

## Development

Run the crate tests directly when changing command orchestration:

```bash
cargo test --package xtask
```

### Key Code

- `src/cli.rs` parses and dispatches commands.
- `src/command.rs` defines the injected command-runner boundary.
- `src/check.rs` defines the complete source, packed-consumer, browser, and Rust
  verification sequence.

### Related Docs

- [Repository README](../README.md)
- [CI and npm release contract](../docs/protocol/npm-release.md)
- [CI verification](../docs/protocol/ci-verification.md)
- [Dependency security](../docs/protocol/dependency-security.md)

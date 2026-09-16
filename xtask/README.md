# Mokly xtask

`xtask` owns repository-local verification for the Mokly workspace. It is an
internal binary and is not published to npm or crates.io.

## Responsibilities

- Run the current source-level TypeScript, package, example, site, and Rust suite.
- Fail verification when the live dependency audit reports an advisory or error.
- Enforce the Rust file-length limit.

## What This Crate Does

The crate provides the implementation behind `cargo xtask check` and
`cargo xtask rust-file-length-lint`.
The Node unit/integration suite runs at most two test files concurrently;
individual concurrency tests and their existing timeouts remain unchanged.
The complete check starts with `npm run dependencies:check`, covering all
workspace dependency categories. It requires registry access; an audit or network
failure stops subsequent checks. Packed-consumer smokes separately audit the
consumer's resolved production dependencies without workspace overrides.
After `package:smoke`, `npm run site:check` builds and typechecks the public
site, runs its unit tests and link checker, then exercises the built pages in
Playwright. The catalogue's `test:browser` runs next on its separate port.

## Quick Start

```bash
cargo xtask check
cargo xtask rust-file-length-lint --all
```

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
- [Dependency security](../docs/protocol/dependency-security.md)

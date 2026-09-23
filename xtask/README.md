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
individual concurrency tests retain their existing timeouts. The real preview
build browser test has a 240-second deadline after its prior 180-second budget
proved too tight under four-worker CPU contention; its real build and assertions
remain mandatory.
The complete check starts with `npm run dependencies:check`, covering all
workspace dependency categories. It requires registry access; an audit or network
failure stops subsequent checks. Packed-consumer smokes separately audit the
consumer's resolved production dependencies without workspace overrides.

The [CI verification contract](../docs/protocol/ci-verification.md) defines the
suite boundaries, shard evidence, and fail-closed CI aggregate. Selected suites
are partial verification; the unqualified command remains the complete gate.
Its [local verification contract](../docs/protocol/local-verification.md)
requires the current staged, unstaged, and non-ignored untracked sources in each
isolated worker, checks for source drift, and validates all eight shard reports.
After the live audit, the local runner starts at most four repository, package,
unit, and browser workers at once. Each worker owns its generated output and
reports; browser workers receive independent ports. It links installed external
dependencies without pointing the viewer workspace back at the live checkout.
Longer measured shards start early; every verifier subprocess registers its
process group, including Playwright's web server, so cancellation can drain it
before its snapshot is removed.
The ignored `.context/verification-reports/local-check-*/` directories contain
per-invocation timing and inventory evidence. A preflight isolation failure
announces an unsharded sequential fallback; failed workers never silently fall
back or report complete success.
CI resolves Node 24 in its repository prerequisite and shares that exact version
with dependent jobs, keeping shard evidence consistent across runner caches.

Hydration coverage discovers a separate browser test for every example route
across four independently discovered spec files,
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
The public `npm test` and `npm run test:browser` commands remain unsharded;
CI keeps both Node runtimes and its existing shard identities.

## Development

Run the crate tests directly when changing command orchestration:

```bash
cargo test --package xtask
```

### Key Code

- `src/cli.rs` parses and dispatches commands.
- `src/command.rs` defines the injected command-runner boundary.
- `src/check.rs` defines the complete source, packed-consumer, browser, and Rust
  verification sequence; `scripts/verification/local-check.mjs` orchestrates
  isolated local fan-out using the shared shard validators.

### Related Docs

- [Repository README](../README.md)
- [CI and npm release contract](../docs/protocol/npm-release.md)
- [CI verification](../docs/protocol/ci-verification.md)
- [Complete local verification](../docs/protocol/local-verification.md)
- [Dependency security](../docs/protocol/dependency-security.md)

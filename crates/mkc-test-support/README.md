# mkc-test-support

`mkc-test-support` provides pure fixture builders shared by Mokly Cloud tests.
Use it as a dev-dependency when tests need deterministic input data.

## Responsibilities

- Build predictable fixtures without filesystem, clock, or network access.
- Keep shared test inputs separate from application dependencies.

## What This Crate Does

`text::numbered_lines` creates a requested number of newline-terminated,
nonempty lines. The Cargo workspace line-limit tests use it to exercise the exact
300-line boundary, including files that exceed it.

This crate contains no application data or production behavior. Runtime trait
boundaries are mocked with unimock in the crate that owns the behavior;
integration fixtures with real IO live beside their integration tests.

## Quick Start

Add `mkc-test-support = { workspace = true }` under `[dev-dependencies]`:

```rust
use mkc_test_support::text::numbered_lines;

let oversized = numbered_lines(301);
assert_eq!(oversized.lines().count(), 301);
```

## Development

```sh
cargo test -p mkc-test-support
cargo clippy -p mkc-test-support --all-targets -- -D warnings
```

### Key Code

- [text.rs](./src/text.rs) — `numbered_lines`, which produces exactly the requested number of newline-terminated nonempty lines; the `xtask` file-length checks use it for the 300-line boundary.
- [text_tests.rs](./src/_tests_/text_tests.rs) — the boundary test for zero, one, 300 and 301 lines.

### Related Docs

- [Repository layout](../../docs/protocol/cloud/repository-layout.md)
- [xtask guide](../../xtask/README.md) — the checks that consume these fixtures.
- [Repository get started guide](../../docs/development/cloud.md)
- [Architecture](../../docs/architecture/cloud.md) — the components, their boundaries, and the data flows this crate takes part in.

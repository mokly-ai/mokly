# mokly-test-support

`mokly-test-support` holds the fixtures that the Rust integration tests of the
Mokly workspace share. It is a development-only crate: test targets depend on
it, and no product crate does. Use it when a test drives the native `mokly`
binary end to end, or needs the fake HTTP server or the fake Mokly Cloud
receiver.

## Responsibilities

- Run the `mokly` binary with the package root and the viewer bundle of the
  checkout, capture both output streams, and send signals.
- Create committed publication fixtures and Git repositories.
- Serve loopback HTTP with recorded requests, one connection at a time or
  concurrently.
- Act as a fake receiver of the upload exchange v1, with retries, re-plans,
  held requests, and a check before each Complete.
- Read upload files with an independent copy of the receiver's rules:
  upload metadata v2, ownership v3, and the complete inventory.
- Read `--debug-timings` records, and recompute the comparison generation and
  the deployment identity of an output.
- Copy the example catalogue, with the documents that its entries link, into a
  temporary directory.

## What This Crate Does

`process::Mokly` builds invocations of one binary. A child inherits the test
environment without its `MOKLY_` variables, then gets the package root, the
viewer bundle, and the output mode. `XDG_CACHE_HOME`, `HOME`, and
`LOCALAPPDATA` point to one temporary cache folder per test thread, which all
runs of the test share and which is removed when the test ends. A test can set
its own value on the invocation. Threads capture both streams while the
child runs, so that a receiver can wait for the private build directory that
`mokly publish` reports. A hang guard stops a child that never exits. A child
that leads its own process group is stopped with its whole group, because a
process in the group keeps the captured streams open.

`receiver::Exchange` answers Plan, Blob, and Complete on a concurrent
`server::Server`. A handler failure answers 500 and fails `Exchange::close`.
The `inventory` and `upload` readers apply the receiver's rules without the
product's own readers, so a defect in the product cannot hide behind them.

## Quick Start

```rust
use mokly_test_support::process::Mokly;
use mokly_test_support::publication::{self, Outputs};
use mokly_test_support::receiver::{Exchange, Options};

let root = publication::fixture(false, "sha1");
let receiver = Exchange::start(Options::default());
let mokly = Mokly::new(env!("CARGO_BIN_EXE_mokly"));
let running = publication::publish(&mokly, root.path(), &receiver.endpoint, "plain", &[]).spawn();
receiver.observe(running.build_directory());
let result = running.wait();
let mut outputs = Outputs::default();
outputs.push(publication::directory(&result.stdout));
assert_eq!(result.code, Some(0), "{}", result.stderr);
receiver.close();
```

## Development

```bash
cargo test -p mokly-test-support
cargo clippy -p mokly-test-support --all-targets -- -D warnings
```

Tests that run the binary with JavaScript entries need the built viewer and
`@mokly/mokly` packages: run `npm run build` first.

### Key Code

- [Binary invocations](./src/process/mod.rs): `Mokly`, `Running`, and `Finished`.
- [Publication fixtures](./src/publication.rs) and [Git helpers](./src/git.rs).
- [Loopback server](./src/server.rs) and the
  [fake receiver](./src/receiver/exchange.rs).
- [Upload metadata](./src/upload.rs) and [ownership](./src/inventory.rs) readers.
- [Timing records](./src/timings.rs) and [output identities](./src/identity.rs).
- [Example copy](./src/example.rs): the example catalogue in a temporary
  directory that a test can build or change.

### Related Docs

- [CI test timing](../../docs/protocol/ci-test-timing.md)
- [CLI tests](../mokly-cli/tests/README.md)

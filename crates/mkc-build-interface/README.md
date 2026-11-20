# mkc-build-interface

Contracts for one cloud build attempt. Depend on this crate when a worker runs
a build or stores its redacted output. It owns no database or sandbox adapter.

## Responsibilities

- Define `BuildRunner`, `BuildLogSink`, and their unimock APIs.
- Keep request arguments typed and credentials out of diagnostics.
- Define steps, output streams, budgets, and the complete outcome set.

## What This Crate Does

`BuildRunner::run` accepts one `BuildRequest` and an `Arc<dyn BuildLogSink>`.
It returns a boxed future that callers await and can drop to stop execution.
The sink receives each step start before its first process. Chunks carry the
attempt operation ID, step, stream, and at most 64 KiB of redacted bytes.
A failed sink ends the attempt as infrastructure failure.

`Repository`, `HeadSha`, `Branch`, `ConfigPath`, and `UploadEndpoint` validate
arguments before use. `ConfigPath` requires a repository-relative path that
ends in `.json`, such as `mokly.config.json`. It refuses `.ts` paths and
leading option prefixes. The endpoint identifies one project's upload exchange.
`Secret` has no serialization and prints `[redacted]` in `Debug`.
`BuildRequest` diagnostics show only identity, deadline, and redacted tokens.

`mkc-build-sandbox` implements this interface. The publication worker owns
retry, persistence, and publication state policy. `Completed` means the
processes succeeded; the caller must still confirm the upload committed.

`BuildOutcome::StepFailed.cli_error` is an optional `cli_code::MoklyCliCode`.
The sandbox parses the last plain publish error at its boundary. The typed
codes are `UploadFailed`, `GitUncommitted` and `Unrecognized`.
The publication worker owns their failure and retry policy.

## Quick Start

```sh
cargo check -p mkc-build-interface
cargo test -p mkc-build-interface
```

Construct the typed request inputs with their `new` methods. Wrap each token
in `secret::Secret`. Supply the request and your sink to a `dyn BuildRunner`.

## Development

Tests validate argument safety, endpoint ownership, and secret diagnostics.
Both traits expose unimock APIs for callers' unit tests.

### Key Code

- [Runner](./src/runner.rs) and [log sink](./src/log.rs).
- [Request](./src/request.rs), [typed inputs](./src/input.rs), and [secret](./src/secret.rs).
- [Outcomes](./src/outcome.rs), [CLI codes](./src/cli_code.rs) and [errors](./src/error.rs).

### Related Docs

- [Cloud build runner](../../docs/protocol/cloud/cloud-build-runner.md).
- [Cloud build lifecycle](../../docs/protocol/cloud/cloud-builds.md).
- [Repository layout](../../docs/protocol/cloud/repository-layout.md).

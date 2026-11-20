# mkc-build-sandbox

Run one cloud build through the provider-neutral sandbox interface. Depend on
this crate at the composition root to construct a `dyn BuildRunner`.

## Responsibilities

- Create or recover one bounded sandbox and destroy it after the attempt.
- Check out the exact head, install tracked dependencies, and run the public CLI.
- Stream redacted output without waiting for the log sink on the reading task.

## What This Crate Does

`SandboxBuildRunner` implements `mkc-build-interface::runner::BuildRunner`.
It accepts `Arc<dyn SandboxBackend>` and `Arc<dyn BuildClock>`. It selects the
`build` profile with public egress and a one-shot lifetime. The caller uses
`policy::denied_destinations` to configure that profile before constructing
the runner. The helper adds ranges the pinned adapter omits, including IPv6
multicast, and canonicalizes at most 32 extra IP or CIDR rules.

Every process uses direct argv, a working directory, and an environment map.
Command display quotes only empty values or values with characters outside
`A-Za-z0-9@%+=:,./_-`, and escapes apostrophes inside single quotes.
Git reads its installation token from a workload-owned 0600 file. Only
publish receives the upload token. The runner follows the contract's fetch
ladder and lockfile order. An installed CLI must report a SemVer at or above
`MIN_MOKLY_VERSION` (0.18.0). Without a local CLI it runs the newest npm release,
`@mokly/mokly@latest`, through `npm exec`. The receiver accepts upload envelope
3, ownership marker 3 and catalogue index 9.
The runner creates no worktree files before install. Its credential file stays
under `/home/user`. The configuration path ends in `.json`, such as
`mokly.config.json`. The CLI builds in a private directory outside the
worktree. The consumer must ignore install and build output.
Dirty files fail publish with `git-uncommitted`.

Each stream has a 64 MiB cap. Redaction retains possible split-token prefixes.
Chunks end at newlines or the 64 KiB limit. A limit cut moves back at most
three bytes for a valid UTF-8 prefix that can be completed. Invalid bytes
stay unchanged, each cut makes progress, and finished streams drain in full.
The one-second timer also emits line-free output below the size limit. A
timer cut keeps an incomplete UTF-8 prefix for the next event.
The last plain stderr code becomes a typed `MoklyCliCode`; unknown codes
become `Unrecognized`. A separate
task delivers chunks. Sink failure or stalled delivery ends the run as
infrastructure failure. Provider and sink error text is excluded from the
outcome's source chain, since it may contain credentials.

The runner requires a Tokio runtime with time enabled. `BuildRunner::run` returns a boxed future; calling `.run(...).await` executes
it. Dropping the run drops
its stream and starts bounded cleanup on that runtime. A dropped create uses
recovery only. Runtime shutdown can prevent cleanup; the provider lifetime is
the final bound. The crate owns no database, HTTP handler, scheduler, or E2B client.
Failed or timed-out destruction preserves the build outcome. The warning
contains only the build ID, attempt operation ID and safe failure fact.
Reconciliation and the one-shot lifetime remove the sandbox.

## Quick Start

```rust
use std::sync::Arc;
use mkc_build_interface::runner::BuildRunner;
use mkc_build_sandbox::clock::{BuildClock, SystemBuildClock};
use mkc_build_sandbox::runner::SandboxBuildRunner;
use sandbox_interface::SandboxBackend;

fn runner(backend: Arc<dyn SandboxBackend>)
    -> mkc_build_interface::error::Result<Arc<dyn BuildRunner>>
{
    let clock: Arc<dyn BuildClock> = Arc::new(SystemBuildClock);
    Ok(Arc::new(SandboxBuildRunner::new(
        backend, clock, "production-builds".into(),
    )?))
}
```

Supply the backend's `build` profile and the log sink, then call
`run(request, sink).await`. `mkc-api` owns E2B composition.

## Development

```sh
cargo test -p mkc-build-sandbox
cargo check -p mkc-build-sandbox
cargo xtask toolchain-pins
```

Tests use `SandboxBackendMock`, `BuildClockMock`, and `BuildLogSinkMock`.
They cover exact requests, failure classes, output bounds, and cancellation.
They make no E2B requests. The live template proof belongs to the
[build template runbook](../../docs/ops/build-template.md).

### Key Code

The [Cargo workspace manifest](../../Cargo.toml) pins `sandbox-interface` and
`sandbox-e2b` from the public [sandbox repository](https://github.com/futex-ai/sandbox)
to revision `86d82340715ed443b596565f3509ced58c299fc2`.
That revision carries `cwd` and `envs` on streaming process requests.
`mkc-build-sandbox` uses the interface for execution; `mkc-publications` uses
it for reconciliation. Only `mkc-api` depends on `sandbox-e2b` and constructs
its backend.

- [Runner](./src/runner.rs) and [cleanup](./src/cleanup.rs).
- [Checkout](./src/checkout.rs), [install](./src/install.rs), and [publish](./src/publish.rs).
- [Process driver](./src/process.rs), [stream reader](./src/output.rs), and [redaction](./src/redact.rs).
- [Chunk cutter and CLI parser](./src/buffer.rs).
- [Build deny rules](./src/policy.rs) and [CLI versions](./src/versions.rs).
- [Runner tests](./src/_tests_/runner/).

### Related Docs

- [Cloud build runner](../../docs/protocol/cloud/cloud-build-runner.md).
- [Upload exchange](../../docs/protocol/cloud/publication-upload-exchange.md).

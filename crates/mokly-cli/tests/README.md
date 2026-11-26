# CLI tests

The `mokly-cli` tests cover native commands, comparison, and process recovery.
Run commands from the repository root.

Changes integration tests isolate cache directories for each child process.
They check exact entry names through the native build composition, including
HTML, React, and stylesheet edits.
The design attribution matrix copies the example sources, with the `@mokly/ui`
sources that the design library imports by repository path, into temporary Git
fixtures with fully registered base and head commits. It pins stylesheet links,
rule and resource records, changed entries, and affected consumers. Independent
head edits reuse the pinned base generation. Four distinct CSS delivery rules
share one registered base and one head. Excluded, unresolved, and matched
shared rules use separate selectors in one head, with exact per-rule evidence.
The matrix runs with the `design-matrix` feature. A separate optional workflow
runs it nightly and on manual dispatch. The default workspace tests and required
verification gate exclude this target. Its runner and hang guards follow the
[CI workflow contract](../../../docs/protocol/ci-workflow.md#design-attribution-matrix).

The design behaviour target checks parents' own-props views and the stacked
frames of the Canvas comparisons in the default workspace suite. It renders an
isolated copy of the example catalogue and of those `@mokly/ui` sources.
Set `MOKLY_TEST_DESIGN_MUTATION` to inject one defect into that copy. Each
value must fail its corresponding behaviour check:

| Value        | Injected defect                                    |
| ------------ | -------------------------------------------------- |
| `own-props`  | Replace a parent's own destination prop.           |
| `stack`      | Mark the Current layer as a Before layer.          |
| `stack-swap` | Swap Before and Current content in stacked frames. |

The Serve terminal regression in
[`serve_terminal_tests.rs`](./serve_terminal_tests.rs) is a Rust process test.
It runs rich watched Serve with a pseudo-terminal as stdin. It waits until
Serve answers the `h` shortcut and reads all queued input. It then closes the
terminal and checks that Serve still answers HTTP. Next, it sends `SIGHUP` and
checks that Serve exits 0 and frees its port.

The test runs only on Unix. It starts the crate's `mokly` binary directly, not
through the npm shim. Its timeouts only guard against a hang. Set
`MOKLY_TEST_TERMINAL_BINARY` to a binary path to run the same test against
another build. Unit tests in
[`serve_controls_tests.rs`](../src/_tests_/serve_controls_tests.rs) check on
every platform that closed or failed input ends the key reader and does not
stop Serve.

Each process test that starts Serve gives its child a temporary home through
`Cache` in [`process_support/cache.rs`](./process_support/cache.rs). It sets
`HOME`, `XDG_CACHE_HOME`, and `LOCALAPPDATA` on the child command only, outside
the fixture repository. So the render store and the other Mokly caches stay out
of the host cache and out of the watched catalogue on macOS, Linux, and
Windows. The test keeps that owner alive until the child stops. These tests
keep their exact output checks: a Serve start that fails before it listens
writes no stdout, and the listening line is the first line that they parse.
[`process_support/html.rs`](./process_support/html.rs) holds the shared HTML
fixture writes and the complete native-process shutdown.

A test that publishes only to reach the upload step uses
`rejecting_endpoint()` in [`publish_support`](./publish_support/mod.rs). Its
loopback receiver answers each request with 404, which is not retryable, so the
publish fails at once with `upload-failed` and spends no retries or backoff.

A test whose cases start independent `mokly` processes runs them through
`each()` in [`process_support/parallel.rs`](./process_support/parallel.rs).
It runs at most one case for each available core at a time, on a thread named
after the case. A failed case does not stop the other cases, and the test then
fails with the names of the failed cases. Each case builds its own fixture.
Parallel cases never share a Git checkout, because Git can rewrite
`.git/index` during a read such as `git status`.

Some `mokly-cli` Rust tests use debug-only hooks, such as the allocator probe
and `MOKLY_TEST_STATIC_COLUMNS`, so they need the dev profile and fail under
`cargo test --release`.

The hanging-render test of
[`changes_javascript_tests.rs`](./changes_javascript_tests.rs) sets
`MOKLY_TEST_SIDECAR_RENDER_TIMEOUT_MS` to 1,000 ms. A debug binary passes it
to `Pool::with_test_render_deadline`, which replaces the deadline of render
calls only. The test also sets `MOKLY_SIDECAR_TIMEOUT_MS` to 10,000 ms, so the
sidecar start and the bundle calls keep a 10-second deadline. Release builds
compile no read of the variable.

```bash
cargo test -p mokly-cli
cargo test -p mokly-cli --features design-matrix --test design_attribution_tests
cargo test -p mokly-cli --test design_behaviour_tests
cargo test -p mokly-cli --test serve_terminal_tests
cargo test -p mokly-cli --test allocator_tests
cargo clippy -p mokly-cli --all-targets -- -D warnings
```

[Static build recovery](../../../docs/protocol/mokly-export-recovery.md) tests
are Node tests under the repository `tests/` folder.
They start the debug binary through
[`tests/helpers/static_publication.ts`](../../../tests/helpers/static_publication.ts)
and set faults through
[`tests/helpers/static_faults.ts`](../../../tests/helpers/static_faults.ts):

- [`static_recovery_process.test.ts`](../../../tests/static_recovery_process.test.ts)
  injects filesystem failures.
- [`static_recovery_signals.test.ts`](../../../tests/static_recovery_signals.test.ts)
  sends `SIGINT` at signal gates.
- [`static_recovery_paths.test.ts`](../../../tests/static_recovery_paths.test.ts)
  checks the printed recovery paths.
- [`static_signal_readiness.test.ts`](../../../tests/static_signal_readiness.test.ts)
  checks the readiness markers and the abort regression.
- [`static_fault_seam.test.ts`](../../../tests/static_fault_seam.test.ts) holds
  the compiler probe and the signal-session probe.

```bash
npm test -- tests/static_recovery_signals.test.ts
```

These tests use the [debug fault adapters](../src/test_faults/mod.rs).
`MOKLY_TEST_STATIC_FAULTS` selects injected filesystem failures or signal gates.

The `allocator` value of `MOKLY_TEST_STATIC_FAULTS` runs the allocator probe of
[`allocator_probe.rs`](../src/test_faults/allocator_probe.rs) instead of the
command. The probe prints `allocator-purge-delay` and the purge delay that
mimalloc reports at startup. It then calls `MimallocPurgeDelay`, the
implementation that Serve calls after its first ready Changes. It prints
`allocator-purge-delay-after-changes` and the delay after that call, and the
binary exits. The Rust test `allocator_tests.rs` checks both lines with and
without `MIMALLOC_PURGE_DELAY`. A unit test in
[`serve_changes_tests.rs`](../src/_tests_/serve_changes_tests.rs) checks that
only a ready Changes result calls `PurgeDelay`.

The optional `MOKLY_TEST_STATIC_READY`, `MOKLY_TEST_STATIC_EVENTS`,
`MOKLY_TEST_STATIC_PREVIOUS`, and `MOKLY_TEST_STATIC_COLUMNS` values provide
isolated test paths and terminal width. Release builds compile none of these
adapters or hooks. The compiler probe checks only that the fault module erases
itself without debug assertions and cannot be referenced in that mode. It does
not inspect a packed release binary. The signal-session probe creates and drops
both build and publish signal handlers. Normal source and output operations
still use their injected trait boundaries.
Asset recovery tests set the terminal width from the temporary path length.
This keeps the asserted filename visible when the host uses a long temporary root.
Each recovery signal case owns one fault, fixture, and hang guard. It waits for
the complete readiness marker before sending SIGINT. Test cancellation closes
the watcher, kills the fixture's process group, waits for the inherited output
pipes to close, and removes its output. On Unix the abort regression waits for
the complete native gate marker before cancellation, so the shim has started
the held native process. The regression combines local cancellation with the
test signal and closes the marker watcher before fixture removal. Windows
retains the immediate-abort check and uses `taskkill /T /F` for cleanup.

# CLI tests

The `mokly-cli` tests cover native commands, comparison, and process recovery.
Run commands from the repository root.

The end-to-end behaviour of the `mokly` binary is tested here, in Rust. Node
tests under `tests/` cover TypeScript code and Node tooling only. Each
end-to-end area has one test binary with a module folder, and uses the shared
fixtures of [`mokly-test-support`](../../mokly-test-support/README.md):

| Binary                 | Area                                                                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------ |
| `publication_tests`    | Publish against the fake receiver: retries, re-plans, deltas, cancellation, cleanup.             |
| `changes_output_tests` | Changes classification, comparison contents, evidence, timings, and Serve parity.                |
| `recovery_tests`       | Install and rollback failures, signals, cancellation, input boundaries, and static resources.    |
| `base_tiers_tests`     | Base dependency tiers with real package managers, a local registry, mirrors, and secrets (Unix). |

Tests that render JavaScript entries need the built viewer and `@mokly/mokly`
packages: run `npm run build` before a raw `cargo test`.

Changes integration tests isolate cache directories for each child process.
They check exact entry names through the native build composition, including
HTML, React, and stylesheet edits.
The design attribution matrix copies the example sources into temporary Git
fixtures with fully registered base and head commits. It pins stylesheet links,
rule and resource records, changed entries, and affected consumers. Independent
head edits reuse the pinned base generation. Four distinct CSS delivery rules
share one registered base and one head. Excluded, unresolved, and matched
shared rules use separate selectors in one head, with exact per-rule evidence.
The matrix runs with the `design-matrix` feature. A separate optional workflow
runs it nightly and on manual dispatch. The default workspace tests and required
verification gate exclude this target. Its runner and hang guards follow the
[CI workflow contract](../../../docs/protocol/ci-workflow.md#design-attribution-matrix).

The design behaviour target checks parents' own-props views, stacked frames,
captions tied to recorded changes, and the Checklist's Changes in the default
workspace suite. It renders an isolated copy of the example catalogue.
Set `MOKLY_TEST_DESIGN_MUTATION` to inject one defect into that copy. Each
value must fail its corresponding behaviour check:

| Value            | Injected defect                                      |
| ---------------- | ---------------------------------------------------- |
| `own-props`      | Replace a parent's own destination prop.             |
| `stack`          | Remove the Current layer's class marker.             |
| `caption`        | Replace a comparison caption with incorrect text.    |
| `checklist`      | Replace the Checklist's Changes with Action's story. |
| `stack-swap`     | Swap Before and Current content in stacked previews. |
| `caption-record` | Change a recorded reason without changing a caption. |

```bash
cargo test -p mokly-cli
cargo test -p mokly-cli --features design-matrix --test design_attribution_tests
cargo test -p mokly-cli --test design_behaviour_tests
cargo clippy -p mokly-cli --all-targets -- -D warnings
```

Process recovery tests use the [debug fault adapters](../src/test_faults/mod.rs).
`MOKLY_TEST_STATIC_FAULTS` selects injected filesystem failures or signal gates.
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
Each recovery signal case in `recovery_tests` owns one fault and one fixture.
It waits until the readiness marker holds the fault's gate name before it sends
SIGINT, and fails when the child exits first. A child that a failed test leaves
behind is killed and reaped when its runner drops. Signal cases run on Unix
only.

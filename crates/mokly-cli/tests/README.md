# CLI tests

The `mokly-cli` tests cover native commands, comparison, and process recovery.
Run commands from the repository root.

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
Each recovery signal case owns one fault, fixture, and hang guard. It waits for
the complete readiness marker before sending SIGINT. Test cancellation closes
the watcher, kills the fixture's process group, waits for the inherited output
pipes to close, and removes its output. On Unix the abort regression waits for
the complete native gate marker before cancellation, so the shim has started
the held native process. The regression combines local cancellation with the
test signal and closes the marker watcher before fixture removal. Windows
retains the immediate-abort check and uses `taskkill /T /F` for cleanup.

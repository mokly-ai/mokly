# Large-Fixture Benchmark Contract

## Delivery Status

Template identity, stable values, the four-scenario matrix, filtering,
restoration and report provenance are implemented. The user deferred performance
acceptance on 2026-10-06 under Decision 13 of the
[scalable analysis plan](../../../plans/scalable-inline-style-analysis.md#decisions).
That plan no longer runs acceptance. The procedure below stays available for a
later plan, which must fit limits to fresh same-session reference and candidate
measurements on one machine, in alternating order. The stored M2 reference is
not reusable because main changed digest-covered path-identity templates.
Timing fields and their delivery are owned by
[timings](../../../docs/protocol/mokly-timings.md); setup, dimensions, cache
behavior and historical results are described in the [fixture README](./README.md).

## Template Identity And Stable Values

Preparation records `templateDigest`, `moklyCommit`, `moklyDirty` and the isolated
`fixtureCommit`. `templateDigest` is lowercase hex SHA-256 over every regular
file recursively under `tests/fixtures/large/`, including hidden files and this
contract, except the root `README.md`. Sort POSIX relative paths by unsigned
UTF-8 byte order. For each file hash, in order: a four-byte big-endian path-byte
length, its UTF-8 path bytes, an eight-byte big-endian content-byte length, and
the exact file bytes. No timestamps, modes or platform separators participate;
reject symlinks rather than hash external content. Length framing makes the
concatenation unambiguous. Both renderer modes use the same whole-tree digest.
The fixture owns `theme.ts`; generation reads no repository file outside this
template tree. The example theme is not a rendering input.

Setup writes an authoritative `.mokly-large-fixture.json` beside the generated
`mokly.config.ts` in the isolated fixture root, after creating its Git baseline.
The fixture ignores this record in Git, so it is not a scenario edit or generated
output. It contains `schemaVersion: 1`, all four identity fields, and the fixture's
`areas`, `screens`, `rows`, `stylesheets`, `stylesheetShare`, `inlineStyles` and
`trackedOutput`, plus `renderingDependencies`. The size-keyed record in this checkout's `.context/` remains
a lookup index; neither it nor `--config` may bypass the root identity record.

`moklyCommit` is this checkout's HEAD; `moklyDirty` reports tracked/untracked
non-ignored changes from `git status --porcelain`, not the isolated fixture's
intentional edits. `fixtureCommit` is the isolated baseline commit. Every
setup, sample and matrix report carries all **four** identity fields:
`templateDigest`, `moklyCommit`, `moklyDirty`, `fixtureCommit`. A benchmark uses
current Mokly identity and additionally preserves the preparation record's
`moklyCommit`/`moklyDirty` as `preparedMoklyCommit`/`preparedMoklyDirty`. Code may
evolve while a fixture is reused; derived baselines keep the prepared toolchain
as described in the README.

Every setup, sample and matrix report also carries `renderingDependencies`,
an object keyed by `react`, `react-dom`, `react-native-web`, `@firna/ui`,
`lightningcss`, `parse5`, `css-select`, `css-what`, with their resolved installed
version strings, not ranges. Setup always installs the fixture's own toolchain.
Rendering packages resolve from that fixture-root install;
classification packages resolve from the current Mokly checkout. Preserve the
setup map as `preparedRenderingDependencies` on reused matrix reports. Compare
maps by exact name/version membership, not property order, during acceptance.

`preparedFixture`, including `--config` reuse, loads the root record, recomputes
the digest and rejects a missing record or missing/mismatched `templateDigest`
**before starting Serve or editing a scenario**. It names
`npm run fixture:large --` followed by valid recorded areas, screens, rows
or the requested dimensions when the record is malformed,
stylesheet count/share and applicable `--inline-styles`/`--tracked-output` flags.
It does not silently regenerate or compare measurements from old templates.
Only README reporting edits are excluded from the digest; other template-tree
edits require preparation again. A changed Mokly commit or dirty flag alone
is not a template mismatch.

The renderer supplies `token = JSON.stringify([entry.path, viewport, colorScheme])`.
Every Action in a view shares that rule; renders without the provider use
the fallback token `"interactive"`. Per-view atomic values use SHA-256 of
UTF-8 `JSON.stringify([area, token])`, never a registration index.
Derive `zIndex` as `1000 + (first unsigned big-endian 32 bits % 1000000)`.
Class names therefore depend on values only. Adding an entry can add unused
rules to later cumulative sheets; it cannot change any existing view's own
values/classes or non-style markup. Small-fixture proof compares those bytes
and requires every other area's unchanged entries to stay out of Changes,
not impossible byte equality of complete cumulative sheets.

## Scenario Matrix And Restoration

The approved benchmark-only filter is repeatable `--scenario <name>`; examples:
`npm run benchmark:large -- --scenario no-changes --scenario component-style`
and `npm run benchmark:large -- --inline-styles --scenario linked-stylesheet`.
No filter selects all four rows below. Unknown/missing names fail before any
edit; duplicates collapse; selected rows retain the table's order. Each row
gets one cold and one warm fresh-server/browser-context sample, not a warmed
classification worker. Chrome is launched before the measured command.

| Scenario            | Input state relative to isolated Git `main`                       | Expected Changes paths                                            |
| ------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------- |
| `no-changes`        | Baseline renderer and baseline `shared-1.css`                     | none                                                              |
| `component-style`   | Only the area-one Action color constant edited; baseline CSS      | `area-1/components/action`                                        |
| `screen-markup`     | Only screen-one markup constant edited; baseline CSS              | `area-1/screens/activity-group-1/screen-1`, `area-1/flows/flow-1` |
| `linked-stylesheet` | Baseline renderer, **keep setup's unused rule** in `shared-1.css` | none                                                              |

Reset both mutatable files independently before each scenario; never carry a
previous edit into the next one. Build current outputs after preparation,
including with `--tracked-output`, before starting its cold server. Rebuilt-baseline cache
reset/hit rules remain in the README. Zero shared-sheet count makes the linked
row a no-op with zero CSS-analysis union; zero share keeps the unused rule but
no reachable dependency. The ordinary stylesheet edit proves rule exclusion,
not a matching-selector keep. Record `cssAnalysisMs/Share` as well as inline
union/share using the diagnostic contract's clipped intervals.

In `finally`, restore `renderer.tsx` and `shared-1.css` to **setup state**:
baseline renderer plus the unused setup rule when the sheet exists. Restore
generated current outputs to that state too, without changing the fixture's
Git baseline, identity record or archived toolchain. Restore even after failed
samples, browser errors or cancellation; stop owned servers/browser first.
A restoration error fails the command without discarding recorded samples.

One SIGINT/SIGTERM handler covers the whole matrix, including preparation.
Disable Playwright's SIGINT/SIGTERM/SIGHUP handlers; interruption marks
cancellation, aborts the active preparation `execFile` through its AbortSignal
and stops the active Serve. Skip remaining rows/states, close Chrome and rebuild
setup in `finally` before nonzero exit. Restoration itself is not aborted.
The final report carries `cancelled: true` and retains started samples only;
never invent records for skipped samples. Benchmarks run separately; the unit
suite no longer launches browser-backed child processes to check interruption
during preparation or sampling and compare every setup source/output byte.

Record every requested sample unless cancelled, continue after bounded failures,
and write the full report before returning nonzero. The exact `ok`, `error`,
`incomplete`, `membership-mismatch` fields, clocks, rounding and interval unions
are owned by [sample outcomes](../../../docs/protocol/mokly-timings.md#benchmark-sample-outcomes).
Preserve whole `documentWork`/`inlineStyleCounts` records and `heapPeakMiB` when
available; absent records are not invented zeros. The independent
`usableMs < 5000` check still applies; classification acceptance cannot turn a
failed navigation assertion into benchmark success.

## Classification Performance Acceptance

This procedure and its original ratios are retained for a later plan. They are
not an acceptance gate for the scalable analysis plan. Before using them, the
later plan must approve its limits and measure the reference and candidate in
one session on one machine, in alternating order. The M9A values are indicative
only; neither they nor the stored M2 reference set the later limits.

Use default dimensions (30/40/12, four sheets, share 0.5), all four scenarios
and both states with **`--tracked-output`**. Output is untracked by default;
`--tracked-output` is opt-in. At the reference step run two complete
default-fixture matrices after regeneration. Retain every sample, including
cumulative failures from its separate baseline matrix; old historical tables
are not substituted for this reference. At acceptance regenerate both current
fixtures and run two complete matrices per fixture, plus one cold cumulative
`component-style` sample with the default untracked output. Use the same template digest,
dimensions, Node runtime and machine, with other heavy work idle. Record
`nproc`, `free -m` and `uptime` before/after each run.

For scenario `s` and state `t`, let `B(s,t)` be the arithmetic mean of the two
reference default `classificationMs` values. Let `D(s,t)` and `C(s,t)` be the
two-run means for acceptance default/cumulative respectively. Times are the
completed **background worker** `changes.classify` durations, not readiness,
Serve wait, baseline build or inclusive child sums. Calculate means/ratios
from recorded two-decimal durations without rounding intermediates; displayed
ratios may round only after the pass decision. Pass iff **all** hold:

- For every scenario/state, `C(s,t) / B(s,t) <= 2`.
- On each fixture/state, its `component-style` mean divided by its
  `no-changes` mean is `<= 1.25`.
- For every scenario/state, `D(s,t) / B(s,t) <= 1.05`.
- Every sample contributing to `B`, `D` or `C`, and the untracked-output spot sample,
  is `ok`, has exact expected membership and a present `heapPeakMiB < 1024`.
  The separate cumulative baseline matrix is diagnostic, not an input to `B`.

Missing completed durations, zero ratio denominators, missing `heapPeakMiB`,
any failure outcome in a required sample, or different `templateDigest`,
dimensions, runtime, `renderingDependencies` or machine makes acceptance fail,
not a discarded outlier.
Different `moklyCommit`, `moklyDirty` or prepared-code identity values do not
fail acceptance by themselves: the reference and optimized commits must differ.
Segment counts added after the reference step are not required on reference
samples. Do not drop a cold sample, substitute warm, average states, or replace
a failed run with a faster retry. A later plan must account for newly dominant
work before it claims that its approved performance limits pass.

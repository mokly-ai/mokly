# Shared Page Analysis: Post-reboot Browser Gate

Milestone 7's supervisor fixes are implemented. The supervisor authorizes their
local commit after identifying the six browser failures as host timing, not M7
defects. Pinned hydration passes all 219 tests. No UI code/browser assertions or
timeouts are changed, no push occurs, and no scale-benchmark matrix is started.
This report records the investigation after the 2026-10-02 reboot.

## Environment And Runs

All commands use Node 24.19.0. Authoritative verification uses
`PLAYWRIGHT_CHANNEL=chromium`, matching `.github/workflows/ci.yml`; the installed
`chromium-1228` executable reports Chrome for Testing 149.0.7827.55. System Chrome
reports 153.0.8010.52. The supervisor confirms that system Chrome was installed
on 2026-09-22 and used successfully for every earlier milestone's browser run.

## Root Cause And Supervisor Decision

The reboot moved this VM to a slower host. Every M2–M6 benchmark's `machine.cpu`
records **Intel(R) Xeon(R) Processor @ 2.90GHz**; `/proc/cpuinfo` now reports
**Intel(R) Xeon(R) Processor @ 2.50GHz**, with observed MHz of 2499.998. The
current model/MHz/aggregate CPU steal ticks are retained in
`m7-host-change-snapshot.json`. M2 reference and M6 clean report machine records
were checked directly; neither code tree changes the CPU identity.

The supervisor's comparison of the 702 tests passing in both pre-reboot
`m7-browser.json` and the post-reboot pinned run finds a median **1.46×** duration
ratio, with 10th–90th percentiles **1.15×–2.55×**. System Chrome's median ratio
is **1.50×**. These are per-test duration ratios on different hosts, not an M7
performance result. The earlier 205.6 s ordinary-preview setup approaches 300.2 s
at 1.46×, beyond its unchanged 300 s limit. The six specs' 5 s frame/URL waits
and setup timeouts reproduce on cold pre-M7 M6 as well.

The supervisor therefore accepts these six host-timing browser failures for
the M7 local code checkpoint, with no UI/timeout changes. They remain required
tests: complete browser and hydration suites, including those six specs, must
pass in CI with pinned Chromium or on a reference-CPU host before M10 acceptance.

## Retained Run Evidence

Each run below is retained under `.context/delegation/scalable/`, with its
named `.log` and `.json`. Counts are recorded statuses, not inferred passes.
`failed` and `timedOut` are distinct; skipped tests do not satisfy the gate.

| Evidence stem                  | Tree / operation                                                  | Passed | Failed | Timed Out | Skipped | Interrupted |
| ------------------------------ | ----------------------------------------------------------------- | -----: | -----: | --------: | ------: | ----------: |
| `m7-supervisor-system-chrome`  | Fixed tree, full system-Chrome run                                |    704 |      7 |         2 |      12 |           0 |
| `m7-supervisor-pinned-browser` | Fixed tree, full pinned-Chromium run                              |    705 |      4 |         4 |      12 |           0 |
| `m7-fixed-repeat-1`            | Six failed specs, `--repeat-each=3`                               |     22 |     15 |        11 |      36 |           0 |
| `m7-fixed-repeat-2`            | Same repeat run, stopped for the corrected M6 control instruction |     23 |      6 |         4 |       0 |           1 |
| `m7-m6-control-browser`        | Clean pre-M7 `e5025e64`, six specs once                           |      7 |      5 |         4 |      12 |           0 |

The six specs are `component_design_navigation`, `design_library_runtime`,
`design_links`, `preview_design_links`, `preview_navigation`, and
`standalone_appearance_history`. The list is saved in `m7-pinned-failed-specs.txt`.
The initial fixed repeat completed all 84 assigned repetitions. Its second
run was deliberately interrupted on the supervisor's instruction to replace
the M7 control with M6; its 34 observed repetitions are not a completed gate.

The focused pinned diagnostic (`m7-supervisor-pinned-browser-smoke.log`) and
the earlier clean `ee4ead64` diagnostic (`m7-pristine-browser.log`) both
reproduce four investigated blockers: ordinary component-design navigation,
mobile and desktop comparison/tag/flow navigation, and the ordinary-preview
fixture's 300 s setup timeout. `ee4ead64` already contains M7 and is **not** the
pre-M7 control. The supervisor also independently reproduced the four
system-Chrome blockers on that commit.

The valid control is `e5025e64`: a detached clean worktree, its own
`npm run prepare:verification`, pinned Chromium, port 4527, and the same six
specs without repeats, run with no other suite/build/copy active. Its preparation
is in `m7-m6-control-prepare.log`. It reproduces the same classes of 5 s frame/
URL waits and 300 s ordinary-preview setup timeouts. No tracked control source
was modified. This is not evidence of a deterministic M7-only browser defect.

The previously queued hydration run was stopped to follow the bounded repeat
instruction; `m7-hydration-deferred-for-repeat.log`/`.json` preserve that
non-accepting interruption. The supervisor-authorized hydration run subsequently
passes **219/219**, with zero failures/skips/cancellations, using pinned Chromium;
`m7-supervisor-approved-hydration.log`/`.json` retain the completed result.

## Second-round Verification And Additional Waits

The token-provenance follow-up reruns all required checks without changing UI
code or timeouts. `m7-round2-unit.json` passes **3,417/3,417**;
`m7-round2-hydration.json` passes **219/219** using pinned Chromium. Both have
zero failures/skips/cancellations. Targeted suites pass 825 and 280 tests;
format, lint, typecheck and repository ratchets pass.

The complete pinned run (`m7-round2-browser.log`/`.json`) observes all 725 tests:
703 pass, 6 fail, 4 time out and 12 skip after the two known publication-fixture
setup timeouts. The established six specs retain their wait/setup signatures.
Two additional tests require the supervisor's further classification:

- `browse.spec.ts`: the light-only screen's frame remains `about:blank` at its
  unchanged 5 s source wait.
- `component_example.spec.ts`: desktop highlight activation reaches its 60 s
  click limit because the preview session reports “could not be loaded”.

The supervisor requests both complete specs with `--repeat-each=3`, alone and
with pinned Chromium, first on the fixed tree and then on clean, separately
prepared pre-M7 `e5025e64`. Evidence is `m7-round2-extra-fixed.log`/`.json`,
`m7-round2-extra-control.log`/`.json`, and `m7-round2-control-prepare.log`.
Both repetition runs observe all 105 assigned tests without skips/cancellations:

| Target                     | Fixed Tree                       | Pre-M7 M6 |
| -------------------------- | -------------------------------- | --------- |
| Browse light-only wait     | 2 pass / 1 identical 5 s failure | 3 pass    |
| Desktop component preview  | 3 pass                           | 3 pass    |
| Entire two-spec repetition | 104 pass / 1 fail                | 105 pass  |

Neither additional failure is deterministic on the fixed tree. The short M6
control does **not** reproduce either, so it is not claimed as a reproduced
control failure. Full-run and repeat artifacts are preserved in
`m7-round2-full-failure-artifacts/` and `m7-round2-extra-*-artifacts/`. Both repeat
logs include `DEBUG=pw:webserver` diagnostics. The failing full-run component
trace shows successful HTTP 200 responses for the toolbar documents and view
endpoint (desktop document response: 4,653 ms), no failed resource responses,
and no page/render error beyond expected sandbox script blocking. The adapter
has an existing 5 s mount deadline; timeout is plausible, but that generic UI
message alone is not proof of its error code. The extracted trace facts are in
`m7-round2-preview-trace-summary.txt`.

The supervisor resolves that hold with the bounded startup experiment below.
No full-suite retries, UI/timeout fixes, pushes or scale-fixture measurements
follow the diagnostic. The completed M6 repeat control is cleaned up; evidence
remains in the original worktree.

## Bounded Cold Serve Experiment

Run alone on the 2.50GHz host, ABBA twice: M6/fixed/fixed/M6, repeated. Both
isolated trees have their own `npm run prepare:verification`, identical example
inputs/dependencies and baseline merge-base `b4314fec`. M6 is clean `e5025e64`;
fixed code is detached snapshot `048fe802` of the pending sources, parent
`b9e1256d`. That scratch snapshot does not commit or move the production branch.
Clear only each scratch tree's `.mokly-cache` before every new process; all
eight baseline completions report `cacheHit: false`. Prepared output stays as
Playwright prepares it. These are process/baseline-cold runs, not OS-cache flushes.

Each invocation is exactly `node dist/cli/bin.js serve --config
examples/basic/mokly.config.ts --port <free> --no-watch --debug-timings`, with no
browser traffic, CPU profiling, other suite/build/benchmark or tracked edits
while measuring. Classification is its recorded completed background span.
Idle starts at the first observed post-classification window with at most two
process CPU ticks over at least two seconds (100 Hz ticks, 250 ms sampling).
Confirmation is recorded separately; no worker/supervisor completion is invented.
CPU is the server process's `/proc/<pid>/stat` user+system time, including worker
threads, excluding external baseline-command children. Idle wall time includes
those baseline commands. This measures startup contention, not frame latency.

| Run | Tree  | Classification (ms) | Start To Idle (ms) | Server CPU (ms) |
| --- | ----- | ------------------: | -----------------: | --------------: |
| 1   | M6    |            6,973.42 |          71,017.53 |          39,690 |
| 2   | Fixed |            3,416.70 |          70,253.21 |          38,420 |
| 3   | Fixed |            3,445.54 |          69,250.29 |          35,510 |
| 4   | M6    |            6,685.65 |          68,239.31 |          38,720 |
| 5   | M6    |            6,388.30 |          70,771.94 |          40,660 |
| 6   | Fixed |            3,366.35 |          66,489.21 |          36,210 |
| 7   | Fixed |            3,422.04 |          64,237.72 |          34,170 |
| 8   | M6    |            6,710.42 |          68,764.33 |          39,660 |

Means: classification M6 **6,689.45** versus fixed **3,412.66 ms** (ratio
**0.5102**); idle **69,698.28** versus **67,557.61 ms** (**0.9693**); server CPU
**39,682.50** versus **36,077.50 ms** (**0.9092**). Every fixed classification
and CPU value is below M6's minimum. Fixed idle values overlap M6's
68,239–71,018 ms spread or are faster; fixed is not consistently slower.

Every run compares 428 views (426 fast, 2 complete) and emits exactly one
document-work and inline counts record. Work is identical within each tree:
M6 **2,520 HTML parses / 51,366,664 bytes**: 1,460 reference, 1,032 range and
28 style-discovery parses. Fixed **430 / 8,953,277 bytes**: 428 page-analysis
parses plus 2 reference parses. Recorded HTML parse time spans M6
3,030.14–3,329.25 ms versus fixed 959.95–992.75 ms. All inline fields are zero
(elements, segments, hits, parses, fallbacks); there is no inline parse work
hidden in this comparison. Complete document-work fields are retained per run.

Evidence directory: `.context/delegation/scalable/m7-startup-experiment/`:
`run.mjs`, `run.log`, `samples.json`, `summary.json`, `source-snapshot.json`, and
each `01-m6` through `08-m6` run's `*-sample.json`, `*-timings.json`, stdout/
stderr logs and before/after machine JSON. Snapshots include CPU model/MHz,
steal ticks, `nproc`, `free -m`, `uptime` and `ps`. The first detached launcher
exited before any start/sample; its empty log is retained. The corrected owned
launcher completes all eight runs without retries, dropped samples or deadlines.

**Decision:** the supervisor's stated rule is met. Record Browse's intermittent
5 s wait as an additional host-timing exception and commit the verified fixes.
The component-preview wait is not deterministic either: 3/3 passes on both
trees, HTTP 200 trace responses and no observed render/server error. Preserve
that transient full-run failure rather than claiming it reproduced on M6.
No cost-profile/remedy is warranted by this experiment. This is evidence about
the real example startup only, **not** Decision 13 acceptance or proof for the
large fixtures; their approved same-host comparison still waits for code review.

## Cold Ordinary-preview Export

`m7-export-probe.mjs` loads each tree's own `createCommittedExampleBaseline`
and `buildPreview`, creates a fresh unique committed `ordinary-preview`
fixture, and exports to its previously absent `.context/site`. Every tree has
its own prepare step. Probes run sequentially and alone, with enabled timing
and document-work diagnostics, not a browser or scale benchmark.

| Tree                    | Fixture Setup (ms) | Export (ms) | Total (ms) | Outcome  |
| ----------------------- | -----------------: | ----------: | ---------: | -------- |
| M6 `e5025e64`           |          10,477.51 |  156,498.58 | 166,976.69 | Complete |
| Delivered M7 `ee4ead64` |          10,015.51 |  141,375.21 | 151,391.37 | Complete |
| Fixed M7 worktree       |           7,655.20 |  139,810.93 | 147,466.68 | Complete |

Raw evidence: `m7-m6-export.log`, `m7-delivered-export.log`,
`m7-fixed-export.log`, and `m7-cold-export-summary.json`. Each probe's
`*-export-machine-before.txt` and `*-export-machine-after.txt` record `nproc`,
`free -m`, and `uptime`. Fixture/output paths are in each log's start/end records;
all processes ended normally before the next prepare/probe began. The 600 s
supervisor safety limit was never reached, and no completion was fabricated.

All three exports record exactly 1,535 HTML parses and 58,549,778 parsed bytes:
428 range parses (5,504,956 bytes), and 1,107 reference parses (53,044,822 bytes).
HTML parse time is respectively 4,631.79 / 3,843.75 / 4,358.66 ms; reference
work is 949.87 / 1,137.42 / 1,159.88 ms. All record **zero compared views,
zero matching/projection/inline-rule work, and zero inline elements/segments**.
The ordinary export does not enter component classification/page analysis.
These cold probes show neither an M7 export hang nor an export slowdown;
most elapsed export time lies outside the recorded document work. They do
not explain the VM's remaining browser waits or justify relaxing timeouts.

## What The Pre-reboot Pass Reused

The earlier `m7-prepare.log` records a package build and regeneration of 430
example files. Prepared verification then consumes `dist/cli/bin.js`,
`packages/viewer/dist/browser/inspector.js`, and the generated example manifest/
HTML from that preparation. `requirePrepared` checks file existence, not a
source-to-output fingerprint; its name alone cannot prove a fresh build.

There is **no evidence of a reused stale ordinary-preview publication**.
`startOwnedPreviewFixture` creates a unique `mkdtemp` owner directory, asserts
that the output is absent, builds it, and checks a fresh ownership marker.
`copyExampleSources` excludes generated HTML/manifests. The artifact is shared
only within its current worker and removed at teardown, not reused from `/tmp`
or an earlier verification run. The pre-reboot `m7-browser.log` records an
ordinary-preview export of **205,645.10 ms**, followed by a 1,873.09 ms server
start: that fresh setup fit its 300 s limit. Its recorded 725 tests passed.
The new cold control/probes do not support inventing a stale artifact to
explain that earlier pass. The measured host slowdown explains why this fresh
setup and frame/URL waits no longer fit their existing limits; the same failures
occur before M7 as well.

## Boundary And Next Gate

The supervisor-fix targeted suites pass 724 and 222 tests; the complete unit
suite passes 3,316 tests without failures/skips/cancellations. Format, lint,
typecheck and repository ratchets pass. Failed browser evidence remains visible.

The supervisor's host diagnosis and positive bounded startup experiment resolve
the earlier commit holds. Commit locally, retaining the six established timing
specs, the additional Browse exception and the transient component wait's
3/3 fixed and M6 repeat passes; then stop for the supervisor's code check. Do not
push, retry full suites, edit unrelated UI/tests, or take scale measurements.

When authorized to run the final `cargo xtask check` before pushing, explicitly
export `PLAYWRIGHT_CHANNEL=chromium` and record it. Scale benchmarks retain
default system Chrome for M2–M6 comparability; an interactive browser failure
must stop and be reported, never silently switch channels.

After approval, M7 scale evidence uses same-session, same-host M6/M7 comparisons:
prepare a separate clean `e5025e64` worktree (same analysis code as measured
`1887eff6`), and interleave **M6, M7, M7, M6** per fixture. Each pass records
no-change/component-style cold and warm scenarios. Report ratio spreads, not
direct comparisons with M2–M6's different-host times. Each machine snapshot
records `machine.cpu`, `/proc/cpuinfo` model/MHz and CPU steal time. Decision 13's
same-reference-machine acceptance remains unchanged; its host question is for
the user, not a contract amendment at this checkpoint.

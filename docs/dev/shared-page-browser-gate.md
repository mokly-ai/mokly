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

The supervisor's host diagnosis supersedes the earlier stop/commit hold. Commit
the verified fixes locally, stating that this host's browser gate fails only
the six host-timing specs; then stop for the supervisor's code check. Do not
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

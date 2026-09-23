# Complete Local Verification Performance

## Repeatable Measurement

On the same eight-CPU development machine, record `git rev-parse HEAD`,
`git status --short`, `node --version`, `npm --version`, `rustc --version`,
`nproc` (or `sysctl -n hw.ncpu`), and the checkout's source fingerprint. Run
`/usr/bin/time -v cargo xtask check` twice with dependencies and build caches
already populated. Keep both raw logs in `.context/`; capture the runner's
suite/shard wall times, reports' discovered and observed files/tests, maximum
resident size and the time command's CPU utilization. Record each complete
command's exit code; only two successful invocations count as warm samples.

For cold setup, make a separately owned temporary checkout, time `npm ci`,
browser installation and a fresh Rust build separately. Do not delete the
developer's caches or conflate cold provisioning with warm wall time. Record
the machine's observed load (e.g. `/proc/loadavg` on Linux) and source identity
alongside timings. CI compatibility uses both supported Node runtimes and
the existing fail-closed hosted aggregate; hosted timings are not local results.

## Baseline (September 22, 2026)

At commit `8b7c5238` on eight CPUs, a successful complete gate took
**39m01.054s**. Node: **2,236 tests, 419 files, 10m36.119s**. Browser:
**686 tests, 108 specs, 25m16.450s**. Rust: **10 tests**. The remaining
**3m08.485s** includes preparation and other gates. These suite durations
are nested within, not additional to, the complete wall time. Per-file
reports are retained under the ignored `.context/verification-reports/`.

## Candidate Runs

The performance target is 15 minutes warm; report the actual result and any
bottleneck even if missed. The first full candidate (source fingerprint
`e5afc719`, September 23, 2026) **failed** after 17m23s and is excluded from
acceptance. Isolated browser preview fixtures inherited an outer process owner's
resource path outside their own checkout; the preview safety guard rejected the
path. The run was intentionally terminated after the error surfaced to exercise
drainage: every registered worktree and active subprocess was removed, and no
incomplete success was reported. Repository (44s), package (262s) and all four
unit shards (unit-4: 608s) passed before cancellation. The fixture now keeps
preview artifacts in the executing checkout and has a focused regression test.

The second complete candidate (fingerprint `d105ce1e`, September 23) **passed**
in **20m40.27s** on eight CPUs: repository 46s, package 247s, unit shards
310/285/233/570s, browser shards 425/894/535/440s. The reports confirmed
423 discovered and observed unit files, 2,243 passing unit tests, and 686
discovered and observed passing browser tests. Maximum resident size was
1,687,424 KiB and overall CPU utilization 325%. Browser shard 2 began only
after unit shard 2 and set the critical path. The logs and reports are in
`.context/local-check-candidate2.{log,time}` and
`.context/verification-reports/local-check-rtAxkT/`.

Two later experiments are **failed attempts, not warm samples**. Candidate 3
exposed a missing declaration/import-order error in the new scheduling test;
its cancellation initially waited for the active browser runner, so the
verifier now supports explicit abort and tests its bounded subprocess shutdown.
Candidate 4 tried five simultaneous runners and encountered a Playwright
`beforeAll` deadline during a real static export under high load. It also
exposed that an ancestor did not register every detached verifier process
group, allowing a cancelled descendant to outlive snapshot cleanup. A
failure-first regression now covers ancestor drainage, and the cap is back to
four runners. Neither failed run contributes to the successful warm-run count.

Candidate 5 exposed a separate browser race in the postMessage inspection
fixture: a held label-list request did not imply a concurrently issued
highlight was still pending. The test now holds both requests explicitly and
asserts both were reached before replacement; the formerly flaky case passed
eight focused repetitions and the full 32-case spec passed. During the failed
run's cleanup audit, several Playwright web servers from earlier interrupted
runs were found still listening after their checkouts had been removed. Their
exact process IDs were stopped; the web-server startup now registers its own
process group with the verifier. A failure-first ancestor-shutdown regression
and a complete focused browser spec pass with that registration enabled.

The first attempted final warm run (fingerprint `911d349c`, September 23)
**failed after 9m17.97s** and is not an acceptance sample. Node reported a
native `v8::ToLocalChecked Empty MaybeLocal` crash while loading a CommonJS
module in unit shard 4, leaving `watch_resource_boundaries.test.ts` without
a completed file report. The fail-closed shard validator rejected the missing
evidence. That file subsequently passed directly (three tests, about nine
seconds) and its complete shard passed alone (544 tests, 5m51.44s). The
sampled peak one-minute system load was 15.89 on eight CPUs, but neither a
test assertion defect nor a definitive cause for the native crash has been
established. Failed worker reports are now retained for diagnosis and never
counted as successful local evidence; the focused retention regression passes.

The next complete run (fingerprint `5fc7c4b2`, September 23) **failed after
17m16.91s** and is also excluded. Seven of eight test shards completed;
browser shard 2 executed all 183 assigned cases but one timed out: the real
preview preparation exceeded its 180-second test deadline during the fresh
`npm run preview:build`. In the earlier passing complete candidate the same
case took 170.682 seconds, leaving under ten seconds of margin even then.
The four-worker run reached a sampled one-minute load of 17.71 on eight CPUs,
with no cgroup OOM kills. This measured contention justifies a finite
240-second budget **for that test only** while retaining the actual build,
output digest and browser assertions, and zero retries. The run failed closed,
retained the failed shard report, removed its snapshots, and left no worker
server behind. Its logs are in `.context/local-check-final1.{log,time,load}`.

After the focused preview-build case passed with the adjusted deadline (one
test, **2m20.88s** overall; actual build **119.18s**), the next full attempt
(`de94be74`) **failed after 3m22.91s** in the packed ESM consumer smoke. Its
test server returned a signal exit instead of the required normal zero exit;
the complete runner propagated that failure and drained its other workers.
The exact five-scenario packed smoke passed in isolation immediately afterward
in **1m08.80s**. There were no OOM kills. This attempt is not a successful
warm sample and the cause of the isolated signal exit remains unproven. Logs
are in `.context/local-check-warm-a.{log,time,load}` and
`.context/package-smoke-isolated.{log,time}`.

The following complete attempt (`27a48503`) **failed after 18m15.92s**:
repository and package checks, unit shards 1/2/4 and browser shards 3/4
passed, and the real preview build in browser shard 2 completed under load in
**201.76 seconds**, confirming the old 180-second deadline was insufficient.
Browser shard 1 then failed when a component-controls test fulfilled a held
light-mode response after a context change had already disposed its request.
The test now holds that fetched response explicitly, waits for dark mode to
render, releases the first request, and rechecks that the dark preview remains
current. A canceled obsolete response is an expected navigation outcome, not
a successful replacement. This failed attempt is excluded from warm samples;
its logs are in `.context/local-check-warm-b.{log,time,load}`.
The corrected case then passed eight consecutive focused repetitions, and all
six tests in its owning browser spec passed together with no retries.

## Warm Runs Before Mainline Integration (September 23, 2026)

Two complete `cargo xtask check` runs passed on the **same source fingerprint**
`fb651abd56078937f9f51b79e1360a0518cd8de03386e5cd6fade3d5d1d81e5f`
and the same eight-CPU machine. The initiating `HEAD` was `8b7c5238`, Node
was 24.14.1, npm was 11.11.0, and Rust was 1.98.1; both runs included the
same unstaged tracked and non-ignored untracked source files. Staged-source
capture was separately covered by the snapshot regression.
No source was edited between runs. Every worker's report passed the complete
aggregator, and all temporary worktrees and browser servers were drained.

| Gate or shard      |         Run 1 |         Run 2 |
| ------------------ | ------------: | ------------: |
| Complete wall time | **18m10.73s** | **18m14.17s** |
| Repository         |         40.4s |         37.8s |
| Package            |        200.7s |        197.7s |
| Unit 1             |        290.9s |        307.5s |
| Unit 2             |        286.1s |        293.4s |
| Unit 3             |        215.6s |        213.3s |
| Unit 4             |        479.9s |        472.3s |
| Browser 1          |        539.6s |        545.6s |
| Browser 2          |      1,029.4s |      1,027.8s |
| Browser 3          |        569.6s |        559.5s |
| Browser 4          |        471.5s |        469.2s |

Each run independently discovered and observed **425 unit files and 2,249
passing unit tests** (107/106/106/106 files across shards) and **686 passing
browser tests** (177/183/156/170). There were zero failed, skipped, canceled,
or duplicate results. The 39m01.054s baseline exceeds these wall times by
20m50s and 20m47s, a **53.4% and 53.3%** reduction. The 15-minute aspiration
was missed by 3m11s and 3m14s; no coverage was traded for these improvements.
The long browser-2 shard remains the critical path (around 17m09s from its
early admission); its real preview build alone took 199.79s and 215.16s in
these runs. Unit shard 3 then finished last after joining the bounded queue.
Preparation in each isolated worker, the heavy preview export, and contention
at the four-worker cap remain the main opportunities for further improvement.

The time command observed 369%/367% overall CPU utilization and maximum
resident sizes of 1,688,296/1,707,132 KiB. The sampled peak one-minute
system load was 17.52/19.04; cgroup counters recorded no OOM kills. Raw logs,
time records, and ten-second load samples are in
`.context/local-check-accept-{1,2}.{log,time,load}`; the eight reports per run
are under `.context/verification-reports/local-check-3oXQup/` and
`.context/verification-reports/local-check-JM66IS/`. These are warm, complete
dirty-checkout samples, not clean provisioning or hosted CI measurements.
After they finished, `origin/main` advanced from `8b7c5238` to `d4228f90`
(eight commits). The combined tree was checked and measured separately below;
these older samples do not claim to verify the new mainline changes.
The newer mainline also moved long browser catalogue preparation into a
separately bounded five-minute fixture, leaving each browser assertion's
ordinary timeout intact; the earlier 240-second whole-test adjustment above
and its timings describe only the pre-integration source.

For a clean-checkout smoke, an owned detached worktree containing this source
was committed **only inside the temporary test checkout**. The current
snapshot implementation successfully reproduced and verified that clean tree
in a second isolated worktree; its `cargo xtask check --suite repository` also
passed in 37.8s. Both temporary worktrees were removed, the original dirty
source was reverified unchanged, and only the original worktree remained.
The clean smoke was a selected repository suite, **not** another complete gate;
its log is `.context/clean-checkout-smoke.log`. The intentional failing shard,
port conflict, and live-server SIGTERM smokes are documented above.

The failure-path smoke using an unavailable Chromium channel returned failure,
kept an incomplete report incomplete, and removed its worktrees and processes.
An occupied browser port was rejected before dispatch without touching the
listening process. SIGTERM cancellation was checked separately: the runner
exited without a success line, reported the signal, and removed its worktrees.
After web-server registration was added, a second cancellation smoke waited for
the browser server to listen before sending SIGTERM: its port closed, no
worktree or server process remained, and no complete report was emitted.

## Public Commands And CI Inventory

On September 23, the public unsharded `npm test` passed **2,248 tests in 425
files** with no failures or skips in **10m24.93s**. The unsharded
`npm run test:browser` passed **686 tests** with no failures or skips in
**24m55.39s**; its web server also exited. Both commands retained their normal
limits when measured. On Node **22.14.0** and **24.14.1**, final independent discovery found the
same 425 unit files and 686 Playwright tests. Each runtime's native four-way
unit assignment had 107/106/106/106 files and its Playwright assignment had
177/183/156/170 tests. Each runtime's shard unions exactly matched its
independently discovered inventory with no repeated identity. This checks CI
inventory compatibility, not a claim that hosted jobs were executed locally.

## Separate Cold Setup

An owned, subsequently removed checkout of the exact dirty source fingerprint
`25961a2b` measured local provisioning without deleting shared caches. With
Node 24.14.1 and npm 11, `npm ci` took **7.54s** in a fresh empty
`node_modules`; `playwright install chromium` took **8.63s** into a fresh
browser directory and downloaded the browser binaries; and
`cargo build --workspace --all-targets` took **4.91s** with a fresh local
target directory. Global npm and Cargo download caches were already warm, so
these are fresh-checkout setup times, **not** internet-cold download timings.
Their individual command logs are in `.context/cold-{npm-ci,chromium,rust-build}.{log,time}`.

## Slow-File Measurements And Rebalance

The September 22 reports give 104 independently timed route tests inside one
246.304s hydration spec. Four spec files now divide those tests by the stable
manifest order; each spec builds the real development React bundle once. The
pre-split design-library attribution file took 165.161s for 32 tests. Its
measured test groups took 39/45/45/22s, so independent groups now live in
four files on shards 1/2/3/4; a focused run of all 32 took 94.830s with two
files active. The 293.918s preview unit file (two real builds) moved from
shard 1 to shard 4 through the new sorted inventory. The 131.280s browser
preview-preparation spec keeps its fresh build and digest assertions. Fixture
setup, bundle preparation and teardown now emit phase timings to quantify
their contribution during the complete runs.

## Merged-Tree Verification (September 23, 2026)

The candidate implementation was merged locally with `origin/main` at
`d4228f90`. Node 24.21.0, npm 11.11.0, Rust 1.98.1 and eight CPUs were used;
the original checkout remained dirty for all checks. `npm ci`, build,
example build/check, formatting, lint, typechecks, Rust formatting/Clippy/tests,
focused unit/browser tests and the Rust file-length audit passed. Both Node
22.14.0 and 24.21.0 independently discovered identical **444 unit files**
(111/111/111/111) and **761 browser tests** (191/194/189/187), with complete,
non-overlapping shard unions; see `.context/integration-ci-inventory.log`.

The first complete gate stopped at 2m10s on a test fixture's TypeScript
undefined-array check; its typecheck and seven focused tests passed after the
fixture was corrected. One subsequent complete merged-tree gate passed in
**27m03.91s** on fingerprint `64d174c5`. A repeat on that same fingerprint
**failed after 22m10.96s**: the real browser preview build exceeded the
five-minute setup fixture deadline. Its 194-test shard reported failure despite
observing every assigned case, and the runner removed its owned workers and
servers. The successful run's preview build took **296.51s**, leaving under
four seconds of setup margin. Only this preview fixture's finite setup budget
was raised to seven minutes; other setup and browser assertion deadlines are
unchanged. Its real-build focused test passed (build **190.37s**). These failed
and pre-adjustment runs are excluded from the final warm pair.

Two complete runs then passed on the **same final code fingerprint**
`afdbbd9218217b8c798eb6665593ae16fdd9b7eaf17b0ba98d577b9f6e7e5a47`;
no source changed between the runs. Documentation-only results were recorded
afterward. Times are nested within each wall time, not additive:

| Gate or shard      |         Run 1 |         Run 2 |
| ------------------ | ------------: | ------------: |
| Complete wall time | **30m42.48s** | **27m29.02s** |
| Repository         |         42.9s |         46.9s |
| Package            |        274.5s |        228.1s |
| Unit 1             |        385.7s |        362.2s |
| Unit 2             |        794.2s |        744.4s |
| Unit 3             |        363.2s |        323.5s |
| Unit 4             |        317.9s |        271.2s |
| Browser 1          |        619.6s |        518.2s |
| Browser 2          |      1,539.7s |      1,359.7s |
| Browser 3          |      1,030.4s |        906.2s |
| Browser 4          |        723.7s |        615.7s |

Each run observed all **444 unit files**, **2,386 passing unit tests**, and
**761 passing browser tests**, with no failures, skips, cancellations or duplicate
identities. Against the 39m01.054s baseline, wall time fell **21.3%/29.6%**;
the 15-minute target was missed by **15m42s/12m29s**. Browser shard 2 remains
the critical path, including real preview builds of **319.65s/311.78s**.
The time command measured **324%/320%** CPU use and **2,383,148/2,294,492
KiB** maximum resident size; sampled peak one-minute load was **17.21/16.27**.
Raw records are `.context/integration-gate-{4,5}.{log,time,load}` and the
eight reports are under `.context/verification-reports/local-check-W00Eks/`
and `.context/verification-reports/local-check-QryzH7/`. The separately
measured fresh-checkout setup above used warm global caches and does not
represent internet-cold provisioning or a hosted CI run.

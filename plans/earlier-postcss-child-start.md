# Earlier PostCSS Child Start

Status: Active. On branch `calummoore/mokly-earlier-postcss-start-bdhv`, no pull request yet. The pull request that completes the work deletes this plan, as the `plans` skill says. The performance orchestrator answered item 1 on 2026-11-22.

A warm Serve start of a PostCSS project restores its head compilation from the
bundle cache. The pool spawns the head sidecar, reads the bundle cache, sends
`restoreGeneration`, and only then sends the startup `bundle` request. The
sidecar forks the prepared PostCSS child when that `bundle` request reaches it.
The child needs about 350 ms to load the configuration and the plugins, so the
first `processCss` request waits for it. This change starts the child earlier,
with the same contexts, output, evidence, and child count. It does not change
when a context is prepared.

The performance orchestrator asked for this change on 2026-11-22. Its goal: on
`examples/basic` with 2 sidecars, a drained warm restart reaches `serve.ready`
at least 100 ms sooner, first Changes does not get later, `mokly-cloud` stays
the same, every published byte stays the same, and the cold whole-tree memory
peaks stay within 2% of `main`. The orchestrator runs the official speed and
memory checks. Its stop condition: when no safe earlier start can save 60 ms,
the work stops with a closed-experiment record. The change replaces the
follow-up item
[Warm start waits for the PostCSS child](./follow-ups/postcss-child-start-before-startup-bundle.md).

On 2026-11-22 the performance orchestrator, under the delegation of the user,
chose option B of item 1 for this pull request. It approved the proposed
protocol text below and the three design calls. It set two conditions:

- `prepareContext` reaches the process that runs its `bundle` request, inside
  the same slot claim. A test shows that a replaced worker between the two
  cannot leave the child on another process.
- A failed `prepareContext` never changes the result or the error of the
  `bundle` request. The child count, the contexts, the output, and the read
  evidence stay the same in cold and warm starts, in a project without
  PostCSS, and after a configuration change between restarts.

Option D follows as the next stacked pull request of this workspace, with its
own plan, whatever the official result of B is. Its protocol check goes to the
orchestrator before its code. The pool step stays in
`crates/mokly-sidecar/src/pool_requests.rs`, away from `seed_compilation`,
which workspace 229 changes.

Contract owners:

- [Consumer PostCSS contexts](../docs/protocol/mokly-sidecar-postcss.md#prepared-contexts).
- [Sidecar methods](../docs/protocol/mokly-sidecar.md#methods).
- The [sidecar crate README](../crates/mokly-sidecar/README.md) and the
  [sidecar package README](../packages/mokly/src/sidecar/README.md).

## Split On Main

A temporary probe outside the repository measured the warm start of `main` at
`249fa1aa5`: a release core, `examples/basic`, 2 sidecars, 8 drained warm
restarts on a 4-CPU machine. Times are means in milliseconds from the start of
the core. The probe output is under `.context/earlier-postcss-start/`.

| Event                                            | Time |
| ------------------------------------------------ | ---: |
| Head sidecar spawn starts                        |   16 |
| `hello` ends                                     |  119 |
| `restoreGeneration` reaches the sidecar (4.6 MB) |  177 |
| `restoreGeneration` ends                         |  193 |
| `bundle` reaches the sidecar                     |  193 |
| PostCSS child fork                               |  195 |
| Child ready (configuration and plugins loaded)   |  547 |
| Short `bundle` reply                             |  318 |
| First `processCss` reaches the sidecar           |  329 |
| First `processCss` reply                         |  565 |
| `serve.ready`                                    | 1536 |

- The first `processCss` request waits about 218 ms for the child. The child
  needs about 351 ms from fork to ready, so its start is the critical path.
- The sidecar boot takes about 100 ms before `hello`. Node reaches user code
  after about 12 ms. The session modules load until about 60 ms later. The
  thread that reads the parent input then delivers `hello` after about 19 ms.
- The bundle cache read and the restore take about 74 ms after `hello`. About
  15 ms of that is the parse of the `restoreGeneration` frame.
- In a cold start without a cache record, the first bundle cache access takes
  about 400 ms after `hello`. The cold child is ready about 2.4 s before the
  first `processCss` request.

A throwaway prototype of option B measured 16 interleaved ABBA pairs of warm
restarts against `main`, with the same sidecar `dist` in both arms. With two
different `dist` builds, each arm switch misses the bundle cache. Results, mean
of the pair differences:

- `serve.ready`: −113 ms, median −98 ms, 95% bootstrap interval −168 to −65 ms.
  13 of 16 pairs were faster. Without one pair of −394 ms, the mean is −95 ms.
- First Changes: −112 ms, median −143 ms, interval −259 to +25 ms.
- Child ready: −70 ms, faster in all pairs. Wait of the first `processCss`:
  −74 ms.

The same prototype measured cold sessions, with the whole-tree RSS sampled every
50 ms:

- 2 sidecars, 10 pairs: peak +60 MiB on the mean, with a bimodal spread of
  about 1.7 GB or 2.2 GB. The peak comes at about 10.5 s, when the return pass
  spawns a head sidecar beside the base sidecar and its child. The head
  PostCSS child ends at about 3 s in both arms, so B cannot change the peak.
  The last 6 pairs alone gave −27 MiB, and the peak of the first 4 s was
  48 MiB lower with B.
- 4 sidecars, 4 pairs: peak −81 MiB on the mean, interval −218 to +2 MiB.

## Design Calls

My calls of 2026-11-22. They apply to option B.

- The `bundle` request keeps its `preparation` member. The sidecar then still
  releases the context when the `bundle` request fails. A `bundle` request
  starts the preparation only when no earlier request started it. A
  preparation that only `prepareContext` carries was rejected, because it
  removes that release from the sidecar for no gain at the boundary.
- The pool sends `prepareContext` after the cleanup of the slot and before the
  seed, for every `bundle` request with a preparation. So a released older
  context ends first, as the one-child rule needs. The pool records the
  context once, in the pool state and on the slot, before `prepareContext`.
  A second record before the `bundle` request could undo a release between the
  two requests.
- The request is `prepareContext`, beside `disposeContext`. Its params are
  those of `processCss` without the stylesheet path and text. It uses the
  default 30-second deadline and returns nothing. It reports its context and
  its source root like `processCss`, so the pool also routes it correctly on
  the public request path.
- Two more protocol sentences name the start of a prepared child. The memory
  page said that recycling counts "a child that a `bundle` request starts".
  The sampler finds each child at its start event, whatever request started
  it, so the sentence now names the `prepareContext` or `bundle` request. The
  scheduling page says that the context belongs to the slot of the bundle
  "from the start of the bundle". That stays true, because the pool gives the
  context to the slot when the `bundle` call takes the slot, before
  `prepareContext`. My call of 2026-11-22, under the decision of item 1.

## Decisions

### 1. Warm start waits for the PostCSS child

- **Severity:** Low. **Effort:** Medium.
- **Source:** Design.
- **Category:** Performance.
- **Location:** `crates/mokly-sidecar/src/pool_requests.rs:15` to line 27,
  `packages/mokly/src/sidecar.ts:1` to line 51,
  `packages/mokly/src/sidecar/session.ts:73` to line 81, and
  `docs/protocol/mokly-sidecar-postcss.md:83` to line 93.
- **Terms:**
  - **Startup preparation:** the `preparation` member of the first `full`
    `bundle` request of a Serve start. It names the context of the attempt and
    its PostCSS module.
  - **Seed:** a kept compilation, or one from the bundle cache, that the pool
    installs in the sidecar with `restoreGeneration` before the `bundle`
    request.
  - **Sidecar boot:** the time from the spawn of the Node sidecar to its answer
    to `hello`. The sidecar loads its session modules in this time.
  - **Light sidecar entry:** a sidecar entry that loads only the transport, the
    timings, and the PostCSS child owner, and loads the session modules later.
- **Background:** "Split On Main" gives the times. The core knows the context
  and the PostCSS module before it sends the `bundle` request. The pool spawns
  the head sidecar inside that request, and the sidecar forks the child. Each
  attempt needs its own child, and today the child belongs to the sidecar that
  runs the `bundle` request.
- **Problem:** The child starts only when the `bundle` request reaches the
  sidecar, after the sidecar boot, the bundle cache read, and the restore. On a
  warm start, the first stylesheet then waits about 218 ms for the child.
- **Impact if no action:** Each warm start of a PostCSS project keeps about
  200 ms of child start on the path to `serve.ready`.
- **Root question:** How can a warm Serve start have the prepared PostCSS child
  ready when the first stylesheet needs it, with the same contexts, output,
  evidence, and child count?
- **Options:**
  - **A.** The `restoreGeneration` request of the seed also starts the
    preparation. The sidecar parses that frame before any handler runs, so A
    gains about 1 ms. Effort: Small.
  - **B.** The pool sends a new `prepareContext` request to the slot of the
    `bundle` request after `hello` and the cleanup, before the bundle cache read
    and the seed. It moves the child start by about 74 ms. The prototype
    measured −113 ms mean `serve.ready`, median −98 ms, so the official check
    can land below 100 ms. A cold child starts about 400 ms earlier and ends at
    the same time. It needs one request, a pool step, and a protocol change.
    Effort: Medium.
  - **C.** The pool passes the preparation to the sidecar at its spawn. The
    sidecar forks the child before it loads its session modules and before it
    answers `hello`. Projected: child ready about 150 ms earlier than on `main`,
    about 70 ms more than B. It needs a launch input that the sidecar removes
    from its environment before any consumer code runs, a light sidecar entry,
    and child events held until the `hello` answer, because the first frame
    must be that answer. Effort: Large.
  - **D.** B, plus a light sidecar entry that answers `hello` and
    `prepareContext` at once and loads the session modules in the background.
    Later requests wait for that load. The child forks during the module load,
    projected about 15 ms after C's point. Every warm start also overlaps the
    bundle cache read with the module load, so `mokly-cloud` can start up to
    about 50 ms faster. A failed session load must still end the process, so
    that it shows as a crashed sidecar after one retry, not as a failed
    `hello`. It needs no launch input and no `hello` change. Effort: Medium.
  - **E.** C's start point, but the preparation travels in the `hello` request,
    which a light sidecar entry reads before its session modules. A live
    sidecar gains nothing unless B is also built. It needs a `hello` protocol
    change and attempt state in the handshake. Effort: Large.
  - **F.** The child starts faster: profile its own module load before the
    configuration load, about 150 ms, and cut it. The contexts, the evidence,
    and the child count stay the same, and no file is written. It stacks with B
    or D. Its gain is unknown, and a change near the read observers can change
    the read evidence. Effort: Medium, or Large when it touches the observers.
  - **G.** The core spawns the child when the attempt starts and sends
    `processCss` to it directly. The child starts about 30 ms before C or D, and
    each stylesheet saves one process hop. It needs a new process kind with its
    own transport, memory accounting, cancellation, and parent-death
    protection on each platform, and new context routing in the protocol.
    Effort: Large.
- **Left out:**
  - A separate pool request before the `bundle` request: it starts at the same
    time as B, but the slot is free between the two requests, so the `bundle`
    request can wait for its slot behind another request. B is better on every
    point.
  - A generic PostCSS child forked before any attempt: it needs C's launch input
    and light entry plus a second child step, and C reaches the same child-ready
    time. C is better or equal on every point.
  - A V8 compile cache for a faster child: the sidecar performs no file writes.
  - Change nothing: it fails the goal.
- **Assumptions:**
  - The sidecar of the `bundle` request forks and owns the child, because the
    `processCss` requests and the release of the context reach that process
    ([source root workers](../docs/protocol/mokly-sidecar-modules.md#source-root-workers)).
    It holds while the protocol routes PostCSS through the sidecar. G drops it.
  - Each attempt prepares a new context, and the child loads the consumer
    modules only after its attempt starts (protocol and task message). It holds.
    Kept.
  - The set of attempts that prepare a context does not change (protocol and
    task message). It holds. Kept.
  - The sidecar answers `hello` only after it loads its session modules (code).
    It is not a requirement. D drops it.
  - The child keeps its own start cost (the scope of this task). The goal
    measures `serve.ready`, so it is not a requirement. F drops it.
- **Wider fix:** None. This is a speed change, not a class of defect.
- **Previous examples:** #459 overlapped the fresh PostCSS setup with the
  bundle. #464 moved the startup child start to the `bundle` request.
- **Recommendation:** B now. It reached the goal in the prototype runs with a
  small pool step and one new request. When the official check of B lands
  below 100 ms, D comes next in this pull request. D reuses the request of B,
  starts the child close to C's point, and needs no launch input and no `hello`
  change.
- **Action:** ask the user, because the recommended option changes the start
  point that the PostCSS protocol states, and the options trade effort and risk
  against gain.
- **Outcome:** B, chosen by the performance orchestrator on 2026-11-22, with D
  as the next stacked pull request.

## Proposed Protocol Text

For option B. In `docs/protocol/mokly-sidecar-postcss.md`, this text replaces
the paragraph "The sidecar that runs the `bundle` request starts the
preparation..." and its decision. Wrapped at 80 columns, the page then has 250
lines, the cap. With its new method row, `docs/protocol/mokly-sidecar.md` then
has 249 lines.

> For a `bundle` request with a preparation, the pool first sends a
> `prepareContext` request to the sidecar of the `bundle` request. It carries
> the preparation, source root, repository roots, and resolution settings. It
> comes before the bundle cache read and any seed, so a new sidecar receives it
> directly after `hello`. The sidecar starts the preparation then and answers at
> once. A `bundle` request starts the preparation only when no earlier request
> did. The prepared child loads the PostCSS module and constructs its plugins.
> It processes no stylesheet before the first `processCss` request of its
> context. Neither request waits for that load. A preparation failure never
> changes the result or the error of the `bundle` request.
> Decision: the child starts before the bundle cache read and runs no
> stylesheet early. Processing the stylesheet roots during the bundle was
> rejected, because it needs speculative roots and later evidence checks. A
> start at the `bundle` request was rejected, because the child then starts
> after the bundle cache read.

In the same page, "A prepared context is live from the start of its `bundle`
request." becomes "A prepared context is live from its `prepareContext`
request." In `docs/protocol/mokly-sidecar.md`, the method table gets this row:

> `prepareContext`: PostCSS context and module, source root, repository roots,
> and resolution settings. Result: nothing.

## Milestone 1: Documentation and protocol

Depends on: the answer to item 1.

- [x] Apply the protocol text of the chosen option to
      `docs/protocol/mokly-sidecar-postcss.md` and
      `docs/protocol/mokly-sidecar.md`. Keep each page within 250 lines.
- [x] Update the preparation entries of `crates/mokly-sidecar/README.md` and
      `packages/mokly/src/sidecar/README.md`.

## Milestone 2: Earlier start

Depends on: 1

- [x] Red first: a pool test with a bundle cache hit shows that the slot
      receives `prepareContext` before `restoreGeneration` and `bundle`. A
      second case shows that a `bundle` request without a preparation sends no
      `prepareContext`. The existing core test already shows that a
      configuration without PostCSS gets no preparation.
- [x] Red first: a pool test shows that a worker replaced after
      `prepareContext` gets `prepareContext` again before its `bundle`
      request, and that the context stays on the slot of the `bundle`
      request. The existing ownership test expects `prepareContext` on the
      slot of the `bundle` request.
- [x] Red first: a pool test shows that an error reply to `prepareContext`
      leaves the `bundle` result unchanged.
- [x] Red first: a sidecar session test shows that `prepareContext` starts the
      child and answers without waiting, and that the later `bundle` request
      with the same preparation starts no second child.
- [x] A Serve restart test with the bundle cache: a change of the PostCSS module
      and of an environment value between the starts gives the new CSS. It
      catches an earlier start that takes its preparation, module, or
      environment from an earlier process, such as a stored cache entry or a
      kept child. See it fail with such a deliberate break.
- [x] Add `prepareContext` to the Rust methods, regenerate the TypeScript
      types, add the pool step, and add the session handler.
- [x] Run the existing startup preparation tests of #464.
- Evidence: `.context/earlier-postcss-start/tests/` and
  `.context/earlier-postcss-start/verify/`.
- Implementation calls of 2026-11-22 (mine): `FailureKind::for_call` maps
  `prepareContext` to a bundle failure, like `disposeContext`. A pool test also
  shows that a release after `prepareContext` disposes the context after its
  `bundle` request, because no listed test catches a second record point. The
  restart test uses the durable fixture owner `ServePostcssRestart`, because
  changes of `/tmp` during the cold compile made its capture not durable in
  about 1 of 5 runs. Its root gets its own `package.json` and an empty
  `tsconfig.json`, because the checkout settings otherwise add a second cold
  compile. The `mokly-test-support` README states that rule.

## Milestone 3: Verification, commit, review, and pull request

Depends on: 1, 2

- [x] Run the targeted tests, `cargo xtask check --suite repository`, and the
      complete gate named in `AGENTS.md`. The repository, viewer, browser,
      `cloud-rust`, `cloud-fixtures`, and nine more cloud suites passed
      locally. `cloud-terraform`, `cloud-helm`, `cloud-infrastructure`, and
      `cloud-toolchain-pins` need tools that this machine lacks, so CI runs
      them. `cloud-site` met one unrelated flaky test, recorded as a follow-up
      item. Evidence: `.context/earlier-postcss-start/verify/`.
- [x] Commit with Conventional Commits and push the branch. Send the SHA to the
      performance orchestrator.
- [x] Run a strict byte proof with ready Changes on `mokly-cloud`,
      `examples/basic`, and the large HTML and React fixtures. Evidence:
      `.context/earlier-postcss-start/byteproof-summary.md`.
- [x] Review the complete local diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings, then
      apply the fix rule: fix the `fix now` findings, record follow-up items
      under `plans/follow-ups/` for the rest, re-review once, and report.
      Findings file: `.context/reviews/calummoore/mokly-earlier-postcss-start-bdhv/findings.md`.
- [x] Merge `origin/main` once after workspace 229's pull request (#469)
      lands, and rerun the targeted pool and sidecar tests on the merged tree.
- [ ] Delete the follow-up item that this change replaces.
- [ ] Delete this plan when the `plans` skill says, under "Deleting the
      plan".
- [ ] Open the pull request. Its description gives the decisions and the
      design calls of this plan with their dates, a permalink to this plan,
      and the follow-up items that the change adds.

# Eager base work competes with the head usage pass on large catalogues

- **Severity:** Medium. **Effort:** Medium. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Post-merge task.
- **Category:** Performance.
- **Owner:** Cal (@calummoore).
- **Added:** 2026-11-21, from the branch
  `calummoore/mokly-eager-base-preparation-5dkn`, after the performance
  orchestrator accepted its Ready-only cold source policy.
- **Location:** `crates/mokly-server/src/background.rs:99` to line 150,
  `crates/mokly-server/src/background_batch.rs:49` to line 66,
  `crates/mokly-server/src/changes_background.rs:34` to line 41,
  `crates/mokly-cli/src/serve_eager_admission.rs:42` to line 48,
  `crates/mokly-cli/src/serve_gate.rs:102` to line 160,
  `crates/mokly-cli/src/serve_pool.rs:156` to line 168,
  `crates/mokly-sidecar/src/pool_eager.rs:11` to line 62, and the Admission
  section of `docs/protocol/mokly-eager-base-preparation.md`.
- **Reason:** On 2026-11-21 the owner accepted the Ready-only policy and gave
  this investigation to the time after the merge, so it does not block the
  eager base preparation pull request.

- **Terms:**
  - **Head usage pass:** The background pass of Serve that renders, or reads
    from the render store, every view of the working catalogue after
    readiness. `UsagePass` in `crates/mokly-server/src/background.rs` runs it.
  - **Eager base preparation:** The base catalogue work that Serve starts
    before the head usage pass ends. Its contract is
    `docs/protocol/mokly-eager-base-preparation.md`.
  - **Base bundle:** The eager sidecar call, `Call::Bundle`, that bundles the
    base catalogue during base validation.
  - **Usage window:** `Window` in `crates/mokly-server/src/background_batch.rs`,
    the started head views of the pass. A view leaves its count at the handoff
    of its sidecar stage, but its whole future can still run.
  - **Claim:** The place of one sidecar call in the shared capacity of the
    pool, which the default memory admission sets.
- **Background:**
  - Serve compares the working catalogue, the head, with the catalogue at
    the merge-base commit, the base. Changes classification starts only after
    the head usage pass ends.
  - Current `main` runs the accepted Ready-only policy in this order:
    - Serve starts eager base preparation when the working configuration of
      a head preparation attempt validates.
    - The Git pin, the checkout sample, and the load of the base
      configuration start at once.
    - When the working configuration names a renderer or PostCSS, the
      preparation leases an existing complete extraction. A pure HTML
      configuration probes no cache and adds no cache notice.
    - With a complete lease, discovery, the extraction, and the clean
      dependency identity reads also run at once. This is the warm path.
    - Without a complete lease, that work waits for the first successful
      readiness of Serve. Later edits do not wait for readiness.
    - Dependency selection, the install, and base validation, which includes
      the base bundle, wait for the final adopted head, after any watch
      recheck.
    - Early base renders, capture, comparison, and publication wait for the
      complete head usage pass.
    - Pending statuses, steps, warnings, and diagnostics stay silent until
      the current classification adopts them.
  - The eager sidecar admission rules are in force:
    - At most one eager sidecar call runs at a time.
    - It shares the one pool and its default memory admission with head
      calls. Each call holds a claim until it ends.
    - Serve admits an eager call only when no head call waits for admission
      and no whole HTTP render runs.
    - The call needs a free claim and an eligible slot together. An eligible
      slot is an empty slot or an idle process of a base source root. An
      eager call never takes the warm head process or another head process.
    - At a capacity of one, eager preparation makes no sidecar call. At two
      or three, an eager call waits until the pass has started its last view.
      At four or more, it has no such wait.
    - Eager work adds no head reservation, no new worker, no OS priority
      change, no timer, no retry, and no sleep.
  - The owner, under the delegation of the user, made this decision on
    2026-11-21. Ready-only is the accepted policy. HeadBundleOrReady, which
    started cold discovery when the head bundle of the attempt ended, is not
    chosen. The owner accepted a cold first Changes gain of 0.72 s, below the
    original target of 1.5 s, for readiness and first-edit safety.
  - The accepted measurement used the `mokly-cloud` catalogue, the same dist,
    and main `36cfd7cf7` as the control. It ran four warm rounds with a
    one-line change, four warm unchanged rounds, and four alternating cold
    ten-edit pairs with fresh caches and a quiet-snapshot gate. Each candidate
    had its own control run, and the control column gives both runs.

    | Measure                       | Control, Head / Ready run | HeadBundleOrReady                    | Ready                  |
    | ----------------------------- | ------------------------- | ------------------------------------ | ---------------------- |
    | First Changes, warm one-line  | 4.25 s / 4.30 s           | 3.97 s, -0.28, 4 of 4                | 3.65 s, -0.65, 4 of 4  |
    | First Changes, warm unchanged | 4.03 s / 3.92 s           | 3.45 s, -0.58                        | 3.38 s, -0.54          |
    | First Changes, cold           | 15.05 s / 15.25 s         | 13.55 s, -1.50                       | 14.53 s, -0.72, 4 of 4 |
    | Readiness, warm one-line      | 1,260 ms / 1,237 ms       | 1,361 ms                             | 1,262 ms               |
    | Readiness, warm unchanged     | 1,298 ms / 1,231 ms       | 1,243 ms                             | 1,247 ms               |
    | Readiness, cold               | 3,444 ms / 3,482 ms       | 3,615 ms, +171, about +350 in 3 of 4 | 3,472 ms, equal        |
    | First edit, warm one-line     | 2.22 s / 2.21 s           | 2.38 s                               | 2.25 s                 |
    | First edit, warm unchanged    | 2.16 s / 2.35 s           | 2.27 s                               | 2.29 s                 |
    | Cold ten-edit peak memory     | 3,127 MiB / 3,171 MiB     | 3,087 MiB, -1.3%                     | 3,166 MiB, -0.1%       |

  - Local scale evidence on the full large React fixture, 5,850 documents:
    - The control was main `77021d88c`, not main `36cfd7cf7`. The host had
      4 vCPU. Each candidate ran four interleaved rounds against the control,
      with the default pool and memory admission on.
    - The host was not calm. A read-only `/proc` read showed that the
      workspace runner used 189.37 CPU seconds in 129.873 wall seconds, which
      is 1.458 of the 4 cores. The owner then stopped further local timing
      rounds.
    - Nobody measured the Ready-only policy locally on this fixture.
    - HeadBundleOrReady, cold: first Changes had a control mean of 87.192 s,
      range 80.530 s to 98.024 s, and a candidate mean of 88.685 s, range
      82.735 s to 99.637 s. Head usage went from 57.594 s to 61.380 s.
      Readiness went from 4.002 s to 4.097 s.
    - HeadBundleOrReady, warm: first Changes had a control mean of 60.936 s,
      range 53.910 s to 71.334 s, and a candidate mean of 61.315 s, range
      54.741 s to 68.318 s. Head usage went from 35.580 s to 36.547 s.
      Readiness went from 1.215 s to 1.252 s. All eight warm starts hit the
      bundle cache for both bundles.
    - The mean deltas, +1.493 s cold and +0.379 s warm, do not prove a small
      regression with this spread.
    - The first candidate had no cold source bound. Against the same control,
      its warm first Changes went from 45.469 s to 46.318 s, and its head
      usage from 27.029 s to 28.716 s. This also suggests contention. That
      candidate also made cold readiness slower, and the owner rejected it.
  - Source facts, separate from the measured effects:
    - The head usage pass can keep the cores about 90% busy.
    - One bundle call can use about 55% of four cores.
    - One spare sidecar claim does not bound CPU, because one call runs both
      a Node process and an esbuild process.
    - Views that the render store serves use CPU, but they make no sidecar
      call. So a gap in sidecar calls does not show an idle view slot.
    - The pass calls `PendingChanges::dispatched` when it has started its last
      view. The full final window can still run after that call.
    - `Window::has_room` counts only the views that have not handed off. A
      handed-off view can still do Rust completion work and make later head
      calls. `Window::is_empty` is true only when every started view ended.
    - `UsageCapacity` in `crates/mokly-cli/src/serve_delivery.rs` bounds each
      stage of the pass by the smaller of the worker count and the sidecar
      limit. The sidecar limit can shrink while the pass runs.
    - Under the Ready-only policy, cold discovery, extraction, and identity
      reads start after readiness. So they also run beside the pass. A bound
      on the base bundle does not cover them.
  - Predictions, not measured:
    - A bound on the base bundle can lower its contention with the head usage
      pass on large catalogues.
    - When the usage window stays full until its end, the bound removes most
      bundle overlap. So it can lose the warm gain on the basic fixture.
    - When every allocated slot holds a head process, the empty-or-base-root
      rule gives the base bundle no slot. The end of a head view makes its
      process idle, not empty. So a cold start can then get no bundle overlap.
- **Task:**
  1. On a calm host, measure the accepted Ready-only policy against its
     control on the full large React fixture and on `mokly-cloud`, cold and
     warm, in interleaved rounds. Record first Changes, head usage,
     readiness, the first edit, and the cold ten-edit peak memory of the
     whole process tree.
  2. Build option A as a candidate. Measure it against the same control and
     the Ready-only policy, in the same rounds.
  3. Give the owner every sample, its spread, and the effect of each option.
     The owner chooses. No final fix is chosen now.
  4. Keep these requirements in every option:
     - Every published byte stays equal on the basic, large HTML, large
       React, and `mokly-cloud` fixtures.
     - Readiness, head usage, and edits do not become slower beyond
       measurement noise.
     - The cold ten-edit peak memory of the whole process tree stays within
       2% of the control.
     - Statuses, their text and order, warnings, progress lines, and bytes
       stay unchanged. Add no public option, environment variable, or
       setting.
     - Base capture, early renders, comparison, and publication stay after
       the complete head usage pass.
- **Options:**
  - **A.** Measure an idle-slot bundle bound. The eager base bundle starts
    only when the current head usage pass actually leaves an idle view slot.
    - The last dispatch alone is not enough. The full final window and the
      CPU work of handed-off views can remain. Warm store-hit views use CPU
      without sidecar calls.
    - Candidate condition: the pass has dispatched or skipped every route,
      and all unfinished whole-view futures of the current origin are fewer
      than the smaller of the worker limit and the current sidecar capacity.
      Count a handed-off view until its whole future ends.
    - Then the existing rules apply: no whole HTTP render, no queued head
      call, a free claim, and an eligible slot.
    - Check the condition against the current capacity at each admission
      attempt, because the capacity can shrink. Wake the wait through the
      existing signals. End it at once when the preparation is cancelled or
      its origin is replaced. Add no timer.
    - Check it before the claim and before the request, so that a bundle
      cache hit also waits. Hold no claim and no worker during the wait.
    - Keep the rule that an eligible slot is an empty slot or an idle
      process of a base root. A root switch of an idle non-warm head process
      needs a separate approval of the owner.
    - Do not promise cold overlap in a pool that holds only head processes.
      Do not promise the warm gain on the basic fixture.
    - Tests: a full final window of store hits keeps the bound closed with no
      sidecar call active. One whole-view end opens it only below the bound.
      A capacity shrink closes it again, and a capacity of one stays serial.
      A queued head call or a whole HTTP render still goes first. Use
      controlled channels, with no elapsed-time assertion and no sleep.
  - **B.** Keep the current policy, when calm measurements show no regression
    beyond noise.
  - **C.** Use a different CPU priority policy for eager base work, such as a
    lower OS priority. This adds an OS policy, so it needs the approval of
    the owner before any work.
- **Impact if no action:** Large catalogues can keep a slower head usage pass
  and a later first Changes while eager base work runs beside the pass. The
  noisy local rounds can neither prove nor rule out this cost, and nobody
  measured the Ready-only policy on the large React fixture.
- **Needs:** Release builds of the control and of each candidate with the same
  dist, Node, npm, and esbuild. A calm host with at least 4 vCPU and no other
  heavy process. The full large React fixture and the `mokly-cloud`
  catalogue. Stable caches outside the repository and `/tmp`. The same
  whole-tree memory accounting as the accepted measurement. The approval of
  the owner for option C or for a root switch.
- **Done when:** A calm interleaved measurement compares the Ready-only policy
  and the option A candidate with the control, cold and warm, on the full
  large React fixture and on `mokly-cloud`, with every sample kept. The
  owner ships one option, or records that the current policy stays. A
  shipped change to the eager admission rules updates the Admission section
  of `docs/protocol/mokly-eager-base-preparation.md` in the same change.
- **Related:**
  - [cold-start-base-overlap-memory.md](./cold-start-base-overlap-memory.md):
    the memory of early base work beside head usage. This item covers its CPU
    contention with the head usage pass. Neither result answers the other.

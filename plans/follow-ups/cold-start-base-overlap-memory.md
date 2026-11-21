# Cold-start base overlap needs a memory bound

- **Severity:** Low. **Effort:** Large. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-18, from the closed branch `calummoore/mokly-startup-base-overlap-rae7`, after the performance orchestrator closed its product change without a merge.
- **Location:** `crates/mokly-server/src/background.rs:44-62`, `crates/mokly-server/src/changes_background.rs:43-52`, `crates/mokly-cli/src/serve_gate.rs:64-87`, `crates/mokly-sidecar/src/pool_admission.rs:29-107`, `crates/mokly-cli/src/render_runtime.rs:115`, and the Default Admission section of `docs/protocol/mokly-sidecar-memory.md`.
- **Reason:** A further attempt needs a new memory rule for early base work, and only the user can choose that rule.

- **Source:** Implementation.
- **Category:** performance.
- **Terms:**
  - **Current usage:** The background pass that renders every view of the head after Serve is ready.
  - **Base:** The historical catalogue at the merge base that Changes compares with the current catalogue.
  - **Cold start:** A Serve start with an empty bundle cache in the cloud measurements, or fresh caches in the local measurements.
  - **Demand:** The peak of cgroup `anon` plus swap for the whole Serve tree, both read on the same sample tick.
  - **Startup task:** The closed attempt's one base preparation beside the first usage of a Serve session.
- **Background:**

  - Plain words used below:
    - The core is the Rust `mokly` process.
    - A sidecar is a Node process that renders JavaScript views for the core.
    - First Changes is the time from the Serve start to the first published Changes result.
    - HTTP is the time of one view render that a browser requests during usage.
    - A byte proof compares the published Changes bytes of both arms.
  - Current main runs the accepted Ready-only eager base preparation of `docs/protocol/mokly-eager-base-preparation.md`. Serve can prepare the base beside the usage pass. Discovery without a complete extraction lease waits for the first readiness of Serve. Base capture and comparison still start after usage. `UsagePass` renders current usage, then runs Changes, at `crates/mokly-server/src/background.rs:44-62`. Changes and its one-second reference poll start after usage, at `crates/mokly-server/src/changes_background.rs:43-52`.
  - On main, a base sidecar call of the classification waits while a foreground lease is held, at `crates/mokly-cli/src/serve_gate.rs:141`. One eager sidecar call at a time shares the pool. It uses only a spare claim and an empty or base-root slot, and it waits for every queued head call and every whole HTTP render.
  - On 2026-11-21 the performance orchestrator, under the delegation of the user, accepted that Ready-only policy on the `mokly-cloud` catalogue against main `36cfd7cf7`. Cold first Changes came 0.72 s sooner. The cold ten-edit peak was 3,166 MiB against 3,171 MiB, within the 2% limit of that change. That acceptance does not reopen the closed startup candidate below or change its 5% memory record. Any more startup overlap than the Ready-only bounds stays a new user decision.
  - Main has live memory admission for default-size sidecar pools, at `crates/mokly-sidecar/src/pool_admission.rs:29-107`, wired at `crates/mokly-cli/src/render_runtime.rs:115`.
    - Each sidecar slot reservation has a 1 GiB budget.
    - A further reservation needs host headroom for its budget, the unused budgets of the other reservations, the budgets that live claims hold, and 1 GiB of spare memory for the binary and native helpers.
    - It reads live memory at each growth, so it sees core memory that is already in use. It reserves none ahead for base work.
    - An explicit `--sidecars` or `MOKLY_SIDECARS` pool skips this growth admission.
  - That admission bounds sidecar slots. Apart from its fixed spare, it reserves no memory for base work in the core, such as the base graph and its captures, or for other descendants.
  - The closed attempt ran one startup task beside the first usage, only when the first head needed a sidecar. It prepared the base through graph preparation on one sidecar slot and captured after usage. Every ordinary Changes request kept main's order.
  - Its measured product was `2c28d9677`, with contained main `d4df04aa5`. That code is not on main. Its measurements predate main's pool admission, so they did not measure it.
  - The closed attempt was a last attempt. Its rule allowed no retry and no new variant, and the change closed without a merge.
  - Its memory requirement: candidate demand at most 105% of the paired main, and the Serve peak on the `mokly-cloud` catalogue at most 5% above main. A later attempt keeps this requirement. On 2026-11-16, the user prohibited work that can exhaust memory.
  - The performance orchestrator measured the catalogue of the `mokly-cloud` repository on a cloud machine: 167 entries, 1,508 views, 4 vCPU, 8 GiB, and a pool of 4. Three alternating rounds ran for each of warm and cold caches, after one discarded settle run per arm. Each arm used its own release core and one shared sidecar build. The orchestrator found no `packages/mokly/src` difference between `d4df04aa5` and `2c28d9677`. Cgroup samples came every 200 ms, with no PSS reader or clone recorder. The cloud table below gives every reported value.
    - Cold first Changes was 1.90 s, or 11%, sooner on the candidate in all three pairs.
    - Cold mean demand rose 4.2%. The reported cold pairs moved by +1.9%, -3.6%, and +16.1%. The +16.1% pair compares with main's lowest run.
    - Derived in listed order, the warm pairs moved by +16.5%, -13.2%, and -0.9%. The record does not confirm that the listed order is the pair order.
    - Warm first Changes differed by 0.16 s, within noise, and edits were equal. Cold `serve.ready` was 0.17 s later on the candidate, with no shown cause.
  - The local large React fixture ran one pair only, with fresh caches, a pool of 4, the original HTTP request and two edits, and one-second samples. Both local arms used one sidecar and viewer asset set built from main `d4df04aa5`, with inventory SHA-256 `09bbf757242557befd585412d295015515bdcc5cc5156045a8551c4d828d2498`.
    - Main: first Changes 77.880329 s, edits 53.029370 s and 50.436395 s, HTTP 233.468542 ms, and demand 1,949,596 KiB.
    - Candidate: first Changes 67.340584 s, 10.54 s or 13.5% sooner. HTTP 209.163250 ms. Demand 2,077,692 KiB before its stop, a 6.57% rise. The exact edit 1 value is lost, and edit 2 did not complete.
    - The candidate's startup stages were shorter than main's: usage by about 6.23 s, classification by 4.03 s, and ready by 0.28 s. One pair cannot attribute the usage gain or size a causal benefit.
    - The candidate stopped during edit 2 at a sampler integrity guard. No numeric breach was demonstrated. The complete RSS sum was unavailable, and `MemAvailable` stayed above its floor. The other four arms never ran, so this pair is no acceptance result.
    - The stopped sidecar, PID 1750569, was a head render worker of edit 2. The startup task had ended long before the stop. The sidecar showed `State: R`, one thread, and no `VmRSS`, while the cgroup still listed it. No `State: Z` sample was recorded. Its previous sample read 251,736 KiB and eight threads.
    - It had finished exactly 500 renders, the recycle limit, and its recycle stop had run about 18 ms when the guard fired. Main's matching recycle, PID 1746398, also after 500 renders, stopped in 19 ms.
    - All twelve main recycle stops of that edit took 12 to 45 ms, and the candidate's other eleven took 14 to 79 ms. These durations include shutdown, reaping, and drain. The run had no exact exit trace, and no candidate lifecycle defect is established.
  - In the local large HTML fixture, no startup task ran, Changes kept main's order, and all three byte proofs passed. The timing deltas changed sign, and the performance orchestrator accepted them as noise. The HTML table below gives each pair.
  - An older instrumented React peak gave a ratio of 1.1308. That ratio was PSS alone. PSS plus `SwapPss` at the same samples gave 1.0147. Neither value is a demand peak.
  - Measurement lessons for a later attempt:
    - A sampler must treat a listed member in exit, without `VmRSS` or with `State: Z`, as zero resident memory.
    - It must keep the raw status and membership evidence, and separate failed reads from identity changes.
    - It must save partial records before any summary. A summary error lost the exact candidate edit 1 time.

  Cloud runs, as the performance orchestrator reported them. First Changes and demand give the mean, then each run in listed order. Edits give the means of edit 1 and edit 2.

  | Arm            | `serve.ready`, s | First Changes, s        | Edits, s    | Demand, MiB                | `memory.peak`, MiB |
  | -------------- | ---------------- | ----------------------- | ----------- | -------------------------- | ------------------ |
  | Warm main      | 1.60             | 12.73; 12.9, 12.9, 12.4 | 3.37 / 3.09 | 2,386; 2,137, 2,511, 2,509 | 2,592              |
  | Warm candidate | 1.64             | 12.57; 13.3, 12.8, 11.6 | 3.33 / 2.97 | 2,385; 2,489, 2,180, 2,486 | 2,626              |
  | Cold main      | 3.49             | 17.23; 17.3, 16.8, 17.6 | 3.18 / 2.90 | 2,405; 2,445, 2,583, 2,187 | 2,562              |
  | Cold candidate | 3.66             | 15.33; 15.3, 15.5, 15.2 | 3.34 / 2.93 | 2,507; 2,492, 2,490, 2,539 | 2,695              |

  Local large HTML pairs. Each cell gives main / candidate. The ratio compares the paired demand peaks.

  | Pair | First Changes, s      | Edit 1, s           | Edit 2, s           | HTTP, ms              | Demand, KiB           | Demand ratio |
  | ---- | --------------------- | ------------------- | ------------------- | --------------------- | --------------------- | ------------ |
  | 1    | 16.561525 / 15.392234 | 3.013662 / 2.685332 | 2.898342 / 3.187619 | 52.185805 / 43.916738 | 1,021,344 / 994,224   | 0.973446753  |
  | 2    | 15.076388 / 15.593861 | 2.776209 / 2.803207 | 3.064410 / 2.734353 | 45.299299 / 50.548827 | 1,043,644 / 1,033,640 | 0.990414356  |
  | 3    | 17.024947 / 16.858053 | 2.625127 / 3.005025 | 2.897846 / 3.186481 | 60.143840 / 46.093195 | 1,033,600 / 1,026,356 | 0.992991486  |

- **Problem:** Early base work at cold start gave a real first-Changes gain, but its added memory was borderline. One of three cloud pairs and the one incomplete React pair rose more than 5%, and the cloud mean rose 4.2%. No rule bounded that memory, and main's pool admission does not cover it.
- **Impact if no action:** Cold Serve starts keep the accepted Ready-only bounds, with no more startup overlap. On the cloud catalogue of 2026-11-18, the closed attempt gave cold first Changes about 1.9 s, or 11%, sooner than main of that date. The Ready-only gain of 0.72 s used a later main as its control, so the two gains do not compare directly. Memory stays within the accepted Ready-only bounds.
- **Root question:** How, if at all, can Serve make the first Changes of a cold start sooner, while paired demand stays within 5% of main and no work can exhaust memory?
- **Options:**
  - **A.** Keep the experiment closed. Keep the accepted Ready-only bounds of main. No more overlap work or added overlap memory, but no cold gain beyond the Ready-only policy. Effort: Small.
  - **B.** Measure the added memory first. Under a new approval, run a corrected sampler on the closed candidate and on main, and split the added demand by owner: the core, esbuild, and Node. This is a new diagnostic, not an acceptance retry. It informs the other options but improves nothing alone. Effort: Medium.
  - **C.** Cold caches only. Restore the startup task, but start it only when the bundle cache is cold, because warm starts showed no first-Changes gain beyond noise. This removes early work where it gains no time. The measured memory rise is in the same cold case, so this option alone does not meet the bound. Effort: Large.
  - **D.** Smaller footprint. Find and remove the memory that early base work adds, so that demand stays within 5% without a new rule. No record locates memory that early base work adds. An older candidate, which also changed edits, peaked during an edit, after its early base process had exited. With `SwapPss` counted, its core share fell from 247,873 KiB to about 23,429 KiB. A head esbuild process held 90,788 KiB more, and Node held 82,084 KiB less. The saving is unknown and can differ by machine. Effort: Large.
  - **E.** Memory admission beyond the pool. Before early base work starts, take a separate bounded memory reservation beside the live pool admission. Size it for the core's base work and its descendants, which the sidecar budgets do not cover. When the reservation fails, keep the accepted Ready-only bounds. The reservation is an absolute admission of host memory. It does not demonstrate or enforce the paired 5% bound, so demand must still be proven within 5% of the paired main. Cost: a new resource rule, a size that needs calibration on several machines, new clean local evidence, and a cloud run. No safe threshold is established. Effort: Large.
  - **F.** B, widened. Under a new approval, find the source of the demand spread that both arms show, warm and cold. Also record when any added demand peaks: in startup usage, in the base capture, or in an edit. Apply the three sampler lessons above. Cost: diagnostic runs, a harness correction, and a cause that can stay unknown. It improves nothing alone, and it adds no acceptance rule. Its result can size C, D, E, G, and H. Effort: Large.
  - **G.** Restore the startup task, and gate it on main's existing default-pool admission. Start it only when the pool would admit one further 1 GiB reservation beside the slots that usage holds. Otherwise keep the accepted Ready-only bounds. This needs no new reservation size. Evidence limits: no record measures the core's base work alone, so nobody knows whether one sidecar budget covers it. Explicit `--sidecars` and `MOKLY_SIDECARS` pools skip admission, so the gate does not cover them. Like E, it does not prove the paired 5% bound, so it needs the same paired proof. Effort: Large.
  - **H.** Shorten the serial base stages after usage, with no further base work beside usage. This avoids the overlap. A shorter serial path can still change demand, so it needs the same paired proof. Evidence: in the one local React main arm, base capture took 14,694 ms of the 21,308 ms classification after usage. The nested spans suggest that the early task moved only about 2.5 s of pre-capture work. Evidence limits: one pair, nested spans, no cloud stage traces, and no proved saving or owner. Effort: Large.
- **Left out:**
  - A retry of the frozen candidate as acceptance evidence. The closed attempt was a last attempt, and its rule allowed no retry and no new variant. Its results also predate main's pool admission. A new diagnostic under a new approval is option B or F.
  - A higher limit or a looser guard. It weakens the recorded memory requirement.
  - A persistent base cache across starts. It cannot help the first cold start.
  - Keeping the bundle cache on fresh machines. It makes fewer starts cold, but it does not make a cold start sooner.
  - A move of early work away from the time of the added demand peak. No record says when that peak comes, and F records it first.
  - Early capture, or a Changes request during usage. Earlier attempts on the closed branch added work to usage and slowed first Changes.
  - A larger pool, or a separate base render pool alone. Each adds processes or workers, and so memory, without a bound.
- **Wider fix:** E, for the class of early work that can exhaust memory. A reservation makes that bound part of admission. It does not prove the paired 5% bound, which still needs paired evidence.
- **Previous examples:** On the closed branch, a headroom rule with a serial fallback was proposed three times and not chosen, because no threshold was proved. An earlier cloud run had already shown a 2.4 s cold gain and a 0.45 s warm gain for an earlier candidate. The new runs repeat a cold gain for the narrowed design.
- **Related:**
  - [early-base-capture-evicted-results.md](./early-base-capture-evicted-results.md): its bounded handoff must account for retained early results. Its accepted step 1 diagnostic does not approve a new memory rule for this separate overlap work.
  - [background-base-render-pool.md](./background-base-render-pool.md): it covers the shared-worker stall. Like main, the closed attempt captured only after usage, so its capture did not compete with usage for render workers. A browser request during that capture can still wait, because waiting base jobs can hold every shared render worker.
  - [default-sidecar-count.md](./default-sidecar-count.md): the pool size sets the sidecar memory that any early base work must fit beside.
  - [esbuild-memory-after-bundle.md](./esbuild-memory-after-bundle.md): it would return bundler memory after each bundle, which option D can test. An older sampled peak showed more memory in a head esbuild process during an edit, with no causal proof.
  - [eager-base-competes-with-head-usage.md](./eager-base-competes-with-head-usage.md): the CPU contention of the accepted eager base work with the head usage pass on large catalogues. This item covers the memory of early base work. Neither result answers the other.
- **Recommendation:** E, as the future structural direction, with the diagnostic of F as its first prerequisite. E admits extra base memory beyond the live sidecar budgets, but it does not demonstrate or enforce the paired 5% bound by itself. If F cannot establish a usable sizing rule and paired evidence, keep the accepted Ready-only bounds. Every option other than A needs a fresh user decision before any work, and F adds no acceptance rule. The fresh options check of 2026-11-18 recommended F before any design. The workspace orchestrator kept E, because it accounts for extra base allocations that the sidecar slot budgets do not reserve.
- **Action:** ask the user, because E adds a new resource rule for early base work, and no safe threshold is established.

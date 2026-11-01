# Bring large React startup under five seconds

- **Severity:** Medium. **Effort:** Large. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan:
  option A of decision 57, which the user deferred on 2026-10-19.
- **Location:** `docs/protocol/mokly-on-demand.md:22-25`,
  `docs/protocol/mokly-timings.md:187` and `:201-204`, and the esbuild
  compilation in `packages/mokly/src/sidecar/bundle.ts`.
- **Reason:** The user deferred the compilation redesign after accepting the
  15-second merge budget. The existing five-second target and complete-catalogue
  readiness rule still apply.

- **Source:** Design.
- **Category:** Performance.
- **Terms:**
  - **Usable startup:** `usableMs`, the time from command start to
    searchable navigation and a real selected preview in `mokly serve`.
  - **Large fixture:** the generated test catalogue under
    `tests/fixtures/large`, by default 1,620 routes and 5,850 documents.
- **Background:**
  - `docs/protocol/mokly-on-demand.md:22-25` sets the scale target: usable
    startup under five seconds, cold and warm, on the large fixture. The
    page's status line names this item.
  - `docs/protocol/mokly-timings.md:187` budgets `usableMs` under 5,000 ms
    for HTML and under 15,000 ms for React, on the release build.
  - The user's decision of 2026-10-19 kept the complete-catalogue startup
    design and approved the 15,000 ms React budget. It deferred option A, a
    compilation cache redesign, so that it did not block the acceptance.
  - `mokly-timings.md:201-204` records that usable navigation before every
    entry is ready was not chosen.
  - Measurements on an eight-CPU, 16.25 GiB machine, release build, two
    sidecars, default deadlines, and a 6 GiB memory stop:
    - Source tree `9ad26d86`, 2026-10-19: 10.551 s cold and 10.538 s warm.
      Core preparation took 0.260 s and 0.177 s. Compilation took 7.491 s
      and 7.019 s.
    - Commit `caf7b383`, in the next measurement round: 8.564 s cold and
      8.533 s warm. It passed the 15,000 ms budget. The round date is not
      recorded.
  - The deleted plans record no later large React startup measurement.
  - On 2026-10-30, a one-time run of the startup scenario measured commit
    `cd35ab37`, source tree `92a5c41b`, with no local changes. That commit
    differs from main commit `f93afcea` only in Markdown files.
  - The run used the release acceptance build on an eight-CPU, 16.25 GiB
    machine, with two sidecars, default deadlines, and a 6 GiB memory stop.
    Its fixture came from `npm run fixture:large -- --variant react`, with
    1,620 routes and 5,850 documents. The command was
    `npm run benchmark:large -- --root {fixture} --scenario startup --sidecars 2 --memory-stop-kib 6291456`.
  - Usable startup took 9,139.757 ms cold and 8,274.408 ms warm. The run
    passed the 15,000 ms React budget. It missed the five-second target. It
    reported no split of the time by phase.
- **Problem:** On 2026-10-30, large React startup took about 9.1 s cold and
  8.3 s warm. The five-second target is still not met for React. In the run
  of 2026-10-19, JavaScript compilation took most of the time.
- **Impact if no action:** Large React catalogues open about twice as slowly
  as the target, and the on-demand page keeps its status line.
- **Root question:** How does a large React catalogue reach usable startup
  in under five seconds?
- **Options:**
  - **A.** Redesign the compilation cache, so that startup repeats less
    esbuild work. The plan gives no design. Measure first with
    `npm run benchmark:large -- --root {fixture} --scenario startup` on a
    React fixture from `npm run fixture:large -- --variant react`. Effort:
    Large.
  - **B.** Keep the current design, and make the 15-second React budget
    the target in `docs/protocol/mokly-on-demand.md`. This drops the
    five-second React target. Effort: Small.
  - **C.** Open Browse before every React entry is ready. This reverses the
    recorded choice in `mokly-timings.md:201-204`, and it needs pending
    entries and delayed errors. Effort: Large.
- **Left out:** Skip validation to start sooner. The on-demand page forbids
  it.
- **Wider fix:** A. Less repeated compilation also helps watch rebuilds and
  long Serve sessions.
- **Previous examples:** The startup work of 2026-10-19 shared the routing
  inventories and cut core preparation from seconds to 0.260 s. Compilation
  stayed the main cost.
- **Related:**
  - [compiled-recipe-cache.md](compiled-recipe-cache.md) asks for a cache
    of compiled code after its generation ends. A redesign under A can
    include it, so decide the two together.
  - [serve-sidecar-prestart.md](serve-sidecar-prestart.md) moves sidecar
    start before the background pass. It covers work after Serve is ready.
- **Recommendation:** A. It keeps the five-second target and the
  recorded readiness decision. B or C changes one of them.
- **Action:** fix after merge, apply A, because the user deferred the
  compilation work after accepting the merge budget. Keep the existing startup
  and readiness requirements.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L5430).

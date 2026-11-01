# Keep the base side in memory between edits

- **Severity:** Medium. **Effort:** Large. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-01, from the closed "perf 6" workspace of the
  performance work, and its unmerged plan at commit `129dda09` on branch
  `conductor/perf-6-keep-the-base-side-in-memory-between-edits`.
- **Location:** `crates/mokly-compare/src/base_render.rs:168`,
  `crates/mokly-cli/src/serve_changes_base.rs:97`,
  `crates/mokly-cli/src/changes_base.rs:32`,
  `crates/mokly-cli/src/serve_changes_native.rs:106`, and
  `crates/mokly-compare/src/git_failures.rs:15`.
- **Reason:** The user has not answered the five open decisions of the
  plan, and the plan starts no milestone before the answers.

- **Source:** Design.
- **Category:** Performance.
- **Terms:**
  - **Changes:** Serve's comparison of the working tree, the head, with the
    merge base of `HEAD` and `review.base`.
  - **Base side:** the base commit's configuration, sources, sidecar bundle,
    render graph, and captured documents.
  - **Kept base:** the captured base side that Serve would keep between
    classifications under this item.
  - **Working install:** the `node_modules` directories of the working
    tree. Tier-1, tier-3, and HTML-only bases render with its files.
  - **Selected capture:** the on-demand copy of one entry's documents that
    Serve makes when a reviewer opens a comparison.
- **Background:**
  - Each classification prepares the base side again: configuration load,
    discovery, sidecar bundle and describe, graph preparation, and capture.
    After an edit the merge base stays the same, so the work repeats.
  - On 2026-10-29, `main` at `f93afcea` took 11.5 s from an edit to the end
    of the second classification on the baseline machine. The base side
    was 5.0 s of it. A machine 1.6 to 1.9 times slower measured 22.1 s and
    9.7 s on 2026-10-30.
  - On 2026-10-27 the user chose option A of finding 2 of that day's
    performance profile. Serve keeps the prepared base side in memory, and
    reuses it while the merge base and its inputs stay equal. Option B also
    kept the capture on disk. The plan records why it lost: a disk copy
    needs a new versioned format.
  - On 2026-10-30 the user chose to start this work in parallel with
    [bundle-disk-cache.md](./bundle-disk-cache.md).
  - The acceptance of the task: after an edit to one screen module, the
    second classification runs no base `config.load`, `catalogue.discover`,
    `catalogue.validate`, or `graph.prepare` span. `review.base-tree` takes
    under 0.5 s. The first classification does not get slower.
  - The plan keeps one base, keyed by the merge-base commit, a digest of
    the working configuration, and the install-scripts setting. It keeps no
    base after a base error, a source failure, a `base-conversion` warning,
    or a fallback that a retry can fix. A reuse publishes no `preparing`
    status and captures nothing again. `review.base-tree` gets an `action`
    field, `reuse` or `prepare`.
  - A base request switches one sidecar pool worker to the base source root.
    The pool stops a head worker and starts a new one, about 0.33 s.
  - The plan predates PR #248, which added comparison steps to the base
    provider on 2026-10-30. Check the plan against it before the work.
- **Problem:** Every classification after an edit repeats the whole base
  side for an unchanged commit.
- **Impact if no action:** Each edit waits about 5 s longer for Changes on
  the baseline machine.
- **Root question:** How does Serve reuse the prepared base side between
  classifications, and still give the result of a fresh preparation?
- **Options:** The user chose the approach. Five decisions stay open.
  Answer each by number and letter, for example "1C, 2B".
  1. **Working-install changes** (High). When does a kept base still give
     the result of a fresh preparation, when it reads working-install files?
     - **A.** Check the dependency selection again before each reuse. It
       misses an install that keeps the lockfile. Effort: Medium.
     - **B.** A, and compare the install record and the entry list of each
       working `node_modules` root. It misses Bun and hand edits. Effort:
       Medium.
     - **C.** B, and compare the base bundle's digests of installed modules
       with the head bundle's digests. It misses package stylesheets,
       assets, and files that only the base reads. Effort: Medium.
     - **D.** A, and release the kept base on a head watch event below a
       used dependency directory. It changes the watch code. Effort: Medium.
     - **E.** C, and digest again each file that the base read through the
       working dependency reader. Effort: Large.
     - **F.** B, and check the input stamps of the base runtime again, with
       a new check in `crates/mokly-render`. Effort: Large.
  2. **Cancelled readers** (High). How do a replaced classification and a
     cancelled selected capture stop quickly, and leave the kept base usable?
     Today a stopped Git read records a fatal source failure.
     - **A.** Release the kept base after any cancelled read. Each edit
       during a classification then loses the gain. Effort: Small.
     - **B.** Detach at keep: the base then watches only Serve's stop, and
       each reader checks its own token before each call. It changes the
       replacement rule of `docs/protocol/mokly-comparison-serving.md` and
       the capture-abort rule of `docs/protocol/mokly-selected-comparisons.md`.
       Effort: Large.
     - **C.** B, and a cancelled Git read records no source failure, so the
       capture-abort rule stays. It changes `crates/mokly-compare`. Effort:
       Large.
     - **D.** A shared reader scope: the base stops only when every reader
       is cancelled. Effort: Large.
  3. **What Serve keeps** (Medium). **A.** The captured generation with its
     graph, sources, leases, and bundle. Effort: Small. **B.** The capture
     and the catalogue only. Views outside the capture then cannot render.
     Effort: Large.
  4. **When Serve releases it** (Medium). **A.** On a key change, a failed
     freshness check, a base error, or a retryable fallback, and at stop
     when the last Serve state drops. Effort: Small. **B.** A, and also in
     the release step of the shutdown order. It frees nothing more. Effort:
     Medium.
  5. **The render pool item** (Low). **A.** Change nothing in
     `plans/follow-ups/background-base-render-pool.md`. **B.** Add two facts
     to it: base capture then runs only on a fresh preparation, and under
     2B a replaced reader cannot cancel a kept-base render at the admission
     gate. **C.** Do that item in the same branch. Effort: Small, Small,
     Large.
- **Left out:**
  - A disk copy of the capture: the user chose option A over it on
    2026-10-27.
  - A copy of the working install for the base: it breaks the rule that
    both sides use the working install in tiers 1 and 3.
  - A fresh base runtime for each reader: it prepares the graph again and
    misses the 0.5 s target.
- **Wider fix:** 1F and 2C. 1F reuses the input stamps that the runtime
  already checks. 2C stops every later cancellation from poisoning a base.
- **Previous examples:** PR #220 captures the head once in `build`, the
  same class of repeated work.
- **Related:**
  - [installed-module-watch-paths.md](./installed-module-watch-paths.md):
    the watcher can miss installed modules, which limits options 1C and 1D.
  - [background-base-render-pool.md](./background-base-render-pool.md):
    decision 5 changes its text.
  - [bundle-disk-cache.md](./bundle-disk-cache.md): it caches the base
    bundle on disk, so a fresh preparation gets cheaper. Measure this item
    again after either merges.
- **Recommendation:** 1C, 2B, 3A, 4A, 5B. They are the most complete
  options inside the scope of the plan. 1F and 2C best protect the
  comparison, but they change `crates/mokly-render` and
  `crates/mokly-compare`.
- **Action:** ask the user, because the recommended option 2B changes two
  protocol rules that no user decision covers.

The full plan, with its design calls and six milestones, is in the [unmerged plan](https://github.com/mokly-ai/mokly/blob/129dda09a70d544bcc88b8aa5b4b0d504804325f/plans/keep-base-side-in-memory.md?plain=1).

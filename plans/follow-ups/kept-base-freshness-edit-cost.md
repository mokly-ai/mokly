# Kept-base freshness check slows each warm edit

- **Severity:** Low. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-21, from the branch
  `calummoore/mokly-edit-comparison-cost-bo07`, which timed the warm edits of
  the `mokly-cloud` catalogue.
- **Location:** `crates/mokly-compare/src/base_freshness.rs:132`
  (`FreshnessChecks::current`), `crates/mokly-cli/src/serve_base.rs:44`
  (`ServeBase::find_kept`), `crates/mokly-compare/src/base_classification.rs:63`
  (the `review.base-tree` span around `find_kept`),
  `crates/mokly-git/src/source_key.rs:25` (`checkout_settings`),
  `crates/mokly-git/src/checkout_index.rs:51` (`settings_listing`),
  `crates/mokly-git/src/access.rs:20` (`candidates`),
  `crates/mokly-compare/src/working_inputs.rs:30`, and
  `crates/mokly-compare/src/install_inputs.rs:30`.
- **Reason:** On 2026-11-21 the user asked to handle this phase in a separate
  later task, because the branch that measured it changes only head closure
  validation.

- **Source:** Implementation.
- **Category:** Performance.
- **Terms:**
  - **Classification:** one Changes pass of Serve after a source edit, which
    finds or prepares the base, compares every view, and publishes the result.
  - **Warm edit:** a source edit in a running Serve process after its first
    classification, when Serve keeps a base and view comparisons.
  - **Kept base:** the prepared base side that Serve keeps in memory between
    classifications, with its render graph, sources, leases, capture, and
    bundle.
  - **Freshness check:** the checks before each reuse of the kept base that
    show that a fresh preparation would give the same base.
  - **Checkout identity:** a digest of the base commit, the effective Git
    configuration, and the Git attributes of each file of that commit.
- **Background:**
  - Mokly Serve serves a mockup catalogue for development and watches its
    sources. After each source edit, it prepares a new head generation from
    the working tree.
  - Then a classification compares the head with the base: the merge base of
    `HEAD` and the configured review base. Serve publishes the result as the
    Changes state of the catalogue index and the entry details.
  - The `changes.classify` timing span covers one classification. It ends
    when the `ready` or `unavailable` state commits.
  - A warm edit reuses the kept base when its key and its freshness check
    hold. A failed check releases the kept base. The classification then
    prepares the base again, which takes seconds.
  - `ServeBase::find_kept` runs inside the `review.base-tree` span. The span
    records `action` `reuse` when the kept base passes, and `prepare`
    otherwise.
  - `find_kept` calls `FreshnessChecks::current`, which runs these parts in
    this order:
    - The checkout identity, through `checkout_identity` of the repository.
      It runs three Git processes: `git config --null --list --includes`,
      `git ls-tree -r -t -l -z --full-tree {commit} --`, and
      `git check-attr --attr-source={commit} --all -z --stdin` for each
      regular file of the base commit.
    - In a blobless clone, the listing runs more Git processes.
    - The working dependency inputs. When the base has no fixed path list, Git
      lists the working candidates with
      `git ls-files -z --cached --others --exclude-standard`. Then the check
      reads and normalizes the manifests and lockfiles that select the base
      dependencies.
    - The install evidence: the install record and the entry list of each
      working `node_modules` directory that the base reads.
    - The installed-module digests of the base bundle and the head bundle,
      when the base recorded installed modules. This part runs no Git.
  - Standard `--debug-timings` output shows the whole lookup as
    `review.base-tree` with `action` `reuse`. It has no span for the parts.
  - Requirements that stay:
    - Before each reuse, Serve checks that a fresh preparation would give the
      same base. Source:
      [Freshness Checks](../../docs/protocol/mokly-base-preparation.md#freshness-checks).
    - The check covers the working manifests and lockfiles, the install
      records and entry lists, the installed-module digests, and the effective
      checkout settings. Source: the same section.
    - Decision in force: Serve compares the checkout settings before each
      reuse. Keeping the settings of the preparation was rejected, because a
      fresh preparation reads with the current settings.
    - Serve keeps at most one base. Source:
      [Serve Base Lifetime](../../docs/protocol/mokly-base-preparation.md#serve-base-lifetime).
    - The comparison after the check keeps its complete content proofs and
      the current usage of both sides. Source:
      [Proven view reuse](../../docs/protocol/mokly-changes-serving.md#proven-view-reuse).
    - The output, the warnings, the diagnostics, and the order of failures of
      each classification stay equal. Base work runs before the comparison,
      so a base failure ends a classification before head validation runs.
    - On 2026-11-16 the user asked to keep improving the speed and the
      reliability of Changes. The same decision forbids any change that can
      exhaust a machine's memory.
  - Measurement setup, an investigation on 2026-11-21, not an acceptance
    result:
    - Mokly at `beb87a53a6c0cd4fb72b03fba404ca1318894ad8`, before PR #459,
      which merged as `793d0c77d`. PR #459 changed sidecar PostCSS
      preparation and render code, not the code of this check.
    - The `mokly-ai/mokly-cloud` catalogue at
      `194fdb789b243ca649a592c6488e8d56b0a32be5`, in a full clone. It has
      381 expanded records: 283 screens, 94 components, and 4 use cases. It
      has 1,508 document views.
    - Linux with four vCPUs, four sidecars, four comparison workers, and
      Node 24.22.1. The core was a release build. The npm packages were built
      from the same source.
    - A strict build of the catalogue with Changes and `--base HEAD` passed.
      It wrote 5,485 files.
    - Each sample started
      `mokly serve --config mokly.config.json --base HEAD --sidecars 4 --port 4289 --debug-timings`
      from the restored source. Then it made two one-line title edits at
      line 35 of `docs/mockups/src/screens/product/settings/slug-editor.tsx`.
    - The harness waited for each `ready` publication through the Serve
      events. It added no timeout, retry, or sleep.
    - In each warm edit, all 1,508 views took part: 1,464 reused and 44
      compared. Each edit published `ready` and served all 381 current
      details.
    - A temporary Rust probe outside the repository timed the parts. Mode
      `off` disables its hooks. Mode `coarse` times phases. Mode `detail`
      also times single calls.
    - The modes ran in interleaved rounds, with ten warm edits for each mode.
  - Results, as coarse means over ten warm edits, in milliseconds. A parent
    includes its children:
    - Classification: 384.040. The comparison: 271.878. Outside the
      comparison: 112.162.
    - `find_kept` with the freshness check: 37.202. The means of the five
      runs range from 26.8 to 49.7.
    - Inside it: checkout identity 23.963, working dependency inputs 10.632,
      and install evidence 1.590.
    - Other parts outside the comparison: the pin of the selected base 6.207,
      the final Git reference check 3.756, and the `ready` publication 55.623.
  - Limits of the measurement:
    - In mode `off`, the comparison mean was 211.10 ms, with a range of 157 to
      333 ms. The coarse mean was 272.20 ms. Do not read a difference between
      modes as probe overhead or as a saving.
    - In mode `off`, a classification spent a mean of 96.1 ms outside the
      comparison. Mode `off` gives no split of that time.
    - Use coarse and off values to rank work. Use detail values only to name
      parts. Never add values of different modes, or a parent and its child.
    - Mode `off` is the probe binary with its hooks off, not a clean core.
    - The classification value is the probe's own interval. The standard
      `changes.classify` span also includes the probe's event output.
    - One machine, one catalogue, and one edit shape. No change was tried, so
      no saving was measured.
- **Problem:** On the measured catalogue, each warm edit spends a mean of
  37.2 ms in the kept-base freshness check before the comparison starts. About
  two thirds of it is the checkout identity, which runs three Git processes on
  each edit.
- **Impact if no action:** Each warm edit keeps this cost on the path to
  published Changes. On the measured catalogue, it is about a tenth of the
  coarse classification time.
- **Root question:** How can Serve show on each warm edit that a fresh
  preparation would give the same base, faster, with every freshness check
  kept?
- **Options:**
  - **A.** Split first, with no product change. On current `main`, time each
    Git process of the checkout identity, the working candidate listing, the
    manifest reads, and the install evidence. Count the Git processes of each
    edit. Run the `mokly-cloud` catalogue, `examples/basic`, and the default
    React variant of the
    [large fixture](../../tests/fixtures/large/README.md). Use a full clone
    and a blobless clone. Keep the probe and its results out of the
    repository, and add no test. Then record the split here, and recommend
    the option for the largest part. Effort: Medium.
  - **B.** Keep the file listing of the base commit with the kept base, and
    give the kept list to `git check-attr`. A commit's tree cannot change.
    Each check still runs `git config` and `git check-attr`, so it still sees
    each change of the configuration and the attributes. It saves one Git
    process on each edit, and more in a blobless clone. Cost: the kept base
    holds one path list. A test must show an equal checkout identity with the
    kept list. Effort: Medium.
  - **C.** Run the freshness check beside head work that does not read the
    base, such as head validation. Keep the base decision and base failures
    before the comparison, as now. Cost: a failed check starts a base
    preparation that competes with the head work for workers and sidecars.
    Cancellation must stop both. It removes no work. Effort: Medium.
  - **D.** Add permanent timing spans for the parts of the check, and allow
    them in `crates/mokly-cli/src/serve_trace_stages.rs`. Every
    `--debug-timings` run then shows the split. Cost: more timing records for
    each classification. Stage names are diagnostic details under
    `docs/protocol/mokly-timings.md`. Effort: Small.
- **Left out:**
  - Change nothing. It fails the goal of a shorter warm edit.
  - Skip the check, or run it only on some edits. That breaks the rule that
    each reuse checks freshness first.
  - Skip the check when the watcher saw no change, or when file times stay
    equal. Git reads configuration and attribute files outside the watched
    tree, so a fresh preparation could still differ.
  - Keep the checkout settings of the preparation. The decision in force
    rejects it, because a fresh preparation reads with the current settings.
  - Keep one Git process that answers attribute queries across edits. It
    would not see a configuration change after it started.
- **Assumptions:**
  - Each reuse runs every freshness check with the current settings. Source:
    the Freshness Checks section. Every option keeps it.
  - No option adds a store, a bound, an error, or a gate. Source: the user
    decision of 2026-11-16. B adds one path list to the existing kept base.
  - One catalogue in a full clone shows the cost. Source: the measurement of
    2026-11-21. A adds `examples/basic`, the large React fixture, and a
    blobless clone.
- **Wider fix:** None, because this is a speed opportunity, not a class of
  defect. D keeps the parts of the check visible in later timing runs.
- **Previous examples:**
  - On 2026-11-20, `blobless-base-read-extra-listing.md` recorded about 35 to
    40 ms per edit for this check after PR #356, in a full clone.
  - `head-graph-preparation-cost.md` asks for a split of another warm-edit
    phase before it chooses a fix.
- **Related:**
  - [blobless-base-read-extra-listing.md](./blobless-base-read-extra-listing.md):
    the same code. Its extra Git processes run in the listing of this check
    in a blobless clone. B of this item removes that listing from each edit.
  - [plain-git-fsmonitor-override.md](./plain-git-fsmonitor-override.md): the
    same code. Its option D changes the plain `config` and `check-attr`
    requests of this check, and so the checkout identity, once.
  - [changes-detail-revision-copies.md](./changes-detail-revision-copies.md):
    the same measurement. It records the ready publication, the other
    deferred phase outside the comparison.
- **Recommendation:** A. No option is clearly best until a split names the
  costly Git process, and A names it without a product change.
- **Action:** fix after merge, apply A, because the user asked on 2026-11-21
  to handle this phase in a separate later task.

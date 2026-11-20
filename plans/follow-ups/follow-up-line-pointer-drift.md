# Follow-up line pointers drift when code moves

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-17, from the round 1 finding check of the branch
  `calummoore/mokly-parallel-view-comparison-n4kr`, finding 1, which listed
  this class under its new problems. Updated on 2026-11-19 with the
  pointers that the round-2 review of the branch
  `calummoore/mokly-return-warmup` and its checks found wrong. Updated on
  2026-11-20 with the two pointers that the round-2 docs work of the branch
  `calummoore/mokly-stylesheet-resolution-evidence-fix-qnp4` found wrong.
- **Location:** `plans/follow-ups/base-read-cause-unknown.md:12` and line 89,
  `plans/follow-ups/root-switch-reap-wait.md:12` and line 41,
  `plans/follow-ups/forced-kill-reap-wait.md:8`, line 27, and line 29,
  `plans/follow-ups/bundle-cache-request-cost.md:37`,
  `plans/follow-ups/sequential-evidence-capture-cost.md:15` and line 88,
  and `plans/follow-ups/stylesheet-roots-span-parent.md:9` and line 36.
- **Reason:** All these pointers were already wrong on `origin/main`, so a
  separate branch fixes them, and the search rule lives in the shared skills
  repository.

- **Source:** Review.
- **Category:** Docs or spec.
- **Terms:**
  - **Line pointer:** a `path:line` code span in a follow-up item under
    `plans/follow-ups/` that names a place in the code.
  - **Stale-reference search:** the rule of the shared `git-commit` and
    `documentation` skills to search `docs/`, `plans/`, and every `README.md`
    for a name that a change removes or renames.
- **Background:**
  - Follow-up items name code places as line pointers. The follow-up layout
    asks for "Each file path and line" in the **Location** field.
  - The shared skills come from the `Firna-AI/skills` repository, outside
    this repository. The `git-commit` skill, section "Removals and renames",
    says: "When a change removes or renames a feature, test, fixture,
    scenario, command, or file, search `docs/`, `plans/`, and every
    `README.md` for its name." The `documentation` skill says: "When a change
    removes or renames anything, search `docs/`, `plans/`, and every
    `README.md` for its name".
  - Neither rule asks for a search when a symbol moves to another file, or
    when lines above a pointed line change.
  - Two pointers were already wrong on `origin/main` at
    `0b82cf6c0`:
    - The [completed isolated Git item](https://github.com/mokly-ai/mokly/blob/a16a623e670deca5256ef6a43044f9441abad313/plans/follow-ups/isolated-git-in-every-test-helper.md?plain=1#L60) lists
      `crates/mokly-compare/tests/engine_support/mod.rs:214` as a local Git
      helper. On `origin/main`, the helper
      `fn git(root: &Path, args: &[&str]) -> Vec<u8>` starts at line 219. At
      commit `4f7bc0213`, it starts at line 232. The shared Git helper change
      completes that item and removes its local Git helper.
    - `plans/follow-ups/base-read-cause-unknown.md:12` and `:89` cite
      `crates/mokly-compare/tests/engine_support/mod.rs:157` to line 159 as
      the fixture that loads a base `GitTree` without its stored failure. On
      `origin/main`, line 156 is `pub fn prepare(`, and lines 157 to 159 are
      its parameters `root`, `tree`, and `cache`.
    - The fixture's `Arc::new(GitTree::new(` call starts at line 102 on
      `origin/main` and at line 108 at `4f7bc0213`. It is probably the
      intended target. Nobody has confirmed that.
  - On 2026-11-17, the branch `calummoore/mokly-parallel-view-comparison-n4kr`
    moved code and then fixed the pointers that its own moves broke:
    - `plans/follow-ups/capture-batch-window.md`: `ThreadWorkers::comparison`
      moved from `crates/mokly-graph/src/workers.rs:148` to line 186.
    - `plans/follow-ups/postcss-request-order-varies.md`:
      `ThreadWorkers::stylesheets` moved from
      `crates/mokly-graph/src/workers.rs:171` to line 209.
    - `plans/follow-ups/authored-asset-generation-race.md`:
      `contains_public_file` moved from `crates/mokly-graph/src/session.rs:225`
      to line 236. The item cites it twice.
    - `plans/follow-ups/skip-equal-before-snapshots.md`: the ordered view
      consumer moved to `crates/mokly-compare/src/comparison_consumer.rs:50`.
    - `plans/follow-ups/serve-scoped-tracing-context.md`: `WorkerContext`
      moved from `crates/mokly-graph/src/workers.rs` to
      `crates/mokly-graph/src/worker_context.rs`.
  - The search rule asked for none of these updates. A review found them.
  - On 2026-11-19, the round-2 review of the branch
    `calummoore/mokly-return-warmup` and its checks found more pointers that
    were already wrong on `origin/main` at `6ae96ed08`. That branch moved each
    target one more line down. The lines below are those of that branch:
    - `root-switch-reap-wait.md:12` and line 41, and
      `forced-kill-reap-wait.md:8`, line 27, and line 29 point into
      `crates/mokly-sidecar/src/process_control.rs`. `ProcessControl::kill`
      is at line 61, `ProcessControl::finish` at line 68, and its `reaped`
      call at line 72.
    - `bundle-cache-request-cost.md:37` and
      `sequential-evidence-capture-cost.md:15` and line 88 cite
      `crates/mokly-sidecar/src/pool_requests.rs:144` to line 145 for the
      `complete_bundle` call. That range names `fn cleanup`. The call is at
      line 141.
    - [`worker-bundle-reuse-provenance.md:10`](https://github.com/mokly-ai/mokly/blob/e5acd1a25355139eeaa4559b3fed0ade35afabee/plans/follow-ups/worker-bundle-reuse-provenance.md?plain=1#L10), line 40, line 106, line 213, and
      line 216 cite `crates/mokly-sidecar/src/pool_requests.rs` lines that sit
      about six lines below their targets. `take_reused` is at line 80, the
      shared compilation starts at line 81, and the `dispose` arm starts at
      line 121.
    - [`worker-bundle-reuse-provenance.md:72`](https://github.com/mokly-ai/mokly/blob/e5acd1a25355139eeaa4559b3fed0ade35afabee/plans/follow-ups/worker-bundle-reuse-provenance.md?plain=1#L72) cites
      `crates/mokly-sidecar/README.md:146` for the runtime-key comparison,
      which is at line 212.
    - The [completed queue-steering item](https://github.com/mokly-ai/mokly/blob/904d1a3e93d1d08b289764a67540ba24450a8aac/plans/follow-ups/sidecar-queue-steering-fixtures.md?plain=1#L7),
      at line 7, line 58, line 59, and line 77, cites
      `crates/mokly-sidecar/src/_tests_/recipe_support.rs`.
      `Fixture::select` is at line 175, `Fixture::probe` at line 212, and the
      idle setup is not at line 141.
  - On 2026-11-20, the round-2 docs work of the branch
    `calummoore/mokly-stylesheet-resolution-evidence-fix-qnp4` found two more
    pointers that were already wrong on `origin/main` at `a2f61eb53`:
    - `stylesheet-roots-span-parent.md:9` cites
      `crates/mokly-render/src/bundle.rs:232`, and its line 36 says that
      `class_maps` calls `stylesheets::roots` at line 232. On `origin/main`
      and on that branch, line 232 is `fn maps_digest`. The call is at
      line 249.
- **Problem:** Line pointers in follow-up items go stale when lines above them
  change or a symbol moves to another file. The stale-reference search names
  removals and renames only, so no rule asks the change to update such
  pointers. The other pointers still need correction.
- **Impact if no action:** A reader who follows a stale pointer opens the
  wrong code and must search for the target. A wrong pointer can also mislead
  a fix. The pointer of `base-read-cause-unknown.md` names function
  parameters, not the tree load.
- **Root question:** How do follow-up items keep each source pointer true when
  the code that it names moves?
- **Options:**
  - **A.** In a later branch, re-anchor the remaining wrong pointers at that
    branch's commit. Cost: the next move can break them again. Effort: Small.
  - **B.** Apply A, and name the symbol beside each remaining pointer, for
    example `GitTree::new` at `crates/mokly-compare/tests/engine_support/mod.rs`
    and its line. A reader then finds a moved target by its name, and a search
    for the name finds the pointer. Cost: the lines can still drift. Effort:
    Small.
  - **C.** Propose to the shared skills repository the extension that the
    finding check suggested. The stale-reference search of the `git-commit`
    and `documentation` skills would also cover moved symbols and shifted line
    pointers.
    - Assessment: the moved-symbol part is cheap and catches a move to
      another file.
    - The shifted-pointer part makes almost every code change search for
      pointers into each changed file and compute their lines again.
    - Nothing enforces either search.
    - Cost: it changes the shared instructions of every repository that uses
      the skills.
    - Effort: Small for the text.
  - **D.** Propose to the shared skills repository that follow-up items anchor
    on a file and a symbol, not on a line. Add the moved-symbol part of C.
    - A line shift then breaks no pointer. The existing rename search, with
      the moved-symbol part, finds every renamed or moved symbol by name.
    - Cost: it changes the follow-up layout, and readers lose the direct line
      jump.
    - Effort: Small for the rule, Medium to move the existing items over
      time.
- **Left out:**
  - A repository check that resolves each line pointer under `plans/` is a new
    gate, so it needs the user. It also cannot tell a moved target from a
    line that still exists.
  - Fixing the two wrong pointers on the branch that found them breaks the
    rule that a problem outside the review scope gets its fix in a separate
    branch.
- **Wider fix:** D. It removes line shifts as a cause and finds moved symbols
  by name, so the class stays fixed when the code changes shape.
- **Previous examples:** Commit `6e02b32dd` of 2026-11-01 re-anchored line
  pointers in `plans/follow-ups/nested-own-preview-matches.md` after code
  moved. The five fixes of 2026-11-17 above. On 2026-11-18, the branch
  `calummoore/fu-linked-renderer-stylesheet-root-crva` moved configuration
  validation to `crates/mokly-catalogue/src/config_inputs.rs`. It re-anchored
  27 pointers that its change shifted in nine items. Each pointer now has
  a symbol name near it. Option D still owns file-and-symbol anchors in the
  shared skills. On 2026-11-19, the branch `calummoore/mokly-return-warmup`
  moved seven pointers that were right on `origin/main`, and its round-2
  review found five of them. It re-anchored all seven with a symbol beside
  each, after a diff-based comparison of every pointer into each changed
  file. On 2026-11-20, the branch
  `calummoore/mokly-stylesheet-resolution-evidence-fix-qnp4` re-anchored the
  two pointers of `stylesheet-roots-span-parent.md` that its change moved,
  from `crates/mokly-render/src/stylesheets.rs:91` to line 92.
- **Related:**
  - `plans/follow-ups/base-read-cause-unknown.md`: it holds the wrong pointers
    at lines 12 and 89. Fix those pointers with option A or B of this item.
- **Recommendation:** B. It fixes the remaining pointers and keeps them easy to
  find after the next move, with no change to shared instructions. D best
  protects the codebase, but it changes the shared skills repository.
- **Action:** fix after merge, apply B, because these pointers were already
  wrong on `origin/main`, and the wider fix D belongs to the shared skills
  repository, outside this repository.

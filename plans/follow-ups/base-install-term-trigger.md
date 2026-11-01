# Three items misstate when a base install runs

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** Yes.
- **Kind:** Outside the scope.
- **Added:** 2026-11-01, from the branch
  `conductor/rust-rebuild-150-process-tree-stops`. The finding check of its
  third review round found it outside the scope.
- **Location:** `plans/follow-ups/package-manager-script-guard-fixtures.md:17`
  to line 19, `plans/follow-ups/typed-lockfile-model.md:14` to line 16, and
  `plans/follow-ups/yarn-tls-file-confinement.md:18` to line 20.
- **Reason:** The three items are older than the branch that found the
  problem, and the diff of that branch does not change them.

- **Source:** Review.
- **Category:** Docs or spec.
- **Terms:**
  - **Base install:** the private install of the base commit's
    dependencies when the base needs JavaScript rendering and its
    dependency inputs differ from the working tree.
  - **Dependency inputs:** the tracked package manifests and lockfiles of a
    side, and with pnpm or Yarn lockfiles also the manager configuration
    files.
- **Background:**
  - Each of the three items defines the base install with the same words
    in its **Terms**. The words are: "the private install of the base
    commit's dependencies that Changes runs when the base lockfile differs
    from the working tree."
  - `crates/mokly-cli/src/changes_base.rs:87` to line 91 sets the flag
    `needs_sidecar`, which says whether the base needs JavaScript rendering.
    The flag reads the base configuration and the base catalogue. It is true
    when the configuration names PostCSS or a renderer. It is also true when
    the catalogue has an entry module or a stories file that is not
    excluded.
  - Lines 92 to 102 prepare the base dependencies only when `needs_sidecar`
    is true. Only that path can start a package manager.
  - Otherwise, lines 109 to 123 call `html_dependencies`. It compares only
    the manifests and the lockfiles that govern the `node_modules`
    directories of the head. When they differ, it gives the warning "Base
    dependencies differ. HTML comparison uses working-tree dependencies."
  - `docs/protocol/mokly-comparison.md:162` to line 164 states the rule. An
    HTML-only catalogue without a renderer or PostCSS "needs no extraction,
    Node process, or package installation."
  - `crates/mokly-compare/src/dependencies.rs:51` uses the working tree's
    dependencies with no install when the dependency inputs of both sides
    are equal.
  - `docs/protocol/mokly-base-dependencies.md:11` to line 14 lists the
    dependency inputs. They hold every tracked package manifest and
    lockfile. With pnpm or Yarn lockfiles, they also hold
    `pnpm-workspace.yaml`, `.yarnrc.yml`, `.yarnrc`, and `.npmrc`.
  - `plans/follow-ups/install-pipe-wait-after-stop.md` already holds the
    corrected term, with the conditions in its **Background**.
- **Problem:** The three items say that a lockfile difference alone starts
  a base install. An HTML-only base never starts one. A change to a manifest
  or to a manager configuration file can also start one.
- **Impact if no action:** A reader who sets up a run from these words can
  choose an HTML-only catalogue, and then no install starts. Option C of
  `plans/follow-ups/package-manager-script-guard-fixtures.md` asks for runs
  with a real base install.
- **Root question:** How do these items tell a reader when Changes starts a
  base install?
- **Options:**
  - **A.** Replace the **Base install** term of each item with the term
    above. Add the **Dependency inputs** term and the facts that an item
    needs from the **Background** above. Skip an item that a branch has
    already deleted. Effort: Small.
  - **B.** Cut the condition from the term of each item. Each term then says
    only "the private install of the base commit's dependencies". No item
    then holds a condition that can become stale. A reader who sets up a
    real install must find the conditions in the code. Effort: Small.
  - **C.** Do A. Also add one sentence to
    `docs/protocol/mokly-base-dependencies.md` that states both conditions
    in one place. The two pages then state the HTML-only rule twice, and
    the two copies can drift. Effort: Small.
- **Left out:**
  - Change nothing. The three items stay wrong, so it fails the goal.
  - Replace the condition with a link to the two protocol pages. It breaks
    the rule of the `plans` skill that an item copies each fact that its
    work needs.
  - A lint or a test that compares each copy of the term with the code. It
    breaks the rule of the `testing` skill that plans and doc prose get no
    test.
  - Install the dependencies of an HTML-only base. It breaks the rule in
    force at `docs/protocol/mokly-comparison.md:162` to line 164.
- **Wider fix:** None. The `plans` skill already requires each item to
  agree with the code and to copy its own facts. C gives one source to copy
  from, but it does not stop a wrong copy.
- **Previous examples:** On 2026-11-01, two new items of the branch
  `conductor/rust-rebuild-150-process-tree-stops` copied the same words. A
  review of that branch found that one copy led its smoke task to an
  HTML-only catalogue, which starts no install.
- **Recommendation:** A. It makes each item true and keeps the conditions
  that a real run needs, at the same effort as B.
- **Action:** fix after merge, apply A, because the branch that found the
  problem does not change the three items, and A adds no requirement.

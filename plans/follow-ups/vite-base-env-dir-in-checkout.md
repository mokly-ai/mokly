# The base reads head env files in the checkout

- **Severity:** High. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-25, from round 2 of the implementation review of the
  branch `calummoore/storybook-track-d-finish-nkpi`: a new problem that the
  finding check of finding 104 found.
- **Location:** `packages/mokly/src/sidecar/vite-working-env.ts:71`,
  `packages/mokly/src/sidecar/vite-base-env.ts:31`, and the section "The Base
  Side" of `docs/protocol/mokly-vite-adapter-inputs.md`.
- **Reason:** The case needs an `envDir` that a config sets to an absolute
  path inside the working checkout, which is a rare setup.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Vite adapter:** The optional compile path that compiles JavaScript and
    transforms stylesheets through the project's own Vite setup.
  - **Head and base:** The two sides of a comparison. The head is the working
    checkout. The base is the selected commit.
  - **Extraction:** The cached copy of the files of the base commit. The base
    sidecar uses it as its source root.
  - **Kept base:** A prepared base side that Serve keeps while its freshness
    checks pass.
- **Background:**
  - The base side applies precedence rules to each env candidate, under
    `docs/protocol/mokly-vite-adapter-inputs.md:94` to line 97. A file that
    the base commit holds comes from the base commit. A file that the base
    commit lacks and the Git index holds is absent. Each other file comes
    from the working tree. The working-tree reads take part in the freshness
    checks of a kept base.
  - The read hook observes only candidates inside the source root or a
    selected dependency root, at
    `packages/mokly/src/sidecar/vite-working-env.ts:71`. On the base side,
    the source root is the extraction.
  - The base selector returns a candidate outside the source root unchanged,
    with `working: false`, at `packages/mokly/src/sidecar/vite-base-env.ts:31`.
    Only working reads enter the freshness record, at
    `crates/mokly-render/src/vite_base_env.rs:53`.
  - A config can set `envDir` to an absolute path, such as a hard-coded path
    into the checkout. On the base side, that path stays inside the working
    checkout and outside the extraction.
- **Problem:** For such an `envDir`, the base side skips the read hook and
  the precedence rules. It reads the head's bytes under the repository name,
  with `working: false`. This comes from a read of the code. Nobody ran it.
- **Impact if no action:** Changes hides a branch edit of a tracked env
  file, because both sides read the head's file. The file also stays out of
  the freshness check of a kept base.
- **Root question:** How does the base side read an env candidate that
  resolves inside the working checkout and outside the extraction?
- **Options:**
  - **A.** On the base side, map a candidate inside the working checkout to
    its repository path. Select it with the precedence rules, as a candidate
    inside the extraction. Snapshot it in the read hook, and mark each
    working-tree read as working. Test an absolute `envDir` into the
    checkout, with a tracked file that the branch edits and with an untracked
    file. Effort: Medium.
  - **B.** Fail the base setup when the resolved `envDir` is inside the
    working checkout and outside the extraction. The diagnostic names the
    `envDir` setting and asks for a path relative to the config. Cost: a new
    failure for a setup that works on the head side, so the user must approve
    it. Effort: Small.
- **Left out:**
  - Read the head's file, and only mark it as working. It fails the goal,
    because Changes still hides a branch edit of a tracked env file.
  - Only two real approaches remain: read the base commit's file, or reject
    the setting.
- **Wider fix:** A. One mapping from a path in the working checkout to its
  repository path lets each base reader apply the base rules, whatever path
  the config wrote.
- **Previous examples:** `plans/follow-ups/base-extraction-committed-links.md`
  records other base reads that miss the base commit.
- **Related:** `plans/follow-ups/vite-outside-env-directory.md`: the same
  base selector. Its option D covers an `envDir` outside the checkout. This
  item covers an `envDir` inside the checkout. The two rules do not overlap,
  so either change can land first.
- **Recommendation:** A. It applies the precedence rules that the inputs page
  already states, so it changes no requirement.
- **Action:** fix after merge, apply A, because the case needs an absolute
  `envDir` inside the checkout, a rare setup, and A changes no requirement.

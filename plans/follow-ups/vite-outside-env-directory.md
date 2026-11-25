# An outside envDir fails the Vite setup

- **Severity:** High. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-25, from round 2 of the implementation review of the
  branch `calummoore/storybook-track-d-finish-nkpi`, findings 104 and 136,
  which repeat each other. This item merges the options of both findings
  and of their finding checks.
- **Location:** `packages/mokly/src/sidecar/vite-working-env.ts:65`,
  `packages/mokly/src/sidecar/vite-working-env.ts:91`,
  `packages/mokly/src/sidecar/module-paths.ts:134`,
  `packages/mokly/src/sidecar/vite-base-env.ts:31`, and the section "The Base
  Side" of `docs/protocol/mokly-vite-adapter-inputs.md`.
- **Reason:** The input rules cover link targets outside the repository but
  not a directly configured outside `envDir` or its watch, and the
  recommended D takes its watch rule from the open item
  `plans/follow-ups/vite-env-link-target-watch.md`.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Vite adapter:** The optional compile path that compiles JavaScript and
    transforms stylesheets through the project's own Vite setup.
  - **`envDir`:** The Vite setting that selects the directory of the dotenv
    files.
  - **Head and base:** The two sides of a comparison. The head is the working
    checkout. The base is the selected commit, which Mokly extracts into its
    cache.
  - **Kept base:** A prepared base side that Serve keeps while its freshness
    checks pass.
- **Background:**
  - Vite loads `.env`, `.env.local`, `.env.development`, and
    `.env.development.local` from `envDir`. `vite dev` loads an `envDir`
    outside the checkout and watches its four files
    (`node_modules/vite/dist/node/chunks/node.js:37704`, `node.js:24778`).
  - `docs/protocol/mokly-vite-adapter-inputs.md:14` makes the four candidates
    setup inputs that move every render key. An env candidate keeps its own
    logical path, and both sides can read a link target outside the
    repository, at line 89 to line 91.
  - On 2026-11-25 the user decided that tracked env files come from the base
    commit and untracked env files from the working tree. A design call of
    the same date reads each env file that neither the base commit nor the
    Git index holds from the working tree. Another design call of that date
    says that reads that only the base side makes add no watch input. A third
    one skips a PostCSS config outside the roots with a diagnostic, at
    `docs/protocol/mokly-vite-adapter-inputs.md:45`.
  - Equal setup inputs use equal render identities on both sides. Their
    logical names and digests decide the identity, not their physical read
    paths (`docs/protocol/mokly-vite-adapter-inputs.md:42`). A path relative
    to each side's source root is not equal for a literal absolute
    directory, because the checkout and the extraction are at different
    places.
  - On the base side, Vite resolves `envDir` against the extraction in
    Mokly's cache. `__dirname` is in the extraction
    (`packages/mokly/src/sidecar/vite-config-source.ts:32`), and so is
    `process.cwd()` (`crates/mokly-sidecar/src/pool_options.rs:15`). Vite
    gives Mokly only the resolved absolute path.
  - No Vite diagnostic shows an absolute path
    (`docs/protocol/mokly-vite-adapter.md:163`), and a setup change error
    prints the input name (`packages/mokly/src/sidecar/vite-setup-input.ts:24`).
    So each name and each diagnostic uses the `envDir` setting and the file
    names only.
  - A comparison needs `repoRoot` at the Git top level
    (`docs/protocol/mokly-configuration.md:154`), so no commit holds a file
    outside it.
  - Module confinement stays for JavaScript and CSS modules, under
    `docs/protocol/mokly-sidecar-modules.md:74`. An env file is not a module.
- **Problem:** The read hook takes only candidates inside the source root or
  a selected dependency root, at `vite-working-env.ts:65`. So the files of
  an outside `envDir` bypass the byte snapshot. The final snapshot, at line
  91, then names each candidate through the confined module paths, and
  `ModulePaths.name` throws for a directory outside all mapped roots, at
  `module-paths.ts:134`. It throws also when all four candidates are absent,
  on both sides. The message names no config file and no setting:
  `module .env is outside sourceRoot and selected dependency roots`.
- **Screenshot:** Show the build terminal for a project with a shared dotenv
  directory outside the checkout. Mark the outside-root error on the dotenv
  candidate.
- **Impact if no action:** A working Vite project that names a shared
  dotenv directory outside its checkout cannot prepare either side in Mokly.
- **Root question:** Does the Vite adapter accept a dotenv directory outside
  the checkout, and if it does, how do both sides read the same files and
  see their edits?
- **Options:**
  - **A.** Keep `envDir` inside the roots. Fail the setup with a diagnostic
    that names the Vite config file, the `envDir` setting, and the file
    names, with no absolute path. Document the route inside the repository:
    an env file or an `envDir` in the repository can be a symbolic link to
    the shared files. Effort: Small.
  - **B.** Hide outside candidates from Vite. In the read hook, answer each
    dotenv candidate outside the source root and the selected dependency
    roots as absent during the setup. Leave it out of the snapshot. Send one
    `diagnostic` event that names the `envDir` setting and the file names.
    State the rule next to the PostCSS rule on the inputs page, and add the
    exception to `docs/guides/authoring/vite.md:45`. Test present outside
    files on both sides. Cost: a view that reads these values differs from
    `vite dev`. Both sides miss the same values, so Changes stays correct.
    An `envDir` is an explicit project setting, while an outside PostCSS
    config is only a file that Vite's upward lookup finds. When the user
    chose the env rules on 2026-11-25, a setup with no env files stayed out
    for the same reason. Effort: Small.
  - **C.** Support an explicitly configured absolute outside directory. Give
    its candidates stable names and separate physical evidence. Define how
    Serve watches it and how both sides share the values. Cost: a relative
    or a computed `envDir` resolves inside Mokly's cache on the base side, so
    the base reads absent files, and Changes shows a false change. Effort:
    Medium.
  - **D.** One admission rule for each env candidate outside the checkout,
    through a direct `envDir` or a link:
    - Name each candidate of an outside `envDir` with a fixed prefix and its
      file name. The name is equal on both sides and holds no absolute path.
      Admit only the four candidates of the resolved `envDir`, so the names
      stay unique. Snapshot each one in the read hook, so that the
      one-snapshot rule of the setup covers it.
    - On the base side, treat an `envDir` inside Mokly's cache directory and
      outside the extraction as derived from the root. Read the same path
      relative to the working checkout. Read every other outside path as
      Vite resolved it.
    - Mark each outside candidate as a working read on the base side, so the
      kept-base freshness check covers it. Today
      `packages/mokly/src/sidecar/vite-base-env.ts:31` returns
      `working: false` for it, and
      `crates/mokly-render/src/vite_base_env.rs:53` records only working
      reads.
    - Take the watch rule from `plans/follow-ups/vite-env-link-target-watch.md`,
      and register the physical file, not the name.
    - State the rules in `docs/protocol/mokly-vite-adapter-inputs.md` and
      `docs/protocol/mokly-watch.md`. Test a literal absolute, a relative,
      and a `__dirname`-computed `envDir` on both sides, with present and
      absent candidates, and an edit of an outside file in Serve.
    - Cost: the base rule depends on the cache location, and each rule needs
      a protocol sentence. No wire change is necessary, because each env
      input already keeps its logical name apart from its physical file.
    - Effort: Medium.
  - **E.** D without the watch. State on the inputs page and in
    `docs/guides/authoring/vite.md` that Serve shows an edit inside an
    outside `envDir` only after the next rebuild or a restart. The next
    request still reloads the setup, because each request compares the setup
    stamp (`packages/mokly/src/sidecar/vite-context.ts:106`). Choose E when
    the user answers the link target watch item with its option E. Cost:
    Serve stays stale for this case until another rebuild, and the reload
    promise of the guide gets narrower. Effort: Medium.
  - **F.** Declare each outside dotenv directory in a new field of the `vite`
    object of `mokly.config.json`, relative to `repoRoot` or absolute. Admit
    an outside `envDir` only when it equals a declared directory, resolved
    against the side's source root. Fail with a diagnostic that names the
    field otherwise. Both sides read the declared directory resolved against
    the working checkout, so the base side needs no guess. Cost: a new
    configuration field with its schema, validation, wire field, and docs.
    The field repeats a Vite setting. Effort: Large.
- **Left out:**
  - Skip outside candidates after Vite reads them. It fails the goal, because
    an edit then changes the output and moves no setup key.
  - Let every module input use outside paths. It breaks the module
    confinement rule, which stays. D gives env files their own names and
    needs no change to that rule.
  - Read the head's resolved `envDir` on the base side. It fails the goal,
    because a branch that changes `envDir` then shows no change in Changes.
- **Wider fix:** D. It classifies an outside directory by where it resolves,
  so it holds for a literal, a relative, and a computed `envDir`, and for a
  link at `envDir` or at a candidate. C must know the authored form, which
  Mokly cannot see.
- **Previous examples:** The fix of 2026-11-25 for committed dotenv links
  keeps the logical name of each env input apart from its physical read
  path. `tests/fixtures/vite_env_changes.ts:110` covers a linked candidate
  with an outside target.
- **Related:**
  - `plans/follow-ups/vite-env-link-target-watch.md`: work that waits for the
    answer. That item decides whether Serve watches an env file outside the
    repository that the head reads through a link. D takes its watch rule
    from that answer. Under its option C, the same core mapping admits the
    parent directory of an outside candidate. Under its option E, choose E
    here.
  - `plans/follow-ups/vite-static-build-input-evidence.md`: work that waits
    for the answer. If this item admits outside env files, the static build
    rule there must say whether they take part.
  - `plans/follow-ups/vite-base-env-dir-in-checkout.md`: the same base
    selector. That item covers an `envDir` inside the working checkout and
    outside the extraction. The base rule of D covers only an `envDir`
    outside the checkout, so the two rules do not overlap.
  - `plans/follow-ups/installed-module-watch-paths.md`: the same cause in the
    JavaScript watch plan. `crates/mokly-render/src/bundle_finish.rs:61`
    sends the logical name of each env input, and
    `crates/mokly-watch/src/plan.rs:137` joins that name to the repository
    root. An outside candidate has no repository path, so the watch of C and
    D needs the physical route that the mapping of that item carries.
  - `plans/follow-ups/vite-setup-error-location.md`: for A only. The
    diagnostic of A is a setup failure. That item names the config file for
    each setup failure, but the env snapshot runs after the setup loads, at
    `packages/mokly/src/sidecar/vite-setup.ts:70`, so its fix does not reach
    the diagnostic of A. A must name the config file itself.
  - `plans/follow-ups/base-link-target-batch-reads.md`: its option C changes
    the same base selection, so that option waits for this answer.
- **Recommendation:** D. It adds the base rule and the watch rule that C
  leaves open. Without the base rule, a config that computes `envDir` from
  `__dirname` reads an absent directory in Mokly's cache on the base side,
  and Changes shows a false change in each view that reads the values. C has
  the same gap, because a computed path is absolute. If the user does not
  want Mokly to read outside the checkout, choose A. Choose B to keep builds
  running without these values.
- **Action:** ask the user, because the input rules do not settle a directly
  configured outside `envDir` and its watch, and the recommended D takes its
  watch rule from the answer to
  `plans/follow-ups/vite-env-link-target-watch.md`.

# The base extraction drops committed links

- **Severity:** High. **Likelihood:** Rare. **Effort:** Large. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-25, from round 1 of the implementation review of the
  branch `calummoore/storybook-track-d-finish-nkpi`, finding 4, option C.
  The branch applied option D of that finding, a direct fix for env files.
  This item is its wider fix.
- **Location:** `crates/mokly-git/src/extraction.rs:28`,
  `crates/mokly-git/src/extraction.rs:31`,
  `packages/mokly/src/sidecar/vite-postcss-lookup.ts:118`,
  `packages/mokly/src/sidecar/vite-config.ts:58`, the section "Tree, Blob,
  And Source Archive Reads" of `docs/protocol/mokly-git.md`, and
  `docs/protocol/mokly-root-discovery.md:14`.
- **Reason:** C changes the extraction rule of `docs/protocol/mokly-git.md`
  and the reason of the root-discovery rejection of a linked root, and no
  user decision covers either change.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Base:** The selected Git commit that Mokly renders as the historical
    side of Changes. The head is the working tree.
  - **Base extraction:** The cached copy of the regular files of the base
    commit. The sidecar reads the base side from it.
  - **Committed link:** A symbolic link that a commit holds as a Git tree
    entry.
  - **Git index:** The working checkout's list of tracked paths and staged
    changes.
  - **Dotenv file:** A file such as `.env` from which Vite loads environment
    values.
- **Background:**
  - `docs/protocol/mokly-git.md` says that an extraction keeps executable
    files and omits links and submodules. It also says that a base file read
    needs exact regular-file mode in the tree of the pinned commit. A base
    file read follows no symbolic link.
  - `docs/protocol/mokly-root-discovery.md:14` says that a root or package
    root that is a link in the base commit, or lies below one, fails base
    validation with `config-invalid`. Its reason: the base extraction holds
    regular files only, so JavaScript below a linked root would still fail.
  - `docs/protocol/mokly-vite-adapter-inputs.md`, section "The Base Side",
    says how the base side reads each env file. A file that the base commit
    holds comes from the base commit. A file that the base commit lacks and
    the Git index holds is absent. Each other file comes from the working
    tree. An env file can be a symbolic link to a regular file. Both sides
    then read the target, and the input keeps the env file's own path.
  - On 2026-11-25 the user decided where the base side reads env files.
    Tracked env files come from the base commit, and untracked env files come
    from the working tree.
  - On 2026-11-25 the branch that found this item fixed the env case, with
    option D below. The other base readers keep the defect.
- **Problem:**
  - The extraction drops every committed link, at
    `crates/mokly-git/src/extraction.rs:31`. A base reader that treats
    absence from the extraction as absence from the commit then misreads a
    committed link.
  - The base Vite setup looks up its PostCSS config at
    `packages/mokly/src/sidecar/vite-postcss-lookup.ts:118` and its default
    Vite config file at `packages/mokly/src/sidecar/vite-config.ts:58` in
    the extraction. So a committed link at either path reads as absent, and
    the base runs without that config.
  - Before the direct fix, the same cause hit env files in four ways. A head
    file that replaced a committed env link gave both sides the new bytes. A
    kept link gave a false change. A removed link hid the removal. A
    committed directory link above the env files, such as a linked
    `envDir`, made the base read the head's files and hide a branch edit.
  - Base JavaScript cannot resolve through committed links either. This is
    the reason of the root-discovery rejection.
- **Screenshot:** Show Changes when the replacement of the committed link
  supplies the only changed value, and mark the empty result.
- **Impact if no action:** The base side can run without a config that the
  base commit holds through a link. Changes can then show a false change, or
  hide a real change in each view that the config affects.
- **Root question:** How does the base side read each input that the base
  commit reaches through a committed symbolic link?
- **Options:**
  - **A.** For env files only, the dotenv selector checks the pinned tree for
    each candidate. It resolves confined committed links to regular files of
    that commit. The extraction keeps regular files only. Effort: Medium.
  - **B.** Give the historical source readers one shared, confined link
    resolver for Git trees. Use it for the dotenv candidates, and define its
    scope for the other source readers. B prevents the class only in the
    readers that call it, so each new input needs its own wiring. Its use by
    other readers needs a separate decision. Effort: Large.
  - **C.** Keep committed links in the base extraction:
    - Keep each committed link whose target stays inside the commit, so that
      Vite and Node follow it on the base side as they do on the head side.
    - On a host that cannot create links, use a copy of the target.
    - Name each env input by the env file's own path.
    - A committed env link whose target the commit lacks still needs the
      target rule of D.
    - Cost: it changes the extraction rule of `docs/protocol/mokly-git.md`
      and the reason of the root-discovery rejection. It needs a new
      extraction cache identity. Base JavaScript then resolves through
      committed links.
    - Effort: Large.
  - **D.** The direct fix for env files, applied on 2026-11-25:
    - Apply A, and resolve committed links at each component of the
      candidate path in the pinned tree, so that a linked `envDir` also reads
      the base commit.
    - When the base commit lacks the final target, apply the env rule to the
      target path. The target is absent when the Git index holds it. Else it
      is the working-tree file, also outside the repository, as Vite reads
      it.
    - Name the input by the env file's own path.
    - Test a kept link, a link that the head replaces with an untracked
      file, a removed link, and a link to a Git-ignored target.
    - No Git reader returned a link target before, so Rust reads the link
      blob and passes the base link entries to the sidecar.
    - Effort: Medium.
- **Left out:**
  - Change nothing beyond D. The PostCSS config candidates, the default Vite
    config file, and base JavaScript still miss committed links.
  - Suppress only the working-tree fallback. It fails the goal, because the
    base value stays missing.
  - Follow the live link for a target that the base commit holds. It loses
    the pinned value. D uses the live target only when the base commit lacks
    it, where no pinned value exists.
  - A visible failure, such as `config-invalid` or a warning that names a
    committed env link. It breaks the user's decision of 2026-11-25 to read
    tracked env files from the base commit, and the target bytes are
    available.
- **Wider fix:** C. With the links in the extraction, each input that the
  base Vite setup reads, present or absent, sees a committed link as a
  checkout does. This includes the PostCSS config candidates and the default
  Vite config file. B needs wiring in each reader.
- **Previous examples:** `plans/follow-ups/marked-reuse-link-retarget.md`
  records a related failure to keep the source selection through a link.
- **Recommendation:** C. It fixes the class for every base reader at once,
  and a new input needs no wiring of its own. Decide in the same answer
  whether the root-discovery rejection of a linked root stays, because C
  removes its reason.
- **Action:** ask the user, because C changes the extraction rule of
  `docs/protocol/mokly-git.md` and the reason of the root-discovery
  rejection, and no user decision covers either change.

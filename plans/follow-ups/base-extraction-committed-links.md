# The base extraction drops committed links

- **Severity:** High. **Likelihood:** Rare. **Effort:** Large. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-25, from round 1 of the implementation review of the
  branch `calummoore/storybook-track-d-finish-nkpi`, finding 4, option C.
  The branch applied option D of that finding, a direct fix for env files.
  This item is its wider fix. On 2026-11-25, round 2 of the same review added
  findings 109 and 137, which repeat each other: the Vite and PostCSS config
  links, the `tsconfig.json` readers, and options E to H. Option D of their
  finding checks, a named failure, is option E here. The `tsconfig.json`
  reader of the default compiler is outside the scope of that review.
- **Location:** `crates/mokly-git/src/extraction.rs:28`,
  `crates/mokly-git/src/extraction.rs:31`,
  `packages/mokly/src/sidecar/vite-postcss-lookup.ts:118`,
  `packages/mokly/src/sidecar/vite-config.ts:59`,
  `packages/mokly/src/sidecar/config-inputs.ts:86`,
  `packages/mokly/src/sidecar/vite-base-env.ts:44`, the section "Tree, Blob,
  And Source Archive Reads" of `docs/protocol/mokly-git.md`, the section "The
  Base Side" of `docs/protocol/mokly-vite-adapter-inputs.md`, and
  `docs/protocol/mokly-root-discovery.md:14`.
- **Reason:** C changes the extraction rule of `docs/protocol/mokly-git.md`
  and the reason of the root-discovery rejection, E adds a new failure, and
  no user decision covers these changes.

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
    Changes then shows "base validation failed", under
    `docs/protocol/mokly-base-preparation.md:99`.
  - `docs/protocol/mokly-vite-adapter-inputs.md`, section "The Base Side",
    says that the base side compiles with the base commit's setup in its
    extraction, all from the base commit. No user decision and no design call
    covers config links. The same section says how the base side reads each
    env file. A file that the base commit holds comes from the base commit. A
    file that the base commit lacks and the Git index holds is absent. Each
    other file comes from the working tree. An env file can be a symbolic
    link to a regular file. Both sides then read the target, and the input
    keeps the env file's own path.
  - On 2026-11-25 the user decided where the base side reads env files.
    Tracked env files come from the base commit, and untracked env files come
    from the working tree.
  - On 2026-11-25 the branch that found this item fixed the env case, with
    option D below. The other base readers keep the defect.
  - The base sidecar already receives every committed link of the pinned
    tree in `ViteBaseEnv.links`
    (`crates/mokly-compare/src/base_vite_env.rs:37`,
    `crates/mokly-cli/src/changes_base.rs:166`). It resolves link chains with
    `ViteBaseEnv.target`, at `packages/mokly/src/sidecar/vite-base-env.ts:44`.
    The map is complete, because an attached extraction lists the whole tree
    (`crates/mokly-compare/src/sources_extraction.rs:27`).
  - The setup identity uses logical names and digests, under
    `docs/protocol/mokly-vite-adapter-inputs.md:42`. The config record probes
    each config candidate again at snapshot time
    (`packages/mokly/src/sidecar/vite-setup-snapshot.ts:39`), and the reuse
    stamp probes again (`packages/mokly/src/sidecar/vite-context.ts:110`).
  - Vite's bundled lilconfig reads a found PostCSS candidate with a
    `fs.promises.readFile` that it keeps from its first load, and then it
    gives the path to its loader
    (`node_modules/vite/dist/node/chunks/node.js:6577`).
  - Readers that Mokly does not own probe the same extraction. esbuild
    resolves the Vite config entry itself
    (`packages/mokly/src/sidecar/vite-config-bundle.ts:63`). Vite 8 sends each
    TypeScript transform to Rolldown's native `transformSync`, which finds
    the nearest `tsconfig.json` in its own cache (`node.js:7583`,
    `node.js:7656` to line 7662). Browserslist, which Autoprefixer uses,
    probes `.browserslistrc` and `package.json` in each parent directory
    (`node_modules/browserslist/node.js:418`).
- **Problem:**
  - The extraction drops every committed link, at
    `crates/mokly-git/src/extraction.rs:31`. A base reader that treats
    absence from the extraction as absence from the commit then misreads a
    committed link.
  - The base Vite setup looks up its PostCSS config at
    `packages/mokly/src/sidecar/vite-postcss-lookup.ts:118` and its default
    Vite config file at `packages/mokly/src/sidecar/vite-config.ts:59` in
    the extraction. So a committed link at either path reads as absent, and
    the base runs without that config. The head loads the target, so Changes
    can show a false difference, or hide a change that only the base config
    would show.
  - A committed `tsconfig.json` link also reads as absent on the base side.
    Under the adapter, Rolldown's lookup then misses it, so the base can
    compile JSX or decorators with other settings than the head. On the
    default compiler, the head follows the link, as
    `tests/sidecar_absolute_paths.test.ts:211` tests, but the base lookup at
    `packages/mokly/src/sidecar/config-inputs.ts:86` probes the extraction.
    The base can then lose the `paths` mappings and the parse options of
    that file, and give a false difference or a base failure. The default
    compiler case is older than the Vite adapter.
  - A committed config link can name a target that the base commit does not
    hold, such as a Git-ignored local config. The head loads the target, but
    no pinned bytes exist.
  - Before the direct fix, the same cause hit env files in four ways. A head
    file that replaced a committed env link gave both sides the new bytes. A
    kept link gave a false change. A removed link hid the removal. A
    committed directory link above the env files, such as a linked
    `envDir`, made the base read the head's files and hide a branch edit.
  - Base JavaScript cannot resolve through committed links either. This is
    the reason of the root-discovery rejection.
- **Screenshot:** In Changes for an unchanged linked config, mark the base
  rendering that used the default settings and the false difference.
- **Impact if no action:** The base side can run without a config that the
  base commit holds through a link. Changes can then show a false change, or
  hide a real change in each view that the config affects.
- **Root question:** How does the base side read each input that the base
  commit reaches through a committed symbolic link, whichever reader looks
  up the path, and what does it do when the commit does not hold the target
  of the link?
- **Options:**
  - **A.** For env files only, the dotenv selector checks the pinned tree for
    each candidate. It resolves confined committed links to regular files of
    that commit. The extraction keeps regular files only. Effort: Medium.
  - **B.** Give the historical source readers one shared, confined link
    resolver for Git trees. Use it for the dotenv candidates, and define its
    scope for the other source readers. B prevents the class only in the
    readers that call it, so each new input needs its own wiring. Its use by
    other readers needs a separate decision. The sidecar already has the
    resolver, `ViteBaseEnv.target`, so the cost of B is the read redirection
    at each lookup. Readers in native code, such as Rolldown's
    `tsconfig.json` lookup, stay uncovered. Effort: Large.
  - **C.** Keep committed links in the base extraction:
    - Keep each committed link whose target stays inside the commit, so that
      Vite, Node, esbuild, and Rolldown follow it on the base side as they do
      on the head side.
    - Resolve each link chain in the pinned tree. Read the link blobs in a
      batch, as `plans/follow-ups/base-link-target-batch-reads.md` proposes.
    - On a host that cannot create links, use a copy of the target.
    - Name each env input by the env file's own path.
    - A committed env link whose target the commit lacks still needs the
      target rule of D.
    - Change the extraction sentence at `docs/protocol/mokly-git.md:151`. The
      protocol change must say which base readers follow links, because the
      Rust readers that check the Git tree, such as the HTML, Markdown, and
      CSS reads and the resource closure, follow no link by rule
      (`docs/protocol/mokly-git.md:127`).
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
  - **E.** Name the case, and do not read it. In the base sidecar, compare
    each default Vite config candidate and each PostCSS config candidate with
    the committed links that the sidecar already gets. When a candidate is a
    committed link, or lies below one, and the base does not resolve the
    link, fail base validation with a typed diagnostic that names the link,
    as root discovery does for a linked root. The fix text tells the author
    to replace the link with a regular file, for example one that re-exports
    the target. A warning that continues is the weaker form of E. State the
    limit in the section "The Base Side" of
    `docs/protocol/mokly-vite-adapter-inputs.md`. Cost: a new failure, so the
    user decides. A project with such a link has no Changes until C lands. A
    link that only native code follows, such as `tsconfig.json`, still gets
    no notice. E needs no Git change. Effort: Small.
  - **F.** Resolve the default Vite config candidates and the PostCSS config
    candidates through the pinned tree, with `ViteBaseEnv.target`. Select
    confined regular targets, and keep their config resolution context. Send
    `configFile`, the snapshot re-probe, the reuse stamp re-probe, the
    PostCSS `access` hook, the read and the load of lilconfig, and the
    PostCSS snapshot through one resolver. Give the base the names that the
    head records. Otherwise each base setup with a linked config fails with
    `Vite setup changed during compilation at {name}`, or the keys of the two
    sides split again. Cost: the native readers and base JavaScript keep the
    defect. Effort: Medium.
  - **G.** For a committed config link whose target the base commit does not
    hold, apply the env precedence rules of
    `docs/protocol/mokly-vite-adapter-inputs.md:94` to the target. The target
    is absent when the Git index holds it. Else the base reads the
    working-tree file that the head reads, and that read takes part in the
    freshness checks. G pairs with C or F, and it needs the read redirection
    of F for these candidates, also under C. Cost: it extends the env design
    call of 2026-11-25 to config files, so the user decides. Effort: Medium.
  - **H.** Keep only confined links to regular files in the extraction, and
    keep omitting directory links. Resolve each link chain in the pinned
    tree, and write a link only when its final target is a regular file of
    the commit. Read the link blobs in a batch. Version the extraction cache
    identity. On a host that cannot create links, use the host rule of C.
    Change the extraction sentence at `docs/protocol/mokly-git.md:151`. The
    linked-root rule and its reason stay, because a linked root is a
    directory link. Cost: a directory link still reads as absent on the base,
    so base JavaScript or a config import below a linked directory keeps the
    defect. H still changes a recorded extraction rule, so the user decides.
    Effort: Large.
- **Left out:**
  - Change nothing beyond D. The PostCSS config candidates, the default Vite
    config file, the `tsconfig.json` readers, and base JavaScript still miss
    committed links.
  - Suppress only the working-tree fallback. It fails the goal, because the
    base value stays missing.
  - Follow the live link for a target that the base commit holds. It loses
    the pinned value, and the base then uses the settings of the branch. D
    and G use the live target only when the base commit lacks it, where no
    pinned value exists.
  - A visible failure, such as `config-invalid` or a warning that names a
    committed env link. It breaks the user's decision of 2026-11-25 to read
    tracked env files from the base commit, and the target bytes are
    available. E gives a visible failure for config links only.
  - A full Git checkout or worktree of the base commit in place of the
    extraction. It breaks extraction requirements that stay: the byte and
    leaf bounds before writes, the per-file conversion fallback with
    `base-conversion` warnings, and the shared cache entry
    (`docs/protocol/mokly-git.md:142` to line 166).
  - A copy of each link target at the link path, with no link on disk, as a
    general approach. It fails the goal for a linked config with relative
    imports or `__dirname`. The head resolves them beside the target
    (`packages/mokly/src/sidecar/vite-config-source.ts:32`), and a copy
    resolves them beside the link. C keeps a copy only as its fallback for
    hosts that cannot create links.
  - A Node `fs` overlay for every read of the base sidecar. It fails the
    goal, because esbuild bundles the Vite config and Rolldown reads
    `tsconfig.json` in native code, outside Node's `fs`.
- **Wider fix:** C. With the links in the extraction, each input that the
  base Vite setup reads, present or absent, sees a committed link as a
  checkout does. This includes the PostCSS config candidates, the default
  Vite config file, Rolldown's `tsconfig.json` lookup, Browserslist, and the
  `tsconfig.json` reads of the default compiler. B and F need wiring in each
  reader. E stays a direct fix for the links that C does not keep.
- **Previous examples:** `plans/follow-ups/marked-reuse-link-retarget.md`
  records a related failure to keep the source selection through a link.
  The env fix of commit `0e7d677c6` covers the same extraction gap for env
  files.
- **Related:** `plans/follow-ups/base-link-target-batch-reads.md`: the same
  code and a shared batch reader. E, F, and G use the full link map of
  `setup_sources`, so that item must keep every committed link available.
  Under C or H, the extraction must read each link blob, so one bounded batch
  reader can serve both items. If the user takes C or H before that work
  starts, that item applies its option D.
- **Recommendation:** C with E, decided together, in place of C alone. C
  alone reaches the native and plugin readers and base JavaScript. E turns
  the silent false differences into a named failure at Small effort, until C
  lands, and after it for the links whose targets the commit does not hold.
  Decide in the same answer whether the root-discovery rejection of a linked
  root stays, because C removes its reason. Choose H if the user wants no
  change to the linked-root rule or its reason. G replaces E if the user
  wants a linked local config to work on the base side.
- **Action:** ask the user, because C changes the extraction rule of
  `docs/protocol/mokly-git.md` and the reason of the root-discovery
  rejection, E adds a new failure, and no user decision covers these
  changes.

# Stylesheet reuse misses probes, external reads, and environment

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Large. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-21, from decision 1 of the stale Browserslist
  stylesheet fix on branch
  `calummoore/mokly-stale-browserslist-stylesheet-fix-ejm0`. The
  performance orchestrator chose to keep mapped observed reads in that
  branch and deferred this class to a separate follow-up item.
  Extended on 2026-11-24 with finding 11 from the workspace source review.
- **Location:** `crates/mokly-render/src/postcss_read_inventory.rs`, the
  functions `collect` and `logical`,
  `crates/mokly-render/src/side.rs:118` to line 157,
  `packages/mokly/src/sidecar/postcss-read-files.ts:37`,
  `packages/mokly/src/sidecar/postcss.ts:133` to line 145,
  `packages/mokly/src/sidecar/workspace-lookups.ts`,
  `packages/mokly/src/sidecar/postcss-worker.ts`,
  `crates/mokly-render/src/stylesheet_cache.rs`,
  `crates/mokly-sidecar/src/process_environment.rs:8` to line 33, and the
  "Read Evidence" section of `docs/protocol/mokly-sidecar-postcss.md`.
- **Reason:** On 2026-11-21 the performance orchestrator kept this class out
  of the fix branch, and each evidence kind that it needs changes the
  PostCSS evidence requirements.

- **Source:** Implementation.
- **Category:** Product bug.
- **Terms:**
  - **Stylesheet record:** one compiled stylesheet root with the stamp of
    its inputs. Serve keeps records in memory and checks the stamp before
    it reuses a record in a later preparation.
  - **Private stylesheet evidence:** the observed PostCSS reads that the
    core keeps only to check reuse. A read alone never adds a file to the
    catalogue or to its public-file protection.
  - **Mapped roots:** the source root of a side and its selected dependency
    roots. On the head side, the source root is the repository root.
  - **Missing-file probe:** a check, such as `fs.existsSync` or
    `fs.statSync`, that finds no file. It delivers no bytes, so the sidecar
    has nothing to digest.
  - **Browserslist:** the library that Autoprefixer and other plugins use
    to choose browser targets from configuration files and environment
    variables.
- **Background:**
  - Serve reuses a stylesheet record in a later preparation of the same
    process while its inputs stay unchanged. The "Dependency Retention"
    section of `docs/protocol/mokly-imported-styles-postcss.md` states the
    rule.
  - The PostCSS child digests the bytes that observed Node read APIs
    deliver. The "Read Evidence" section of
    `docs/protocol/mokly-sidecar-postcss.md` keeps its coverage
    `incomplete`.
  - Before the fix branch, the core dropped an observed read unless a
    plugin reported the file or the file was a module. Autoprefixer reads
    `.browserslistrc` and reports no dependency. So one Serve process kept
    Safari 14 prefixes after `.browserslistrc` changed to Chrome 130.
  - Decision of 2026-11-21, the mapped-read rule: the core keeps each
    observed read that maps through the mapped roots as private stylesheet
    evidence. It keeps the exact whole-file and byte-range witnesses and
    adds a late whole-file digest beside them. Coverage stays incomplete,
    and confinement stays unchanged.
  - The same decision deferred this class at Medium severity. The evidence
    for each mechanism stays separate.
  - Browserslist 4.29.3, in `node_modules/browserslist/node.js`, gives
    these facts:
    - `findConfigFile` walks from the folder of the stylesheet up to the
      filesystem root. In each folder it checks `browserslist`,
      `package.json`, and `.browserslistrc`. The first folder with a
      configuration wins.
    - `getPathType` checks each candidate with `fs.existsSync` and then
      `fs.statSync`. The same walk checks `browserslist-stats.json` in each
      folder for usage data.
    - `BROWSERSLIST_ROOT_PATH` stops the walk at a folder. `BROWSERSLIST`
      replaces the lookup. `BROWSERSLIST_CONFIG` names a configuration
      file. `BROWSERSLIST_ENV`, or else `NODE_ENV`, selects a section of the
      configuration.
    - Autoprefixer 10.6.1 passes the PostCSS `from` path, so the walk starts
      at the folder of the stylesheet.
  - Mokly gives these facts:
    - `packages/mokly/src/sidecar/postcss-read-files.ts` wraps the byte
      reads, such as `fs.readFileSync`. The sidecar does not wrap
      `fs.existsSync` or `fs.statSync`, so a missing-file probe leaves no
      evidence.
    - `crates/mokly-render/src/side.rs` maps a path through the source root
      or a selected dependency root. Each folder inside the repository maps.
      A folder above the repository root does not map.
    - `crates/mokly-sidecar/src/process_environment.rs` passes the
      environment of the Rust process to the sidecar. It removes only
      `INIT_CWD`, `npm_package_json`, `npm_config_local_prefix`, and the
      names that start with `MOKLY_`.
    - `packages/mokly/src/sidecar/postcss.ts` passes the sidecar environment
      to the PostCSS child. Each Serve run inherits its values when it
      starts. Serve has no interface that reloads them during the run.
    - Stylesheet records live in memory only. A restart compiles each root
      again, so it refreshes these inputs.
    - `WorkspaceLookups` records missing source candidates and layout and
      manifest probes in the PostCSS child. The response sends loaded files
      and observed reads. The core receives no missing lookup candidates.
  - A probe on 2026-11-24 loaded `@acme/plugin` from `src/index.js`. The
    package export named `dist/index.js`. Adding only `src/index.ts` made
    a fresh PostCSS context select it. Every input of the first response
    stayed the same.
  - A second probe loaded a relative `./helper` from `helper.js` and
    selected `helper.ts` in a new context after it appeared. This lookup
    also sends no absent candidate. The relative lookup gap predates
    workspace source selection.
  - A one-time audit ran on 2026-11-21 with Node 24.21.0, Browserslist
    4.29.3, and Autoprefixer 10.6.1. It processed `p { user-select: none }`
    in `app/styles/main.css` of a temporary repository. Safari 14 targets
    add `-webkit-user-select`. Chrome 130 targets add no prefix.
    - A change of `.browserslistrc` at the repository root changed the
      output. The child read the file, so the mapped-read rule covers this
      case.
    - `BROWSERSLIST=Safari 14` and `BROWSERSLIST=Chrome 130` gave the two
      outputs. Neither run read a configuration file.
    - One `.browserslistrc` with `[safari]` and `[chrome]` sections gave the
      two outputs under `BROWSERSLIST_ENV=safari` and
      `BROWSERSLIST_ENV=chrome`. Both runs read the same bytes.
    - A `.browserslistrc` in the folder above the repository changed the
      output when it changed. That read maps through no root.
    - With that outside file at `Safari 14`, a new `app/.browserslistrc`
      with `Chrome 130` removed the prefix. Before, the child only probed
      that path with `fs.existsSync`. After, it no longer read the outside
      file.
    - Each run made 13 to 50 `existsSync` and `statSync` calls on 9 to 21
      paths inside the temporary folder.
  - Proposed, not current behaviour: the parked design in
    [stylesheet-cache-across-restarts.md](./stylesheet-cache-across-restarts.md)
    describes a stored format for stylesheet records. Its approved admission
    rule requires complete and stable evidence and a digest of the effective
    child environment. On 2026-11-21 the performance orchestrator parked
    that store and selected startup PostCSS preparation instead. No
    stylesheet result persists across processes.
  - Harder later is No. Under that proposed admission rule, every current
    PostCSS record stays in memory, because its coverage is incomplete.
    A later choice to store PostCSS results must cover these mechanisms first.
- **Problem:** The mapped-read rule keeps the bytes that observed reads
  deliver inside the mapped roots. Four mechanisms can change the PostCSS
  output without a change to those bytes:
  - **Missing-file probes:** a nearer Browserslist configuration appears
    during a Serve session. The earlier probe of its path left no evidence,
    and the farther file stays unchanged. A later preparation in the same
    process then reuses the old CSS.
  - **Reads outside the mapped roots:** a configuration above the
    repository root maps through no root, so the core keeps no evidence for
    it. An edit to it during a session also gives stale reuse.
  - **Inherited environment:** `BROWSERSLIST`, `BROWSERSLIST_CONFIG`,
    `BROWSERSLIST_ENV`, and `NODE_ENV` change the output without a read.
    Each Serve run inherits fixed values when it starts, and Serve has no
    interface that reloads them. A restart clears the records in memory. So
    the current reuse cannot meet this mechanism. A stored record can meet
    it, because the values can differ between the run that stores the record
    and a later run that loads it.
  - **Module lookup:** A higher-priority workspace source or a layout
    file can appear while the selected plugin remains unchanged. An
    extensionless relative import can also switch to a new candidate.
    The stylesheet cache can reuse the old output because it has no
    record of the missing candidate.
- **Impact if no action:** Serve can deliver CSS for old browser targets
  after a nearer configuration appears or an outside configuration changes.
  It can also keep CSS from an older PostCSS module selection.
  The stale CSS stays until another input of the stylesheet changes or
  Serve restarts. A stored record would also need an environment identity.
- **Root question:** How does stylesheet reuse detect a change to a PostCSS
  input that leaves no mapped read, including a change to module selection?
- **Options:**
  - **A.** Compile every PostCSS root again in each preparation. This
    removes stale reuse inside one process. It gives back the PostCSS
    reuse gain of each Serve edit. Effort: Medium.
  - **B.** Add one evidence kind for each mechanism. Keep it as private
    stylesheet evidence, and check it before reuse:
    - Missing-file probes: record each existence and metadata check inside
      the mapped roots, absent results included.
    - Reads outside the mapped roots: keep their witnesses without adding
      them to the catalogue or to its protection.
    - Inherited environment: bind PostCSS records to a digest of the
      effective child environment, and store no values.
    - Module lookup: send the workspace lookup observations with the
      PostCSS result. Include absent build, source, layout, and manifest
      candidates. Check them once per context and add them to the Serve
      watch paths. Keep them out of required file dependencies and the
      stylesheet source inventory.

    Each kind changes the PostCSS evidence requirements, so its protocol
    text goes to the user before code changes. Effort: Large.

  - **C.** Confine the PostCSS input domain, as
    [confined-postcss-inputs.md](./confined-postcss-inputs.md) proposes.
    PostCSS then reads a pinned copy of its domain, or a sandbox denies
    other reads. The environment still needs the digest of B. It reverses
    the decision in force against enforced immutable inputs. Effort: Large.
  - **D.** For module lookup, share the bundle's resolution evidence
    format with the PostCSS child. Include the lookup folders and module
    directory memberships. This also covers relative candidates that
    esbuild probes. Use `InputStamp` to check and watch the paths. Measure
    the evidence size for installed plugin folders. Effort: Large.
- **Left out:**
  - Keep the mapped-read rule as the final rule, and list the four
    mechanisms as limits of incomplete coverage. It fails the goal, because
    the audit cases above still give stale CSS.
  - Put absent paths in the existing required file dependencies. The
    stylesheet inventory rejects an absent file in that list.
  - Special handling of Browserslist file names and variables. It fails the
    goal for the discovery inputs of other plugins.
  - Set `BROWSERSLIST_ROOT_PATH`, a fixed environment, or a configuration
    path for the child. It changes the targets of the consumer and breaks
    the native plugin behaviour that the protocol keeps.
- **Wider fix:** C prevents the full class of unobserved inputs. For module
  lookup, D also covers candidates that esbuild probes.
  [Confined PostCSS inputs](./confined-postcss-inputs.md) describes C.
- **Previous examples:**
  - The stylesheet resolver of the core keeps each candidate that finds no
    file and checks it again before reuse. `crates/mokly-render/README.md`
    describes it, and `docs/protocol/mokly-watch.md` watches those absent
    candidates.
  - The dropped `.browserslistrc` read, which the fix branch of 2026-11-21
    corrects with the mapped-read rule.
- **Related:**
  - [stylesheet-cache-across-restarts.md](./stylesheet-cache-across-restarts.md):
    the restart item for stylesheet records. A stored record needs the same
    evidence as reuse inside one process, and it adds the environment
    mechanism.
  - [confined-postcss-inputs.md](./confined-postcss-inputs.md): option C
    is its root question. Its opaque reads include metadata reads, the kind
    of call that a missing-file probe makes. That item asks for the exact
    bytes of opaque reads. This item asks how reuse sees changes to them.
  - [Synchronous workspace source loading](./synchronous-workspace-source-loading.md)
    needs evidence for the relative paths that it probes.
- **Recommendation:** B. It keeps the native plugin behaviour and the
  mapped-read rule, and it treats each mechanism on its own. C best
  protects the codebase, but it reverses a decision in force.
- **Action:** fix after merge, apply B, because on 2026-11-21 the
  performance orchestrator deferred this class to work after the merge.
  The workspace review deferred module lookup evidence on 2026-11-24.
  Its protocol text goes to the user before code changes.
- **Done when:** The real-sidecar checks in
  `crates/mokly-render/tests/integration/postcss_config_reuse_tests.rs`
  show that adding a higher-priority workspace source ends reuse without
  an edit to the previously loaded plugin. The same check covers an
  absent workspace layout or manifest candidate.

History: the deferral comes from the
[stale Browserslist fix workspace](https://app.conductive.build/orgs/pdtPxBcCc35Atu0jZH1CHAiRQlE7ZEg-TALLl11kidQ/workspaces/3yFAppeXMwwFamd0VolEjdLnmYfuQJX_v03M5dylMJw).
The stored record work runs in
[workspace 218, "mokly stylesheet store across restarts"](https://app.conductive.build/orgs/pdtPxBcCc35Atu0jZH1CHAiRQlE7ZEg-TALLl11kidQ/workspaces/H4iuhWlnmrSsL_NBD_iYC-5Oda7cLUv06TY-XgRTkTk),
in the session
[stylesheet store orchestrator](https://app.conductive.build/orgs/pdtPxBcCc35Atu0jZH1CHAiRQlE7ZEg-TALLl11kidQ/workspaces/H4iuhWlnmrSsL_NBD_iYC-5Oda7cLUv06TY-XgRTkTk/sessions/YdAgYiBP-RbSB3R9GjX5_ARY57C_6sGq5txzWNCftz4).

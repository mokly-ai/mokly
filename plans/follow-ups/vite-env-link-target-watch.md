# Serve misses edits to dotenv link targets

- **Severity:** High. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-25, from round 1 of the implementation review of the
  branch `calummoore/storybook-track-d-finish-nkpi`, finding 3.
- **Location:** `packages/mokly/src/sidecar/vite-setup.ts:188`,
  `crates/mokly-render/src/bundle_finish.rs:47`,
  `crates/mokly-render/src/stylesheet_compiler.rs:120`,
  `crates/mokly-render/src/stylesheet_watch.rs:73`,
  `crates/mokly-watch/src/native_scan.rs:11`,
  `crates/mokly-watch/src/plan.rs:147`, and `docs/protocol/mokly-watch.md:133`.
- **Reason:** Every option changes the watch admission rule of
  `docs/protocol/mokly-watch.md` or narrows the reload promise, and no user
  decision covers either change.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Dotenv file:** A file such as `.env.local` from which Vite loads
    environment values. Vite reads it from its `envDir`.
  - **Vite adapter:** The optional compile path that compiles JavaScript and
    transforms stylesheets through the project's own Vite setup.
  - **Head and base:** The two sides of a comparison. The head is the working
    tree. The base is the selected Git commit.
  - **Canonical file:** The real file that a path reaches after every
    symbolic link on the path resolves.
  - **Admitting directory:** A directory outside the repository that the watch
    contract lets Serve register for one exact input.
- **Background:**
  - A worktree can share an ignored dotenv file with another checkout through
    a symbolic link. Both comparison sides then read the target of the link.
  - `docs/protocol/mokly-vite-adapter-inputs.md` makes each env file that Vite
    reads an input of a Vite compile. A change to one causes a rebuild in
    Serve and reloads the setup. The Vite guide at
    `docs/guides/authoring/vite.md:150` promises the same reload.
  - The same page lets an env file be a symbolic link to a regular file, also
    outside the repository. The input keeps the env file's own path. So the
    link path stays an exact watch input, and a retarget of the link still
    starts a rebuild.
  - A design call of 2026-11-25 by the track D orchestrator covers a
    working-tree env file that only the base side reads. Such a file adds no
    watch input. An edit to it shows in Changes after the next
    classification. Its reason is that the head side normally reads and
    watches the same file.
  - `setupSnapshot` in `packages/mokly/src/sidecar/vite-setup.ts` names each
    head env input with the prefix `node_modules/.mokly-roots/vite-env/`. The
    core finds env inputs by that prefix. It reads them at
    `crates/mokly-render/src/sources.rs:107`. It watches them at
    `crates/mokly-render/src/bundle_finish.rs:54` and
    `crates/mokly-render/src/stylesheet_compiler.rs:128`.
  - The core already finds the canonical file of each stylesheet input, at
    `crates/mokly-render/src/stylesheet_watch.rs:59`. It also reads env
    inputs through that file.
  - Today the watch contract admits a directory outside the repository only
    through a selected dependency root that admits it. See
    `docs/protocol/mokly-watch.md:133` and
    `crates/mokly-watch/src/stylesheet_inputs.rs:21`.
  - `native_scan::parents` at `crates/mokly-watch/src/native_scan.rs:11`
    registers the ancestor directories of an exact watch path. A native
    directory registration sees an edit with no delay, as
    `crates/mokly-watch/src/backend.rs:138` shows.
  - The design gives every watch to Mokly. The adapter turns Vite's own
    watcher off at `packages/mokly/src/sidecar/vite-setup.ts:106`.
- **Problem:** The JavaScript watch plan receives the path of the dotenv
  link. Native watches attach to the parent directories of that path inside
  the repository. For CSS, the watch mapper at
  `crates/mokly-render/src/stylesheet_watch.rs:73` drops the external target.
  So an edit to the shared target file leaves the link unchanged, and no
  rebuild starts.
- **Screenshot:** Show the Browse preview after an edit to the shared dotenv
  target, and mark the value from before the edit.
- **Impact if no action:** Browse and Changes can stay stale until another
  watched edit or a restart. The link test at
  `tests/vite_env_changes.test.ts:58` builds once. The Serve test at
  `tests/vite_env_changes.test.ts:78` edits a regular file.
- **Root question:** How should Serve detect an edit to a file that the head
  reads through a dotenv link?
- **Options:**
  - **A.** Register the resolved target as an exact head dotenv watch beside
    the link. Update the registration when the link changes. Effort: Medium.
  - **B.** Give the Vite JavaScript and CSS calls one setup input record with
    a stable name and exact physical watch paths. Use the same registration
    for the link and for the admitted target. Effort: Medium.
  - **C.** Keep the sidecar names, and map the env inputs in the core:
    - Send the head env names of the JavaScript generation, at
      `crates/mokly-render/src/bundle_finish.rs:47`, and of the Vite
      stylesheet results, at `crates/mokly-render/src/stylesheet_compiler.rs:120`,
      through the one mapping in `crates/mokly-render/src/stylesheet_watch.rs`.
    - That mapping keeps the link path and adds the canonical file.
    - When the canonical file of an env input is outside the repository, make
      its parent directory its admitting directory.
    - Give the pairs of both calls to the watch plan in the form that
      `Plan::stylesheet_resolution` takes, at
      `crates/mokly-watch/src/plan.rs:147`.
    - Map only in Serve. Map again at each delivery, so that a retarget moves
      the registration.
    - This also covers a linked `envDir`, and a target inside the repository
      but outside every root. The JavaScript path misses both today.
    - Add the rule to `docs/protocol/mokly-watch.md`. Extend the Serve test at
      `tests/vite_env_changes.test.ts:78` to edit the target of a linked env
      file.
    - Cost: a new class of outside admission in the watch contract, and a new
      `JavaScriptGeneration` field. It needs no wire change. It keeps the rule
      that Serve admits no outside file without a cache directory.
    - Effort: Medium.
  - **D.** On a timer, check each exact input whose canonical file is in no
    registered directory. Queue a rebuild when its digest changes. Option F of
    `plans/follow-ups/installed-module-watch-paths.md` records the same
    approach for installed modules. Cost: up to one interval of delay,
    repeated reads, and a new watch-runtime decision for the user. It also
    covers failed attachments and every other link target. Effort: Medium.
  - **E.** Keep the current watch, and state its limit in
    `docs/protocol/mokly-vite-adapter-inputs.md` and in
    `docs/guides/authoring/vite.md`. Serve then shows an edit to the target of
    an env link only after the next rebuild or a restart. The design call
    above does the same for reads that only the base side makes. As an
    option, give one Serve diagnostic that names the linked env file. Cost:
    Serve stays stale for the shared-env setup that the adapter supports, and
    the reload promise of the guide becomes narrower. It changes a
    requirement. Effort: Small.
- **Left out:**
  - A recursive watch of the target checkout takes in unrelated files. C
    registers only the parent directory of the target.
  - A check only before classification gives Serve no rebuild event.
  - A rejection of env links that leave the repository removes the
    shared-env support and its test. It is also a new rejection, which needs
    the user. E gives the notice without a rejection.
  - Vite's own watcher is not a real choice. The design gives every watch to
    Mokly, and the adapter turns that watcher off.
- **Wider fix:** C. One core mapping gives each setup input of both calls its
  link path and its canonical file. So a new input that keeps a link path
  needs no new producer. Option E of
  `plans/follow-ups/installed-module-watch-paths.md` can later move the other
  JavaScript watch inputs to the same mapping.
- **Previous examples:** `plans/follow-ups/installed-module-watch-paths.md`
  records the same problem of logical paths that reach external link
  targets, for installed modules.
- **Related:**
  - `plans/follow-ups/installed-module-watch-paths.md`: the same problem for
    installed modules, as above. Its option F is the timer approach of D.
  - The branch that found this item also gave each Vite setup input one
    record with a stable name and separate physical read and watch paths.
    Equal head and base setups then share renders. That change can rename the
    `vite-env/` names. Before you apply C, check that the core still finds
    the env inputs of both calls by their role.
- **Recommendation:** C, not the review's B. The two calls already send the
  same setup names and differ only in the two core watch mappings. So C fixes
  them there, with the existing stylesheet admission pairs and no wire
  change.
- **Action:** ask the user, because every option changes the watch admission
  rule of `docs/protocol/mokly-watch.md` or narrows the reload promise, and no
  user decision covers either change.

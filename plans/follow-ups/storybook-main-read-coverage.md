# Storybook `main.*` read coverage is not stated

- **Severity:** Medium. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-28, from review round 1 of the branch
  `calummoore/storybook-track-e-storybook-folders-87sk`, the blocked wider
  fix E of finding 4.
- **Location:** The last paragraph of the section "Roots From `main.*`" of
  `docs/protocol/mokly-root-discovery.md`, which makes each local file that
  the load of `main.*` reads a configuration input.
  `docs/guides/authoring/config.md:84`, which promises discovery again after
  an edit of `main.*` or a local file that it imports.
  `docs/protocol/mokly-watch.md:31`, the `rebuild` action.
  `packages/mokly/src/sidecar/storybook-main-worker.ts`, which records the
  reads of the load.
- **Reason:** The fix narrows a promise of the protocol and changes what a
  `rebuild` rule does, and no user decision covers either change.

- **Source:** Review.
- **Category:** Docs or spec.
- **Terms:**
  - **Root without `dir`:** A configured root that names a Storybook folder
    and no directory. Mokly runs that folder's `main.*` before discovery and
    turns each `stories` entry into a root.
  - **Configuration input:** A file whose edit makes Serve load the
    configuration and each `main.*` again and run discovery again.
  - **`rebuild` rule:** A `watch.rules` entry with the `rebuild` action.
    Today its paths are inputs of the configuration node, so a change
    recomputes the whole catalogue.
  - **Static verification:** The input check that runs before Mokly installs
    generated output.
- **Background:**
  - The last paragraph of the section "Roots From `main.*`" of
    `docs/protocol/mokly-root-discovery.md` says that `main.*`, each other
    candidate name of `main.*`, and each local file that the load of `main.*`
    reads are configuration inputs.
  - In the section "Storybook" of `docs/protocol/mokly-sidecar.md`,
    `readStorybook` returns `inputs`, the digest of each repository file that
    the load read. Serve watches these paths, and static verification checks
    their digests.
  - The guide promises discovery again only after an edit of `main.*` or of
    a local file that it imports. No user decision covers the wider promise
    of the protocol.
  - The worker that loads `main.*` records the modules that the load imports
    and the `fs` reads of its own thread. On 2026-11-28 the branch that found
    this item also recorded each repository file that the load opens for
    reading. Handle, descriptor, stream, and partial reads then count, the
    last as whole-file inputs.
  - No `fs` wrapper sees the reads of a child process, a native addon, or
    another thread that `main.*` starts. A directory listing is not a file
    read.
  - The section "Incomplete Coverage" of
    `docs/protocol/mokly-sidecar-postcss.md` states the same limit for
    consumer PostCSS.
  - On 2026-11-25 the user chose a route for the same limit of the Vite
    setup. The PostCSS config candidates that Vite looks up are inputs, and a
    `rebuild` rule makes any other file an input. Under the adapter, a change
    to such a path reloads the setup. The section "Inputs And Serve" of
    `docs/protocol/mokly-vite-adapter-inputs.md` states it.
  - The section "Configuration Changes" of
    `docs/protocol/mokly-watch-runtime.md` says that a configuration change
    loads the `main.*` of each root without `dir` again and runs discovery
    again. A change to a file of a `rebuild` rule is not a configuration
    change today.
  - The worker records a module that the load imports by its resolved path
    only. So the link name of a module imported through an in-repository link
    is not watched. The root discovery page limits its link rule to `fs`
    reads. The documentation pass of review round 1 found this gap on
    2026-11-28 and did not test it.
- **Problem:** The protocol promises that every local file that the load of
  `main.*` reads is a configuration input, but Mokly cannot observe every
  read. A file that a child process reads to select stories stays out of the
  watch and out of static verification, and no route lets the project add it.
- **Screenshot:** In Browse after saving the selection file, box the old story
  row that Serve still displays.
- **Impact if no action:** Serve can keep an outdated story list until it
  restarts. A static build can install the old selection when that file
  changes during preparation. The protocol keeps a promise that the code
  cannot meet.
- **Root question:** Which files that the load of `main.*` reads does Mokly
  promise to track, and how does a project make another such file a
  configuration input?
- **Options:**
  - **A.** State the coverage, and give no route. The protocol and the guide
    say that Mokly tracks the imports and the `fs` reads of the `main.*`
    thread. It does not track the reads of child processes, native addons,
    or other threads, or directory listings. An edit to such a file takes
    effect after Serve restarts. Effort: Small.
  - **B.** State the coverage as A does, and give a route. A `rebuild` rule
    makes each file that it matches a configuration input of each root
    without `dir`. A change to such a file then loads `main.*` again and runs
    discovery again. This changes what a `rebuild` rule does, as the user's
    answer for the Vite setup did. Effort: Medium.
  - **C.** Add a field to the `storybook` object of a root that lists the
    files that `main.*` reads outside Mokly's view. Each listed file is a
    configuration input of that root. Cost: a new configuration field with
    its validation, and a second way to name watched files beside
    `watch.rules`. Effort: Medium.
- **Left out:**
  - Watch the whole Storybook folder. A selection file can live outside that
    folder, and each edit of a preview or a story would run `main.*` and
    discovery again. That breaks the watch rule that a change recomputes only
    the outputs whose inputs changed. The user's answer for the Vite setup
    left out the same approach for that reason.
  - Run `main.*` again at the end of a static build and compare the results.
    An edit to an unwatched file still sends Serve no event.
  - Trace file reads in the operating system. It needs platform tools and
    privileges, and the load runs as a thread of the shared sidecar process,
    so a trace cannot tell which load read a file.
  - Run the load in a child process with the PostCSS preload. The observers
    already work in the worker thread, so a process adds start-up time and no
    coverage.
  - Change nothing. The protocol then keeps a promise that the code cannot
    meet.
- **Wider fix:** B. A stated limit with a project route covers every read that
  no `fs` wrapper sees, and it reuses the route that the user chose for the
  Vite setup.
- **Previous examples:** The user's answer of 2026-11-25 for the files that the
  Vite setup reads outside the module graph. The section "Incomplete
  Coverage" of `docs/protocol/mokly-sidecar-postcss.md`.
- **Related:** `plans/follow-ups/storybook-stories-function-not-read.md`: the
  same read records. A preset load reads more files, and the coverage rule of
  this item applies to those reads too.
- **Recommendation:** B. It makes the protocol true, and it gives the project a
  route that matches the route of the Vite setup.
- **Action:** ask the user, because B narrows the promise of
  `docs/protocol/mokly-root-discovery.md` and changes what a `rebuild` rule
  does, and no user decision covers these changes.

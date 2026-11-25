# Static builds miss Vite input edits

- **Severity:** High. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-25, from round 2 of the implementation review of the
  branch `calummoore/storybook-track-d-finish-nkpi`, findings 103 and 135,
  which repeat each other. This item merges the options of both findings
  and of their finding checks. It also holds a new problem of the check of
  finding 103: the stylesheet path checks ancestor manifests that the export
  page excludes.
- **Location:** `packages/mokly/src/sidecar/vite-compiler.ts:82`,
  `crates/mokly-render/src/bundle_finish.rs:23`,
  `crates/mokly-cli/src/build_prepare.rs:43`,
  `crates/mokly-cli/src/static_build.rs:207`,
  `crates/mokly-css/src/vite.rs:126`, and the section "Input Fingerprint" of
  `docs/protocol/mokly-export.md`.
- **Reason:** Every option except A adds a new cause of the `export-invalid`
  rejection and a rule for Vite inputs, and the export page lists no Vite
  inputs.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Static build:** `build` or `publish`, which write a catalogue to disk.
  - **Input fingerprint:** The paths and digests that a static build captures
    and checks again before it installs its output.
  - **Consumed-input record:** The Vite inputs that a compile reports beside
    its module graph: the setup inputs, the files that plugins report, and
    the dotenv inputs. The bundle reuse stamp holds this record.
  - **Late read baseline:** An evidence entry whose baseline is the digest
    that the sidecar consumed, not a later read by the core.
- **Background:**
  - The section "Input Fingerprint" of `docs/protocol/mokly-export.md`
    fingerprints the inventoried sources, the configuration, the renderer,
    the configured stylesheets, the authored closure, and the root
    membership. An edit to a fingerprinted input during the build aborts with
    `export-invalid`, so the earlier output stays in place instead of mixing
    generations.
  - The same section lists no Vite input. It excludes ancestor
    `tsconfig.json` files, ancestor `package.json` files that PostCSS module
    resolution does not name, and missing resolution candidates. It says that
    an edit to one of these during a build is not detected. Its decision
    rejects a walk of every repository file, because unrelated edits would
    then stop builds.
  - The baseline of a bundled JavaScript module is the digest of the bytes
    that the sidecar bundled. The baseline of every other input is its first
    captured digest.
  - `docs/protocol/mokly-vite-adapter-inputs.md:11` makes the Vite config,
    its imports, the env files, the PostCSS config candidates, the `rebuild`
    rule matches, and the files that plugins report inputs of a Vite compile.
  - The sidecar checks its setup observations after the compile, at
    `packages/mokly/src/sidecar/vite-compiler.ts:82`. The JavaScript path then
    sends the consumed-input record to the core for the render keys and the
    watch inputs only. The static capture at
    `crates/mokly-cli/src/build_prepare.rs:43` receives the source inventory
    and the compiled module digests. The final check before installation
    runs at `crates/mokly-cli/src/static_build.rs:207`.
  - The stylesheet path already turns each present entry of the same record
    into a late read baseline, at `crates/mokly-css/src/vite.rs:126`. That
    loop also covers the ancestor `package.json` and `tsconfig.json` files
    that the sidecar's resolution record adds, at
    `packages/mokly/src/sidecar/resolution-inputs.ts:84`.
  - After a setup edit, the pool retries the next stylesheet transform in a
    fresh worker with the new setup
    (`packages/mokly/src/sidecar/vite-context.ts:112`,
    `crates/mokly-sidecar/src/pool_exchange.rs:104`). Its new digests then
    pass beside JavaScript from the old setup.
  - The base side reads untracked dotenv files from the working tree, under
    `docs/protocol/mokly-vite-adapter-inputs.md:97`.
    `crates/mokly-render/src/bundle_finish.rs:23` records these reads only for
    the kept-base freshness check. So an edit between the head compile and
    the base compile can give a false change in Changes.
  - The first static digest of a `rebuild` rule file comes after the compile,
    at `crates/mokly-graph/src/watch_rules.rs:30`, so it can miss an edit in
    between.
  - `InputTree::capture` fails for a path whose target is outside the
    repository, at `crates/mokly-static/src/fingerprint.rs:198`. The evidence
    path already hashes a dotenv link target outside the repository, at
    `crates/mokly-render/src/vite_base_env.rs:92` and
    `crates/mokly-static/src/fingerprint_evidence.rs:76`.
  - The branch that found this item also adds the reports of nested
    `this.load` calls to the transform records. Under D and E, these reports
    reach the static evidence with no more work.
- **Problem:**
  - A static build does not check the Vite inputs of a JavaScript compile
    before it installs. In a catalogue without stylesheets, a root dotenv
    file, a config helper, or a file that a plugin reports can change after
    the sidecar's check and escape the final check.
  - With stylesheets, a stylesheet transform after a setup edit can mix two
    setups in one output.
  - The stylesheet path stops a build after an edit of an ancestor manifest,
    which the export page says is not detected.
- **Screenshot:** Show the generated view after a late edit to the setup
  changes its configured label. Mark the old label that the build installed.
- **Impact if no action:** `build` or `publish` can install a catalogue that
  Vite built with settings that changed during the command, with no
  `export-invalid` error. The coverage depends on whether the catalogue has
  stylesheets, and the stylesheet path disagrees with the export page.
- **Root question:** Which inputs that a Vite compile consumes outside its
  module graph must stay unchanged until a static build installs its output,
  on either compile path and on both sides?
- **Options:**
  - **A.** Keep the code, and state the gap. Add the Vite setup inputs and
    the files that plugins report for a JavaScript compile to the exclusions
    of the export page. State that a Vite stylesheet transform still checks
    them. Cost: a concurrent edit to `.env` or `vite.config.ts` can still
    install stale output or give a false change in Changes. The coverage
    still depends on whether the catalogue has stylesheets. Effort: Small.
  - **B.** Pass the present repository-local setup inputs and the sidecar's
    digests to `InputTree::capture`, at
    `crates/mokly-cli/src/build_prepare.rs:43`. Cost: a second baseline
    channel beside the evidence path. `capture` fails for a target outside
    the repository, so B must leave out such targets. B covers the head
    generation only, so the base side's working dotenv reads stay unchecked.
    Effort: Medium.
  - **C.** Deliver the typed Vite setup observations through the static
    evidence path, from the JavaScript and the stylesheet requests. Define
    which absences and physical routes take part, and record the scope on the
    export page. Test an edit after the compile and before the installation.
    Cost: the files that plugins report for JavaScript modules, and the other
    reads outside the graph, keep the gap. Effort: Medium.
  - **D.** One conversion of the consumed-input record on both compile paths:
    - In `crates/mokly-render/src/bundle_finish.rs`, which runs for new and
      reused bundles on both sides, observe each present metadata input of
      the bundle stamp as a late read baseline. Observe it through the side
      tree, as the stylesheet cache does, at
      `crates/mokly-render/src/stylesheet_cache.rs:206`.
    - Observe each rendered dotenv input through the dependency tree, as the
      stylesheet env delivery does, at
      `crates/mokly-render/src/vite_base_env.rs:83`.
    - Move both loops into one helper that both paths call.
    - Drop absent candidates, directory lists, files under `node_modules`,
      and the ancestor manifests in one filter that matches the exclusions of
      the export page. The stylesheet path then stops checking the ancestor
      manifests too.
    - Add one rule for Vite inputs to the export page.
    - Test static builds with an edit of `.env` after the compile of a
      JavaScript-only catalogue, an edit of `.env` between the JavaScript
      compile and a Vite stylesheet transform, an edit of a config helper,
      and an edit of a file that a JavaScript plugin reports.
    - Cost: a new `export-invalid` outcome for JavaScript-only catalogues. A
      plugin that writes new bytes to a file that it reports then fails each
      static build, as on the stylesheet path today. No wire change.
    - Effort: Medium.
  - **E.** D, but keep the ancestor `package.json` and `tsconfig.json` files
    in the evidence of both paths, as the stylesheet path does today. List
    them as Vite inputs on the export page. Cost: an edit of an ancestor
    manifest during a build stops the build, also on the JavaScript path,
    while the esbuild path keeps the exclusion. Effort: Medium.
  - **F.** Before the final check at
    `crates/mokly-cli/src/static_build.rs:207`, ask each sidecar that holds a
    Vite setup to run its setup check again, at
    `packages/mokly/src/sidecar/vite-setup-snapshot.ts:154`. The check also
    compares the config lookup probes, so a new config file that Vite prefers
    shows. F is the only option that covers absent candidates with existing
    code. The pool still runs at that point, because the drain runs only
    after the preparation returns. Cost: a new sidecar request with its
    protocol row, sent on both sides, base workers included. A worker that
    the pool replaced has lost its snapshot, so the recipe must carry it. The
    check also compares every file name of the configuration directory, so
    an unrelated new file there stops the build. Effort: Large.
  - **G.** Also fingerprint the absent candidates and the installed or
    outside setup inputs. Cost: it extends the stated exclusions, and it needs
    its own coverage decision. `capture` cannot hold an outside target. The
    evidence path already hashes an outside dotenv link target, so the
    outside part of G is smaller than it looks. Effort: Large.
- **Left out:**
  - Hash the whole checkout. It breaks the decision of the export page that
    rejects a walk of every repository file, which stays.
  - Take a new baseline just before the installation. It fails the goal,
    because it accepts an edit after Vite consumed the earlier bytes.
  - Add the setup files to the source inventory. B is better on every point,
    because it gives the same check without the other roles of the
    inventory, such as source protection and Serve's watch sources.
  - Send every Vite setup read through the core's captured tree. It fails
    the goal for the files that Vite reads in native code. D gives the same
    consumed-bytes baseline at lower cost.
  - Pin Vite's default candidate names when the build starts. It fails the
    goal, because a configured `envDir`, the config helpers, and the plugin
    reports are known only after the config runs.
  - Compare each Vite stylesheet result with the setup digest of the
    JavaScript generation. It fails the goal, because a JavaScript-only
    build still installs stale output.
- **Wider fix:** D. One shared conversion gives every entry of the
  consumed-input record the same evidence on both compile paths, whatever its
  kind. A new kind of entry then cannot reach evidence on one path only. C
  prevents the class only for setup inputs.
- **Previous examples:** The static builder already checks PostCSS read
  evidence across rendering and installation.
  `plans/follow-ups/static-evidence-callback-boundary.md` records a related
  gap of the evidence check.
- **Related:**
  - `plans/follow-ups/vite-outside-env-directory.md`: work that waits for the
    answer. If that item admits env files outside the repository, the rule
    here must say whether they take part. `capture` cannot hold them. D
    observes the physical file through the evidence path, so D works with
    either answer.
  - `plans/follow-ups/vite-env-link-target-watch.md`: the same function. Its
    option C maps each env name to its physical file for watching in
    `bundle_finish::finish`. D maps the same record for evidence in the same
    function, so one mapping can serve both.
  - `plans/follow-ups/vite-setup-read-time-evidence.md`: a shared wider fix.
    Its option C adds a read-time digest to each setup input record. Deliver
    the static observations of D from that record.
  - `plans/follow-ups/vite-setup-config-directory-listing.md`: F runs the
    setup check of that item. Fix that item before F, or an unrelated new
    file in the configuration directory stops the build.
- **Recommendation:** D. One conversion of the record that both compile
  results already carry gives the JavaScript path the coverage of the
  stylesheet path, with no wire change. It includes the files that plugins
  report, which C leaves out. Its filter also ends the conflict with the
  export page for the ancestor manifests. Choose E if the user wants the
  ancestor manifests checked on the Vite path.
- **Action:** ask the user, because every option except A adds a new cause of
  the `export-invalid` rejection, and the export page states no rule for Vite
  inputs.

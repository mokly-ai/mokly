# Serve misses files that join Tailwind scan scopes

- **Severity:** High. **Likelihood:** Common. **Effort:** Large. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-25, from round 2 of the implementation review of the
  branch `calummoore/storybook-track-d-finish-nkpi`, findings 101 and 131,
  which repeat each other. This item merges the options of both findings
  and of their finding checks.
- **Location:** `packages/mokly/src/sidecar/vite-plugin-inputs.ts:83`,
  `packages/mokly/src/sidecar/vite-urls.ts:27`,
  `crates/mokly-css/src/vite.rs:62`,
  `crates/mokly-render/src/stylesheet_record.rs:162`, and the plugin report
  rule at `docs/protocol/mokly-vite-adapter-inputs.md:58`.
- **Reason:** Each option adds a rule for the scan patterns that plugins
  report, and the input rules of the Vite adapter cover only reported
  regular files and absent paths.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Serve:** The Mokly command that serves the catalogue and rebuilds it
    when a watched input changes.
  - **Vite adapter:** The optional compile path that transforms stylesheets
    through the project's own Vite setup.
  - **Scan scope:** A file pattern that a plugin declares for the files that
    it scans, such as Tailwind's `@source` paths. It also covers files that
    do not exist yet.
  - **Directory record:** The core's record of a watched directory and its
    glob, `Bundle.directories`. Serve's watch plan and the stylesheet reuse
    stamp read it.
- **Background:**
  - Tailwind v4 has two forms for Vite projects. `@tailwindcss/vite` 4.3.3
    reports each scanned file and each scan glob with `this.addWatchFile`.
    Each glob is relative to Vite's `root`. `@tailwindcss/postcss` 4.3.3
    sends the same globs as PostCSS `dir-dependency` messages. The Vite guide
    supports both forms, at `docs/guides/authoring/vite.md:92`. The Basic
    example uses the PostCSS form on the esbuild path, at
    `examples/basic/postcss.config.mjs:1`.
  - The plugin report rule at `docs/protocol/mokly-vite-adapter-inputs.md:58`
    keeps each reported regular file or absent path inside the roots. It
    skips each other existing path, such as a directory, with a `diagnostic`
    event that names a `watch.rules` `rebuild` rule. The branch that found
    this item chose that skip for directories on 2026-11-25.
  - The report collector passes each report to `viteFile`, at
    `packages/mokly/src/sidecar/vite-urls.ts:27`, which accepts absolute file
    paths only. A relative glob then goes to Vite's watcher, which the adapter
    turns off, at `packages/mokly/src/sidecar/vite-plugin-inputs.ts:107` and
    `packages/mokly/src/sidecar/vite-setup.ts:111`. Mokly sends no
    diagnostic for it. An absolute pattern passes `viteFile`, and the
    collector keeps it as an absent literal file, at
    `vite-plugin-inputs.ts:119`. A relative plain file, such as
    `config/theme.json`, takes the same branch as a glob, at
    `vite-urls.ts:37`.
  - Under the adapter, Vite turns each PostCSS `dir-dependency` message into
    the files that exist at that time, at
    `node_modules/vite/dist/node/chunks/node.js:30572`, and reports each file
    with `addWatchFile`. So Mokly never sees the scope of the PostCSS form.
  - On the esbuild path, a PostCSS directory dependency watches additions
    below the reported directory, under `docs/protocol/mokly-watch.md:27`.
    Each matching file is also a protected input there, at
    `crates/mokly-render/src/postcss_inventory.rs:139`.
  - On a rebuild, the stylesheet cache serves a record while its stamp holds,
    at `crates/mokly-render/src/stylesheet_cache.rs:94`. The stamp reads the
    reported files and `Bundle.directories`, at
    `crates/mokly-render/src/stylesheet_record.rs:152` and line 162. The Vite
    bundle leaves `Bundle.directories` empty, at
    `crates/mokly-css/src/vite.rs:62`. So a rebuild that another edit starts
    reuses the old CSS, for example after a new screen below a root that
    Tailwind scans. This comes from a read of the code. The esbuild path
    passes that case, at
    `crates/mokly-render/tests/integration/stylesheet_scan_tests.rs:55`.
  - `build` and `publish` start no watcher. They transform each stylesheet
    once in a new process, so Tailwind scans the current tree. Only Serve has
    the defect.
  - A Serve probe on 2026-11-25 added a source file with the class
    `grid-cols-7` in an unwatched subdirectory. The utility stayed absent
    until a separate edit of the stylesheet `theme.css`.
  - The branch that found this item passes each watched change to the
    `watchChange` hooks of the setup's plugins. For a directory, it gives a
    `create` or `delete` event only for the membership of a tracked
    directory, at `packages/mokly/src/sidecar/vite-invalidation.ts:90`. A
    file that joins a scope needs the same event for such a hook. Tailwind
    itself needs no event, because it scans again in each transform.
  - The same branch keeps the reports of nested `this.load` calls in the
    per-module report record. Keep each scope in that record too, so that a
    scope that a nested load reports is not lost.
- **Problem:** Tailwind's scan globs never reach Serve's watch plan or the
  stylesheet reuse stamp. The PostCSS form reaches Mokly only as the files
  that exist at transform time. So a file that starts to match a scan scope
  starts no rebuild, and a rebuild that another edit starts reuses the old
  CSS.
- **Screenshot:** In the Serve Canvas, mark a grid that still has its old
  columns after a source adds the `grid-cols-7` class.
- **Impact if no action:** In Serve, a new Tailwind source in an unwatched
  subdirectory gets no CSS for its new classes. The CSS stays stale until a
  stylesheet edit or a restart.
- **Root question:** When a file starts to match the scan scope that a plugin
  of the Vite setup declares, how does Mokly see the change and transform the
  stylesheet that declared the scope again?
- **Options:**
  - **A.** Keep the file rule. Send one `diagnostic` event for each pattern
    report that Mokly drops. Name the pattern and a `watch.rules` `rebuild`
    rule that covers it. State the rule at
    `docs/protocol/mokly-vite-adapter-inputs.md:58` and in the Vite guide.
    Cost: the author must keep the rule in step with Tailwind's `@source`
    paths. Each file that starts to match the rule reloads the setup and
    moves every render key, under
    `docs/protocol/mokly-vite-adapter-inputs.md:26`. The PostCSS form sends
    no pattern, so it gets no diagnostic. Effort: Small.
  - **B.** Keep a relative scan pattern of a stylesheet transform as a scope
    in the core's directory record:
    - Classify each report by its form. Resolve a relative pattern against
      Vite's `root`, as Tailwind does. Split it into its static base
      directory and its glob.
    - Confine the base to the source root and the selected dependency roots,
      with the existing outside-roots diagnostic.
    - Return the scopes in a new field of `ViteCssResult`. This changes a
      Rust type and the generated TypeScript, so the `shared-types` skill
      applies.
    - In `crates/mokly-css/src/vite.rs`, put the scopes in
      `Bundle.directories`. That record then feeds Serve's watch plan, also
      for new subdirectories, at `crates/mokly-watch/src/plan.rs:94`. It also
      feeds the reuse stamp and the comparison generations, at
      `crates/mokly-compare/src/reuse_generation.rs:123`.
    - Keep the reported files as the only protected inputs. Do not read the
      matches into the stylesheet dependencies. Then no new protected-target
      rejection occurs, and the renderer pruning keeps entry stylesheets.
    - Skip with a diagnostic a pattern that the watch plan cannot compile.
    - Test an unchanged stylesheet with a new file in an unobserved
      subdirectory, and with a new catalogue screen below a scanned root.
    - Cost: the reuse check walks each scope, as on the esbuild path. Under
      Tailwind's automatic source detection, the scope can be the whole Vite
      root. The PostCSS form stays unseen.
    - Effort: Medium.
  - **C.** Change only the core. Under the adapter, give each Vite stylesheet
    bundle a directory record for the source root with the glob `**/*`. Each
    created file below the root then starts a rebuild, and the stamp makes
    Mokly transform the stylesheet again. No sidecar or wire change is
    necessary. Cost: each created or edited file below the source root
    becomes a stylesheet input, against the unrelated-file rule of
    `docs/protocol/mokly-watch.md:26`. Every Vite catalogue pays this cost,
    also one with no scanning plugin. The stamp walks the whole source root
    at each record lookup, at `crates/mokly-render/src/input_stamp.rs:167`.
    A scope in a dependency root stays unseen. Effort: Medium.
  - **D.** Apply B to both Tailwind forms:
    - Also capture each PostCSS `dir-dependency` message of a stylesheet
      transform before Vite expands it. Vite keeps these messages inside its
      compile, at `node.js:30561`, so the capture wraps the PostCSS processor
      that Vite uses. The sidecar already hooks `fs.promises.access` and
      module resolution for the PostCSS config lookup, at
      `packages/mokly/src/sidecar/vite-postcss-lookup.ts:114`.
    - Send both kinds as confined directory dependencies in the new field of
      B.
    - Cover a relative report without glob syntax, which Mokly drops today
      with no diagnostic.
    - Rolldown documents `addWatchFile` for files only, so the pattern rule
      is Mokly's own and must name its base. The base is Vite's `root`, not
      the process directory that Vite uses for a relative id, at
      `node.js:2498`.
    - Keep the file rule on the JavaScript path until a JavaScript plugin
      needs a pattern.
    - Write the rule in `docs/protocol/mokly-vite-adapter-inputs.md` and in
      the watch table of `docs/protocol/mokly-watch.md`. Add a line under
      "Development changes" in `docs/guides/authoring/vite.md:144`.
    - Test both forms with a Vite twin of
      `crates/mokly-render/tests/integration/stylesheet_scan_tests.rs:55`,
      and with a Serve case that adds a file in an empty subdirectory.
    - Cost: the capture depends on Vite's private PostCSS run across the
      supported `^8.0.0` range.
    - Effort: Large.
  - **E.** One scope record for each shape of a declared scan scope. Use the
    record of D for a relative or an absolute pattern, for a PostCSS
    `dir-dependency`, for a directory report with the glob `**/*`, and for the
    patterns that JavaScript transforms report. A new shape then needs only a
    new classification at the report boundary. Cost: the directory case
    reopens the skip of a reported directory, which the branch that found
    this item chose. The capture depends on Vite's private PostCSS run.
    Effort: Large.
- **Left out:**
  - Expand a pattern once into its files. It fails the goal, because later
    additions stay unseen. Vite does this to a PostCSS `dir-dependency`, which
    is why the PostCSS form fails now.
  - Keep a glob as an absent literal file. It fails the goal, because a file
    that matches the pattern does not have that name. The code does this now
    for an absolute pattern, so B, D, and E replace that branch.
  - Track the file membership of each directory that holds a reported file.
    It fails the goal, because it misses a file in a new or empty
    subdirectory. The probe added its file in such a directory.
  - Let Vite's watcher or the plugin's own update hook supply events for the
    scope. It fails the goal. Vite gives a glob from `addWatchFile` no
    meaning: `ensureWatchedFile` adds only an existing absolute path outside
    the root, at `node.js:2498`. For a new file with no modules, Vite's update
    handler finds no modules, and Tailwind's `hotUpdate` returns early. So
    nothing transforms the stylesheet again.
  - A Tailwind-only translation of the reported patterns into directory
    dependencies. B is better on every point, because its generic split
    covers Tailwind and other plugins with the same code.
  - A guide note alone that asks for a `watch.rules` rule. A is better on
    every point, because it also tells the author which pattern needs the
    rule.
  - Protect each file that a scope matches, as the esbuild path does. It adds
    a protected-target rejection under the adapter, which needs the user's
    approval. The two paths then keep protecting different files for the same
    Tailwind scope, as they do now, and the pattern rule must say so.
- **Wider fix:** E. A fix at the `addWatchFile` boundary must know the shape
  of the report, and the same scope also reaches Mokly as an absolute
  pattern, a directory, or a PostCSS message. E gives each shape one typed
  record, so a new shape needs only a new classification.
- **Previous examples:** The esbuild path already watches additions below a
  reported PostCSS directory, under `docs/protocol/mokly-watch.md:27`.
  `plans/follow-ups/watch-resource-attach-gap.md` records a related gap of a
  watch path that has not attached yet.
- **Related:**
  - `plans/follow-ups/vite-import-glob-new-files.md`: the same class for an
    `import.meta.glob` of a JavaScript module. The JavaScript half of E can
    serve both items, so the answer here decides the record of that item.
  - `plans/follow-ups/vite-renderer-pruning-css-modules.md`: options that
    conflict while its pruning rule stays. If the files that a scope matches
    join the stylesheet dependencies, a renderer stylesheet with a broad
    Tailwind scope prunes each entry stylesheet below it, at
    `crates/mokly-render/src/bundle_styles.rs:83`. B, C, D, and E keep the
    scope only in `Bundle.directories`. Option B of that item removes the
    conflict.
  - `plans/follow-ups/vite-plugin-report-hook-order.md`: the same code. If
    its option D, a wrapper of each plugin's hooks, lands, move the pattern
    rule into that shared report rule.
  - `plans/follow-ups/stylesheet-cache-across-restarts.md`: if a stylesheet
    store across restarts lands, `build` also reuses records, so its stamp
    also needs the scope. B, D, and E give it.
- **Recommendation:** D. It fixes both Tailwind forms that the adapter
  supports, through the record that already gives the esbuild path this
  behaviour. B misses `@tailwindcss/postcss` under the adapter. If the user
  wants no new input kind now, choose A, because it tells the author which
  rule to add.
- **Action:** ask the user, because the input rules of the Vite adapter keep
  only reported regular files and absent paths, and the recommended D adds
  plugin scan scopes as an input.

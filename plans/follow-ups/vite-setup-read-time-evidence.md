# Setup evidence needs each loader's own read

- **Severity:** High. **Likelihood:** Rare. **Effort:** Large. **Confidence:** Medium. **Harder later:** Yes.
- **Kind:** Fix after merge.
- **Added:** 2026-11-25, from round 1 of the implementation review of the
  branch `calummoore/storybook-track-d-finish-nkpi`, finding 32, option C.
  It also covers option C of finding 5. The branch applied option D of
  finding 32 and option B of finding 5, the direct fixes for the config
  loader and the env reads. This item is their wider fix.
- **Location:** `packages/mokly/src/sidecar/vite-config-source.ts:15`,
  `packages/mokly/src/sidecar/vite-setup.ts:67`,
  `packages/mokly/src/sidecar/vite-setup.ts:187`,
  `packages/mokly/src/sidecar/vite-working-env.ts:75`, and
  `packages/mokly/src/sidecar/vite-compiler.ts:76`.
- **Reason:** One read-time record reaches every setup loader and the
  Storybook setup inputs that later work adds, so it needs its own branch.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Vite adapter:** The optional compile path that compiles JavaScript
    through the project's own Vite setup.
  - **Setup input:** A file that the Vite setup reads while it loads, such as
    the Vite config file, its imports, and the env files. A change to one
    reloads the setup.
  - **Read-time evidence:** The digest of the bytes that a loader gave to the
    setup, taken at the read itself.
  - **Setup-change check:** The check at the end of a compile, at
    `packages/mokly/src/sidecar/vite-compiler.ts:76`. It compares the
    recorded setup inputs with the files, and it fails with
    `Vite setup changed during compilation`.
- **Background:**
  - `docs/protocol/mokly-vite-adapter-inputs.md` lists the setup inputs. A
    change to one causes a rebuild, reloads the setup, and moves every render
    input key. A `bundle` request never uses a transform of older bytes than
    the bytes that the graph reports.
  - One Vite server for each source root stays alive between requests. File
    evidence decides its reuse. See `docs/protocol/mokly-vite-adapter.md:109`
    and `packages/mokly/src/sidecar/vite-context.ts:88`.
  - Mokly gets evidence for a file only when it knows the file before the
    load or sees its read. See `packages/mokly/src/sidecar/vite-setup.ts:50`
    and `packages/mokly/src/sidecar/vite-working-env.ts:125`. The inputs
    protocol rejects a record of every file that the setup reads, because
    Vite reads some files in native code.
  - Vite 8.3.8 reads each env file with synchronous `fs.statSync` and
    `fs.readFileSync` calls inside the async context of Mokly's setup call,
    at `node_modules/vite/dist/node/chunks/node.js:6169`. It loads the env
    values before it awaits the project's `configResolved` hooks.
  - The core cannot fix this alone. Rust's bundle stamp holds the late digest
    of each file, at `crates/mokly-render/src/bundle_attempt.rs:126`, and it
    reuses the old bundle with no sidecar request, at
    `crates/mokly-render/src/bundle.rs:69`. A reload that Rust forces gives
    the new generation the digest that the stale one reported. So the render
    keys do not move, and Serve keeps the old renders.
  - `postcss.initial` already samples the PostCSS config candidates before
    the read. The files that a `rebuild` rule matches have reads that Mokly
    cannot see, so they keep their samples before and after the load.
  - The Storybook setup on the Vite adapter, which the Storybook support work
    adds later, brings Storybook's preset loader into the setup. Mokly may
    not see its reads.
- **Problem:**
  - In each case of this class, the first record of a setup input was a
    snapshot after the setup, at `vite-setup.ts:69`. The setup-change check
    then compared two late reads, at `vite-compiler.ts:77`.
  - The config case: the config loader reads the file, and then an
    asynchronous config factory can wait while the author saves an edit.
    The final check compared two reads of the new file, so the old setup
    passed.
  - The env case: an asynchronous `configResolved` hook can wait while the
    author saves a head env file. Vite kept the old value, and Mokly recorded
    the digest of the new file.
  - On 2026-11-25 the branch that found this item fixed both cases with
    direct fixes. The config loader now records each candidate probe and
    the digest of each file of the config bundle at its read, also a JSON
    helper. Each setup takes one byte snapshot for its env reads and derives
    its evidence from that snapshot.
  - Each direct fix knows its own loader. A new loader, such as Storybook's
    preset loader, needs its own wiring, or it repeats the race.
- **Screenshot:** In Serve's Canvas, mark the old value after a config edit
  that the author made while the first setup was waiting.
- **Impact if no action:** A generation can hold old configuration under the
  new file digest. A later rebuild can keep the same setup, with no further
  edit to detect.
- **Root question:** How does the evidence of a generation describe the bytes
  that each setup input gave to that setup?
- **Options:**
  - **A.** Check the selected config before and after the setup, and load the
    setup again when it changes. This covers the config file only. Effort:
    Small.
  - **B.** Take the digests of the config and its local helpers when the
    loader reads them. Use them in the setup-change check, and reuse only a
    matching setup. Test with a config factory that signals readiness and
    waits while the fixture edits the file. Effort: Medium.
  - **C.** One setup read record for every setup input:
    - Record read-time evidence in one record for each setup input whose
      reads Mokly can see: the config file, its local imports, and the env
      candidates of both sides.
    - Derive the setup digest, the metadata inputs, and the reuse stamp only
      from that record.
    - Keep the samples before and after the load for the `rebuild`-rule
      files and for the PostCSS candidates.
    - Send a sidecar `diagnostic` event when a present candidate has no
      recorded read. A change of Vite's read path then shows.
    - Cost: it changes the config loader and the env hooks together, and each
      loader needs a readiness test.
    - Effort: Large.
  - **D.** Apply B to each read and each probe of the config loader. Record
    the result of each candidate probe in `configFile`. Read each file of the
    config bundle in the plugin, also a JSON helper, and give esbuild its
    bytes with the `default` loader. Compare these records with the final
    snapshot in the setup-change check. The branch applied D on 2026-11-25.
    Effort: Medium.
  - **E.** Use file status, not read hooks, as evidence:
    - Record the start time of each setup load.
    - After the load, accept the setup only when each input of the final
      snapshot is mature at that start time under `mature`, at
      `packages/mokly/src/sidecar/capture-runtime.ts:113`.
    - If not, wait for the guard to pass and load again, with one limit
      before the existing error.
    - It needs no read hook, so it also covers a native read and a
      third-party loader.
    - Cost: with whole-second timestamps the guard is 2.1 s, and the default
      debounce is 75 ms, at `crates/mokly-watch/src/plan.rs:55`. So each
      reload that an edit starts waits and loads two times. A setup that
      writes one of its own inputs in each load fails, also when the bytes
      stay the same.
    - Effort: Medium.
  - **F.** Extend A to the config imports. Digest each file of the config
    bundle as soon as esbuild returns, before the module evaluates and the
    factory runs. Compare the digests with the final snapshot. Cost: an edit
    during the bundle build itself stays undetected. Effort: Small.
- **Left out:**
  - Another snapshot after the setup ends. Both late reads see the edited
    file, so it fails the goal.
  - A snapshot before the setup. Before the config loads, Mokly cannot know
    the final `envDir`. After the config loads, the config can already have
    read the env files, for example with `loadEnv` in `vite.config.ts`.
  - A new setup for each request. Rust reuses the old bundle from its stamp
    with no request, so it fails the goal. Each edit would also pay a full
    setup load.
  - An inline config with `envDir: false` and env values that Mokly loads.
    Mokly then copies Vite's parse and expansion rules, and plugins that read
    `config.envDir` lose the env files.
  - A private copy of the env files on disk. Mokly's use of Vite writes no
    file, as `docs/protocol/mokly-vite-adapter.md:104` says.
- **Wider fix:** C. B and D must know that Mokly's esbuild loader supplies
  the bytes, so they are direct fixes. C makes read-time evidence a part of
  each setup input, so the env reads and the Storybook preset loader get the
  same check.
- **Previous examples:** Commit `134d1c04b` fixed stale stylesheet output
  after edits of PostCSS config inputs. It keeps observed PostCSS
  configuration reads apart from late observations.
- **Related:**
  - The branch that found this item gave each Vite setup input one record
    with a stable name and separate physical read and watch paths. Add the
    observed digest to that record, so that C extends one mechanism and does
    not add a second one.
  - The same branch records each repository file that Node resolves while
    the config loads, also through a computed `require` or `import()`. Give
    each such record the digest of the bytes that Node read, or the race
    stays for a computed helper.
  - `plans/follow-ups/vite-config-modules-own-url.md`: its loader reads each
    config module in one load hook, which can also take the read-time
    digest.
  - `plans/follow-ups/vite-setup-error-location.md`: one config load result
    can carry the read records, the selected file, and the error locator.
  - The review of 2026-11-25 found the same late read for a file that a
    plugin reports, at `packages/mokly/src/sidecar/vite-plugin-inputs.ts:76`,
    when no earlier snapshot holds the file. C can cover it, unless another
    fix already did.
  - `plans/follow-ups/vite-static-build-input-evidence.md`: a shared wider
    fix. Its recommended option delivers static observations of each Vite
    input. Deliver them from the read record of C.
  - `plans/follow-ups/vite-setup-config-directory-listing.md`: C here also
    lets the setup check drop its listing of the configuration directory.
- **Recommendation:** C. It makes read-time evidence a part of each setup
  input, so a new loader cannot bring the race back.
- **Action:** fix after merge, apply C, because C reaches every setup loader
  and the Storybook setup inputs that later work adds.

# Any new configuration-directory file changes the setup

- **Severity:** Medium. **Likelihood:** Common. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-25, from round 2 of the implementation review of the
  branch `calummoore/storybook-track-d-finish-nkpi`: a new problem that the
  finding check of finding 135 found.
- **Location:** `packages/mokly/src/sidecar/vite-setup-snapshot.ts:49`,
  `packages/mokly/src/sidecar/vite-setup-snapshot.ts:180`, and
  `packages/mokly/src/sidecar/vite-context.ts:106`.
- **Reason:** The name list of the fix must follow the files that the config
  load reads, which `plans/follow-ups/vite-setup-read-time-evidence.md` also
  changes.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Vite adapter:** The optional compile path that compiles JavaScript and
    transforms stylesheets through the project's own Vite setup.
  - **Configuration directory:** The directory of `mokly.config.json`. Vite's
    config lookup starts there.
  - **Setup stamp:** The sidecar's digest of the setup inputs. A different
    stamp reloads the setup, and a change during a compile fails the
    compile.
- **Background:**
  - `docs/protocol/mokly-vite-adapter-inputs.md:11` lists the inputs of a
    Vite compile. The file names of the configuration directory are not on
    the list.
  - `setupSnapshot` adds the names of every file and link of the
    configuration directory to the setup stamp, at
    `packages/mokly/src/sidecar/vite-setup-snapshot.ts:49` and line 63. The
    listing came with the first adapter commit `e531693fd`.
  - The config record also probes each Vite config file name in Vite's
    order, at `packages/mokly/src/sidecar/vite-config.ts:59`.
  - `verifySetup` compares the names, at
    `packages/mokly/src/sidecar/vite-setup-snapshot.ts:180`. A change fails
    the compile with `Vite setup changed during compilation at {file}`.
  - Each request compares the stamp to decide whether the setup reloads, at
    `packages/mokly/src/sidecar/vite-context.ts:106`. A different stamp after
    the first setup asks for a fresh worker.
- **Problem:** An unrelated new file in the configuration directory changes
  the setup stamp. A file that appears during a compile fails the compile
  with a setup change. In Serve, the next request also reloads the setup in a
  fresh worker. A swap file that an editor writes beside a file in that
  directory is such a file.
- **Impact if no action:** Serve pays a process start and a setup load after
  unrelated file events in the configuration directory. A compile can fail
  with a false setup change.
- **Root question:** Which file names of the configuration directory can
  change the Vite setup, and which names must the setup check compare?
- **Options:**
  - **A.** Remove the directory listing from the setup stamp and from the
    final check. Keep the config file probes. Cost: a new file that the
    config load reads without a probe, such as a `package.json` or a
    `tsconfig.json` beside the config, then shows only after a restart.
    Effort: Small.
  - **B.** Keep a listing of only the names that the config load can read in
    that directory: the Vite config file names, `package.json`,
    `tsconfig.json`, and `jsconfig.json`. Test that an unrelated new file
    during a compile, and between two Serve requests, keeps the setup.
    Effort: Small.
  - **C.** Record each probe and each read of the config load as a present
    or absent setup input, as option C of
    `plans/follow-ups/vite-setup-read-time-evidence.md` proposes. Then remove
    the listing. Effort: Large.
- **Left out:** Change nothing. It fails the goal, because unrelated files
  keep their effect.
- **Wider fix:** C. With each probe and each read of the config load
  recorded, the setup check compares only real inputs, so no listing is
  necessary.
- **Previous examples:** None found.
- **Related:**
  - `plans/follow-ups/vite-static-build-input-evidence.md`: its option F runs
    the same setup check before a static build installs its output. Fix this
    item first, or an unrelated new file stops that build.
  - `plans/follow-ups/vite-setup-read-time-evidence.md`: C here is its option
    C.
  - `plans/follow-ups/workspace-import-resolution-record.md`: same code. Its
    option C keeps a record of each lookup of the Vite config, and the setup
    reuse derives from those records through `setupSnapshot`. Those records
    are a part of the recorded probes and reads that C here needs.
- **Recommendation:** B. It removes the false reloads and failures, and it
  keeps the detection of a new file that the config load can read.
- **Action:** fix after merge, apply B, because its name list must follow the
  config loaders, and C waits for the read-time evidence item.

# Metadata changes during marked compiles keep stale owners

- **Severity:** High. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-20, from the nearer PnP post-build proof and the design
  investigation of the second implementation review round of the branch
  `calummoore/mokly-folder-export-evidence-7rox`. A baseline run on `main`
  source `a2f61eb53` gave the same stale result.
- **Location:** `PackageFolderLookups.accept` and `finish` in
  `packages/mokly/src/sidecar/package-folder-lookups.ts`, `PnpLocations.read`
  in `packages/mokly/src/sidecar/pnp-locations.ts`, and the ancestor manifests
  that `resolutionInputs` lists in
  `packages/mokly/src/sidecar/resolution-inputs.ts`.
- **Reason:** The performance orchestrator answered the branch choice A on
  2026-11-20, so a fix that closes the gap is separate work outside the scope
  of that branch.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Marked compilation:** a Serve edit compile with `capture: "serveEdit"`
    that keeps the `uncaptured: "serveEdit"` marker. Only its live checks
    protect a later reuse.
  - **PnP state file:** `.pnp.data.json`, or the state that `.pnp.cjs`
    embeds. Native discovery takes the first present state file upward from
    the configuration folder.
  - **Native owner:** the package root that esbuild selects for a bare
    import.
- **Background:**
  - The marked folder pass reads the defining manifest and the PnP state
    after the compile. The marked checks of `main` also read each ancestor
    package manifest after the compile.
  - The `full` capture pins both before esbuild resolves the import, so this
    timing does not reach it.
  - The order-aware rule of option A of
    [marked-post-build-coherence.md](./marked-post-build-coherence.md) is
    exact for one folder target. It cannot see which condition or array
    target becomes active after a manifest edit during the compile. It cannot
    see the native owner after a state edit, or after a new nearer state,
    when the old location stays reachable.
  - The exact proof wraps unmodified `esbuild.build` for one compile:
    - A PnP fixture has an ancestor `.pnp.data.json` at its root and a
      configuration folder without a state file. The native compile selects
      `original-index`.
    - After `build` returns, the wrapper creates a nearer `.pnp.data.json` in
      the configuration folder. Its explicit dependency makes native
      resolution select another root, whose module exports `preferred-file`.
      The importer, the ancestor registry, both manifests, and both selected
      files stay equal.
    - A fresh compile selects `preferred-file`. `reuse` still accepts the old
      marked key. The assertion "a new nearer PnP owner recorded after native
      compilation must reject the retained marked key" fails.
    - On the branch, the first result has 3 private entries, among them the
      nearer state, which is already present, and the old manifest. The
      sidecar recorded them after the new state appeared. On `main` at source
      `a2f61eb53`, the first result has 0 entries, and the old key is still
      reused. So the result is stale on `main` and stays stale on the branch.
  - The choice A for the branch `calummoore/mokly-folder-export-evidence-7rox`
    was answered on 2026-11-20, and it does not block the pull request of
    that branch. The performance orchestrator kept the same metadata timing
    as `main`. A does not fix the stale result. It keeps the stale result of
    `main`. No protocol rule accepts the residual. The pull request says that
    this result is stale on `main` and stays stale. No option that closes the
    gap is approved.
  - Requirements that each option keeps: native esbuild selection stays
    authoritative. Fields, kinds, bounds, wire format, disk format, render
    keys, and watch inputs stay. One compile for each request, with no new
    process, retry, setting, or timeout. A reuse check runs no esbuild
    operation.
  - esbuild reads one PnP state for each build, at its first resolve, from
    the configuration folder. `bundle.ts` sets `absWorkingDir` to that
    folder. Option F relies on this.
  - A fresh options check of 2026-11-20 found no regression. `main` and the
    branch accept the same stale key, the 386 dist files of the `main` build
    match by SHA-256, and the sidecar source has no change from `a2f61eb53`
    to `162b7974a`. By code reading, the branch narrows the race: it pins
    the absent nearer state positions, so a nearer state that appears after
    the recording ends the reuse.
  - The effort grade Medium is that of the planned closing designs E and F.
    A only records the gap, and no closing option is chosen.
- **Problem:** A manifest edit or a new nearer PnP state during a marked
  compile can change the native owner. The checks, recorded after the
  compile, already include the change. So the stale module stays reused.
- **Impact if no action:** Rarely, Serve keeps a stale module after such a
  metadata change during an edit compile, until another live input changes.
  `main` has the same timing for exact package maps.
- **Root question:** In a later, separate change, how can marked reuse
  certify only the owner and target that its recorded metadata still
  selects, also when package metadata or a PnP state file changes during the
  compile? The branch that found the gap keeps the timing of `main` and does
  not close it.
- **Options:**
  - **A.** Keep the shared metadata timing of all marked live checks, as
    `main` does. The stale result stays. Effort: Small.
  - **B.** Before each marked compile, read the PnP state candidates and the
    manifests that the last result of the same settings recorded. Withhold
    the marker when their values change. A new import, and a restore during
    the compile, stay open without timestamps, and PnP catalogues pay a state
    read on each edit. Effort: Medium.
  - **C.** Give the check exact active-target and native-owner parity. The
    call of 2026-11-20 on overlapping PnP roots rejected exact ownership,
    because one wrong parity rule keeps a stale module. Effort: Large.
  - **D.** Apply the timestamp rule of option C of
    [marked-post-build-coherence.md](./marked-post-build-coherence.md):
    withhold the marker when a recorded metadata path changed after the
    attempt start less a guard. Effort: Medium.
  - **E.** After the folder pass, derive the owner and the active target from
    the recorded registry and manifests where the rule is exact, such as an
    explicit dependency of the package of the importer, or a target with a
    single condition. Withhold the marker when they do not reach the selected
    module, and abstain elsewhere. As a fail-closed check, a wrong rule costs
    reuse, not output. It closes the proof, because the nearer state names
    another root. Each modeled rule needs one native control. Effort: Medium.
  - **F.** Pin the PnP state and the absent nearer positions before the
    compile, and let the folder pass use that snapshot. The current check at
    record time then withholds the marker after a change, and a later change
    ends the reuse. It closes the proof and state edits, and manifest edits
    stay open. A PnP catalogue with folder selections moves its existing
    state read earlier. Another catalogue pays a new walk of file stats on
    each edit, unless a session flag gates it. Effort: Medium, because the
    snapshot crosses the compile boundary and needs a cost check.
- **Left out:** A native owner probe: it shares resolver caches, as the
  withdrawn probe of 2026-11-19 showed.
- **Wider fix:** E, run for every marked package import, with exact maps
  included. It also covers the exact package maps of `main`.
- **Previous examples:** `docs/protocol/mokly-sidecar-recipes.md` accepts
  the gap of a configuration chain that the sidecar cannot read. On
  2026-11-19 a native PnP probe was withdrawn, because it shared resolver
  caches.
- **Related:**
  - [marked-post-build-coherence.md](./marked-post-build-coherence.md): its
    option A leaves this residual.
  - [overlapping-reachable-pnp-roots.md at `6ef5bc42c`](https://github.com/mokly-ai/mokly/blob/6ef5bc42c9f8704c300b9f94a6f2d01e48586bf7/plans/follow-ups/overlapping-reachable-pnp-roots.md):
    the full record of the overlap measurement of 2026-11-20. Its reachable
    superset decides which PnP roots the checks keep. On 2026-11-20 the
    performance orchestrator chose its option A, which kept the reachable
    superset. With the user's approval, a commit of 2026-11-22 deleted that
    item.
- **Recommendation:** A, for the current branch only, as answered on
  2026-11-20. It keeps the stale result of `main` and fixes nothing. No option
  for the separate work is chosen or approved. The options check rates F as
  the cheapest sound fix of the proof, and E, run for every package import,
  as the best protection of the codebase.
- **Action:** ask the user when this separate work starts, because each
  option that closes the gap has a real trade-off. B to D need edit-time
  reads, timestamps, or the exact parity that a recorded call rejected. E
  needs a native control for each modeled rule. F moves state reads before
  the compile and leaves manifest edits open. So no option is clearly best.

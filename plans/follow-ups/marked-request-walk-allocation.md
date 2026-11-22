# Marked request walk keeps a residual edit cost

- **Severity:** Medium. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-20, from the final component measurement of the branch
  `calummoore/mokly-folder-export-evidence-7rox`, after its last allocation
  round.
- **Location:** `MetafileEdges.requests` in
  `packages/mokly/src/sidecar/metafile-edges.ts:94`, `serveEditLookups` in
  `packages/mokly/src/sidecar/serve-edit-lookups.ts:12`,
  `PackageFolderLookups.accept` in
  `packages/mokly/src/sidecar/package-folder-lookups.ts:78`,
  `PackageFolders.lookup` in `packages/mokly/src/sidecar/package-folders.ts:49`,
  `PackageFolderMaps.describe` in
  `packages/mokly/src/sidecar/package-folder-maps.ts:56`, `packageMapTargets`
  and `selectedKey` in `packages/mokly/src/sidecar/package-map.ts:21` and
  line 95, `nearestPackage` and `packageDirectories` in
  `packages/mokly/src/sidecar/package-lookup.ts:15` and line 37,
  `parsePackageJson` in `packages/mokly/src/sidecar/package-json.ts:39`,
  `resolutionRequest` in `packages/mokly/src/sidecar/resolution-request.ts:12`
  to line 21, and the `sidecar.bundle.mapped-lookups` phase in
  `packages/mokly/src/sidecar/bundle-recipe.ts:59`.
- **Reason:** The parent stopped optimization on 2026-11-20 after one
  allocation round and ships the correctness fix with this measured residual,
  so more cost work is a separate later change.

- **Source:** Implementation.
- **Category:** Performance.
- **Terms:**
  - **Marked edit:** a Serve edit compile with `capture: "serveEdit"` that
    keeps the `uncaptured: "serveEdit"` marker. A later edit reuses it while
    its live checks still match.
  - **Mapped span:** the `sidecar.bundle.mapped-lookups` timing phase of a
    marked edit. It runs after esbuild returns and records the live checks.
  - **Shared request walk:** `MetafileEdges.requests`, which walks the import
    edges of the metafile once. `serveEditLookups` gives each effective
    request to the marked recorders.
  - **Marked recorders:** `ServeEditPaths`, for the TypeScript `paths` and
    `baseUrl` candidates, and `PackageFolderLookups`, for package folder
    mappings. Each keeps its own inputs, limits, and staging.
  - **Component pair:** one run of `main` and one run of the branch, each in
    a fresh worker, with the same public Session calls and the same edit.
- **Background:**
  - The folder evidence branch makes a marked edit classify each effective
    bare or `#` request for package folder mappings after the compile. This
    work runs in the mapped span, also when no import selects through a
    folder mapping.
  - Every option below must keep these rules of the branch:
    - Native esbuild output, the reuse rules, and the error order stay the
      same.
    - The folder candidate rules, the read sets, and the error rules stay the
      same. The read sets include the refresh barriers: an ordinary scan
      reads again before unseen metadata and before a possible folder map.
      The errors include each fail-closed refusal and the error text
      `package export evidence limit`.
    - Every bound stays: 1 MiB for each metadata file, 8 MiB for all
      metadata together, the 8 MiB `EVIDENCE_LIMIT` for the staged paths at
      the `folderRowBytes` charge and for the private table, and the frame
      limit.
    - The depth bound of 32 nested levels stays. An `imports` walk, and a
      forced walk after an `imports` folder mapping, that reach it withhold
      the marker. The performance orchestrator chose this rule on
      2026-11-20.
    - The `full` audit keeps its streaming candidate list, which keeps no
      path and reserves no table row.
    - No new cache: no request-result, selected-owner, or cross-compile
      cache. No new read, native operation, process, setting, wire field,
      bound, or resource ceiling.
    - The shared walk keeps its eligibility flags, its deferred cursor, the
      failure isolation of the two recorders, and their staging and commit
      rules.
    - Memory stays within 2% of `main`, and the cold check passes.
  - The performance orchestrator's call of 2026-11-20 on this cost:
    - Run one final Small allocation round, then stop optimizing, whatever
      the remaining cost.
    - Accept an extra mapped cost of about 15 ms or less for each compile.
      Above it, still ship the correctness fix, and record the residual and
      the owner profile in a follow-up item.
    - Correctness matters more than about 35 ms for each compile, about 1.4%
      of a real cloud edit.
    - Rejected for the branch: work until the mapped span equals `main`,
      because it delays the correctness fix and can need wider metadata
      ownership changes. Also rejected: shipping without the round.
  - The allocation round made only pure computation and allocation
    reductions:
    - `MetafileEdges.requests` finds the folder and the dependency kind of an
      input only after an edge passes its checks. Both facts stay local to
      the current input.
    - A direct loop replaces the alias callback of the eligibility check.
    - `mappedSelection` and the literal-map placement of
      `PackageFolderMaps.describe` return an exact-base match before they
      build extension candidates.
    - `selectedKey` scans the keys once for the best key, in place of a
      filter, a sort, and a find. A tolerant walk checks its flag before the
      split that validates a pattern.
    - No traversal got narrower. Every ignored branch still runs and can
      still raise its error.
  - An owner profile ran before that round, as a separate diagnostic. It
    profiled the build that the round then changed, so the owner shares
    after the round are unknown:
    - One worker for each arm ran at the same installed package path of a
      local mokly-cloud checkout at commit `55972c860`. The `main` arm used
      the frozen build of `a2f61eb53`.
    - Each worker made genuine public Session calls: one full capture,
      complete and durable, with two native setup compiles and a non-empty
      returned plan, one restore into a fresh Session with no compile, and
      one planned marked edit with exactly one compile. The edit produced
      the ordinary empty table with the `serveEdit` marker.
    - The inspector sampled CPU every 100 microseconds and allocation every
      32,768 bytes, collected objects included. The sampling perturbs the
      durations. The profiled mapped span was 12.34 ms for `main` and
      65.24 ms for the branch, with 67 and 430 samples.
    - One profile for each arm shows ownership, not a performance verdict.
      Sample weights estimate the time between samples, not exact clocks.
      The allocation figures include collected objects, so they are not
      retained bytes or RSS. Do not read the samples as acceptance figures.
  - Exclusive owners of the branch's profiled mapped span, as samples,
    weight, and sampled allocations. The labels are those of the profile,
    and the weights add up to the span:
    - request walk and request interpretation: 173, 18.00 ms, 11.475 MB;
    - package-map targets, key selection, and substitution: 51, 8.45 ms,
      7.379 MB;
    - coordinator: 41, 7.41 ms, 0.033 MB;
    - root control: 28, 5.07 ms, 4.298 MB;
    - unattributed garbage collection: 15, 4.89 ms, no allocation figure;
    - other physical probes: 29, 4.65 ms, 0.922 MB;
    - root-folder iteration: 23, 3.69 ms, 4.920 MB;
    - metadata cache and access: 10, 3.66 ms, 0.344 MB;
    - metadata parsing: 21, 3.38 ms, 2.369 MB;
    - containment and placement: 8, 1.33 ms, 0.656 MB;
    - parsed metadata value arrays: 7, 1.31 ms, 0.787 MB;
    - folder-description control: 6, 0.95 ms, 0.066 MB;
    - nearest package, without its children: 5, 0.83 ms, 1.640 MB;
    - folder accept control: 5, 0.81 ms, 0.137 MB;
    - the `paths` recorder: 3, 0.47 ms, 0.066 MB;
    - configuration: 2, 0.32 ms, no sampled allocation;
    - other or span boundary: 3, 0.03 ms, no allocation figure.
  - Inclusive stacks of the same span. They overlap, so do not add them:
    - `PackageFolderLookups.accept`: 33.28 ms, 23.282 MB;
    - `MetafileEdges.requests`: 17.67 ms, 11.442 MB;
    - `PackageFolderMaps.describe`: 10.95 ms, 8.199 MB;
    - `packageMapTargets`: 8.16 ms, 6.789 MB;
    - `selectedKey`: 4.90 ms, its allocations inside the package-map stacks;
    - `nearestPackage`: 3.82 ms, inside the root and metadata stacks;
    - `packageDirectories`: 3.69 ms, 4.920 MB;
    - `parsePackageJson`: 3.38 ms, 2.369 MB;
    - `substitution`: 0.48 ms, inside the package-map stacks.
  - Other profile facts:
    - The self weight of the request iterator was 16.25 ms, and that of the
      coordinator was 7.27 ms. Both include generator and loop dispatch.
    - The alias eligibility callback had about 1.705 MB of sampled
      allocation. The workload has one alias, `react-native`.
    - `MetafileEdges.own` already saves work: `main` had 16 mapped samples
      under it, with 2.46 ms and 3.803 MB, and the branch had none.
    - The marked recorder stacks sampled 10.719 MB for `main` and 35.091 MB
      for the branch, about 24.37 MB more. The whole planned edit sampled
      400.473 MB and 401.254 MB.
    - `mappedFiles` had about 0.459 MB of inclusive allocation.
  - The final six alternating component pairs ran after the round:
    - The `main` arm used the frozen build of `a2f61eb53`. The branch arm
      used the frozen build of the round on `cb84b44d5`.
    - Each run had its own fresh worker, 12 in total. The order alternated:
      `main` ran first in pairs 1, 3, and 5, and the branch ran first in
      pairs 2, 4, and 6.
    - Each run made the same public calls as the profile workers, and the
      same edit of `docs/mockups/src/screens/product/settings/slug-editor.tsx`
      in the mokly-cloud checkout. Each edit produced the ordinary empty
      table with the marker, so the workload has no folder selection.
    - Means, `main` to branch, in ms: mapped span 11.258339 to 41.653444,
      restore 0.119198 to 0.136043, public planned edit 1140.586316 to
      1100.917333, and edit compile 896.327021 to 853.404783.
    - The mapped span grew in every pair: by 8.244, 19.308, 17.358, 17.190,
      15.789, and 104.481 ms. The paired mean is +30.395105 ms, the paired
      median +17.273777 ms, and the paired MAD 1.759480 ms. The arm medians
      are 9.854990 and 27.105518 ms. Pair 6 causes most of the gap between
      the mean and the median.
    - The planned edit and the compile vary much more, with a paired MAD of
      72.693 ms and 57.647 ms. So their lower means show no measured gain.
  - Before the round, six uninstrumented pairs gave a mapped mean of
    12.494 ms for `main` and 46.527 ms for the branch, with every pair
    positive. Those pairs and the final pairs are separate runs, so their
    difference is no measured effect of the round.
  - An options check of the round estimated, without a measurement, that the
    round removes only part of the profiled owners, such as the alias
    callback, `selectedKey`, and `mappedFiles`. The iterator self weight, the
    coordinator, the root control, and the metadata work remain. It named
    two pure reductions that the round left out:
    - `resolutionRequest` still runs an `aliases.find` callback and builds a
      `key + "/"` string for each alias on each eligible request. Its cost is
      not measured.
    - `selectedKey` could test the rank of a key before it calls
      `substitution`. Both tests are pure, so the result stays the same, and
      the scan skips the string slices of keys that cannot win.
- **Problem:** A marked edit with no folder selection spends about 17 ms more
  than `main` in the mapped span, as the paired median. The shared request
  walk and the ordinary folder classification own most of the profiled span.
- **Impact if no action:** Each marked Serve edit keeps this cost: about
  17 ms as the paired median and 30 ms as the paired mean on the measured
  workload, above the accepted 15 ms. The edit result and its reuse stay
  correct.
- **Root question:** How can a marked edit with no folder selection classify
  its requests at a cost near that of `main`, while it keeps every
  correctness rule, bound, and read set of the folder evidence?
- **Options:**
  - **A.** Accept the residual and change nothing. The cost stays above the
    accepted 15 ms. Effort: Small.
  - **B.** Profile the final build again with the same method. Then make only
    pure reductions in the owners that the new profile names, such as the
    generator and loop dispatch of `MetafileEdges.requests` and
    `serveEditLookups`, the alias lookup of `resolutionRequest`, and the
    rank test before `substitution` in `selectedKey`. Measure six
    alternating component pairs again, and keep every rule above. The gain
    is unknown until the new profile. Effort: Medium.
  - **C.** Rework the ordinary root and metadata work of
    `PackageFolders.lookup`, such as the `nearestPackage` and
    `packageDirectories` work for each request, without a retained cache.
    The refresh barriers decide when each read happens, so a change can drop
    a read that a reuse check needs. Each changed read needs a red-first
    proof. Effort: Large.
  - **D.** Move the marked classification off the edit path, for example to
    idle time, so that the edit result does not wait for it. It changes
    where and when the marker is computed, and the checks are recorded
    later after the compile. It is the wider metadata ownership work that
    the performance orchestrator rejected for the branch. Effort: Large.
- **Left out:**
  - A cross-compile request-result or selected-owner cache: it breaks the
    no-new-cache rule and risks the memory bound.
  - A walk that skips the non-selected keys of a package map: a nested map
    under such a key computes its own selected key. It can still yield
    selected or folder targets and reach the depth refusal, so the skip can
    change candidates or errors.
  - Dropping the folder checks of ordinary imports, or changing a bound: it
    breaks correctness or the memory requirement.
  - A new setting, retry, or native operation: the performance orchestrator
    forbids it.
- **Wider fix:** None. The shared walk is already the one owner of request
  interpretation for both recorders. A cost gate for the mapped span would be
  a new gate, which needs the user.
- **Previous examples:** The shared walk of the same branch removed duplicate
  request work of the two recorders but kept a measured allocation cost. The
  allocation round then removed only pure work. The lazy load of an optional
  parser removed its cold worker cost.
- **Related:**
  - [marked-scope-read-reuse.md](./marked-scope-read-reuse.md): the same
    mapped span. That item covers the configuration reads of the `paths`
    recorder, 0.47 ms and 0.32 ms of the profiled span. Its cache across
    edits conflicts with the no-new-cache rule of this item.
  - [Marked folder checks](../../docs/protocol/mokly-sidecar-folder-reuse.md#marked-live-checks):
    candidate-order and name checks run after the final listings. Their cost
    adds to marked edits outside the mapped span and belongs in a new profile.
- **Recommendation:** B, when this work starts. It is the only option that
  can lower the cost while it keeps every rule above, and its new profile
  first shows which pure owner is left. D best protects the edit time, but it
  changes when the marker is computed.
- **Action:** ask the user when this separate work starts, because the
  parent shipped this residual and stopped optimization on 2026-11-20, and
  each option has a real trade-off. A keeps a cost above the 15 ms limit. B
  has no proved gain before its profile. C risks the refresh barriers. D
  changes when the marker is computed. So no option is clearly best.

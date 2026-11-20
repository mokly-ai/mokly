# Overlapping reachable PnP roots add folder checks

- **Severity:** Medium. **Effort:** Large. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-20, from finding 5 of round 2 of the implementation
  review of the branch `calummoore/mokly-folder-export-evidence-7rox`, at
  commit `18c3827cd` against `main` at `c2fe4bf2a`. The finding check of the
  same round proposed the reachable-root filter. The fresh options check of
  the design item added the kept state-file observation.
- **Location:** `PnpLocations.roots` in
  `packages/mokly/src/sidecar/pnp-locations.ts`, `PackageFolders.lookup` in
  `packages/mokly/src/sidecar/package-folders.ts`, `PnpInputs.capture` in
  `packages/mokly/src/sidecar/pnp-inputs.ts`, and the section "PnP Package
  Roots" of `docs/protocol/mokly-sidecar-folder-reuse.md`.
- **Reason:** The branch fixed the confirmed layout with a sound superset of
  reachable roots and a kept state-file observation, and exact ownership is a
  Large change in which one wrong parity rule can keep a stale module.

- **Source:** Review.
- **Category:** Performance.
- **Terms:**
  - **PnP root:** a package location that the Yarn PnP registry lists for a
    package reference. The registry lives in the PnP state file:
    `.pnp.data.json`, or the state that `.pnp.cjs` embeds.
  - **Reachable root:** a PnP root whose reference, or an alias to it, is the
    target of the requested name in the dependencies of a registry package
    that contains a folder from which the import resolves, of the top-level
    package, or of the fallback pool.
  - **Overlap:** two or more reachable roots of one importer and request
    whose package maps can place the same physical module.
  - **Evidence owners:** the `full` capture, which records folder evidence
    before resolution, and the marked checks, which record live folders and
    private folder files after a Serve edit compile.
  - **Folder checks:** the folders and files that an evidence owner records
    for a selection through a package folder mapping. A change in them ends
    reuse.
- **Background:**
  - Native PnP resolution in esbuild 0.28.2 finds one parent package for the
    importer. That parent is the package whose location is the longest
    prefix of the importer folder. esbuild reads the dependency entry of that
    parent for the requested name. It uses the fallback pool only when the
    parent has no entry. In the esbuild source, `resolveToUnqualified` and
    `findLocator` in `yarnpnp.go` hold this rule.
  - Mokly does not copy that rule. `PnpLocations.roots` gives the roots of
    the requested name and its aliases from the pinned registry. Both
    evidence owners use it:
    - `PackageFolders.lookup` serves the marked checks and the final audit
      of the `full` capture.
    - `PnpInputs.capture` serves the `full` capture before resolution.
  - A root counts when its folder contains the selected module.
    `PackageFolders` merges the candidates of every root that counts. So the
    folder mapping of one root can add checks to a module that another root
    selects.
  - The confirmed base layout, from a proof run against the branch:
    - The registry lists two references of one name. The outer root is
      `.yarn/chosen/`, and its `exports` maps `./sub/` to `./inner/lib/`.
    - The inner root lies inside the outer one. Its exact export selects
      `inner/lib/value/index.js`.
    - The top-level package lists only the inner reference. No package
      lists the outer one.
    - Fresh native output stays `original-index` after `inner/lib/value.ts`
      appears. So esbuild used the inner exact export.
  - Before the reachable filter, the outer folder mapping also placed that
    selection:
    - The marked checks added `inner/lib` and `inner/lib/value` to the live
      folders.
    - They recorded three private files: the outer manifest,
      `inner/lib/value/package.json`, and `.pnp.data.json`.
    - An unrelated file kept reuse. A new `inner/lib/value.ts` ended reuse,
      although the native output stayed `original-index`.
  - The branch now keeps only reachable roots in both owners. The filter is
    an in-memory pass over the pinned registry. It adds no read, no budget,
    and no native operation. It covers each folder from which the import
    resolves, also the folder of a second resolve under the module source
    rules, or it keeps every root of the name for that resolve.
  - When the filter removes a root whose folder mapping matches the request,
    both owners drop its folder checks but keep their observation of the PnP
    state file. In the base layout, the outer root is unreachable. So a new
    `inner/lib/value.ts` now keeps reuse, and a change of the registry ends
    it. The marked private table holds the state file also for this ordinary
    import.
  - A proof run showed why the state file stays. With the filter alone, a
    registry-only edit made the outer root the native owner. After a
    preferred file appeared, native output became `preferred-file`, but both
    modes reused the stale `original-index`. The kept state-file observation
    ends that reuse.
  - A residual stays. A package around the importer, the top-level package,
    or the fallback pool can list a second root of the same name whose map
    can place the selected module. Both roots are then reachable and
    overlap, and the unused one still adds its folder checks. Examples:
    - a root workspace that has the name of the dependency and references
      itself,
    - a `portal:` reference into a subfolder of a workspace with that name.
  - Yarn rejects two workspaces with one name, so the proof registry was
    synthetic. Real layouts can still nest two locations of one name, as in
    the examples. Nobody has measured how often they occur.
  - Native output never changes, because esbuild still selects the module.
    The cost is one extra compile after each change in the extra folders.
  - Decisions in force:
    - On 2026-11-19 the performance orchestrator chose to index the registry
      locations as a bounded superset. It chose not to copy the PnP locator,
      fallback, or ignore rules.
    - On 2026-11-20 the performance orchestrator chose the reachable-root
      superset, under the user's delegation. Reliability comes before speed.
      A sound superset never omits a real folder candidate. That call
      accepts the overlap residual as a narrow exception to unchanged
      ordinary reuse.
    - Later on 2026-11-20, the performance orchestrator extended that call.
      Both owners keep the PnP state-file observation when the filter
      removes a matching folder root. A registry change must end reuse, and
      an irrelevant sibling in the removed root must not.
  - `docs/protocol/mokly-sidecar-folder-reuse.md`, section "PnP Package
    Roots", states the rule, the overlap exception, and the kept state-file
    observation.
  - To measure how often overlap occurs:
    - Add a diagnostic count, off by default. It counts the importer and
      request pairs with two or more reachable roots whose targets can place
      the same physical module.
    - Use all PnP bare requests that the evidence owners classify as the
      denominator. Report both numbers for each catalogue.
    - Keep two controls. In the selected-exact control, the outer root of
      the base layout is reachable, so the count includes it. In the
      selected-folder control, the importer depends on the outer root, so
      its folder checks are real, and a change ends reuse.
    - Run the count on public Yarn PnP projects. Compare each native output
      with a fresh native compile, so that the count changes no output.
    - Keep the existing metadata, evidence, wire, and disk limits. Add no
      default telemetry.
- **Problem:** When reachable roots overlap, an import that native
  resolution selects without a folder mapping still gets the folder checks
  of another root's mapping. A change in those folders ends its reuse,
  although the selection stays the same.
- **Impact if no action:** A catalogue with such a layout compiles again
  after changes that change no selection. Output stays correct.
- **Root question:** How can each evidence owner add the folder checks of
  only the PnP root that native resolution selects, without ever missing a
  real candidate?
- **Options:**
  - **A.** Keep the current reachable-root superset with its kept state-file
    observation. Overlapping reachable roots keep their conservative checks.
    Effort: Small.
  - **B.** Model exact native PnP ownership. It must copy the longest-prefix
    parent, raw location keys, repeated keys with their first-key and
    overwrite rules, aliases, discard flags, ignore patterns, and fallback
    exclusions. It falls back to the reachable superset at each step that
    stays unclear. It keeps the state-file observation, because a registry
    edit can change the owner. A wrong parity rule can drop the real
    candidates and keep a stale module. It reverses the 2026-11-19 choice not
    to copy the locator, fallback, and ignore rules. Effort: Large.
  - **C.** Take package ownership from the native compile, and keep the
    state-file observation for registry edits. The pinned esbuild interface
    exposes no such result, so this needs a fork or an upstream change.
    Effort: Large.
- **Left out:**
  - Deepest-root selection: it can miss an outer mapping into an inner
    package, which keeps a stale module.
  - No marker for overlapping roots: it keeps the performance defect.
  - A resolve at each reuse: it breaks the reuse contract.
  - The runtime API of `.pnp.cjs`: it runs project JavaScript, and a
    `.pnp.data.json` file has no runtime.
- **Wider fix:** C, with the registry dependency of the PnP state file. It
  selects the one native owner, so no unused root adds checks, and a registry
  edit still ends reuse. B is a direct fix, which needs exact parity or the
  reachable superset at each unclear step.
- **Previous examples:** Finding 2 of the same review round added the
  package-root check by containment of the selected module. Finding 5 found
  the unused nested-root regression of the base layout.
- **Recommendation:** B, after the measurement shows that overlap occurs in
  real catalogues. Its superset fallback keeps every real candidate. C best
  protects the codebase, if esbuild exposes package ownership.
- **Action:** fix after merge, apply B, because the branch already fixed the
  confirmed layout, and exact ownership needs its own measurement, parity
  proofs, and a new call that reverses the 2026-11-19 choice.

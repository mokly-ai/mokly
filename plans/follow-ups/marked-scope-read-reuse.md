# Reuse the marked post-compile scope reads across edits

- **Severity:** Low. **Effort:** Medium. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Post-merge task.
- **Category:** Performance.
- **Owner:** The performance orchestrator.
- **Added:** 2026-11-18, from the performance orchestrator's acceptance of the
  post-compile reads of marked Serve edit compiles, on branch
  `calummoore/mokly-absolute-paths-evidence-fix-zqzl`.
- **Location:** `packages/mokly/src/sidecar/bundle-recipe.ts:61` to line 65,
  `packages/mokly/src/sidecar/serve-edit-imports.ts:60`,
  `packages/mokly/src/sidecar/serve-edit-paths.ts:38` and line 142 to line
  154, `packages/mokly/src/sidecar/config-inputs.ts:32` to line 45 and line
  128, `packages/mokly/src/sidecar/physical-inputs.ts:97`,
  `packages/mokly/src/sidecar/mapped-selection.ts:24`, and
  `packages/mokly/src/sidecar/measurements.ts:5`.
- **Reason:** The performance orchestrator accepted these reads on each edit
  as a correctness cost of about 1.5%, so a reuse across edits waits for a
  measured later branch.

- **Terms:**
  - **Marked Serve edit compile:** a head compile that Serve requests with
    `capture: "serveEdit"` after it publishes its first state. It records no
    reuse evidence, and a later `serveEdit` request of the same process can
    reuse it under live checks alone.
  - **Scope read:** the reads of the configuration chain of one importer's
    folder that the post-compile pass makes for a marked compile.
  - **Mapped selection:** the place of the module that esbuild selected among
    the candidates of a `paths` mapping or a `baseUrl`.
  - **Live inputs:** the files, folder lists, and metadata whose change ends
    the reuse of a marked compile.
- **Background:**
  - Since the absolute paths fix of 2026-11-18, `bundleRecipe` runs
    `ServeEditImports.record` after each marked compile, in the timing phase
    `sidecar.bundle.mapped-lookups`, at
    `packages/mokly/src/sidecar/bundle-recipe.ts:61` to line 65. It calls
    `ServeEditPaths.record`, at
    `packages/mokly/src/sidecar/serve-edit-paths.ts:38`. That pass reads the
    edges of the compile's metafile. For each authored bare import, it reads
    the configuration chain of the importer's folder, places the selected
    module among the mapped candidates, and stages the earlier candidate
    folders and `package.json` candidates as live inputs.
  - One pass makes these reads:
    - `lstat` of each component of each configuration path;
    - a read, a hash, and a parse of each `tsconfig.json` and `jsconfig.json`
      candidate and of each relative `extends` base;
    - the canonical path of each defining configuration file, through
      `PhysicalInputs.canonicalFile` at
      `packages/mokly/src/sidecar/physical-inputs.ts:97`;
    - `realpath` probes of each candidate target, each extension candidate,
      and each TypeScript rewrite candidate, such as `.ts` for `.js`, in
      `mappedSelection` at `packages/mokly/src/sidecar/mapped-selection.ts:24`;
    - `stat` of each staged `package.json` candidate.
  - Each pass starts empty. `ServeEditPaths` keeps one scope map and one
    reader for one compile, at lines 142 to 154 of its file. `ConfigInputs`
    caches a scope only inside its reader, at
    `packages/mokly/src/sidecar/config-inputs.ts:32` to line 45. So each edit
    repeats every read. A metadata read stays within 1 MiB for each file, the
    retained observations within 8 MiB, and the staged paths within the 8 MiB
    `EVIDENCE_LIMIT`.
  - A measurement before the CSS edge fix of the same branch compared commit
    `0fd6eced4` with `main` at `4614c4a90` in one real mokly-cloud fixture.
    It supplied the per-edit deltas of `catalogue.bundle`, the candidate
    minus `main`, for edit 1, edit 2, and edit 3, in that order:
    - six interleaved warm rounds: +24, +86, and +12 ms;
    - three interleaved rounds with an empty bundle cache: +19, +155, and
      -15 ms.
  - Overall, that is about +1.5% for each edit.
  - The performance orchestrator accepted this cost on 2026-11-18, under the
    user's delegation of 2026-11-16, as the cost of correct marked reuse. The
    pass scans only metafile edges, its caches last one compile, its reads
    stay within the bounds above, and the measured cost is about 1.5%. The
    absolute paths fix ships no cache across edits.
  - A reuse across edits must stay exact. It must see every configuration and
    candidate change: an edit of a readable relative base, a configuration
    that appears or disappears in a folder of the discovery walk, an absent
    candidate that appears, and a candidate that disappears.
  - The live inputs of a marked compile hold no `extends` base file today, as
    `plans/follow-ups/jsconfig-resolution-input.md` records. So a cache must
    not assume that the existing live inputs are enough to prove it current.
  - A chain with a package `extends` gets no scope read result, as
    `plans/follow-ups/package-tsconfig-extends-reuse.md` records. A cache
    changes nothing for it.
- **Task:**
  1. Measure the `sidecar.bundle.mapped-lookups` span for each Serve edit on
     mokly-cloud, and its share of the `sidecar.bundle` span.
  2. Compare two exact approaches:
     - A cache of parsed scopes across edits, proven by digests. It keeps
       each parsed chain with the digest, the identity, or the absence of
       every file and folder that its reads observed, discovery included. It
       reuses a chain only while a complete check of those observations
       matches.
     - A reuse of the prior mapped selection of an import, only while every
       relevant configuration and candidate observation stays current. The
       pass then skips the scope read and the candidate probes of an
       unchanged import.
  3. Ship an approach only when it lowers the measured cost, keeps every
     selection exact, and the performance orchestrator approves it.
     Otherwise, record that the accepted cost stays.
- **Impact if no action:** Each Serve edit keeps the accepted cost of about
  1.5%, also when no configuration or candidate changed.
- **Needs:** Release builds of `main` and of the candidate change with
  matching sidecars, the mokly-cloud catalogue, timing records with the
  `sidecar.bundle.mapped-lookups` span, and the approval of the performance
  orchestrator.
- **Done when:** A recorded measurement compares the span for each edit
  before and after the candidate change, and the performance orchestrator
  ships one approach or records that the cost stays.

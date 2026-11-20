# Marked post-build checks can certify stale selections

- **Severity:** High. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-20, from the post-build coherence proof and the design
  investigation of the second implementation review round of the branch
  `calummoore/mokly-folder-export-evidence-7rox`. A baseline run on `main`
  source `a2f61eb53` gave the same stale result.
- **Location:** `bundleRecipe` in
  `packages/mokly/src/sidecar/bundle-recipe.ts`, `PackageFolderLookups.accept`
  and `finish` in `packages/mokly/src/sidecar/package-folder-lookups.ts`, the
  placement in `packages/mokly/src/sidecar/package-folders.ts` and
  `packages/mokly/src/sidecar/package-folder-maps.ts`, `resolutionInputs` in
  `packages/mokly/src/sidecar/resolution-inputs.ts`, `reuse` in
  `packages/mokly/src/sidecar/compiled.ts`, and the retained stamp in
  `crates/mokly-render/src/bundle_attempt.rs`.
- **Reason:** The performance orchestrator deferred this shared race on
  2026-11-20, because `main` keeps the same stale result and the fix is
  neither Small nor cost-neutral.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Marked compilation:** a Serve edit compile with `capture: "serveEdit"`
    that keeps the `uncaptured: "serveEdit"` marker. Only its live checks
    protect a later reuse.
  - **Recorded snapshot:** the folder listings, private folder files, and
    consumed digests that a later reuse compares with the disk.
  - **Folder selection:** an import that esbuild resolves through a package
    `exports` or `imports` key that ends in `/`.
  - **Candidate sequence:** the paths that esbuild tries inside one inexact
    target, in order: the exact base, its extensions and `.js` rewrites, the
    main fields, then the index files.
  - **Earlier variant:** a path of a candidate sequence before the selected
    module.
- **Background:**
  - A marked compile records its live checks after esbuild returns.
    `bundleRecipe` walks the import requests once through `serveEditLookups`.
    A request for both recorders goes to the `paths` recorder first and then
    to the folder recorder, which reads manifests. The `paths` checks commit
    first. Then the deferred folder requests run, and the folder recorder
    builds the private table. `resolutionInputs` then lists each staged and
    consumed folder. So the recorded snapshot is taken after the compile.
  - A later `serveEdit` request, or the Rust core for a retained marked
    result, reuses the compilation while each recorded check still matches
    the disk. The TypeScript check compares the disk with the snapshot only.
    The Rust retained stamp compares the logical listings, the metadata
    digests, and the module digests.
  - In esbuild 0.28.2, an inexact folder result goes to
    `loadAsFileOrDirectory`. `loadAsFile` reads the parent folder again. The
    index and main-field steps use the folder cache of the build.
  - Placement today is containment. One variant of any target that equals
    the selected module places it, and the merge joins placements with OR.
    No code checks that an earlier variant is absent in the snapshot.
  - The exact proof wraps unmodified `esbuild.build` for one compile:
    - An installed package maps a folder key to `lib/`. The native compile
      selects `lib/value/index.js`, which exports `original-index`.
    - After `build` returns, and before the sidecar records its checks, the
      wrapper creates `lib/value.ts`, which exports `preferred-file`. The
      importer bytes stay equal.
    - A fresh `serveEdit` compile selects `preferred-file`.
    - The first result keeps the marker, and `reuse` accepts its old runtime
      key. The assertion "a post-build preferred file must not certify the
      old native index" fails.
    - On the branch, the first result has 14 private rows. On `main` at
      source `a2f61eb53`, it has 0 private rows, because `main` records no
      folder checks, and the old key is still reused. So the result is stale
      on `main` and stays stale on the branch.
  - By code reading, the same mechanism reaches every folder route: self,
    linked, alias, package roots, dependency importers, PnP roots, and
    `imports` remaps. It also reaches index and main-field candidates, and
    marked planned attempts.
  - The ordinary marked listings of `main` have the same post-compile
    timing. Take `./value` in `src/entry.ts`, which selects
    `src/value/index.ts`. The recipe lists `src/` after the compile, so a
    `src/value.ts` written in the window enters the snapshot. The recipe rule
    "a higher-priority module in that directory cannot remain hidden" thus
    has the same window.
  - A fresh options check of 2026-11-20 found no regression:
    - `main` and the branch accept the same stale key, and each fails at the
      same final assertion.
    - The 386 dist files of the `main` build match by SHA-256, and the
      sidecar source has no change from `a2f61eb53` to `162b7974a`.
    - The branch rows only add checks, so they cannot allow a reuse that
      `main` refuses. By code reading, the branch narrows the race: `main`
      keeps the stale key also when the file appears after the recording,
      and the branch then ends the reuse.
    - No option is both Small and cost-neutral and closes the proof.
  - Two native attempts on 2026-11-20 gave no red result for the `full`
    half of option B:
    - A cache-window proof stopped at a timeout in a setup deadlock.
    - A resolve proof showed that esbuild already selects the new
      `index.ts` in the first compile.
    - The attempt notes say not to try another variant. So the `full` half
      rests on an unconfirmed lead.
  - The `full` capture records its evidence before esbuild resolves each
    import, so this race does not reach it.
    [in-process-resolution-coherence.md](./in-process-resolution-coherence.md)
    holds the windows of the `full` capture, with an unconfirmed folder
    variant.
  - Requirements that each option keeps:
    - Native esbuild selection stays authoritative.
    - The live checks cover each path that can change the folder selection,
      under `docs/protocol/mokly-sidecar-folder-reuse.md`.
    - Fields, kinds, bounds, wire format, disk format, render keys, and watch
      inputs stay. A withheld marker changes no output.
    - One compile for each request, with no new process, retry, setting, or
      timeout. The sidecar performs no file writes, and a reuse check runs no
      esbuild operation.
  - On 2026-11-20 the performance orchestrator chose option E for the
    branch. Baseline races ship or defer, unless their fix is Small and
    cost-neutral. No protocol rule accepts the race. The pull request says
    that this result is stale on `main` and stays stale.
  - The soundness of option A: a reuse is sound when esbuild, run against
    any state that matches the snapshot, selects the selected module. That
    needs coverage, order parity, and target parity. A candidate that
    appears before the listing is then in the snapshot, and the check
    refuses it. One that appears after the listing makes the disk differ,
    and the live check refuses it. Timing does not enter the argument.
  - The exact rule of option A:
    - Build the candidate sequence of each target and each reachable PnP
      root. Use the order of esbuild: the `node_modules` extension order
      when the written target has a `node_modules` component, the CSS order
      for CSS imports, and the effective main fields with the first property
      of each key.
    - A target reaches the module when a variant equals it as a string or by
      its canonical path. Containment is not a position. Withhold the marker
      when no target reaches the module.
    - Each target that reaches the module must pass. An OR is unsound: with
      `{"import": "./a/", "require": "./b/"}` and `a/value` linked to
      `b/value`, `b` still passes after `a/value.ts` appears.
    - A target passes when no earlier variant matches a name in the recorded
      listing of its folder. The match folds each code point alone with
      `toLowerCase()` and maps `U+0130` to `i`, as the Go lowercase of
      esbuild does. A one-time native run must confirm this fold.
    - Exempt a name only when the snapshot proves that it is no file for
      esbuild. Withhold the marker when a needed listing is missing.
      Evaluate on the listings that `resolutionInputs` returns.
  - Limits of option A:
    - Target parity fails when a manifest changes during the compile. See
      [marked-metadata-owner-timing.md](./marked-metadata-owner-timing.md).
    - A dangling candidate link is a listed name that the snapshot cannot
      prove is no file. See
      [dangling-candidate-link-pin.md](./dangling-candidate-link-pin.md).
    - Listings omit special files. See
      [listing-kind-fidelity.md](./listing-kind-fidelity.md).
- **Problem:** A marked compilation records its checks after the compile. A
  preferred candidate that appears between the read of esbuild and the
  recording enters the recorded listing. The checks then match the new disk,
  so the stale selection stays reused.
- **Impact if no action:** Rarely, Serve shows a stale module until another
  live input changes, or until a restart. A fresh compile stays correct.
- **Root question:** How can marked reuse certify only a selection that its
  own recorded checks still produce?
- **Options:**
  - **A.** After the listings, check each marked folder selection with the
    exact rule above, and withhold the marker when it fails. It adds order
    and case-fold parity, and it closes the proof for native and planned
    attempts. Effort: Medium.
  - **B.** A, plus the same rule in the `full` capture. The capture records
    folder obligations, and `finish` marks the evidence incomplete when the
    rule fails. It also closes the folder variant of
    [in-process-resolution-coherence.md](./in-process-resolution-coherence.md).
    It stays conditional, because that variant is unproved: two native
    attempts gave no red result. Effort: Large.
  - **C.** Record the attempt start, and withhold the marker when a recorded
    folder path changed after the start less a guard. It is a timestamp
    proof that needs volume classes. Reuse ends after each recent install,
    and a protocol rule changes. Effort: Medium.
  - **D.** Before each compile, read the folder paths that the last result
    of the same settings recorded, and require equal values after the
    compile. A new import has no prediction, a delete and re-create defeats
    it without timestamps, and folder catalogues pay extra reads. Effort:
    Large.
  - **E.** Defer the shared race, and keep the timing of `main`. No protocol
    rule accepts it. Effort: Small.
  - **F.** For a selection inside a base folder, withhold the marker when the
    recorded listing of the parent of the base holds a file-step name of that
    base. Exempt staged dangling links and the exact base name, and fold the
    case. It closes the proof shape with no order parity. Index, main-field,
    and extension-order shapes stay open. Effort: Medium, because the
    exemptions, the listing-key mapping, and the case fold take it past one
    hour.
  - **G.** Apply the rule of A to every marked selection, ordinary and
    folder, through one shared candidate sequence. Abstain where a candidate
    folder has no listing, until
    [marked-sibling-file-candidates.md](./marked-sibling-file-candidates.md)
    adds those listings. Ordinary compiles then pay in-memory checks on each
    edge, so the no-folder cost goal needs a new measurement. Effort: Large.
- **Left out:**
  - A copied resolver or a native resolution trace: the pinned interface
    exposes no trace, and earlier calls rejected both.
  - An observation in a resolve callback before the native lookup: A is
    cheaper and needs no cache claim, and the cache reason of the callback
    stays unconfirmed after the two `full` attempts.
  - Listings taken right after `build` returns: this shortens the window but
    keeps it, so it fails the goal.
  - Invalidation by watch events: an event can arrive after the next reuse,
    so the window stays. It fails the goal.
  - Expected-absence rows in the private table: the base folder fails an
    absence check, and option A needs no rows.
  - A blanket marker refusal, an extra compile, a resolve at each reuse, or a
    new request field: the requirements above forbid each one.
  - An OR over targets, or a case fold of the whole string in JavaScript:
    both are unsound.
- **Wider fix:** G. One shared candidate sequence for every marked
  selection still covers the race when it moves to an ordinary import. B adds
  only the `full` owner, for an unconfirmed lead.
- **Previous examples:** An earlier PnP cache-window proof wrote
  `lib/value.ts` after esbuild had cached the `lib` folder, and esbuild still
  chose the new file, because `loadAsFile` reads again. On 2026-11-19 a
  native probe was withdrawn, because it shared resolver caches.
- **Related:**
  - [in-process-resolution-coherence.md](./in-process-resolution-coherence.md):
    the `full` side of the same class. Its option D ranks each winner among
    the captured candidates, and B here extends that rank to folder
    obligations. Each item can merge alone.
  - [dangling-candidate-link-pin.md](./dangling-candidate-link-pin.md):
    decides whether option A keeps its exemption for a dangling candidate
    link.
  - [marked-metadata-owner-timing.md](./marked-metadata-owner-timing.md):
    holds the target-parity residual of option A.
  - [listing-kind-fidelity.md](./listing-kind-fidelity.md): holds a listing
    limit that option A shares.
  - [marked-sibling-file-candidates.md](./marked-sibling-file-candidates.md):
    option G abstains where a candidate folder has no listing, until that
    item adds the listings.
  - [marked-request-walk-allocation.md](./marked-request-walk-allocation.md):
    options A, F, and G add checks to the marked pass, whose measured
    residual cost that item records.
- **Recommendation:** A. The `full` lead of B did not reproduce, so the
  fallback of the design investigation applies: A alone. E stays the call
  for the branch. G best protects the codebase.
- **Action:** fix after merge, apply A, because the performance orchestrator
  deferred this shared race on 2026-11-20: `main` keeps the same stale
  result, and the fix is neither Small nor cost-neutral.

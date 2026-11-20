# Replaced dangling candidate links keep stale reuse

- **Severity:** High. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-20, from the dangling candidate replacement proof and the
  design investigation of the second implementation review round of the
  branch `calummoore/mokly-folder-export-evidence-7rox`. A baseline run on
  `main` source `a2f61eb53` gave the same stale result.
- **Location:** the staging of a dangling candidate link in
  `PackageFolderLookups.accept` of
  `packages/mokly/src/sidecar/package-folder-lookups.ts`, the `absent` and
  `link` comparisons in `packages/mokly/src/sidecar/physical-input-reader.ts`,
  the matcher in `crates/mokly-render/src/physical_inputs.rs`, and the control
  in `tests/sidecar_package_folder_edit.test.ts`.
- **Reason:** The performance orchestrator kept the current reuse on
  2026-11-20 and chose the shared link pin as the later fix, because `main`
  keeps the same stale result.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Marked compilation:** a Serve edit compile with `capture: "serveEdit"`
    that keeps the `uncaptured: "serveEdit"` marker. Only its live checks
    protect a later reuse.
  - **Private folder files:** the file, absent, and link entries in the reuse
    evidence of a marked compilation.
  - **Dangling candidate link:** a symbolic link at an earlier candidate path
    whose final target is absent. esbuild skips it.
  - **Listing:** the sorted names of the non-directory entries of one
    folder, which marked reuse compares with the disk.
- **Background:**
  - esbuild skips a folder candidate that is a dangling symbolic link.
  - The marked folder pass stages the final target of such a link as an
    `absent` private entry. The listing keeps the link name.
  - The permanent test "marked folder reuse rejects the target appearance of
    broken ${preferred}", at line 159 of
    `tests/sidecar_package_folder_edit.test.ts`, requires the marker and
    unchanged reuse until the target appears.
  - No current private kind can pin a dangling link. An `absent` entry uses
    `lstat`, which finds the link. A `link` entry needs a real path, which
    fails for a dangling link.
  - The exact proof:
    - A folder package has a preferred candidate `lib/value.ts` that is a
      dangling link. The native compile selects `original-index`, and the
      result keeps the marker. An unrelated new file keeps reuse.
    - The proof replaces the link with a regular file at the same path: it
      unlinks the link and writes `preferred-file`. The old link target stays
      absent, the importer bytes stay equal, and the entry names of the
      folder stay equal.
    - A fresh compile selects `preferred-file`. `reuse` still accepts the old
      marked key. The assertion "replacing a dangling preferred link with a
      regular file must reject the retained marked key" fails.
    - On the branch, the first result has 15 private entries, with the
      absent old target among them. On `main` at source `a2f61eb53`, it has 0
      entries, and the old key is still reused. So the result is stale on
      `main` and stays stale on the branch.
  - The ordinary relative imports of `main` share this limit, because the
    listings of `main` record names only.
  - The gap is no race. A replacement at any time after the compile keeps
    the stale key.
  - A candidate link that resolves to a folder has the same gap. esbuild
    skips it, and a retarget to a file leaves the listing and the table equal.
  - A fresh options check of 2026-11-20 found no regression. `main` and the
    branch accept the same stale key, the 386 dist files of the `main` build
    match by SHA-256, and the sidecar source has no change from `a2f61eb53`
    to `162b7974a`.
  - The `full` evidence already fails closed on a dangling link in an
    observed folder.
  - On 2026-11-20 the performance orchestrator decided:
    - Keep the current marker and reuse now, as option A says.
    - The shared link pin of option C is the later fix.
    - B stays out, because it removes working reuse.
    - No protocol rule accepts the gap. The pull request says that this
      result is stale on `main` and stays stale.
  - Requirements: for this branch, fields, kinds, bounds, wire format, disk
    format, render keys, and watch inputs stay. That rule binds the branch,
    not the later fix, so options E and F may change a kind or a protocol rule
    with their own decision. A withheld marker changes no output.
- **Problem:** A dangling candidate link that becomes a regular file, or that
  points to a new file, leaves each recorded check equal, while esbuild now
  selects it. So the stale module stays reused.
- **Impact if no action:** Rarely, Serve keeps a stale module after a
  dangling candidate becomes a real file, until another live input changes.
- **Root question:** How can marked reuse notice when a candidate that
  esbuild skips becomes selectable while its name stays? A dangling link is
  one shape. A candidate link to a folder is another.
- **Options:**
  - **A.** Keep the marker, the control, and the current reuse, as `main`
    does. Effort: Small.
  - **B.** Withhold the marker when an earlier candidate is a dangling link.
    It is sound, but the control must then expect no marker, and such folder
    selections lose edit reuse. Effort: Small.
  - **C.** Pin the link. A `link` entry whose real path fails then matches
    only a link with the same lexical final target, and only beside an
    absent entry for that target. It changes the shared link comparison in
    TypeScript and Rust, and its rule in
    `docs/protocol/mokly-sidecar-folder-reuse.md`. It can also cover a
    candidate link to a folder, because the existing `link` kind pins a
    resolving link. Effort: Medium.
  - **D.** Check an `absent` entry through links, as esbuild probes a
    candidate. Stage the dangling candidate itself as absent, in place of the
    target walk. A file or a resolving link then fails the entry. It changes
    the recipe rule "A candidate that cannot be read never matches a recorded
    absence" for `full` and marked evidence in TypeScript and Rust. Effort:
    Medium.
  - **E.** Add a private kind for a dangling link with its lexical target. It
    gives the result of C without a second meaning for the `link` target. It
    changes the generated input type and both runtime predicates. Effort:
    Medium.
  - **F.** Record entries with kinds for each candidate folder in the private
    table, with the lexical rule of C for a dangling link. It covers dangling
    links, retargeted candidate links, and special files. It changes the
    protocol rule that the table holds no folder entries, and it uses more of
    the table bound. Effort: Large.
- **Left out:**
  - Three earlier exclusions now come back as options. The candidate path as
    an `absent` entry is D: its reason was the current `lstat` check, not a
    requirement. A new private kind is E: its reason was a constraint of this
    branch, not of the later fix. Folder entries in the private table are F:
    the lexical rule of C removes their dangling-target reason.
  - A null digest in the compiled inputs: the Rust retained stamp does not
    compare that map, so it fails the goal for retained reuse in Rust.
- **Wider fix:** F. Entries with kinds for each candidate folder cover every
  skipped shape. The name-only listings also cause
  [marked-reuse-link-retarget.md](./marked-reuse-link-retarget.md). Option E of
  `marked-reuse-link-retarget.md`, one shared path-and-link observation
  model, with a dangling-link rule, is the form for every route.
- **Previous examples:** The `full` evidence fails closed on a dangling link
  in an observed folder. The same test asserts it with the message "rich
  directory evidence already fails closed on a broken link".
- **Related:**
  - [marked-post-build-coherence.md](./marked-post-build-coherence.md): its
    option A keeps an exemption for a dangling candidate link only under A or
    C here.
  - [marked-reuse-link-retarget.md](./marked-reuse-link-retarget.md): the
    same cause, name-only listings, for a link retarget on every route.
- **Recommendation:** C, kept as the later fix, while A stays the current
  call. It keeps the reuse of the control and closes the gap for both
  runtimes. F best protects the codebase.
- **Action:** fix after merge, apply C, because the performance orchestrator
  kept the current reuse and chose the shared link pin as the later fix on
  2026-11-20, and B stays out because it removes working reuse.

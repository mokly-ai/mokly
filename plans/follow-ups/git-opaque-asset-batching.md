# Extracted base assets are read whole for delivery

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan:
  user item 64, from finding 8 of the sixth Milestone 14 review, and its
  measurement task. Narrowed on 2026-11-01 by the branch
  `conductor/rust-rebuild-64-opaque-asset-digests`, from finding 6 of its
  review, to the part that the branch did not resolve.
- **Location:** `crates/mokly-compare/src/git_asset_stream.rs:38-53`,
  `crates/mokly-compare/src/sources_assets.rs:35-47`, and
  `crates/mokly-cli/src/changes_base.rs:68-86`.
- **Reason:** The branch that streamed the Git path kept the extracted path,
  and its two fix rounds without the user are used up.

- **Source:** Implementation.
- **Category:** Performance.
- **Terms:**
  - **Opaque asset:** a file such as an image or a font that a comparison
    hashes and delivers as bytes, without parsing it.
  - **Base side:** the catalogue from the comparison commit that Changes
    uses as its baseline.
  - **Leased extraction:** the extracted copy of the files of the base
    commit that a base gets when it needs the sidecar. It answers base reads
    and digests without Git.
  - **Private copy:** the copy into which delivery copies an asset and
    checks its SHA-256 before the asset leaves: a temporary file in Serve,
    and the final payload in a static build.
- **Background:**
  - The branch `conductor/rust-rebuild-64-opaque-asset-digests` resolved the
    Git part of this item on 2026-11-01. The lookups, the attribute checks,
    and the digests of the opaque assets of one stylesheet run as one batch.
    The probe of 65 base assets fell from 742 to 90 Git processes. Delivery
    through Git streams the converted bytes into the private copy, in chunks
    of at most 64 KiB, so it holds no whole blob.
  - Delivery from a leased extraction still reads the whole file. The CLI
    attaches an extraction when the base configuration names PostCSS or a
    renderer, or when the base holds modules or stories, at
    `crates/mokly-cli/src/changes_base.rs:68-86`. Every React base is such a
    base.
  - Since PR #236, merged on 2026-10-28, an attached extraction answers the
    reads and the digests of the files that it holds without Git, at
    `crates/mokly-compare/src/sources.rs:199-204` and line 272. A file that
    changed since its first fingerprint in the process reads through Git.
    Since PR #237, merged on 2026-10-29, so does a file that the extraction
    cannot read.
  - With an extraction, `digest_source_batch` returns each digest with
    `length: None`, at `crates/mokly-compare/src/sources_assets.rs:35-47`.
    `opaque_stream` then reads the whole file through `read_many` into a
    `Cursor` before the private copy, at
    `crates/mokly-compare/src/git_asset_stream.rs:38-53`.
  - The first commit of that branch, `5128643e`, kept this buffered path,
    because PR #237 owned `crates/mokly-git/src/extracted.rs` at that time.
    PR #237 merged on 2026-10-29. The fix of finding 2 of that branch kept
    the buffered path for a completed digest record without a length, so an
    open starts no second digest.
  - On 2026-10-28 the coordinator chose option A, refined, for the user.
    Batch the lookups, the attribute checks, and the digests of the opaque
    assets of one stylesheet, with one Git process for each kind of a
    bounded batch. Stream a base asset from Git into the private copy that
    Serve already makes in `crates/mokly-server/src/asset_streams.rs`,
    instead of reading the whole blob. Keep the 48 MiB batch bound, the
    64 MiB blob bound, and the 120-second process deadline. A digest also
    counts the converted bytes, so that delivery knows the length before
    it copies. This choice of a streamed delivery covers the extracted path
    too, so a later branch applies option A without the user.
  - Measured on 2026-10-28 with a release binary, for an HTML catalogue
    whose base commit held 65 opaque assets: the base build started 742
    Git processes, about ten for each asset. 64 small assets added 4.5 s to
    a 0.3 s build. A build that copied a 60 MiB base asset added about
    180 MB of peak RSS. The default large fixtures hold one opaque asset
    each.
  - A one-time probe on 2026-11-01 used the release binary `2a196323`,
    built from commit `8efaa239` of that branch. Its HTML fixture holds one
    60 MiB opaque asset, so its base needs no sidecar and its delivery
    streams from Git. Three runs each gave a peak RSS of 215,320 to
    224,032 KiB with Changes against `HEAD`, and 90,884 to 99,628 KiB with
    `--no-changes`.
  - `crates/mokly-static/src/resource_bytes.rs:22` reads each snapshot
    asset whole into the in-memory output inventory, for each side, through
    the resource loop at `crates/mokly-static/src/comparison_files.rs:45`.
    So the 180 MB of the 2026-10-28 measurement stays after that branch. Its
    cause is the snapshot copies, which
    `plans/follow-ups/snapshot-resource-copies.md` concerns.
- **Problem:** Delivery of a base asset from a leased extraction holds a
  full copy of the file in memory before the private copy.
- **Impact if no action:** A large base asset of a React catalogue costs one
  full extra copy in memory for each delivery. The extraction path also has
  no 64 MiB bound, which `base-asset-conversion-unavailable.md` records
  under its option D.
- **Root question:** How does delivery of an extracted base asset avoid a
  full copy in memory, as the Git path now does?
- **Options:**
  - **A.** Stream an extracted asset from its file into the private copy.
    Take the length from the extracted file, and check the SHA-256 and the
    length through the copy. Keep the Git fallback of PR #236 and PR #237
    for a file that changed or that the extraction cannot read.
    Effort: Small.
  - **B.** Give each extraction digest the length of its extracted file, so
    that the streamed path of Git delivery takes it. Effort: Small.
  - **C.** Change nothing. Effort: Small.
- **Left out:**
  - Fix the snapshot copies of the static build here:
    `snapshot-resource-copies.md` owns that work.
  - Remove the bounds to simplify the code: it breaks the comparison memory
    contract.
- **Wider fix:** A. One streamed delivery serves both base sources.
- **Previous examples:** `GitStream` in
  `crates/mokly-compare/src/git_asset_stream.rs`, the Git stream of the
  branch `conductor/rust-rebuild-64-opaque-asset-digests`. PR #229 and
  PR #236, merged on 2026-10-28, batched the base reads of source files and
  removed one Git process per file.
- **Related:**
  - [snapshot-resource-copies.md](./snapshot-resource-copies.md) concerns
    the snapshot copies that cause the build memory of the 2026-10-28
    measurement.
  - [base-asset-conversion-unavailable.md](./base-asset-conversion-unavailable.md)
    records under its option D that the extraction digest has no 64 MiB
    bound. That bound and option A change the same extracted path. Either
    can land first, and the later change keeps the rule of the earlier one.
  - The
    [opaque asset spool item at its last commit](https://github.com/mokly-ai/mokly/blob/c7e7d9b88efc84152eb33539ed8ed7ca2ad2bb93/plans/follow-ups/opaque-asset-generation-spool.md)
    was about how Serve delivers the same opaque assets. It closed on
    2026-11-01 with PR #273, merged as `d148edc5`, which makes concurrent
    requests for one generation and asset route share one verified copy, in
    `crates/mokly-server/src/asset_streams.rs`. Option A streams into that
    same copy.
  - [base-batch-fallback-processes.md](./base-batch-fallback-processes.md)
    concerns the Git processes of each file after a failed batch. The
    resolved Git part of this item added one more such retry: a failed
    digest batch digests each asset again alone, in
    `crates/mokly-git/src/checkout_digest.rs`.
- **Recommendation:** A. It removes the full copy from the extracted path,
  as the Git path did, and the decision of 2026-10-28 covers it.
- **Action:** fix after merge, apply A, because the severity is Low, the two
  fix rounds of the branch without the user are used up, and the decision
  of 2026-10-28 covers it.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L5834).

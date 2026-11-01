# Batch Git reads for opaque assets

- **Severity:** Low. **Effort:** Large. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan:
  user item 64, from finding 8 of the sixth Milestone 14 review, and its
  measurement task.
- **Location:** `crates/mokly-compare/src/git_asset_io.rs:13-69`
  (`digest_file`) and `:71-100` (`opaque_stream`).
- **Reason:** On 2026-10-28 the coordinator chose option A, refined, for
  the user. Only its implementation waits.

- **Source:** Review.
- **Category:** Performance.
- **Terms:**
  - **Opaque asset:** a file such as an image or a font that a comparison
    hashes and delivers as bytes, without parsing it.
  - **Base side:** the catalogue from the comparison commit that Changes
    uses as its baseline.
- **Background:**
  - On the base side, Changes hashes each opaque asset and copies it into
    delivery.
  - `digest_file` reads a missing digest through one Git digest command per
    asset. `opaque_stream` delivers each asset through one bounded batch
    read of that one path, and it buffers the whole blob in memory.
  - A measured case: 64 assets caused 128 Git commands. A 16.78 MB file
    needed two full payload copies during delivery. Every memory and time
    bound held.
  - That measurement predates PR #236, merged on 2026-10-28. Since then an
    attached base extraction answers digests and reads of the files that it
    holds without Git, at `crates/mokly-compare/src/sources.rs:243-257`.
  - A base gets an extraction only when it needs the sidecar, at
    `crates/mokly-cli/src/changes_base.rs:67-85`. So each opaque asset of
    an HTML-only base still starts its own Git processes. `opaque_stream`
    still buffers each whole blob.
  - The plan also asked for a measurement first. It counts the Git digest
    commands and the buffered delivery under the large-fixture comparison
    workloads, and it keeps the 64 MiB Git read bound. That measurement
    informs this choice. The earlier evidence file was under `.context/` of
    the rebuild workspace and is not in the repository.
  - On 2026-10-28 the coordinator chose option A, refined, for the user.
    Batch the lookups, the attribute checks, and the digests of the opaque
    assets of one stylesheet, with one Git process for each kind of a
    bounded batch. Stream a base asset from Git into the private copy that
    Serve already makes in `crates/mokly-server/src/asset_streams.rs`,
    instead of reading the whole blob. Keep the 48 MiB batch bound, the
    64 MiB blob bound, and the 120-second process deadline. A digest also
    counts the converted bytes, so that delivery knows the length before
    it copies.
  - Measured on 2026-10-28 with a release binary, for an HTML catalogue
    whose base commit held 65 opaque assets: the base build started 742
    Git processes, about ten for each asset. 64 small assets added 4.5 s to
    a 0.3 s build. A build that copied a 60 MiB base asset added about
    180 MB of peak RSS. The default large fixtures hold one opaque asset
    each.
- **Problem:** Without an attached extraction, each opaque asset starts its
  own Git processes. Delivery holds full copies of large blobs in every
  case.
- **Impact if no action:** All bounds hold, but large comparisons keep an
  avoidable process and memory cost.
- **Root question:** How does Changes read many base-side opaque assets
  without one Git process per asset and without full extra copies?
- **Options:**
  - **A.** Measure the workload first. Then batch the digests and stream the
    delivery, and keep every current bound, including the 64 MiB Git read
    bound. Effort: Large.
  - **B.** Keep the measured adapter. Effort: Small.
- **Left out:** Remove the bounds to simplify the code. It breaks the
  comparison memory contract. Fewer than three approaches exist, because
  the choice is whether the measured cost is worth a redesign.
- **Wider fix:** A. One batched reader serves every opaque asset.
- **Previous examples:** PR #229 and PR #236, merged on 2026-10-28, batched
  the base reads of source files and removed one Git process per file.
- **Related:**
  - [base-batch-fallback-processes.md](base-batch-fallback-processes.md) is
    about Git processes per file after a failed batch of source reads. It is
    the same cost class in another reader, so one design can cover both.
  - [opaque-asset-generation-spool.md](opaque-asset-generation-spool.md) is
    about how Serve delivers the same opaque assets: each request copies and
    checks the asset into its own temporary file, in
    `crates/mokly-server/src/asset_streams.rs`. This item changes the
    base-side Git reads in `crates/mokly-compare/src/git_asset_io.rs`. The
    two items change different code and can land in either order.
- **Recommendation:** A, refined as the Background says. It removes both
  measured costs and keeps the existing limits.
- **Action:** fix after merge, apply A, refined, because the user's choice
  of 2026-10-28 settles it and only the implementation remains.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L5834).

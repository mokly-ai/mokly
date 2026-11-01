# One unavailable base asset stops all Changes

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-01, from the branch
  `conductor/rust-rebuild-64-opaque-asset-digests`: review round 1,
  finding 3, option D of its finding check.
- **Location:** `crates/mokly-css/src/compiler_assets.rs:162`,
  `crates/mokly-cli/src/changes_policy.rs:66`,
  `crates/mokly-graph/src/resource_access.rs:13`,
  `crates/mokly-graph/src/asset_delivery.rs:54`,
  `crates/mokly-compare/src/sources_assets.rs:35`, and
  `crates/mokly-static/src/comparison_files.rs:45`.
- **Reason:** Option D changes mokly-css, mokly-graph, mokly-compare, and
  mokly-static outside the diff of the branch that found the problem, and
  only a rare base asset meets it.

- **Source:** Implementation.
- **Category:** Product bug.
- **Terms:**
  - **Opaque asset:** a file that a stylesheet references with `url()`,
    such as an image or a font. Mokly hashes it and delivers it by route
    without parsing it.
  - **Base side:** the catalogue of the base commit that Changes compares
    with the working tree. Its files come from Git or from a leased
    extraction.
  - **Leased extraction:** a cached copy of the converted files of the
    base commit. Base reads use it while a comparison holds its lease.
  - **`base-conversion` warning:** the warning that names one base
    resource whose checkout conversion failed.
  - **Before snapshot:** the `snapshots/before/` tree of base-side
    documents and resources that `build` with Changes writes into the
    static output.
- **Background:**
  - `docs/protocol/mokly-comparison.md:121-124` is the contract. A base
    resource that cannot complete checkout conversion is unavailable with
    one `base-conversion` warning. Failed filters, timeouts, and
    converted-byte limits have this outcome. Its unknown bytes prove
    neither equality nor a change. The other resource and document
    comparisons continue.
  - `docs/protocol/mokly-git.md:121-131` applies that rule to the digest
    batch of the opaque assets of one stylesheet file. Each asset keeps a
    64 MiB byte bound, and an asset is unavailable only when its own digest
    fails. `docs/protocol/mokly-imported-styles-assets.md:134` bounds a
    base-side asset at 64 MiB.
  - `docs/protocol/mokly-comparison.md` and `docs/protocol/mokly-git.md`
    each start with a status line that links this item.
  - On a base read through Git, a digest returns `SourceError::Unavailable`
    when the asset's own conversion fails. The causes are a failed filter,
    the 120-second time limit, and the 64 MiB bound in
    `crates/mokly-git/src/checkout_digest.rs:14`. A digest that failed on
    the 64 MiB bound stays failed for the rest of the base preparation,
    through `crates/mokly-compare/src/git_failures.rs:31`.
  - `crates/mokly-css/src/compiler_assets.rs:162-167` turns that error into
    `CssError::Asset` with the kind `AssetFailure::Unavailable` and the
    message of the source adapter. The stylesheet then fails to compile.
  - `crates/mokly-cli/src/changes_policy.rs:66-69` turns that error into
    the Changes reason "base resource unavailable". So all of Changes is
    unavailable. The test
    `unavailable_css_asset_reports_base_resource_unavailable` in
    `crates/mokly-cli/src/_tests_/changes_policy_tests.rs` pins that
    reason.
  - With a leased extraction,
    `crates/mokly-compare/src/sources_assets.rs:35-47` hashes each asset
    through `digest_extracted`, with no 64 MiB bound. An asset above
    64 MiB passes its digest. `build` with Changes then fails when it
    writes the before snapshot of that asset, in
    `crates/mokly-static/src/comparison_files.rs:45-54`.
  - Before the branch `conductor/rust-rebuild-64-opaque-asset-digests`, on
    `origin/main` at `c7e7d9b8`, the asset digest had no byte bound. That
    held for Git and for an extraction. Only delivery applied the 64 MiB
    bound, so a large base asset failed when Serve or `build` delivered
    it. Every other digest failure became the diagnostic "CSS asset is not
    a regular file inside repoRoot" and the Changes reason "base
    validation failed".
  - The graph already gives a public resource the outcome of the contract.
    `crates/mokly-graph/src/closure.rs:212-221` removes an unavailable
    public resource from the closure with one `base-conversion` warning.
    `crates/mokly-graph/src/resource_access.rs:38-43` answers its digest
    with `GraphError::ResourceUnavailable`. A stylesheet asset does not use
    that path: `crates/mokly-graph/src/resource_access.rs:13-22` returns
    the digest that its stylesheet bundle recorded.
- **Problem:** One base stylesheet asset that cannot complete its
  conversion makes all of Changes unavailable, with the reason "base
  resource unavailable". The contract makes only that asset unavailable,
  with one `base-conversion` warning. With a leased extraction, an asset
  above 64 MiB has no bound at its digest, and `build` with Changes fails
  at the before snapshot instead.
- **Impact if no action:** A base commit with one oversized or
  unconvertible stylesheet asset shows no Changes at all, in Serve and in
  `build`. With a leased extraction, an asset above 64 MiB fails `build`
  with Changes.
- **Root question:** How does a base stylesheet asset that cannot complete
  checkout conversion get the outcome that the contract gives: one
  `base-conversion` warning for that asset, while the other comparisons
  continue?
- **Options:**
  - **D.** Make the asset unavailable, not the comparison. It changes
    mokly-css, mokly-graph, mokly-compare, and mokly-static, and it needs
    tests through Serve and `build`. Effort: Medium.
    - mokly-css: at `crates/mokly-css/src/compiler_assets.rs:162-167`,
      record an asset route whose digest returns `SourceError::Unavailable`
      as unavailable, with its message, and keep compiling the stylesheet.
      The `OpaqueAsset` record of `crates/mokly-css/src/types.rs:26` then
      needs an unavailable state.
    - mokly-graph: answer the digest and the bytes of that route with
      `GraphError::ResourceUnavailable`, in
      `crates/mokly-graph/src/resource_access.rs:13-22` and
      `crates/mokly-graph/src/asset_delivery.rs:54-70`, so that delivery
      leaves the asset out. Report one `base-conversion` warning for it, as
      the closure does for a public resource.
    - mokly-compare: give the extraction branch of
      `crates/mokly-compare/src/sources_assets.rs:35-47` the same 64 MiB
      bound, so that both base reads fail the same asset in the same way.
    - mokly-static: leave the unavailable asset out of the before snapshot,
      in `crates/mokly-static/src/comparison_files.rs:45-54`.
    - Delete the failure kind `AssetFailure::Unavailable` and its reason in
      `crates/mokly-cli/src/changes_policy.rs:66-69` when nothing else
      produces it.
    - Remove the status lines of `docs/protocol/mokly-comparison.md` and
      `docs/protocol/mokly-git.md`.
  - **E.** Keep the failure point. Map `SourceError::Unavailable` from an
    asset digest to its own asset failure kind with the adapter message.
    Map that kind to the Changes reason "base resource unavailable". Keep
    "not a regular file" for missing and non-regular targets, and map
    cancellation to cancellation. All of Changes stays unavailable.
    Effort: Small. Applied in the branch
    `conductor/rust-rebuild-64-opaque-asset-digests`, commit `3cd73531`.
  - **F.** Report an asset above its own bound as a comparison limit,
    `BlobLimit`. All of Changes is unavailable, with the limit and the
    path. It needs a requirement change. Effort: Small.
- **Left out:**
  - Remove or raise the 64 MiB bound of a base asset: it breaks the
    decision of 2026-10-28, which keeps the 64 MiB blob bound.
  - Add the adapter message to the "not a regular file" diagnostic,
    without a failure kind of its own: E is better on every point.
  - The first review gave options A, B, and C for an older root question,
    the wrong diagnostic. A, a diagnostic of its own for the size bound,
    and C, a typed digest error, are now part of E. B, a digest without
    the 64 MiB bound, is the bound removal above.
- **Wider fix:** D. Stylesheet assets then use the unavailable-resource
  path of public resources, so each conversion failure stays with its own
  asset.
- **Previous examples:** PR #229, merged on 2026-10-28, converted each
  file of a failed conversion batch again alone, so that a file is
  unavailable only when its own conversion fails. The closure gives an
  unavailable public resource one `base-conversion` warning in
  `crates/mokly-graph/src/closure.rs:212-221`.
- **Related:** [snapshot-resource-copies.md](./snapshot-resource-copies.md)
  and [unread-comparison-snapshots.md](./unread-comparison-snapshots.md)
  change the same resource loop of
  `crates/mokly-static/src/comparison_files.rs:45-54`. Either can land
  first. The later change keeps the rule of the earlier one in that loop.
- **Recommendation:** D. It gives the outcome that the contract states. E
  only names the cause.
- **Action:** fix after merge, apply D, because the likelihood is Rare and
  D crosses mokly-css, mokly-graph, mokly-compare, and mokly-static
  outside the diff of the branch
  `conductor/rust-rebuild-64-opaque-asset-digests`.

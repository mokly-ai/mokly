# Generated asset media types differ from the contract

- **Severity:** Low. **Likelihood:** Common. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-23, from the branch
  `calummoore/mokly-viewer-live-update-lpaj`, implementation review round 2:
  the wider fix that the branch split off finding 12, "Generated opaque assets
  cannot reach gzip", and the media-type problem outside the scope that its
  check found.
- **Location:** `crates/mokly-server/src/assets.rs` (`content_type`),
  `crates/mokly-server/src/backend_assets.rs` (`Request::verify`),
  `crates/mokly-css/src/paths.rs` (`content_type`, the extension table),
  `crates/mokly-css/src/compiler_assets.rs` (the extension check),
  `crates/mokly-css/src/types.rs` (`OpaqueAsset`),
  `crates/mokly-graph/src/asset_delivery.rs` (`AssetRead`),
  `crates/mokly-graph/src/graph.rs` (the asset `ResourcePlan`),
  `crates/mokly-compare/src/base_reader.rs` (`ReaderAsset`), and the extension
  table in the section "Assets, Links And Delivery" of
  `docs/protocol/mokly-imported-styles-assets.md`.
- **Reason:** The wider fix reaches `crates/mokly-css`, `crates/mokly-graph`,
  and `crates/mokly-compare`, outside the diff of the branch, and it changes
  three served media types.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Generated opaque asset:** an image or a font that the CSS compiler
    registers for delivery through the graph. Serve answers it under
    `/static/mokly-generated/assets/`.
  - **Extension table:** the table of asset extensions and content types in
    the section "Assets, Links And Delivery" of
    `docs/protocol/mokly-imported-styles-assets.md`. `content_type` in
    `crates/mokly-css/src/paths.rs` holds the same values.
- **Background:**
  - The contract says: "Only these extensions, matched case-sensitively, are
    assets; every other extension fails. Serve and the static output use the
    same content types". Its table gives `.ico` as `image/vnd.microsoft.icon`,
    `.otf` as `font/otf`, and `.woff` as `font/woff`.
  - The CSS compiler rejects every other extension through `content_type` in
    `crates/mokly-css/src/paths.rs`. The graph stores the table type in its
    asset `ResourcePlan`, in `crates/mokly-graph/src/graph.rs`.
  - Serve does not use that type. `Request::verify` in
    `crates/mokly-server/src/backend_assets.rs` takes the media type from the
    URL, through `content_type` in `crates/mokly-server/src/assets.rs`, which
    uses `mime_guess`. `mime_guess` 2.0.5 gives `.ico` as `image/x-icon`,
    `.otf` as `application/font-sfnt`, and `.woff` as
    `application/font-woff`. The other ten extensions of the table get the
    table values.
  - `origin/main` has the same code, so Serve sends the three other types
    there too. The check of 2026-11-23 put this problem outside the scope of
    the branch.
  - The review found a gzip branch for generated JSON assets that no
    supported route can reach, because no extension of the table is JSON. The
    review fix of 2026-11-23 removed that branch, so only authored JSON has a
    gzip path now. No type stops a later change from adding a gzip branch for
    generated JSON again.
  - `content_type` in `crates/mokly-server/src/assets.rs` stays the media type
    of authored files. Its doc comment calls it the "MIME fallback for public
    authored files".
  - `crates/mokly-server` already depends on `mokly-css`.
- **Problem:** Serve takes the media type of a generated asset from its URL,
  apart from the extension table of the compiler. So Serve sends `.ico`,
  `.otf`, and `.woff` assets with types that the contract does not give, and
  the delivery code has no type that rules out a generated JSON asset.
- **Impact if no action:** Serve and the static output can send different
  content types for the same asset, against the contract. A later change can
  add a generated JSON branch again, and no type stops it.
- **Root question:** How can each generated asset reach the browser with the
  media type of the extension table, from one source?
- **Options:**
  - **A.** Keep the state of the branch: the generated gzip branch is gone,
    and Serve keeps `mime_guess` for generated assets. Effort: Small.
  - **B.** Make the extension table of the compiler the only source of the
    media type of a generated asset, as a closed type. The CSS compiler
    records the type in `OpaqueAsset`. The generation returns it with the
    opened asset. The generated delivery of Serve takes that type in place of
    a `mime_guess` string, so it has no JSON case. Cost: changes in
    `crates/mokly-css`, `crates/mokly-graph`, and `crates/mokly-compare`, and
    in the `AssetRead` mocks of the server tests. The served types of `.ico`,
    `.otf`, and `.woff` change to the table values, a change of behaviour on
    `origin/main` that needs its own regression test. Effort: Medium.
  - **C.** Give the generated capture of Serve its media type from
    `content_type` in `crates/mokly-css/src/paths.rs`, in place of
    `mime_guess`. Cost: the type stays a string that Serve looks up from the
    URL, apart from the opened asset, so a generated JSON branch stays
    possible to write. The three served types change, with the same
    regression test. Effort: Small.
- **Left out:**
  - JSON among the asset types of the compiler. It breaks the extension list
    of the contract.
  - A runtime assertion. It adds a new failure path, which is the choice of
    the user, and nothing is left to guard after the removal.
  - A second table of the three types in `crates/mokly-server`. It keeps two
    sources, so it fails the goal.
  - A keep annotation for an unreachable branch. The `git-commit` skill says
    to delete dead code that a change touches.
- **Wider fix:** B. With B, the generated delivery has no JSON media type, so
  nobody can write an encoding branch for a generated JSON asset again.
- **Previous examples:** `d148edc50` removed an unreachable fallback from the
  capture path of generated assets.
- **Recommendation:** B. It gives generated media types one source, fixes the
  three types that differ from the contract, and makes a generated JSON
  branch impossible to write. C is the smaller fix when only the three types
  matter.
- **Action:** fix after merge, apply B, because it reaches three crates
  outside the diff of the branch and changes three served media types.

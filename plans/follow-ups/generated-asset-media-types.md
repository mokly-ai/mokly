# Give a generated asset a closed media type

- **Severity:** Low. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-23, from the branch
  `calummoore/mokly-viewer-live-update-lpaj`, implementation review round 2:
  the wider fix that the branch split off finding 12, "Generated opaque assets
  cannot reach gzip". Narrowed on 2026-11-25 by the branch
  `calummoore/storybook-asset-follow-ups-cibm`, whose content type rule fixed
  the media types that this item first named.
- **Location:** `crates/mokly-server/src/backend_assets.rs` (`Request::verify`),
  `crates/mokly-server/src/assets.rs` (`content_type`),
  `crates/mokly-model/src/content_types.rs`,
  `crates/mokly-css/src/types.rs` (`OpaqueAsset`),
  `crates/mokly-graph/src/asset_delivery.rs` (`AssetRead`), and
  `crates/mokly-compare/src/base_reader.rs` (`ReaderAsset`).
- **Reason:** The fix reaches `crates/mokly-css`, `crates/mokly-graph`, and
  `crates/mokly-compare`, and it corrects no output.

- **Source:** Review.
- **Category:** Code structure.
- **Terms:**
  - **Generated opaque asset:** an image, a font, or a media file that the CSS
    compiler or a JavaScript import registers for delivery through the graph.
    Serve answers it under `/static/mokly-generated/assets/`.
  - **Content type rule:** `delivered_content_type` in
    `crates/mokly-model/src/content_types.rs`, which
    `docs/protocol/mokly-content-types.md` states. It gives each delivered file
    the type of its extension: the asset tables first, then `mime_guess`.
- **Background:**
  - Since 2026-11-25, Serve and the Mokly Cloud reservation take every content
    type from the content type rule. So a generated `.ico`, `.otf`, or `.woff`
    asset gets the type of the extension table, as the contract says.
  - The CSS compiler accepts only the extensions of the stylesheet asset
    table, and a JavaScript import only the extensions of the imported types.
    Neither table holds JSON.
  - A review fix of 2026-11-23 removed a gzip branch for generated JSON
    assets, which no supported route could reach. Only authored JSON has a
    gzip path now.
  - `Request::verify` in `crates/mokly-server/src/backend_assets.rs` still
    takes the type of a generated asset as a string, from the URL, through
    `content_type` in `crates/mokly-server/src/assets.rs`. The string can hold
    any type that `mime_guess` gives, JSON included.
- **Problem:** The delivery code of generated assets holds an open string type.
  Nothing in the types stops a later change from adding a gzip or charset
  branch for a generated JSON asset again.
- **Impact if no action:** A later change can add an unreachable branch for a
  generated media type that no table allows, as the removed gzip branch was.
- **Root question:** How can the delivery of a generated asset hold only the
  media types that the asset tables allow?
- **Options:**
  - **A.** Keep the string type. The tables already exclude JSON. Effort:
    Small.
  - **B.** Give each generated asset a closed type from the asset tables. The
    compiler and the import registration record it in `OpaqueAsset`. The
    generation returns it with the opened asset, and the generated delivery
    of Serve takes it in place of the string, so it has no JSON case. Cost:
    changes in `crates/mokly-css`, `crates/mokly-graph`, and
    `crates/mokly-compare`, and in the `AssetRead` mocks of the server tests.
    The served types do not change. Effort: Medium.
- **Left out:**
  - JSON among the asset types. It breaks the extension lists of the contract.
  - A runtime assertion. It adds a new failure path, which is the choice of
    the user.
  - A second type table in `crates/mokly-server`. It brings back a second
    source of the types.
- **Wider fix:** B. With B, the generated delivery has no JSON media type, so
  nobody can write an encoding branch for a generated JSON asset again.
- **Previous examples:** `d148edc50` removed an unreachable fallback from the
  capture path of generated assets.
- **Related:** [asset-resource-plan-variants.md](asset-resource-plan-variants.md)
  drops the unread content type of asset plans. B can carry the closed type in
  the asset variant of that item, so one branch can do both.
- **Recommendation:** B. It makes a generated JSON branch impossible to write.
- **Action:** fix after merge, apply B, because it reaches three crates
  outside the diff of the branch and corrects no output.

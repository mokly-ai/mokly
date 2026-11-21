# Give asset plans their own variant

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-21, from the branch
  `conductor/storybook-support-c-imported-assets`, track C of the Storybook
  support plan: review finding 3 of round 1.
- **Location:** `crates/mokly-graph/src/types.rs:47-54`,
  `crates/mokly-graph/src/imported_assets.rs:52-57` and `:96-106`, and
  `crates/mokly-graph/src/evaluation.rs:22-47`.
- **Reason:** The fix reaches shared resource plan code outside the files of
  that branch, and it corrects no output.

- **Source:** Review.
- **Category:** Code structure.
- **Terms:**
  - **Resource plan:** `ResourcePlan` in `crates/mokly-graph/src/types.rs`,
    the record that tells the graph how to deliver one generated stylesheet
    or asset.
  - **Stylesheet root:** `StylesheetRoot`, the record that tells the
    stylesheet bundler which stylesheets to bundle for one module.
  - **Imported asset:** a file that JavaScript imports as an asset, under
    `docs/protocol/mokly-imported-assets.md`.
- **Background:**
  - One `ResourcePlan` shape serves both generated stylesheets and opaque
    assets. It holds `key`, `document_key`, `content_type`, `root`, and an
    optional `asset`.
  - `register` in `crates/mokly-graph/src/imported_assets.rs` builds the
    plan of an imported asset with a stylesheet root that holds an empty
    stylesheet list, and with a content type.
  - The resource read in `crates/mokly-graph/src/evaluation.rs` returns the
    asset bytes through `open_asset` before it reads the root or the content
    type. Only the stylesheet rebuild reads them.
  - In an asset plan, `key` and `document_key` hold the same value.
  - Serve takes the type of a generated asset from the route, in
    `crates/mokly-server/src/assets.rs`.
- **Problem:** Each asset plan carries a stylesheet root, a content type, and
  a second key that nothing reads. The type also allows a plan that
  describes a stylesheet and an asset at once.
- **Impact if no action:** A later change that sends an asset plan to the
  stylesheet rebuild gets empty CSS in place of the image, with no error,
  because the stylesheet bundler accepts the empty root.
- **Root question:** How can each resource plan hold only the data that its
  file needs?
- **Options:**
  - **A.** Make the stylesheet root optional. Invalid combinations stay
    possible. Effort: Small.
  - **B.** Give the plan distinct asset and stylesheet variants, with one route
    inventory. Effort: Small.
  - **C.** Keep separate asset and stylesheet inventories. Delivery and
    comparison lookups change. Effort: Medium.
  - **D.** B, and the asset variant holds only its key and its `OpaqueAsset`.
    The stylesheet variant keeps its two keys, its root, and its content type.
    Effort: Small.
- **Left out:**
  - Keep the empty root with a comment: it keeps the unread fields.
  - A trait object for each kind of plan: an enum is better on every point
    for two private kinds.
  - A real stylesheet root for each asset: the asset still never reads it.
- **Wider fix:** D. The type then cannot hold an asset with a stylesheet root.
- **Previous examples:** Commit `d935e6a6` used the same plan shape for
  stylesheet bundles and stylesheet assets.
- **Related:** [asset-content-type-rule.md](asset-content-type-rule.md)
  chooses the rule that gives an asset its type. D drops the plan's copy, so
  it follows that rule.
- **Recommendation:** D. It removes the leftover fields without a second
  lookup.
- **Action:** fix after merge, apply D, because the change reaches shared
  resource plan code outside the diff of its branch and corrects no output.

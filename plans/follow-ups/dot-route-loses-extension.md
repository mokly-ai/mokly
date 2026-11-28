# Dot routes can lose file types

- **Severity:** High. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** High. **Harder later:** Yes.
- **Kind:** Needs decision.
- **Added:** 2026-11-28, from review round 1 of the branch
  `calummoore/storybook-track-e-storybook-folders-87sk`, finding 203.
- **Location:** `crates/mokly-css/src/paths.rs:7`, the route mapper.
  `crates/mokly-css/src/compiler_assets.rs:109`, where Mokly accepts a CSS
  asset by the extension of its source path.
  `crates/mokly-server/src/backend_assets.rs:85` and
  `crates/mkc-publications/src/reservation/reserve.rs:205`, where Serve and
  Mokly Cloud choose the content type from the route.
  `crates/mokly-graph/src/resource_edges.rs:11`,
  `crates/mokly-compare/src/resource_memo.rs:101`, and
  `crates/mokly-compare/src/comparison_resources.rs:179`, which treat a route
  as CSS only when it ends in `.css`. The section "Routes And Ownership" of
  `docs/protocol/mokly-imported-styles.md`.
- **Reason:** The recommended option changes the `dot-` spelling that the user
  chose on 2026-11-28, and two other options add a rejection, so the user
  must choose.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Route:** The path under which Serve, a static build, and Mokly Cloud
    deliver a generated stylesheet or asset.
  - **Content type:** The value that a host sends to tell a browser what kind
    of file it received.
  - **Dot segment:** A path segment that starts with a dot, such as
    `.storybook`.
- **Background:**
  - On 2026-11-28 the user chose, "for now", to write each dot segment of a
    generated route as `dot-` and the rest of the segment. So
    `.storybook/preview.tsx` delivers `styles/dot-storybook/preview.tsx.css`.
    Mokly's own `node_modules/.mokly-roots/` segment becomes
    `node_modules/dot-mokly-roots/`. The section "Routes And Ownership" of
    `docs/protocol/mokly-imported-styles.md` states this rule.
  - The user also asked for a high-priority re-review of the whole route
    strategy, which `plans/follow-ups/route-naming-strategy-review.md`
    records.
  - Mokly accepts a CSS asset, such as an image in `url()`, by the extension
    of its source path, before it builds the route. The section "Assets,
    Links And Delivery" of `docs/protocol/mokly-imported-styles-assets.md`
    says that the extension is the text after the last dot of the last path
    segment. So `.svg` has the extension `svg`.
  - Serve and Mokly Cloud choose the content type from the extension of the
    delivered route, and a static host does the same. The section "Content
    Type Rule" of `docs/protocol/mokly-content-types.md` decides that the
    extension alone gives the type. The section "Hosting Contract" of
    `docs/protocol/mokly-export-delivery.md` says that correctness never
    depends on host configuration.
  - Node's `path.extname` and Rust's `Path::extension` give a name such as
    `.svg` no extension. So a JavaScript import of `./.svg` already fails in
    the sidecar, at `packages/mokly/src/sidecar/asset-imports.ts:59`, while a
    CSS `url(.svg)` passes.
  - Before the `dot-` form, the route rule refused names such as `.svg` and
    `.css`. Under A or C below, no route that worked before the `dot-` form
    changes, and no fixture or snapshot holds a dot route.
  - On 2026-11-28 the branch that found this item made each stylesheet link
    read the route that registration gave its source. So A or C below changes
    the route in one place.
- **Problem:**
  - A CSS `url()` can read a file named `.svg`, which passes the SVG
    extension check. Its route ends in `dot-svg`, so Serve and Mokly Cloud
    send `application/octet-stream` for the SVG bytes.
  - The same rewrite sends a configured stylesheet named `.css` to
    `styles/dot-css`, so the published stylesheet loses its CSS content type.
  - Three places treat a route as CSS only when it ends in `.css`. For
    `styles/dot-css`, the closure walk skips its `url()` references. Changes
    then loses its rule evidence, and it can miss an edit of an asset that
    only this stylesheet references.
- **Screenshot:** Open a published story with a configured file named `.css`
  and box an element that appears with its default styling.
- **Impact if no action:** A published story can lose its configured styles.
  An imported image can arrive with the wrong content type after a
  successful build.
- **Root question:** How does every file that Mokly delivers under a generated
  route keep the type that Mokly accepted it as?
- **Options:**
  - **A.** Keep the `dot-` form, and add the delivery extension when the
    mapping consumes it. Use the same rule for links and output files.
    Effort: Medium.
  - **B.** Give generated files stable names with an explicit extension chosen
    for delivery. This changes public routes and needs the broader naming
    decision of `plans/follow-ups/route-naming-strategy-review.md`. Effort:
    Large.
  - **C.** Write `dot` in front of each segment that starts with a dot, and
    keep the dot:
    - `.storybook` gives `dot.storybook`, `.svg` gives `dot.svg`, `.css`
      gives `dot.css`, and `node_modules/.mokly-roots/` gives
      `node_modules/dot.mokly-roots/`.
    - Each segment keeps the text after its last dot, so the rule needs no
      special case.
    - Add a table test that checks that the route mapper keeps the extension
      of each name shape. Add cases for `url(.svg)` and for a configured
      `.css`.
    - Cost: it changes the `dot-` spelling in the protocol, the styles guide,
      and the tests, and the example of the user's answer. The test "a mapped
      preview stylesheet collides with a real dot-storybook route" in
      `tests/storybook_preview_styles.test.ts` must then name a real
      `dot.storybook` folder.
    - Effort: Medium.
  - **D.** Refuse a source whose route would change its extension:
    - Check it where Mokly accepts a stylesheet root
      (`crates/mokly-css/src/compiler.rs:56`), a CSS asset
      (`crates/mokly-css/src/compiler_assets.rs:118`), and a JavaScript asset
      (`crates/mokly-graph/src/imported_assets.rs:29`).
    - Compare the extension of the route with the extension of the source.
      Fail with a diagnostic that asks for a rename.
    - Today this refuses only names such as `.svg` and `.css`. It also
      catches a later route form that drops an extension.
    - Cost: a new build error and a new catalogued message.
    - Effort: Small.
  - **E.** Find extensions as Node and the Rust standard library do: a dot
    that is the first character of a name does not start an extension:
    - Change `file_extension` in `crates/mokly-content-types/src/lib.rs:81`,
      and the extension rule of `docs/protocol/mokly-imported-styles-assets.md`.
    - Apply the same rule where Mokly accepts a configured or declared
      stylesheet, such as `crates/mokly-render/src/declarations.rs:69`.
    - `url(.svg)` then fails with the existing unsupported-extension
      diagnostic, as `url(png)` has failed since commit `ec6cea334`. The CSS
      and JavaScript asset rules then agree.
    - Cost: a later route form stays unguarded, and it adds a rejection.
    - Effort: Small.
- **Left out:** A type manifest, or a type lookup at delivery. Static hosts
  read only the extension, and the hosting contract forbids correctness that
  depends on host configuration, so static output would stay wrong.
- **Wider fix:** C, with its table test of the route mapper. One rule that
  keeps the dot keeps every extension. A is a direct fix, because it must
  detect a name whose only dot is its first character. D applies the same
  check during the build instead of in a test.
- **Previous examples:** Commit `ec6cea334` fixed an earlier disagreement
  between the CSS asset check and the extension rule of the delivered path.
- **Related:** `plans/follow-ups/route-naming-strategy-review.md`: the same
  route rule. B here is the broad renaming of that item, so one answer
  settles both. A or C here changes only the spelling of the current route
  form.
- **Recommendation:** C. It keeps every extension without a special case,
  costs the same as A, and changes only routes that the `dot-` form added.
  The rule to prefer graceful handling puts C and A above D and E, because
  Mokly can deliver these names correctly.
- **Action:** ask the user, because C changes the `dot-` spelling that the user
  chose on 2026-11-28, and D and E add a rejection, which needs the user.

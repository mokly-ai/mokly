# The Node design check passes unmarked external links

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-19, from the branch
  `conductor/storybook-support-a-mockups`. It is the blocked wider fix of the
  branch's review finding 8, which the branch fixed on 2026-11-18. The
  orchestrator of the Storybook support plan approved recording the item on
  2026-11-19.
- **Location:**
  - `tests/helpers/design_rules.ts:59`
  - `tests/design_catalogue.test.ts:137`
  - `tests/browser/design_fixture.ts:58`
  - `tests/browser/component_design_cases.ts:63`
  - `tests/browser/design_library_cases.ts:77`
  - `packages/ui/src/metadata-row/metadata-row.tsx:69`
  - `examples/basic/specs/design/components/parts/component_info.tsx:29`
- **Reason:** The check covers the design mockups of the repository only, and a
  separate branch adds it.

- **Source:** Review.
- **Category:** Test.
- **Terms:**
  - **Design view:** one rendered document of a catalogue entry whose path
    starts with `design/`, for one viewport and one color scheme.
  - **Design link:** a link in a design view that opens an entry under
    `design/`, as `docs/protocol/mokly-design-links.md` defines it.
  - **Mock-link marker:** the `data-mokly-link` attribute that Mokly puts on a
    `MockLink` or `mockLink` link to name the entry that it opens.
  - **External address:** an `href` that starts with `http:`, `https:`, or
    `mailto:`, so that the link leaves the catalogue.
  - **Storybook:** an outside tool that publishes examples of a project's
    components, called stories, as a website.
- **Background:**
  - Mokly's example catalogue under `examples/basic` holds design mockups of
    Mokly's own screens. Their entries have paths that start with `design/`.
    The other example entries, under `example/`, depict a small sample
    product.
  - The design-links contract, `docs/protocol/mokly-design-links.md`, section
    "Link Behavior", says: "Every design link opens an existing design entry
    in the same viewport."
  - The same section says that a depicted control without a destination has
    no `href`, no mock-link marker, and no misleading keyboard stop.
  - Only the rule that a link opens a design entry is for design links alone.
    The section "Basic Example And Portability" covers both kinds of link:
    "All design and example links must keep portable relative hrefs on disk
    and authenticated markers in served/deployed Browse."
  - `linkViolations` in `tests/helpers/design_rules.ts:33` checks every anchor
    of each served view, in design and example entries. The Node test "every
    link opens an entry through one portable focus stop" runs it, in
    `tests/design_catalogue.test.ts:137`.
  - At line 59, an anchor without the mock-link marker passes when its `href`
    starts with `#`, `http:`, `https:`, or `mailto:`. Any other unmarked
    `href` fails with `has an unmarked href` and the value.
  - Only two browser checks reject a link that leaves the catalogue origin.
    Both call `assertDesignResource` in `tests/browser/design_fixture.ts:28`:
    - The component design cases in
      `tests/browser/component_design_cases.ts:63` check the screens under
      `design/components/`.
    - The design library cases in `tests/browser/design_library_cases.ts:77`
      check the saved variants of the design library components.
  - A case calls `assertDesignResource` before it requests the address. On a
    served page, an external origin fails with
    `Design resource leaves catalogue origin` and the address. On a page from
    disk, the text is `Design resource leaves file output`.
  - Other design pages have no such check, for example the screens under
    `design/browse/` and `design/changes/`.
  - The browser cases run only on the entries that
    `tests/fixtures/design-library/browser-inventory.json` lists. The browser
    setup fails until that file lists each new design entry.
  - The local gate, `cargo xtask check`, runs the Viewer suite with the Node
    tests before the Browser suite. A local run stops at the first failed
    suite.
  - A new check, lint, or stricter validation needs the user's approval.
  - `MetadataLink` in `packages/ui/src/metadata-row/metadata-row.tsx:69`
    always draws an anchor with an `href`. The shell's Details rows in
    `packages/viewer/src/shell/details_rows.tsx` use it. The design part
    `examples/basic/specs/design/parts/details.tsx` uses it too.
  - `EmptyAction` in `packages/ui/src/empty-state/empty-state.tsx:69` draws
    an action with an `href` as an anchor. With `interactive` set to `false`,
    it draws an action without an address as a `span` with the link's class.
  - On 2026-11-18 the new mockups drew a Storybook link as an active anchor to
    an address on `https://storybook.example.com`. The link sat in the Details
    row "Storybook", with the text "Open in Storybook".
  - All three new screens under `design/components/states/stories/` drew that
    link.
  - The Node checks passed.
  - The browser cases would have failed only after the browser inventory
    listed the new screens.
  - A review found the link.
  - The fix draws the link as an anchor without an address, at
    `examples/basic/specs/design/components/parts/component_info.tsx:29`. The
    metadata column still styles it as a link. It opens nothing and adds no
    keyboard stop.
  - `examples/basic/specs/design/components/parts/metadata.ts:18` keeps the
    Storybook address, as the address that the product link opens.
  - The commands, from the repository root:
    - `npm test -- tests/design_catalogue.test.ts --test-name-pattern="every link opens an entry"`
      runs the Node link test. The npm commands build first.
    - `npm run test:browser -- tests/browser/component_design.spec.ts` runs
      the component design cases.
    - `npm run test:browser -- tests/browser/design_library.spec.ts` runs the
      design library cases of the desktop viewport.
- **Problem:** `linkViolations` lets an unmarked anchor with an external
  address pass in a design view. Only the browser checks of two page groups
  reject such a link. They run late, after the Node suite in the local gate.
- **Impact if no action:** A design page outside those two groups can link
  outside the catalogue, and no check fails. On the two groups, the failure
  comes only from the browser cases.
- **Root question:** How do the design checks catch a link that leaves the
  catalogue on every design page, early?
- **Options:** The letters follow the options of the review finding on the
  source branch. Its branch applied option A, the link without an address, so
  A now changes nothing. Its options B and C chose other ways to show the
  Storybook link.
  - **A.** Change nothing. The browser checks cover the component design pages
    and the library entries only, and they run late. Effort: Small.
  - **D.** Give `MetadataLink` in
    `packages/ui/src/metadata-row/metadata-row.tsx` a form without an address,
    for pictures of links. `EmptyAction` has such a form for an action without
    an address. D prevents the mistake only in that one component. Effort:
    Small.
  - **E.** Make `linkViolations` reject an unmarked external `href` in each
    design view. Effort: Small.
    - E needs the condition `view.path.startsWith("design/")`, so the example
      views keep the current rule.
    - In a design view, an unmarked anchor then passes only with no `href` or
      with an `href` that starts with `#`.
    - The fast Node suite then catches every such link on every design page.
    - E is a test for the whole defect class, so the user must allow it.
    - In the current build, E rejects nothing.
- **Left out:**
  - A real public Storybook address. `assertDesignResource` rejects any
    external origin before the case requests the address. If the checks
    allowed such an address, they would depend on the network. The link would
    also open an unrelated site.
  - A list of external addresses that design views may use: it breaks the
    contract rule that every design link opens a design entry.
- **Wider fix:** E. No structural fix prevents every such link, because any
  design part can write an external link.
- **Previous examples:** None found.
- **Related:**
  - `plans/follow-ups/design-screen-lists-single-source.md`, same code. Its
    option D deletes `tests/fixtures/design-library/browser-inventory.json`,
    which this item cites. After D, the browser cases run on the entries of
    one shared list.
  - Planned work gives the shell's Details row a Storybook link from
    `@mokly/ui`. The design library must render that link without an address,
    because the design library cases reject an external address.
- **Recommendation:** E. It catches every such link in every design view, at
  the lowest test level.
- **Answer:** The user chose option E, the recommendation, on 2026-11-25, after
  learning that the rule covers only the design mockups of this repository and
  no user catalogue. `linkViolations` rejects an unmarked external `href` in
  each design view, and the example views keep the current rule.
- **Action:** fix after merge, apply E, because the user approved the stricter
  check on 2026-11-25.

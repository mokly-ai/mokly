# Removal branch Action row opens nothing in Changes

- **Severity:** Medium. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-25, from the branch
  `calummoore/storybook-milestone-1a-canvas-mockups-omnr`, review round 1.
  The finding check of finding 3 found it outside the review scope.
- **Location:**
  - `examples/basic/specs/design/canvas/components/parts/branch.ts:82-98`,
    the Action row that three branches share, `:141-158`, the rows of the
    removal branch, and `:205-238`, its targets and `removalChanges`.
  - `examples/basic/specs/design/canvas/components/parts/consumer.tsx:37`,
    the catalogue of Farewell's two artboards.
  - `docs/protocol/mokly-design-links-navigation.md:36-37`, the links of the
    removal branch.
  - `tests/fixtures/design/expectations.json`, the `links` entries of
    `design/canvas/components/removed/consumer` and
    `design/canvas/components/removed/consumer-changes`.
- **Reason:** The problem lies on the removal branch of the Component
  explorer mockups, which the Storybook branch that found it does not change.

- **Source:** Review.
- **Category:** Mockup.
- **Terms:**
  - **Removal branch:** the depicted branch that removed the Action's saved
    variant Compact and Farewell, a screen that rendered the Action. Changes
    lists Farewell, then Compact.
  - **Aggregate row:** an unmodified parent row that the Changes filter shows,
    because its list holds a changed, added, or removed variant.
  - **Picture:** a drawn control without an address. A Canvas mockup draws a
    control as a picture when no artboard shows its outcome.
- **Background:**
  - On the removal branch, the Action itself is unmodified. Its row in the
    Changes filter is an aggregate row, because its list shows
    `Compact · Removed`.
  - The section "Changes Rows" of `docs/protocol/mokly-variant-navigation.md`
    says that an aggregate row "opens its first visible changed variant".
  - `packages/viewer/src/shell/changes_activation.ts:97-124` counts a removed
    variant as such a row. So the product opens the removed Compact.
  - `design/canvas/components/removed` shows the removed Compact on Inspect.
    `design/canvas/components/removed/changes` shows it on the Changes tab.
  - The design links rule at `docs/protocol/mokly-design-links-navigation.md:11-12`:
    a control opens the Canvas artboard that shows its outcome. Lines 39-40
    add that a catalogue row keeps the tab of the right panel where its entry
    has an artboard on that tab.
  - The removal branch has four artboards. Compact is the selected row on
    `removed` and `removed/changes`. Farewell is the selected row on
    `removed/consumer` and `removed/consumer-changes`.
  - `REMOVAL_TARGETS` gives targets to the Farewell and Compact rows only, and
    the shared Action row has no `to`. So the Action row is a picture on all
    four artboards. The views of the build of 2026-11-24 draw it as a `span`
    with no address.
- **Problem:** On `design/canvas/components/removed/consumer` and
  `design/canvas/components/removed/consumer-changes`, the Action row is a
  picture. The product opens the removed Compact there, and an artboard shows
  that outcome on each tab.
- **Impact if no action:** A reviewer cannot follow the Action row from
  Farewell. The mockups depict the row as inert, unlike the product.
- **Root question:** Where does the Action row of the removal branch take the
  reader in the Changes filter?
- **Options:**
  - **A.** Apply the local rule of the stories fixture in
    `examples/basic/specs/design/canvas/stories/parts/branch.ts`. Effort:
    Small.
    - On Farewell's artboards, point the Action row at Compact's artboard of
      the same tab. From `removed/consumer`, it opens
      `design/canvas/components/removed`. From `removed/consumer-changes`, it
      opens `design/canvas/components/removed/changes`.
    - Keep the row a picture on Compact's two artboards, where that target is
      the shown artboard.
    - Add the two links to the `links` of
      `tests/fixtures/design/expectations.json`, and to the removal rows of
      the design links table.
  - **B.** Apply the shared rule of
    [canvas-aggregate-row-targets.md](canvas-aggregate-row-targets.md). The
    shared Canvas catalogue then derives the target of every aggregate row,
    and draws the picture. That item holds the work. Effort: Medium.
- **Left out:**
  - A picture on all four artboards, as today: artboards show the outcome, so
    it breaks the design links rule.
  - A change to the product: it follows the variant navigation contract, and
    `tests/browser/comparison_variants.spec.ts:44` covers it.
  - The Action's own page as the target: the Action is unmodified, so the
    product opens Compact.
  - Fewer than three approaches exist, because the contract fixes the target.
    The only choice is where the rule lives.
- **Wider fix:** B, which
  [canvas-aggregate-row-targets.md](canvas-aggregate-row-targets.md) records.
- **Previous examples:** Commit `54e0a948e` gave the Menu row of the stories
  branch the wrong target. That branch fixed it with a local rule on
  2026-11-25.
- **Related:** [canvas-aggregate-row-targets.md](canvas-aggregate-row-targets.md)
  holds the wider fix. Its C with E also fixes this problem, so the branch
  that applies it deletes this item too.
- **Recommendation:** A. It corrects the two artboards with the rule that the
  stories fixture already uses. B best protects every Canvas catalogue.
- **Action:** fix after merge, apply A, because the removal branch lies
  outside the Storybook mockups of the branch that found it.

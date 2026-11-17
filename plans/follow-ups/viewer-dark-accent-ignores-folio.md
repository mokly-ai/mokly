# Viewer dark accent ignores Folio

- **Severity:** Medium. **Likelihood:** Common. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-02, from item 15 of the Mokly 0.18.0 upgrade on the branch `calummoore/mokly-cli-upgrade`. The mockup work item `conductor/mokly-rust-core-upgrade-m2-b-mockups` found it on 2026-11-01.
- **Location:** the package theme `packages/ui/src/theme/theme.css:43`, `:135` and `:186`, the package rule `docs/protocol/mokly-viewer-appearance.md:176-178`, the test "every viewer screen keeps the chrome over one stage" in `docs/mockups/src/_tests_/viewer.spec.ts:54`, with its package accent count at `:84-108`, and the cloud's mapping in `docs/mockups/styles/product/viewer.css:28-30`, which the app serves as `apps/app/public/folio/product/viewer.css:28-30`.
- **Reason:** On 2026-11-03 the user chose A. The rest of the fix is a change to the published `@mokly/ui` package, outside the scope of the change that found it.
- **Category:** Product bug.

- **Terms:**
  - **Folio:** the product's design system. Its colours are in `packages/tokens`.
  - **Accent variables:** `--mokly-accent`, `--mokly-accent-contrast` and `--mokly-accent-soft`, through which a host gives the viewer its brand colour.
  - **Accent budget:** a rule in `docs/protocol/cloud/design-tokens-color.md`. A screen may use one solid accent fill, and the selected row of the desktop side list uses it.
- **Background:**
  - `docs/protocol/cloud/viewer-host.md` says that the cloud gives Folio's accent to the viewer only through the accent variables, set on its own container.
  - `docs/protocol/mokly-viewer-appearance.md:176-178` says that host values win in both themes, also values that the viewer inherits.
  - The workspace `@mokly/ui` sets the accent variables again on its own root element `.mbk`, at `packages/ui/src/theme/theme.css:43`, `:135` and `:186`. So an inherited value loses, against the package's own rule.
  - The cloud uses the workspace `@mokly/ui`, so one change can fix the package and restore the cloud's check, with no release and no version bump.
  - Since the user chose A on 2026-11-03, the test reads the colour that the package root gives `--mokly-accent`. It counts the selected row in that colour, and the Firna primary buttons in Folio's `accentSolid`. When the two colours are equal, as in Light, it counts both in one sum.
  - Under 0.18.0, a count of the selected row in Folio's accent failed this test in desktop dark: "Expected: 1, Received: 0". The package rule is unchanged, so the restore must land with the package fix.
- **Problem:** In the dark theme, the selected row shows the package colour `#86b79b`, not Folio's `#7aa78e`. In the light theme both colours are `#4f7864`.
- **Impact if no action:** App readers in the dark theme see the package's green. The test accepts any accent that the package root sets, so a later package change that overrides the host values again passes unseen.
- **Root question:** How does the app show Folio's accent in the dark theme, and how does the gate keep checking the accent budget?
- **Options:**
  - **A.** Change the test to expect the colour that the package gives, and restore the Folio check after a fixing pin bump. This weakens a test of live code, and the app keeps the wrong colour. Effort: Small.
  - **B.** Set the accent variables also on the package's root element, for example `.fo-published-viewer .mokly-viewer.mbk`. This fixes the app and the mockups now. It changes the rule of `viewer-host.md` that package selectors are not extension points. Effort: Medium.
  - **C.** Keep the test, and wait for a Mokly release that keeps host values. The gate stays red until then. Effort: Large.
- **Left out:** A colour fix in the drawing only, because the drawing must follow the package, and the app would keep the defect.
- **Wider fix:** Fix the package rule in `packages/ui`. One change then fixes the app and the mockups. The options above are the ones that the user saw on 2026-11-03, when the cloud pinned published releases.
- **Previous examples:** The mockup work item found the same cause in its viewer drawings on 2026-11-01.
- **Recommendation:** A. It keeps the accent budget checked, and it makes the gate pass. B protects the product best now.
- **Decision:** On 2026-11-02 the user deferred the choice. On 2026-11-03 the user chose A.
- **Action:** fix after merge. Fix the package rule and apply the restore of A in one change.

The fix, in one change:

- In `packages/ui/src/theme/theme.css`, stop setting the public accent variables again on the package root, so that inherited host values win in both themes, as `docs/protocol/mokly-viewer-appearance.md:176-178` requires. Unset values keep the theme defaults. Add a package test that an inherited host accent wins in Dark.
- In the test, count the selected row in Folio's `accentSolid` again, as one sum with the primary buttons. Remove the package accent count and its comment.
- Check that the app shows Folio's dark accent `#7aa78e` on the selected row of the desktop side list.

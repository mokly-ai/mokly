# Viewer dark accent ignores Folio

- **Severity:** Medium. **Likelihood:** Common. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-02, from item 15 of the Mokly 0.18.0 upgrade on the branch `calummoore/mokly-cli-upgrade`. The mockup work item `conductor/mokly-rust-core-upgrade-m2-b-mockups` found it on 2026-11-01.
- **Location:** the test "every viewer screen keeps the chrome over one stage" in `docs/mockups/src/_tests_/viewer.spec.ts:52`, with its package accent count at `:84-108`, the package stylesheet `ts/node_modules/@mokly/ui/dist/styles.css:44`, `:136` and `:187`, and the cloud's mapping in `docs/mockups/styles/product/viewer.css:16-18`, which the app serves as `ts/app/public/folio/product/viewer.css:16-18`.
- **Reason:** On 2026-11-03 the user chose A, and the restore of the Folio check needs a pin bump to a Mokly release that keeps host values.
- **Category:** Product bug.

- **Terms:**
  - **Folio:** the product's design system. Its colours are in `ts/tokens`.
  - **Accent variables:** `--mokly-accent`, `--mokly-accent-contrast` and `--mokly-accent-soft`, through which a host gives the viewer its brand colour.
  - **Accent budget:** a rule in `docs/protocol/design-tokens-color.md`. A screen may use one solid accent fill, and the selected row of the desktop side list uses it.
- **Background:**
  - `docs/protocol/viewer-host.md` says that the cloud gives Folio's accent to the viewer only through the accent variables, set on its own container.
  - The package's own doc `mokly-viewer-appearance.md` says that host values win in both themes, also values that the viewer inherits.
  - `@mokly/ui@0.18.0` sets the accent variables again on its own root element, so an inherited value loses.
  - The Mokly gap is in the upstream list of `plans/follow-ups/mokly-upstream-gaps-to-file.md`.
  - Since the user chose A on 2026-11-03, the test reads the colour that the package root gives `--mokly-accent`. It counts the selected row in that colour, and the Firna primary buttons in Folio's `accentSolid`. When the two colours are equal, as in Light, it counts both in one sum.
  - Under 0.18.0, a count of the selected row in Folio's accent fails this test in desktop dark: "Expected: 1, Received: 0". So the restore cannot come before the pin bump.
- **Problem:** In the dark theme, the selected row shows the package colour `#86b79b`, not Folio's `#7aa78e`. In the light theme both colours are `#4f7864`.
- **Impact if no action:** App readers in the dark theme see the package's green. The test accepts any accent that the package root sets, so a later release that overrides the host values again passes unseen.
- **Root question:** How does the app show Folio's accent in the dark theme, and how does the gate keep checking the accent budget?
- **Options:**
  - **A.** Change the test to expect the colour that the package gives, and restore the Folio check after a fixing pin bump. This weakens a test of live code, and the app keeps the wrong colour. Effort: Small.
  - **B.** Set the accent variables also on the package's root element, for example `.fo-published-viewer .mokly-viewer.mbk`. This fixes the app and the mockups now. It changes the rule of `viewer-host.md` that package selectors are not extension points. Effort: Medium.
  - **C.** Keep the test, and wait for a Mokly release that keeps host values. The gate stays red until then. Effort: Large.
- **Left out:** A colour fix in the drawing only, because the drawing must follow the package, and the app would keep the defect.
- **Wider fix:** C. One Mokly release fixes the app and the mockups.
- **Previous examples:** The mockup work item found the same cause in its viewer drawings on 2026-11-01.
- **Recommendation:** A. It keeps the accent budget checked, and it makes the gate pass. B protects the product best now.
- **Decision:** On 2026-11-02 the user deferred the choice. On 2026-11-03 the user chose A.
- **Action:** fix after merge, apply the restore of A, because the restore needs a pin bump to a Mokly release that keeps host accent values.

The restore, after a pin bump to a Mokly release that keeps host accent values:

- In the test, count the selected row in Folio's `accentSolid` again, as one sum with the primary buttons. Remove the package accent count and its comment.
- Check that the app shows Folio's dark accent `#7aa78e` on the selected row of the desktop side list.

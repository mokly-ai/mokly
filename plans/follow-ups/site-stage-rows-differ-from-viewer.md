# Home stage rows differ from the viewer's rows

- **Severity:** Low (estimate). **Likelihood:** Common (estimate). **Effort:** Medium (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-30, from the closed [PR #67](https://github.com/mokly-ai/mokly-cloud/pull/67), which re-landed finding S2 of the closed PR #39, and its review finding 2. The closed PR #39 left the variant list question open as finding F8.
- **Location:** `ts/site/scripts/stage/catalogue.ts:35-47`, `:61-74` and `:108-121`, `ts/site/src/stage.ts:28-35`, `docs/protocol/site-delivery.md:132-141` and `docs/mockups/src/_tests_/design-site-test-helpers.ts:49-62`.
- **Reason:** One detail of the fix must choose between the viewer's rows and the approved site mockup, which the user decides.
- **Checked:** 2026-10-31, at commit `f568853e`. The choice is still open. `row()` still gives entry rows a count and empty folders a zero, and the stage schema still accepts both.
- **Category:** Product bug.

- **Terms:**
  - **Home stage:** The static catalogue drawing on the site home page, which `ts/site/scripts/stage.mjs` builds around the screen `product/account/project-created`.
  - **Row count:** The number that a navigation row shows beside its label.
  - **Variant list:** The list of a parent entry's variants that the viewer discloses under the parent's row.
  - **Site mockup:** The approved site drawing under `docs/mockups/src/screens/design/site/`, which `docs/protocol/site-mockups.md` makes the visual source of truth.
- **Background:** On 2026-10-12 the user decided that the stage follows the `@mokly/viewer` 0.5.0 navigation rows. A count appears only on a folder row, and only above zero. An entry row shows no count. Specs ends at the staged screen with its own variant list closed, and Components variant lists stay closed. The staged screen has three variants: Empty, Loading and Error.
- **Problem:** The list below gives what `main` draws, and the open question.
  - `row()` gives an entry row with variants a count, and a folder with no visible child the count 0.
  - The Components section opens every variant list.
  - A folder with only hidden descendants still shows as a row.
  - The pinned viewer opens a parent's variant list when the active route is that parent. The 2026-10-12 rule keeps the staged screen's list closed, as the site mockup draws it.
  - `folderChildCount` in `design-site-test-helpers.ts:49` also counts hidden child rows. It can disagree with a stage that counts visible rows, once a hidden folder record exists.
- **Impact if no action:** The home page shows navigation rows that the product viewer does not draw. The protocol doc claims parity with the viewer.
- **Root question:** Which navigation rows does the home stage draw, and where does it depart from the viewer?
- **Options:**
  - **A.** Bring back the closed branch, and keep the staged screen's variant list closed as the site mockup draws it. Say in `site-delivery.md` and `ts/site/README.md` that the viewer opens that list. Make `folderChildCount` count visible rows. It changes about 40 lines in two code files. Effort: Medium.
    - Only a folder row shows a count, only above zero, and it counts visible children.
    - A folder opens at the top of its section or on the staged screen's path. A folder with only hidden descendants is omitted.
    - The stage manifest in `ts/site/src/stage.ts` rejects a zero count and any count on an entry row. That rejection is stricter validation. It needs the user's approval if the 2026-10-12 decision does not cover it.
    - A parity test compares the stage row kinds and count positions with the site mockup in both desktop schemes.
  - **B.** Do A, but follow the viewer for the staged screen too. Draw its three variant rows in the stage and in the site mockup, with a variant row kind and glyph. It changes an approved mockup and the parity tests. Effort: Large.
  - **C.** Ask the open Mokly repository to export the default navigation rows, with counts and disclosures, from `@mokly/viewer/data`. Build the stage from that export, with the closed list as a named override. It needs a viewer release. Effort: Large.
- **Left out:** Change nothing. The 2026-10-12 decision requires the viewer row rules, so it fails a decision in force.
- **Wider fix:** C. The stage then takes counts and disclosures from the viewer, not from a local copy of its rules.
- **Previous examples:** The closed PR #39 recorded the counts and open lists as finding S2, and the staged screen's list as finding F8. The viewer rule is `collectDefaults` in `@mokly/viewer` `dist/shell/nav_model.js:89-93`, and `@mokly/mokly` `docs/protocol/mokly-disclosure-persistence.md:47-51` requires it.
- **Related:** `plans/follow-ups/site-reference-omits-upload-exchange.md` shares the closed branch.
- **Recommendation:** A. The site mockup is the visual source of truth, and the stage already omits every sibling row. C best protects the codebase against more drift.
- **Action:** ask the user, because condition 3 holds: option A chooses the approved mockup over the viewer, a choice that PR #39 left open.

The closed branch `calummoore/reland-site-stage-reference` holds this work and the Reference work at commit `3517a9d6`. It merges into `main` without a conflict on 2026-10-30. Its complete gate passed on 2026-10-27, with 518 site browser tests. That result is history and was not repeated at commit `f568853e`.

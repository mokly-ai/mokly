# Doc fixes of the closed PR #39 remain

- **Severity:** Medium (estimate). **Effort:** Small (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-30, from the audit of the closed [PR #39](https://github.com/mokly-ai/mokly-cloud/pull/39) on 2026-10-26, checked again against `main` at `860b163f`. Updated on 2026-10-30, when the plans migration deleted the plan that fixes 8 and 11 edited.
- **Location:** `docs/development/cloud.md:42-51`, `docs/protocol/cloud/web-app.md:146`, `docs/protocol/cloud/product-navigation.md:205-216` and `docs/ops/publish-smoke.md:199-203`. The list below gives the other places.
- **Reason:** The user's answer of 2026-10-26 re-landed only the code fixes of PR #39, so no recorded decision covers its doc-only fixes on today's `main`.
- **Checked:** 2026-11-01, on the branch `calummoore/mokly-cli-upgrade` at commit `62e623ca`, with its uncommitted Mokly 0.18.0 docs. The decision is still open. Most listed passages remain, some at new lines. PR #81 fixed the Step 6 link of fix 6, and fixes 8 and 11 were done on 2026-10-30. The 0.18.0 docs applied the merge-base edit of fix 3 and two of the four edits of fix 9. The anchor edit of fix 3 and the second edit of fix 4 no longer apply.
- **Checked:** 2026-11-17, in this repository after the cloud moved in. The cloud root README is now `docs/development/cloud.md`. Its package-boundary paragraph, lines 42-51, names the workspace packages, the documented exports and the documented file artifacts, and it still omits the shipped guides and protocol documents that `apps/site` publishes. The cloud `AGENTS.md` is gone, and the merged `AGENTS.md` holds none of the narrow wording of option B. The other passages were not checked again.
- **Category:** Docs or spec.

- **Terms:**
  - **Audit row:** One finding of the PR #39 reviews, named by its old id such as D4, which the list below explains.
  - **Mockup baselines:** `docs/protocol/cloud/mockup-baselines.md`, now titled Mockup Comparison Base, which the user made the only owner of the comparison base rules on 2026-10-12.
- **Background:** The list below gives the facts.
  - The closed PR #39 fixed the documentation findings of the reviews of PR #35 and PR #36. The user approved each recommended option on 2026-10-12.
  - On 2026-10-26 the user closed PR #39 and chose to re-land its code fixes in smaller pull requests.
  - Pull request #51 had rewritten the protocol docs under the new `documentation` skill in between.
  - An audit on 2026-10-26 found 19 doc-only fixes that still applied, and a check on 2026-10-30 confirmed all 19 on `main`. That count is history.
  - PR #81 later fixed one more edit, the Step 6 link of fix 6.
  - On 2026-11-01, the docs for the move to Mokly 0.18.0, on the branch `calummoore/mokly-cli-upgrade`, rewrote several listed passages. The list below marks each edit that they applied or made obsolete.
- **Problem:** The docs still hold the open defects that the list below gives, most misleading first. The worst is the package-boundary paragraph of `docs/development/cloud.md`, the former cloud root README. It names the workspace packages, the documented exports and the file artifacts, but not the package guides and protocol documents that `apps/site` publishes. Some other fixes only make a rule explicit, and they correct no code defect.
- **Impact if no action:** Readers and reviewers act on rules that the code breaks by design. References point to the wrong section, and runbook steps run in the wrong checkout.
- **Root question:** Which of the doc fixes that the user approved on 2026-10-12 still land on today's `main`?
- **Options:**
  - **A.** Land the open fixes in one docs-only branch. Fixes 8, 10, and 11 and two edits of fix 6 are already done, as the list says. Effort: Small.
  - **B.** No longer applies. It also aligned the narrow wording at `AGENTS.md:118-125` of the old cloud repository. The merged `AGENTS.md` holds no such wording, so B is now the same as A. Effort: Small.
  - **C.** Land only the first five groups of the list, which mislead the most. Effort: Small.
  - **D.** Drop the fixes and delete this item. Effort: Small.
- **Left out:** Re-land the PR #39 doc commits as they are. Pull request #51 split and rewrote the same docs, so the old text no longer fits the new doc layout.
- **Wider fix:** None in this item. `plans/follow-ups/doc-splits-have-no-removal-audit.md` holds the wider fix of the D2 class, a removal audit for document splits.
- **Previous examples:** The review of PR #35 found the D2 class: rules that earlier document splits dropped. The same audit found 8 other rows already fixed on `main` and 6 that no longer apply.
- **Related:** The list below gives the links.
  - `plans/follow-ups/mockup-determinism-rebuilds-in-same-checkout.md` edits `docs/protocol/cloud/mockup-verification.md`. The P7 fix edited the same doc, and the Mokly 0.18.0 docs already applied that edit.
  - `plans/follow-ups/doc-splits-have-no-removal-audit.md`, same class. It holds the split-audit rule that the 2026-10-12 decision for D2 added.
  - `plans/follow-ups/shared-link-loses-screen-through-sign-in.md`, same defect. Fix 11 wanted a sentence that names the owner of the signed-out defect, and that item is now its owner.
- **Recommendation:** A. Each fix is a small doc edit that the user approved. The recommendation was B until the merged `AGENTS.md` dropped the wording that B aligned.
- **Action:** ask the user, because condition 1 holds: the 2026-10-26 answer narrowed the re-land to code fixes, so no recorded decision covers these doc fixes now.

The fixes, most misleading first. Each line gives the current place and the smallest fix:

1. **D4, package boundary.** `docs/development/cloud.md:42-51` now names the workspace packages, the documented exports and the documented file artifacts. It still omits the shipped guides and protocol documents that `apps/site` publishes. `docs/protocol/cloud/mokly-artifact-compatibility.md:8` allows documented exports, `packages/app/src/viewer/published.web.tsx:3` imports `MoklyViewer`, and `apps/site` publishes the package's guides. Name the shipped guides and protocol documents there too. The cloud now uses the workspace packages, not exact pins on published releases, as `docs/protocol/repository-layout.md` says, so the fix no longer names exact pins.
2. **D4 and L1, landmark rule.** `docs/protocol/cloud/web-app.md:146` and `docs/protocol/cloud/product-navigation.md:215-216` say that every screen owns one `main` landmark, one `h1` and a skip link. `docs/protocol/cloud/web-product-shell.md:175-177` records two nested `main` landmarks and two skip links in the ready viewer. Add one sentence to each rule that names this exception and links `web-product-shell.md#viewer`.
3. **P3, runbooks.** The list below gives the two edits.
   - `docs/ops/publish-smoke.md:199-203`: add "Run the pinned command above from the temporary fixture checkout that step 9 prepares."
   - Done by the Mokly 0.18.0 docs: `docs/ops/deploy.md:734-738` now says that the comparison renders the merge base of `HEAD` and `--base`. The anchor edit no longer applies: `docs/protocol/cloud/mockup-baselines.md` has no rebuild recipe and no `#base-rebuild-recipe` heading, and the link at line 739 names that whole page.
4. **D1, fixtures.** The list below gives the two edits.
   - `docs/protocol/cloud/mokly-fixture-regeneration.md:110-112` lists the only authored inputs. On 2026-10-26 the generator also accepted the corpus module `review-corpus.mjs`. Since the move to Mokly 0.18.0, the generator in this repository, `xtask/scripts/mokly-fixtures.mjs:141-148`, accepts `index-v9-cases.json`, `index-corpus.mjs` and `check-index-corpus.mjs` beside the source trees and the README. Add `index-corpus.mjs` as "its case builder" when the doc does not name it yet, and name no file.
   - No longer applies after the move to Mokly 0.18.0: the edit added a row for `mokly-viewer/navigation/**` to the path table of `docs/protocol/cloud/mokly-artifact-compatibility.md`. A 0.18.0 build writes no such directory, and the route table of the released `mokly-shell-delivery.md` lists none. The rewritten table at lines 124-135 lists the 0.18.0 paths. The committed 0.14.0 fixture inventory still declares those modules at `crates/mkc-mokly-contract/fixtures/inventory.json:265-280` until the fixtures are regenerated.
5. **D2, rules that splits dropped.** The list below gives the five edits.
   - `docs/protocol/cloud/viewer-read-model.md:201-206` now projects the stored catalogue index of Mokly 0.18.0 and names no after side. `crates/mkc-publications/src/screens.rs:28-35` still drops a review row without an after-side view until that move rewrites it. Check the new projection, then add "A screen with no such view is dropped." only if it still drops screens.
   - `docs/protocol/cloud/publication-upload-validation.md:114-115`: change "are private" to "Reject comparison diagnostics under `mokly-viewer/diffs/**/summary.md`.", as `crates/mkc-mokly-contract/src/bundle_validation.rs:57-58` does.
   - `docs/protocol/cloud/screen-comments.md:14`: "A thread stores an immutable original anchor with …". Lines 24-25: "It is a stable opaque identifier supplied only by the negotiated bridge, …".
   - `docs/protocol/cloud/product-mockups.md:53-63`: add "Never add an app-test-only label to make this parity check pass."
   - `docs/protocol/cloud/site-design.md:198-206`: add "The site omits the mockup's filter count because the staged build has no comparison."
6. **D3, wrong references.** The list below gives the three edits.
   - `docs/protocol/cloud/product-navigation.md:205-208` says that Viewer chrome holds the package host contract. Say that `[Viewer host](./viewer-host.md#package-host)` owns it, and keep Viewer chrome for the slot mapping.
   - Done by PR #81: `docs/protocol/cloud/preview-seed-local.md:18-20` now links Step 6 to `preview-capture.md#catalogue-capture`.
   - Done on 2026-10-30: `docs/ops/publish-smoke.md:287` now links "Milestone 3" to the deleted dependency upgrade plan with a permalink. The same runbook still names milestones without a link at lines 41, 238 and 252. These names are history, and this item does not require their edit.
7. **A1, fixture consumers.** `fixtures/README.md:15-18` names two consumers. `crates/mkc-publications/src/_tests_/moved_screen_tests.rs:12` is the third, and it derives a moved-screen case, not byte-limit cases. All three read the review v6 fixture `fixtures/viewer-review-v6.json`, and the move to Mokly 0.18.0 removes the review reader, so check this edit against the fixtures that remain after it.
8. **D5, upstream list.** Done on 2026-10-30. The plans migration deleted `plans/mokly-dependencies-upgrade.md`, and `plans/follow-ups/mokly-0140-inconsistencies-unreported.md` now lists all four upstream inconsistencies, the fourth included. On 2026-11-17 the move of Mokly Cloud into this repository split that item; `plans/follow-ups/changelog-0140-names-old-formats.md` holds its one open point.
9. **P7, base rule copies.** Replace each protocol copy with a link to Mockup baselines. The list below gives the four copies.
   - Done by the Mokly 0.18.0 docs: `docs/protocol/cloud/mockup-verification.md:202-203` now only links Mockup baselines.
   - Done by the Mokly 0.18.0 docs: `docs/protocol/cloud/preview-capture.md:116-135` now links Mockup baselines for the base render, and keeps only the capture rules and the capture consequences.
   - `docs/protocol/cloud/preview-seed-local.md:22-25` links the comparison base section of `preview-capture.md`, not Mockup baselines, and restates the base render in one sentence.
   - `docs/protocol/cloud/mokly-artifact-compatibility.md:161-165` restates two base rules and links Mockups and Mockup tooling, not Mockup baselines.
   - The copies agree today.
10. **D7, change wording.** Done on 2026-11-18. Commit `a81cf356` rewrote the sentence. `docs/product-direction.md:58-59` now says that the cloud hosts the workspace packages, which is the steady state. No edit remains.
11. **D6, owner of the signed-out defect.** Done on 2026-10-30. The plans migration deleted the plan whose [status paragraph](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/mokly-dependencies-upgrade.md?plain=1#L1-L12) named no owner. `plans/follow-ups/shared-link-loses-screen-through-sign-in.md` now owns the defect and the open decision on PR #37.

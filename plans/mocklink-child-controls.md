# MockLink Child Controls

Implement the approved [styled link controls contract](../docs/protocol/mokly-link-controls.md)
so consumers can use their existing styled controls with Mokabook navigation.
Scope is the Mokabook package, documentation, and consumer/browser fixtures.
Downstream adoption and publishing a package release are subsequent work.

## Milestone 1: Define the contract — completed

Specify a complete opt-in API and its ownership, accessibility, and build rules.

- [x] Audit the consumer failure and current Mokabook navigation boundary.
- [x] Fetch and preserve current main before integration. Source tip was
      `b5ed6dfa8d82ea8ef532f7873443ddaa9fca1440`; audit showed the navigation
      resize feature, which was retained by fast-forwarding to `b45327a`.
- [x] Write the protocol before implementation and index this plan immediately.

## Milestone 2: Implement static child controls — completed

Deliver a functioning, opt-in authoring API and shared build transformation.

- [x] Add failing regressions for conversion, default-byte compatibility,
      inactive states, invalid children, and ambiguous markup.
- [x] Add typed and runtime-validated `MockLink asChild` authoring.
- [x] Implement bounded marker parsing and source-offset control adaptation,
      preserving unaffected bytes and providing link/focus styling.
- [x] Preserve intrinsic button sizing and authored block width, protected by
      real Firna browser comparisons with the original button.
- [x] Integrate structured/legacy rendering before existing logical-link and
      compatibility validation; reject unconsumed markers afterwards.
- [x] Cover destinations, fragments, viewports/schemes, custom renderers,
      disabled ancestors, conflicting attributes, and malformed markers.
- [x] Reject scripted descendants and keep injected control styles in the
      owning document head, including documents containing SVG elements.
- [x] Run the focused unit/integration suite and package build successfully.

## Milestone 3: Verify consumers and document adoption — completed

Prove the API works with custom renderers and real consumer UI controls.

- [x] Add typed NodeNext and clean packed-consumer coverage.
- [x] Exercise a real Firna button in both viewports with pointer/keyboard
      Browse and use-case navigation, focus, disabled/busy behavior, standalone
      files, and Review snapshots.
- [x] Update the README and package/rendering documentation with usage,
      limitations and consumer migration guidance; mark the contract delivered.
- [x] Complete relevant tests and `cargo xtask check` (including clippy).

Validation: 78 focused tests, six real-Firna browser smoke tests, and the full
`cargo xtask check` passed. The gate includes 364 unit/integration tests, packed
consumers, browser coverage, formatting, lint, typechecking, clippy, and Rust
tests. An initial port-allocation test race passed in isolation and on the full
rerun. Mobile/desktop screenshots were inspected.

## Milestone 4: Commit, push, and review — completed

Deliver the complete reviewed branch under the repository's required workflow.

- [x] Inspect the diff and deletions against `origin/main`, then `git add -A`.
- [x] Commit all completed work using Conventional Commits and push the branch.
- [x] Run `cargo xtask review` after the push; do not automatically fix findings.
- [x] Record review findings with severity, context, impact, lettered options,
      and recommendations; complete and re-index the plan.
- [x] Validate and commit/push the final plan record if it changes after review.

The implementation was committed as `09e9ec1` and pushed to
`calummoore/feat-mocklink-for-buttons` before `cargo xtask review` completed
successfully. The full gate passed 364 unit/integration tests, 70 Chromium
tests, and three Rust tests. The working diff contained no mainline deletions.

## Review outcome

The initial delivery recorded items 1–4 for the user's decision without changing
the reviewed implementation or README. The user has now authorized all four
fixes, tracked in Milestones 5 and 6 below. Item 5 described the expected
pre-review delivery state: this final record and index update complete the
already-planned post-review bookkeeping.

1. **Severity: Medium — child markers can bypass safety checks by changing attribute case.**

   Context: [src/build/link_controls.ts](../src/build/link_controls.ts#L30) only enters the adapter when `html.includes(CHILD_MARKER)`, and [src/build/link_controls.ts](../src/build/link_controls.ts#L166) uses the same case-sensitive check after compatibility output. HTML attribute names are case-insensitive, so `DATA-MOKABOOK-LINK-CHILD-START` can ship unconsumed if emitted by a renderer or compatibility transformer.

   Impact of doing nothing: internal reserved markers can leak into generated output, and the documented “unconsumed markers fail the build” contract is not actually enforced.

   Options: A. Use a case-insensitive marker scanner/regex for the precheck and post-transform assertion, with tests for uppercase renderer output and uppercase compatibility-transform output. B. Document lowercase-only reserved markers, but that conflicts with HTML parsing semantics.

   Recommended: A.

2. **Severity: Medium — `data-mokabook-link-control` is only reserved on the adapted root.**

   Context: the injected stylesheet targets every `a[data-mokabook-link-control]` in the document at [src/build/link_control_patches.ts](../src/build/link_control_patches.ts#L15), but the reserved-metadata check only rejects the attribute on the root being adapted at [src/build/link_control_patches.ts](../src/build/link_control_patches.ts#L88).

   Impact of doing nothing: an unrelated consumer-authored anchor with that attribute can be restyled whenever any active child control causes the stylesheet to be injected, violating the “patch only marked controls” safety boundary.

   Options: A. Globally reject package-owned link-control metadata before injecting styles and after compatibility transforms, case-insensitively. B. Rename to a less likely internal attribute but still enforce it. C. Only document the reservation.

   Recommended: A.

3. **Severity: Low — focusable ancestors are allowed despite the multiple-keyboard-target contract.**

   Context: [src/build/link_controls.ts](../src/build/link_controls.ts#L127) checks ancestors with `isInteractive(ancestor, false)`, which excludes `tabindex`; [src/build/link_control_nodes.ts](../src/build/link_control_nodes.ts#L71) otherwise treats focus targets as interactive. The protocol says interactive ancestors are invalid to prevent multiple keyboard targets.

   Impact of doing nothing: `<div tabIndex={0}><MockLink asChild ... /></div>` can produce redundant nested focus targets and drift from the documented accessibility rule.

   Options: A. Treat focusable ancestors as interactive and add a regression test. B. Intentionally allow focus wrappers and update the protocol/tests to say so.

   Recommended: A.

4. **Severity: Low — public README includes downstream app migration guidance.**

   Context: [README.md](../README.md#L118) puts consumer-specific styled `Button` instructions in the package README.

   Impact of doing nothing: app-independent Mokabook docs remain coupled to one consumer app/framework, which can confuse package users and make future README maintenance noisier.

   Options: A. Move that migration guidance to `docs/migration` or the plan, and keep the README generic. B. Reword it as a generic custom-component note.

   Recommended: A.

5. **Severity: Low — delivery plan status is stale for a committed/pushed review diff.**

   Context: [plans/mocklink-child-controls.md](../plans/mocklink-child-controls.md#L49) says full validation passed, but [plans/mocklink-child-controls.md](../plans/mocklink-child-controls.md#L55) leaves commit, push, review, and final plan recording unchecked; [plans/README.md](../plans/README.md#L5) still lists the plan as active.

   Impact of doing nothing: reviewers cannot tell whether post-push review happened or whether the feature is complete.

   Options: A. After review disposition, update Milestone 4 and move the plan to Completed when appropriate. B. Keep it active but record these findings explicitly.

   Recommended: A.

Reviewer scope: committed `HEAD` `09e9ec1` against local `origin/main` `b45327a`. No deletions were present, and `git diff --check origin/main..HEAD` was clean. The reviewer ran read-only and did not repeat the build/tests; the full implementation gate had already passed before the commit and push.

### Scope recommendations

For items 1 and 2, prefer one parsed-attribute reservation policy shared by
authoring adaptation and compatibility validation, with mixed-case and
unrelated-anchor regressions. Reject consumer-authored reserved attributes and
verify ownership after compatibility transforms while retaining metadata
generated by the adapter. This takes more work than two string checks but
protects future reserved attributes and avoids treating ordinary text as HTML
metadata. For item 3, decide the ancestor-focus contract explicitly and test
both positive tab order and programmatic-focus containers before broadening
rejection. For item 4, retain the migration content in a linked consumer guide
and keep the public README example generic.

## Milestone 5: Address approved review findings — completed

Enforce one parsed metadata policy at both renderer and compatibility boundaries,
align focus validation with the contract, and separate consumer migration docs.

- [x] Add failing regressions for mixed-case markers, reserved metadata on
      unrelated elements, compatibility ownership changes, and focusable parents.
- [x] Share parsed attribute validation, preserving literal text and legitimate
      generated metadata while rejecting authored or altered reserved metadata.
- [x] Reject ancestor `tabindex`, including programmatic focus, and document the
      same rule for ancestors and descendants.
- [x] Move consumer-specific instructions out of the README and keep
      the package README generic.
- [x] Run relevant tests, browser smoke tests, and `cargo xtask check`.

## Milestone 6: Deliver and review the fixes — completed

Complete the required delivery sequence after the approved fixes pass validation.

- [x] Audit the diff against `origin/main`, stage all files with `git add -A`,
      commit using Conventional Commits, and push the branch.
- [x] Run `cargo xtask review` after the push and report any new findings without
      automatically fixing them.
- [x] Record the review result, complete the plan/index, validate Markdown, and
      commit/push the final delivery record if needed.

Approved fixes: items 1 and 2 now share parsed metadata validation, including
mixed-case names, global reservation, duplicate attributes, logical-owner
records, and stylesheet preservation. Item 3 rejects ancestor focus attributes,
including negative `tabindex`. Item 4 is covered by the generic integration
contract. Item 5 was completed in the initial post-review record.

Validation after the fixes: all 97 focused tests and `cargo xtask check` passed.
The full gate passed 401 unit/integration tests, 70 Chromium tests (including
real Firna navigation smoke tests), and three Rust tests, plus formatting,
lint, typechecking, example validation, and packed-consumer checks. The known
port-allocation test race occurred on the first run; the isolated test and
full rerun passed. No production or test changes were made for that race.

The approved fixes were committed and pushed as `d5ab08a`. The mandatory
post-push review has now completed; this final documentation record closes the
scheduled delivery tasks. The two additional compatibility findings below are
recorded for the user to decide, without further implementation changes.

## Follow-Up Review Outcome

The reviewer reported four items below. Item 1 was disproved by the merge
preview; items 2 and 3 remain for the user's decision; item 4 is completed by
this planned delivery record. Evidence and scope recommendations follow the
original report.

1. **Severity: High — branch would remove a current `origin/main` feature.**

   **Context:** `HEAD` is behind local `origin/main` by one commit: `1dcfb67 fix(search): match authored page IDs (#39)`. The committed diff removes ID search by dropping `data-entry-id` from nav rows in [src/server/shell/nav.tsx](../src/server/shell/nav.tsx#L62) and matching only text/route in [src/client/search_query.ts](../src/client/search_query.ts#L23). It also updates docs to remove ID search while the UI still exposes copyable IDs in [src/server/shell/head.tsx](../src/server/shell/head.tsx#L113).

   **Impact of doing nothing:** merging this branch as-is regresses mainline Browse search and deletes tests/docs added by `origin/main`. Users who copy an ID chip or know a `MockLink` target ID may no longer find the screen unless title/route happen to match.

   **Options:** A. Rebase/merge `origin/main` and preserve `1dcfb67`, restoring `data-entry-id`, ID query matching, tests, and docs. B. If removing ID search is intentional, get explicit approval and document it as a behavior change.

   **Recommended:** A.

2. **Severity: Medium — compatibility transforms can invalidate adapted-control safety after validation.**

   **Context:** child controls are validated before the compatibility transformer in [src/compatibility/transform.ts](../src/compatibility/transform.ts#L35), but after transform only metadata/logical records are checked at [src/compatibility/transform.ts](../src/compatibility/transform.ts#L83). Those checks do not reject new interactive ancestors, nested controls, or inline handlers on the adapted anchor. I verified with the built validators that wrapping the generated anchor in `<button>`, adding `onclick`, or inserting a nested `<button>` passes current metadata/logical validation.

   **Impact of doing nothing:** a compatibility bridge can ship output that violates the documented “no inline handlers / no nested controls / no interactive ancestor” contract, especially in standalone files and Review snapshots.

   **Options:** A. Add a post-transform validator for `data-mokabook-link-control` owners that rechecks native anchor shape, inline handlers, descendants, and ancestors. B. Document compatibility transformers as fully trusted and allowed to break adapted-control safety.

   **Recommended:** A, with regression cases in `tests/compatibility_link_controls.test.ts`.

3. **Severity: Medium — control metadata ownership is not bound strongly enough.**

   **Context:** [src/build/link_control_metadata.ts](../src/build/link_control_metadata.ts#L104) records only control metadata plus `id`, `href`, `data-nav-href`, and `data-mokabook-link`. It ignores preserved owner attributes such as `class`, `style`, labels, and DOM position. The existing test at [tests/compatibility_link_controls.test.ts](../tests/compatibility_link_controls.test.ts#L51) catches moving metadata only because the ordinary link has a distinguishing `id`; the same move to a no-id same-destination link passes.

   **Impact of doing nothing:** compatibility transforms can move `data-mokabook-link-control` from the styled adapted control to a plain same-destination link without detection, breaking the documented “moving metadata to a different logical owner fails” guarantee.

   **Options:** A. Strengthen owner records with the adapted root’s non-package attributes, and add no-id same-destination regression coverage. B. Add an opaque generated owner token and treat any missing/duplicated/moved token as invalid. C. Weaken the docs to describe the current best-effort record matching.

   **Recommended:** A plus B if the contract needs a hard ownership guarantee.

4. **Severity: Low — delivery plan still records review as pending.**

   **Context:** [plans/mocklink-child-controls.md](../plans/mocklink-child-controls.md#L165) leaves post-push `cargo xtask review` and final plan/index recording unchecked, and [plans/README.md](../plans/README.md#L3) still lists the plan as active.

   **Impact of doing nothing:** reviewers cannot tell from committed docs whether the required post-push Review step completed for the final fix commit.

   **Options:** A. Run/record the post-push review result and move the plan to Completed if done. B. Keep it active but add a dated blocker/status note.

   **Recommended:** A.

Reviewer scope: read-only source inspection, Git diff checks, and pure validator probes against the existing build. The reviewer did not repeat the full gate; it had already passed before the implementation commit and push.

### Disposition And Scope

1. **Reported High — mainline ID search removal: not a branch regression.**
   `origin/main` advanced during review from `b45327a` to `1dcfb67`, while the
   reviewed branch remained `d5ab08a`. The reviewer treated a two-tip diff as a
   removal. The branch-point diff contains no ID-search changes.
   `git merge-tree --write-tree 1dcfb67 d5ab08a` completed without conflicts and
   produced tree `080898945cf420b011c2a47f33872359105a7dd3`. All nine ID-search
   code/test/protocol files match `1dcfb67` exactly in that tree; the merged
   README retains main's ID-search guidance and adds only this feature's docs.
   No mainline removal is proposed or authorized. A. Preserve main through the
   normal merge (recommended and verified). B. Refresh the branch from main
   before integration if desired; no ID-search reimplementation is needed.

2. **Medium — final adapted-control validation: pending user decision.**
   Prefer one semantic validator shared by initial adaptation and final
   compatibility validation, with ancestor, descendant, and inline-handler
   regressions. Reusing the policy prevents future validation drift across the
   two boundaries; checking only the demonstrated wrapper would leave the
   related cases open.

3. **Medium — owner identity among identical destinations: pending user decision.**
   Strengthen the owner record and define exactly which consumer edits remain
   allowed. Add regression coverage for two links without ids sharing a target.
   A token by itself is movable alongside its metadata, so pair any identity
   token with the owner validation rather than relying on a token alone.
   This requires a contract/test update beyond merely adding another string to
   the existing fingerprint.

4. **Low — pending delivery record: completed as scheduled.**
   Review cannot be marked finished in the commit it is reviewing. This record
   completes the already-planned post-review bookkeeping and index update.

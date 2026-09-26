# Path-Only Evidence Stays Out Of Changes

Status: Milestones 1–9 are complete and findings 3–6 are fixed; finding 2 is
superseded by [Configurable Changes Listing](./configurable-changes-listing.md),
and findings 7 and 8 await the user's decision. The plan stays Active until PR #118 merges. Created
2026-09-25 with the user's consent (option B of
finding 1 raised while reviewing the PR #118 preview). Implemented on the
`calummoore/halifax-v2` branch alongside
[Path-Based Navigation Hierarchy](./nav-path-hierarchy.md).

**Problem:** In a catalogue with registered components, a changed file that
matches only a `review.sharedImpact` glob, or sits inside a directory an entry
declares as a dependency, gives every matching entry a `dependency` reason.
Those entries are listed in Changes although nothing they render changed. The
PR #118 preview listed 114 entries; 30 had no other reason, and every one of
the 114 was Unmodified in every view. The cause was two edited component
registration modules (`action.mokly.tsx`, `toolbar.mokly.tsx`) matching the
example's `examples/basic/src/components/**` glob. The same rule lists nearly
the whole catalogue whenever a renderer or token module changes.

The specs disagree: `mokly-changes.md`, `mokly-runtime.md`,
`mokly-configuration.md`, and `mokly-css-attribution.md` say shared-impact
globs and dependency declarations alone add nothing, while
`mokly-component-changes.md` keeps an unowned shared-impact path as an
independent Changes reason, which the classifier implements.

**Decision:** Path-only evidence is comparison evidence, never a Changes
reason, in every catalogue. Rendered changes keep their existing detection:
each view's normalized document, every resource it references, and linked
stylesheets by rule. Explicit declarations keep their reasons:

- a component-owned path (`ownedDependencies`, file or directory root)
  remains a reason for its owning component, and its consumers stay
  affected-only;
- an exact explicitly declared dependency file remains a reason for the
  entry that declares it, under the existing ownership rules.

A path matched only by a `review.sharedImpact` glob, by containment in a
declared dependency directory, or by automatic source attribution adds no
reason, no Changes row, no affected-consumer propagation, and no use-case
propagation. Entry `sharedImpact` keeps the same path set as before, with
stylesheet scope and ownership handled by the exact
[result definition](../docs/protocol/mokly-component-review.md#reasons-and-secondary-evidence).
The Details inspector shows that comparison evidence under the existing
`design-review-shared-impact` design: an unchanged screen opened from All with
"Changes to these files may affect this screen:".

## Milestone 1: Contract documentation

Define one membership rule for path evidence and remove the contradiction.

- [x] `mokly-component-changes.md` "Dependencies And Styles": replace the
      conservative shared-impact rule with the decision above (owned paths,
      exact declared files, everything else evidence only); state that a
      renderer, theme, or token module matched only by broad evidence still
      reaches Changes through rendered documents and referenced resources.
- [x] `mokly-component-review.md`: define the `dependency` reason by the new
      rule and state exactly what entry `sharedImpact` contains, including
      changed paths inside declared dependency directories, so no evidence the
      old rule recorded as a reason disappears.
- [x] Make `mokly-changes.md` (Changes membership), `mokly-runtime.md`,
      `mokly-configuration.md` (`review.sharedImpact`),
      `mokly-catalogue-changes.md`, `mokly-css-attribution.md`,
      `mokly-css-evidence-shell.md` (the Details list includes shared-impact
      evidence in both result versions), and `mokly-export.md` state the same
      rule once and link to the owner instead of restating it.
- [x] Update `docs/guides/authoring/config.md`, `docs/guides/catalogue/`
      pages that explain Changes membership, `examples/basic/README.md`, and
      `src/review/README.md`.
- [x] Preserve the v3 `sharedImpact` edge case for out-of-scope stylesheet
      glob matches when another component owns the path.
- [x] Fix the stale example README publishing anchor found during link validation.
- [x] Keep published guides free of Markdown links, as their structure test requires.
- [x] Address Milestone 1 review: restore unrelated contract wording and use
      user-facing guide language without raising protocol size caps.
- [x] Validate Prettier, links, and anchors on changed Markdown; run the unit
      tests that read protocol docs, including `tests/protocol_doc_sizes.test.ts`.
- [x] Commit the documentation.

## Milestone 2: Shared-impact evidence in comparison details

Tags: ui

Show the entry's shared-impact evidence for current results as the existing
Shared impact mockup already depicts; no visual design change.

- [x] The Details inspector's "Changes to these files may affect this
      screen:" list is the union of retained dependency reason paths and the
      entry's `sharedImpact` evidence for both result versions; excluded
      stylesheets and analysed-selector groups are unchanged and never
      overlap it.
- [x] Failure-first unit tests for the evidence projection, and browser
      coverage for a screen opened from All showing shared-impact evidence;
      defer its Changes-membership assertion until Milestone 3.
- [x] Smoke-test through `npm run dev`.
- [x] Check entry-kind wording and the existing mobile/desktop shared-impact
      mockup; report the component wording without changing copy.
- [x] Commit.

## Milestone 3: Path-only evidence adds no Changes reasons

Implement the rule in the one component-aware classifier used by Browse,
watched updates, Review JSON, and publication.

- [x] Failure-first tests: a changed path matched only by a
      `review.sharedImpact` glob, and one inside a declared dependency
      directory, add no Changes row for a screen, component, or use case, do
      not make a component affect its consumers, and stay in entry
      `sharedImpact`; an exact declared file and a component-owned path keep
      their reasons; an unowned component registration module under a broad
      glob lists nothing.
- [x] Extend the real Git-backed case in
      `tests/browser/shared_impact_details.spec.ts` with an assertion that the
      path-only screen has no Changes row after classification.
- [x] Change `ComponentDependencyPolicy` so only owned paths and exact
      declared files are independent evidence; remove the glob path from the
      policy.
- [x] Produce entry `sharedImpact` exactly as Milestone 1 defines it.
- [x] Validate dependency reasons against source manifests in the producer;
      the source-free viewer decoder retains structural validation.
- [x] Preserve legitimate ownership-projected resource reasons in producer
      validation without repeating the comparison.
- [x] Align the v3 result contract with its screen/component record shape;
      use cases have no entry `sharedImpact` record.
- [x] Audit tests that encoded old membership; existing expectations covered
      v2 evidence, explicit paths, rendered resources, or CSS and needed no
      changes. Report that list as empty.
- [x] Smoke: `npm run preview:build -- --include-changes` on this branch
      lists 83 Changes entries instead of 114 (82 screens whose component
      data changed and the Catalogue navigation component); the Example tour
      flow drops with its two screens; `design-appearance-props` stays listed
      for its data reason, and its comparison details name one changed
      component (Catalogue navigation) instead of eight.
- [x] Commit.

## Milestone 4: Verification, close-out, and review

- [x] Run `cargo xtask check`; fix anything it reports until it passes.
- [x] Update the PR #118 description to cover this change.
- [x] Commit and push.
- [x] Review the complete local diff against `origin/main` using
      [`docs/implementation-review-prompt.md`](../docs/implementation-review-prompt.md)
      after the push; report each finding with a number, severity, plain
      explanation, impact of doing nothing, lettered options, and a
      recommendation, without changing the implementation. An independent
      reviewer ran against `49a23bd`; findings 3–6 await the user's decision.

## Milestone 5: Review follow-up contract documentation

The user asked to fix findings 3–6 with the recommended options. Define the
contract for each before any code changes.

- [x] Finding 3: state that source validation accepts an entry `dependency`
      reason only from evidence the classifier collected itself (the path
      rule, the resources its view comparisons retained for that entry, or
      propagated owned CSS), never from the result's own records, and that
      this evidence is keyed exactly like entry pairs (route for screens and
      flows, id for components). Update `src/review/README.md`, whose current
      sentence lists "retained view" evidence.
- [x] Finding 5: link the `mokly-authoring.md` (~57) passage and the
      `mokly-design-components.md` change table (~227) to the owning rule in
      `mokly-component-changes.md` instead of the old wording.
- [x] Finding 6: in `mokly-css-evidence-shell.md` (and
      `mokly-component-workspace-design.md` if it owns component Details
      copy), define the component wording of the four Details sentences that
      now say "screen", choosing "component" or "variant" by whether the
      evidence is entry-level or per saved variant, all supplied by the shared
      wording helper.
- [x] Distinguish ordinary Unmodified component mockups from the shared-impact
      state that keeps a file list in Details.
- [x] Split validation and canonical output into a focused spec, retaining the
      original affected-consumer wording and linking back from the result schema.
- [x] Validate Prettier, links, and anchors on changed Markdown; run the
      doc-size, guide, and protocol-reading unit tests.
- [x] Commit.

## Milestone 6: Component shared-impact mockup

Tags: mockup

- [x] Add a component version of the Shared impact state (a component page
      whose Details lists files that may affect it, with the Milestone 5
      wording), mobile and desktop, reachable from the existing component
      mockup pages and within the five-mockups-per-page limit; reuse the
      existing screen components and design parts.
- [x] Update component design inventory counts in the specs, example README,
      and the exact-count example tests for the new screen.
- [x] Wrap the new mockup's real shared-file paths within the mobile Details
      panel and inspect both panel sizes.
- [x] Run `npm run build`, `npm run example:build`, and
      `npm run example:check`; inspect the new artboards through
      `npm run dev`.
- [x] Run lint, format check, the design-screen inventory unit tests, and all
      browser specs that open component design pages.
- [x] Commit.

## Milestone 7: Source validation and invariant oracle

- [x] Finding 3, failure-first: a forged reason recorded on both a view and
      the entry, and a reason injected onto a screen that only uses a changed
      component, are rejected; a screen moved onto another screen's former
      route with a view-level dependency reason validates.
- [x] Remove the result-based fallback from producer source validation and
      key the classifier's view evidence with the entry pair key, shared with
      `entryPairs`.
- [x] Finding 4: compute the invariant test's expected `sharedImpact` from the
      fixture's manifests and changed files under the old rule, without
      reading the result under test; show it fails when an owner reason is
      dropped.
- [x] Run build, prepared typecheck, lint, format check, the full unit suite,
      and the five comparison-evidence browser specs.
- [x] Commit.

## Milestone 8: Component Details wording

Tags: ui

- [x] Route the four Details evidence sentences through the shared wording
      helper with the Milestone 5 copy; screen copy stays unchanged.
- [x] Failure-first test that renders component Details evidence and fails
      on screen wording, plus screen regression coverage; smoke-test a
      component page through `npm run dev`.
- [x] Extend the shared-impact browser test to open a component from All and
      assert the component file-list sentence.
- [x] Compare live component Details with the shared-impact mockup at desktop
      and mobile widths, verify long paths wrap, and save smoke screenshots.
- [x] Run build, prepared typecheck, lint, format check, the full unit suite,
      and every browser spec that exercises Details evidence.
- [x] Commit.

## Milestone 9: Review follow-up verification, close-out, and review

- [x] Mark findings 3–6 fixed in the review-findings list.
- [x] Run `cargo xtask check`; fix anything it reports until it passes.
- [x] Update the PR #118 description if it no longer covers the branch.
- [x] Commit and push.
- [x] Review the complete local diff against `origin/main` using
      [`docs/implementation-review-prompt.md`](../docs/implementation-review-prompt.md)
      after the push; report each finding with a number, severity, plain
      explanation, impact of doing nothing, lettered options, and a
      recommendation, without changing the implementation. An independent
      reviewer ran against `83e0879`; findings 7 and 8 await the user's
      decision.

## Review findings

Findings 1 and 2 came from the PR #118 preview: 1 is this plan (option B);
2 (a listed screen whose views look unchanged does not say why it is listed)
is superseded: the user chose configurable listing settings instead, planned
in [Configurable Changes Listing](./configurable-changes-listing.md), whose
`sharedFiles` setting will replace this plan's hard-coded path-only rule. Findings 3–6 come from the review of
`49a23bd`; the user chose the recommended options and Milestones 5–8 fixed
them.

3. Medium: producer source validation accepts a `dependency` reason when the
   result itself records the same path on one of the entry's views
   (`keepsDependency` in `src/review/component_result_sources.ts`), so a
   classifier bug that writes both passes, including a reason wrongly given to
   an affected-only screen. The full unit suite passes without that fallback
   (2,496/2,496). Its evidence map is also keyed by kind and id while
   `entryPairs` pairs screens and flows by route: when a screen moves onto a
   route another screen used, two pairs share a key and one overwrites the
   other's view evidence, so a valid result can be rejected once the fallback
   is gone (found by reading the code; not reproduced). Recommended: drop the
   fallback, key the evidence with the pair key, and test a forged view
   reason, an injected reason on an affected-only screen, and a screen moved
   onto another screen's former route. Fixed in Milestones 5 and 7.
4. Low: `tests/component_shared_impact_invariant.test.ts` builds its expected
   set from the result's own reasons and models the new definition, so it
   cannot catch a lost owner reason or show that the set matches the old rule.
   Recommended: compute the old rule's set from the fixture's manifests and
   changed files only. Fixed in Milestone 7.
5. Low: `mokly-authoring.md` (~57) says dependency declarations never add
   entries, which has been incomplete since exact declared files and owned
   paths could list entries in component catalogues; the
   `mokly-design-components.md` change table (~227) still gives token changes
   "existing conservative membership", which this plan made stale.
   Recommended: link both to the owning rule in `mokly-component-changes.md`.
   Fixed in Milestone 5.
6. Low (pre-existing): on component pages four Details evidence sentences say
   "screen" (the file list lead, the excluded-stylesheet sentence, and two
   style-outcome leads), although the spec requires Details wording to follow
   the entry kind through one shared helper (`entryWording`), which the
   terminal line already uses. Milestone 2 made the file list appear on more
   component pages. Recommended: add the component state to the Shared impact
   mockup, then route every evidence sentence through the helper, with a test
   that renders component Details and fails on screen wording. Fixed in
   Milestones 5, 6, and 8.

7. Medium: source validation re-runs the dependency policy without the
   classifier's stylesheet-scope filter, so an exact-declared or
   component-owned public stylesheet that every view excluded after CSS
   analysis passes as a `dependency` reason (the reviewer reproduced this with
   a synthetic result). Adding the scope filter alone would reject a valid
   exact screen declaration that its view retained while a component owns the
   file. Recommended: the classifier hands validation its per-entry reason
   sources (scope-filtered path reasons, view-comparison paths, exact-screen
   stylesheet reasons, and owned CSS) keyed by `entryPairKey`, and validation
   accepts only those; test excluded owned and exact-declared stylesheets
   (rejected) and a retained exact screen stylesheet that a component owns
   (accepted).
8. Low: the invariant fixture has no added or removed entries, so path
   evidence that only one side declares is not checked against the old rule.
   Referenced-resource and invocation-CSS evidence reach Details through
   reasons, and the CSS tests already assert them. Recommended: add added and
   removed entries with glob and declared-directory evidence to the invariant
   fixture.

## Post-merge follow-up (non-blocking)

- Confirm the merged preview's Changes list no longer grows when only a
  shared-impact file changes.

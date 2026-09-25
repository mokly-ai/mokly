# Path-Only Evidence Stays Out Of Changes

Status: Active. Created 2026-09-25 with the user's consent (option B of
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

- [ ] Run `cargo xtask check`; fix anything it reports until it passes.
- [ ] Update the PR #118 description to cover this change.
- [ ] Commit and push.
- [ ] Review the complete local diff against `origin/main` using
      [`docs/implementation-review-prompt.md`](../docs/implementation-review-prompt.md)
      after the push; report each finding with a number, severity, plain
      explanation, impact of doing nothing, lettered options, and a
      recommendation, without changing the implementation.

## Post-merge follow-up (non-blocking)

- Confirm the merged preview's Changes list no longer grows when only a
  shared-impact file changes.

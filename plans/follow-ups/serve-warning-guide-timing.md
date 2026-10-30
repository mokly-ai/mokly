# Align the Serve warning guide with on-demand views

- **Severity:** Low (estimate). **Effort:** Small (estimate).
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from PR #225 and its completed plan, which put the
  problem outside the scope of its review.
- **Location:** `docs/guides/cli/serve.md:67` and line 80.
- **Reason:** The guide text is older than PR #225, and the review found the
  mismatch outside the diff of that change.

- **Source:** Review.
- **Category:** Docs or spec.
- **Terms:**
  - **Build attempt:** one preparation of the catalogue in Serve, at startup
    or after an edit. Its warnings belong to it.
  - **Background pass:** the work of Serve after readiness that renders every
    view, to fill the render cache and the usage of every entry detail.
- **Background:**
  - `docs/protocol/mokly-build-warnings.md:138` says that a successful attempt
    prints its collected warnings once, before its `Catalogue ready` line.
  - Line 142 of that page says that a view that first renders on demand
    after readiness prints its warnings once when they appear.
  - Since PR #225, merged on 2026-10-28, the background pass reports each
    view's warnings in catalogue order, under
    `docs/protocol/mokly-on-demand.md:73`.
  - The guides under `docs/guides` ship with the npm package and describe
    the released product.
- **Problem:** `docs/guides/cli/serve.md:67` says that Serve prints a
  generation's build warnings once when the complete generated output
  finishes, and that previews opened afterwards are not reported again. Line
  80 says that each warning is reported before `Catalogue ready`. Views
  rendered after readiness print their warnings when they are reported.
- **Impact if no action:** A user expects every warning before
  `Catalogue ready`, and can miss a warning that appears later.
- **Root question:** What does the Serve guide tell users about when
  warnings appear?
- **Options:**
  - **A.** Rewrite the two passages of `docs/guides/cli/serve.md` under the
    protocol: preparation warnings before `Catalogue ready`, and the
    warnings of later renders when they appear, once each. Effort: Small.
  - **B.** Change nothing. Effort: Small.
- **Left out:** Holding every warning until readiness. It changes the
  protocol rule, and a warning of a later render would never print. Only
  two options remain, because the protocol already settles the behaviour.
- **Wider fix:** None. The `documentation` skill already requires a guide to
  follow the behaviour that it describes.
- **Previous examples:** None found.
- **Recommendation:** A (estimate). The protocol settles the behaviour, so
  only the guide is wrong.
- **Action:** fix after merge, apply A (estimate), because the guide
  contradicts the protocol, and A changes only its words.

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/parallel-background-pass.md?plain=1#L388).

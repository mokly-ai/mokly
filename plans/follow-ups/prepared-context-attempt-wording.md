# "Each attempt prepares a new context" overstates

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-22, from round 5 of the review of the branch
  `calummoore/mokly-earlier-postcss-start-bdhv`, whose finding check listed
  it outside the scope.
- **Location:** `docs/protocol/mokly-sidecar-postcss.md:114`, the first
  sentence of the paragraph about fresh module contexts in "Prepared
  Contexts".
- **Reason:** The sentence is unchanged since #459 (commit `793d0c77d`), so it
  is outside the diff that found it, although that diff widened "attempt" to
  include base attempts.

- **Source:** Review.
- **Category:** Docs or spec.
- **Terms:**
  - **Attempt:** one graph preparation of Serve: a head attempt, at startup
    or after an edit, or a base attempt of a Changes classification.
  - **Preparation:** the optional value of a `bundle` request that starts the
    PostCSS child of its context through a `prepareContext` request before
    the first stylesheet.
- **Background:**
  - "Prepared Contexts" in `docs/protocol/mokly-sidecar-postcss.md` gives the
    rule: the core adds a preparation only for the context of an attempt
    whose configuration names a PostCSS module. A later head attempt must
    also keep a stale PostCSS stylesheet bundle, and only one `bundle`
    request of the attempt carries the preparation.
  - So a later head attempt without a stale bundle, and an attempt without a
    `bundle` request, such as a CSS-only one, prepare no context. Their child
    starts at their first `processCss` request.
  - The paragraph about fresh module contexts starts with "Each attempt
    prepares a new context." Its point is that each attempt uses a new
    context, and that no module, plugin instance, or plugin state passes to
    another context or attempt.
- **Problem:** The sentence says that every attempt prepares, against the
  rule above, because "prepares" is also the word of the preparation rule.
- **Impact if no action:** A reader, or an agent, can take the sentence as a
  requirement to prepare in every attempt and propose a change that starts
  children that no request uses.
- **Root question:** How does the paragraph say that each attempt uses its
  own context, without the word of the preparation rule?
- **Options:**
  - **A.** Change the sentence to "Each attempt uses a new context." Keep the
    rest of the paragraph and the page length. Effort: Small.
- **Left out:** Delete the sentence: the paragraph then loses the rule that
  each attempt has its own context, which the later sentences build on.
  Changing nothing fails the goal. Only one approach is real, because the
  fault is one word.
- **Wider fix:** None. The `documentation` skill already requires one term
  for one thing.
- **Previous examples:** Round 5 of the same branch narrowed the base
  decision line of the same section for the same reason: it named every base
  attempt, but only a `bundle` request carries the preparation.
- **Recommendation:** A. It keeps the meaning and removes the conflict.
- **Action:** fix after merge, apply A, because the sentence is outside the
  diff that found it.

# Classify duplicate callback attributes correctly

- **Severity:** Low (estimate). **Likelihood:** Rare (estimate). **Effort:** Small (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan:
  a problem outside the scope of round 2 of the HTML pipeline decision work
  review, 2026-10-28.
- **Location:** `crates/mokly-html/src/source_checks.rs:21-36`, and the
  caller at `crates/mokly-html/src/javascript.rs:116`.
- **Reason:** The review found the wrong message in code that its change
  did not edit, so the fix needs a separate branch.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Callback output:** the HTML that a JavaScript render callback returns
    through the render sidecar.
- **Background:**
  - `source_checks::validate` reads the HTML tokens before the HTML parser
    drops duplicate attributes.
  - For a duplicate attribute, it fails when the name is a navigation
    attribute: `href`, `data-nav-href`, `data-mokly-link`,
    `data-mokly-target`, or a `data-mokly-link-control…` name. It also fails
    for any name when its `fragment_markers` argument is true, at line 30.
  - `javascript.rs:116` calls it with `fragment_markers` set to true for all
    callback output.
  - The failure is `build-invalid` with the message "duplicate navigation
    attribute {name}", at line 34, for every case.
- **Problem:** A duplicate of an ordinary attribute in callback output, for
  example `class`, fails with "duplicate navigation attribute class". The
  failure is right, but the message names the wrong class of attribute.
- **Impact if no action:** An author looks for a navigation problem that
  does not exist.
- **Root question:** How does a duplicate-attribute failure name the actual
  rule that the output broke?
- **Options:**
  - **A.** Give a non-navigation duplicate in callback output its own
    message, for example "duplicate attribute class in callback output".
    Effort: Small.
  - **B.** Keep the message. Effort: Small.
  - **C.** Classify each duplicate through one shared table of attribute
    classes, which the check and its message both read. Effort: Medium
    (estimate).
- **Left out:** Accept ordinary duplicates in callback output. It removes a
  failure that the code raises today, and the message is the defect.
- **Wider fix:** C. One table keeps the rule and the message in step for
  each later attribute class.
- **Previous examples:** None found.
- **Related:** [reserved-navigation-diagnostic-source.md](reserved-navigation-diagnostic-source.md)
  is about the message of the reserved-navigation check in the same
  function, at line 18. Both items fix wrong wording in one function, so
  one branch can fix both.
- **Recommendation:** A (estimate). It corrects the message with the
  smallest change.
- **Action:** fix after merge, apply A (estimate), because the message is a
  product defect in code outside the reviewed change.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L5591).

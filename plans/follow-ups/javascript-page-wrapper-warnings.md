# Report JavaScript page wrapper attribute warnings

- **Severity:** Medium. **Effort:** Large.
- **Kind:** Fix after merge.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan:
  user item 138, from the F22 decision.
- **Location:** `crates/mokly-html/src/javascript.rs:106-118`,
  `crates/mokly-html/src/ignore_checks.rs:24-34`,
  `crates/mokly-catalogue/src/templates.rs:41-54`, and
  `docs/protocol/mokly-html-screens.md:135-141`.
- **Reason:** On 2026-10-21 the user chose option A as work after the
  merge, not in the rebuild pull request.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Ignore wrapper:** the `mokly-ignore` or `mokly-ignore-scope` element.
    It marks or scopes a region that Changes ignores.
  - **`renderPage`:** the sidecar call that runs a JavaScript `definePage`
    callback and returns a complete HTML document.
- **Background:**
  - `docs/protocol/mokly-html-screens.md:135-141` lists the attributes of
    each ignore wrapper. Unknown attributes warn once per shared body and
    attribute with `html-ignore-attribute`. Strict builds fail.
  - For authored HTML, `templates.rs:41-54` pushes that warning.
  - For callback output, `javascript.rs:117-118` parses the HTML and
    `ignore_checks::filter_tree` removes the unknown wrapper attributes. It
    pushes no warning.
  - The plan gave the cause: the sidecar contract had no warning transport
    for callback HTML. The render and page results now carry a `warnings`
    list, in `crates/mokly-sidecar/src/results.rs:91` and `:104`, and
    `javascript.rs:106` adds those warnings to the entry.
  - On 2026-10-21 the user chose option A, as work after the merge.
- **Problem:** Unknown attributes on ignore wrappers that a `renderPage`
  callback returns are removed with no `html-ignore-attribute` warning.
- **Impact if no action:** The same invalid wrapper warns in an HTML page
  and stays silent in a JavaScript page. A strict build passes for one and
  fails for the other.
- **Root question:** How does one wrapper attribute rule apply to authored
  and callback HTML alike?
- **Options:**
  - **A.** Add warning transport to the sidecar render record. Report one
    `html-ignore-attribute` warning per page callback body and attribute.
    Effort: Large.
  - **B.** Keep callback HTML free of this warning, and limit the warning to
    authored bodies in the protocol. Effort: Small (estimate).
- **Left out:** Parse callback HTML in JavaScript to find the attributes. It
  repeats the Rust HTML checks in a second place.
- **Wider fix:** A. One warning rule then covers authored and callback HTML.
- **Previous examples:** None found.
- **Recommendation:** A. It keeps one warning rule for authored and callback
  HTML.
- **Action:** fix after merge, apply A, because the user chose A on
  2026-10-21 as work after the merge. The recorded grade is Large. Part of
  the transport, the `warnings` list, exists today.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L5800).

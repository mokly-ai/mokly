# Test every axis of Affected links

- **Severity:** Low. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan:
  user item 144, from finding 2 of the 103 C review.
- **Location:** `tests/browser/branch_point_destinations.ts:69-137`,
  `tests/browser/branch_point_affected.ts:190-191`, `:195`, and `:199`, and
  `packages/viewer/tests/affected_comparison.test.ts:127-230`.
- **Reason:** The Rust rebuild merged with this test gap open, and the shared
  helper changes two test suites, so it needs a separate branch.

- **Source:** Review.
- **Category:** Test.
- **Terms:**
  - **Affected link:** a link in a component's Usage section, in Inspect, to
    an entry that uses the changed component. It selects the entry, the
    viewport, the colour scheme, and the comparison.
- **Background:**
  - The browser helper `affectedDestinations` in `branch_point_affected.ts`
    follows each Affected link of the Tally component and checks the page
    that opens.
  - Its fixture `TALLY_AFFECTED`, at `branch_point_destinations.ts:69-137`,
    holds the text, path, listing, comparison, and the shown status and
    outcome lines of each link, but no viewport or scheme.
  - It reads the viewport from the link itself, at line 190. It passes that
    value to the compare modes check `expectAffectedBand`, at line 191, and
    to the frame selector, at lines 195 and 199.
  - The unit file `affected_comparison.test.ts` checks which views offer a
    comparison, at lines 127-201. Its link tests, at lines 218-230, check
    `usageHref` against one fixed route with `viewport=mobile` and
    `scheme=light`.
- **Problem:** The browser test derives its expected viewport from the link
  under test. The unit tests check one axis pair only, so they cannot catch
  a link that ignores its own viewport or scheme.
- **Impact if no action:** An Affected link can open the wrong viewport or
  scheme while both suites pass.
- **Root question:** How do the tests prove that each Affected link opens
  the right entry, axes, comparison, and comparison details text?
- **Options:**
  - **A.** Add independent viewport and scheme values to the fixture.
    Assert each link URL and its comparison details text. Effort: Small.
  - **B.** Add one shared helper with independent destination, axis,
    comparison, and comparison details expectations, and use it in both suites.
    Effort: Medium.
- **Left out:** Read the expected values from the generated link. It repeats
  the current defect. Fewer than three approaches exist, because the choice
  is the scope of the independent expectations.
- **Wider fix:** B. One helper stops both suites from deriving expectations
  from the output.
- **Previous examples:** None found.
- **Recommendation:** B. Shared independent expectations protect every link
  axis.
- **Action:** fix after merge, apply B, because the shared helper changes only
  test code in the browser suite and the viewer unit suite, and it adds no gate.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6099).

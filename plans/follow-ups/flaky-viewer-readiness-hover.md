# Flaky viewer readiness test sees a late hover

- **Severity:** Medium. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-25, from the complete gate of the Storybook
  integration branch `calummoore/mokly-storybook-integration`, after its
  merge of `main` at commit `10a30afe4`.
- **Location:** `tests/browser/viewer_readiness.spec.ts:60-90`: the test
  body. Line 90 holds the assertion that failed.
- **Reason:** The test fails now and then on a branch that does not touch
  it, the viewer, or the frame package, so one fix in its own branch reaches
  every open branch.

- **Source:** Implementation.
- **Category:** Test.
- **Background:**
  - `tests/browser/viewer_readiness.spec.ts` runs four cases. Each case runs
    in the "same-origin" mode and in the "postMessage" mode: "pending
    sibling keeps navigation without automatic inspection" and "unavailable
    sibling keeps navigation without automatic inspection".
  - Each case hovers the "Visible" button in the desktop canvas frame,
    clicks it, and clicks the "Open Action" link. It then polls until the
    viewer harness records one `navigate` event to `action`.
  - Line 90 then asserts that the harness recorded no `error`, `hover`, or
    `click` event: `toEqual([])`.
  - The diff of the failing branch against `main` changed no file under
    `tests/browser/`, `packages/viewer/src`, or `packages/frame/src`.
- **Problem:** The assertion sometimes receives one `hover` event with
  `frame.entryPath` `"action"`, empty `boxes`, and a null `instance`:

  ```text
  Error: expect(received).toEqual(expected) // deep equality
  - Array []
  + Array [
  +   Object {
  +     "name": "hover",
  +     "value": Object {
  +       "boxes": Array [],
  +       "frame": Object {
  +         "entryPath": "action",
  +       },
  +       "instance": null,
  +     },
  +   },
  + ]
      at tests/browser/viewer_readiness.spec.ts:90:9
  ```

  In the complete gate of 2026-11-25, "same-origin unavailable sibling" and
  "postMessage pending sibling" failed, and the other two cases passed. Run
  alone three times with
  `npm run test:browser -- tests/browser/viewer_readiness.spec.ts`, the
  spec passed twice and failed once with one failed case. The next browser
  suite run passed.

- **Impact if no action:** The browser suite fails now and then on any
  branch, and a local complete gate stops there, so the cloud suites after
  it do not run.
- **Root question:** How does the test check that navigation causes no
  automatic inspection, without a result that depends on where the pointer
  rests when the next document loads?
- **Options:**
  - **A.** Move the pointer out of the canvas frame after the click on
    "Open Action" and before the assertion, so that the new document does
    not load under the pointer. Effort: Small.
  - **B.** Filter the assertion to inspection events of the earlier
    document, and accept a `hover` with no `instance` from the new
    document. This weakens the check of the test name. Effort: Small.
  - **C.** Find whether the frame probe should report a `hover` with no
    instance for a document that loads under a resting pointer, and change
    the probe if it should not. Effort: Medium.
- **Left out:** A retry of the test, because it hides the cause. A longer
  wait, because the event comes from pointer position, not from time.
- **Wider fix:** C, when the probe should not report a pointer that did not
  move. Otherwise none, because A fixes only this test.
- **Previous examples:** None found.
- **Recommendation:** A. It removes the dependence on pointer position and
  keeps the full check. Run the spec ten times after the change, as the
  `testing` skill says.
- **Action:** fix after merge, apply A, because the failure is outside the
  scope of the branch that found it.

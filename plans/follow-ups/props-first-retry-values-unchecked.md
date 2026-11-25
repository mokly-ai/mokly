# No check covers the first retry's values

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-25, from the branch
  `calummoore/storybook-milestone-1a-canvas-mockups-omnr`, review round 2.
  The finding check of finding 9 found it outside the review scope.
- **Location:**
  - `tests/browser/component_controls_cases.ts:122-136`, the end of the case
    "component controls show saved, edited, reset, and error states", which
    follows Try again from Render failed.
  - `tests/fixtures/design/expectations.json:1755`, the `viewFacts` table,
    and `tests/helpers/design_view_facts.ts:93-132`, which checks it.
  - `examples/basic/specs/design/canvas/props/states.tsx:13-20`, `PENDING`,
    the view of `design/canvas/props/states`, and `:38-44` and `:69-75`,
    `FAILED` and `EXPIRED`.
  - `examples/basic/specs/design/canvas/props/parts/forms.tsx:45`, where Try
    again of Render failed and Update preview of Preview expired get the
    address of that view.
- **Reason:** The gap lies in the first edit attempt, which the branch does
  not change, and the branch checks only the later attempt that it added.

- **Source:** Review.
- **Category:** Test.
- **Terms:**
  - **Props:** the Inspect section where a reader edits the values that a
    component preview renders.
  - **Edit attempt:** one draft of the props, with the preview that the
    frames keep while it renders or after it fails.
  - **Try again:** the action of a failed render's alert. It renders the same
    draft again, through a pending view.
  - **View facts:** the `viewFacts` rows of
    `tests/fixtures/design/expectations.json`. Each row names a design entry
    and the values that every view of it must show.
- **Background:**
  - The screen `design/canvas/props/states` draws the edit states of Default,
    a saved variant of the Action. Its own view, Updating preview, is the
    pending view of the first edit attempt.
  - In that view the Label field holds the draft, "Get started", from
    `DEFAULT_EDITS.edited`. Both Default frames keep the saved props, with
    the label "Continue", under the status "Updating preview".
  - Two failed views of the first attempt open it. Try again of Render
    failed, `design/canvas/props/states/error`, opens it, and so does Update
    preview of Preview expired, `design/canvas/props/states/expired`. Both
    failed views draw the same draft and the saved props.
  - The browser case "component controls show saved, edited, reset, and
    error states" runs for desktop and mobile, in the Serve suite
    `tests/browser/component_controls.spec.ts` and in the static suite
    `tests/browser/static_component_controls.spec.ts`. It opens Render
    failed and follows Try again. Then it checks only the address and the
    status "Updating preview" of the Default · Light frame.
  - On 2026-11-25 the branch added the pending view of the later attempt,
    `design/canvas/props/states/later-pending`, and the view facts. The
    design catalogue test "Props retries and Storybook Details show the
    expected values", in `tests/design_catalogue.test.ts:235-241`, checks
    them.
  - The row of `later-pending` requires "Start now" in the Label field and
    "Get started" in both Default frames. Other rows check the alert sentence
    of three failed views. No row names `design/canvas/props/states`.
- **Problem:** No check covers the draft and the preview of the first
  attempt's pending view. If `PENDING` showed other values, Try again and
  Update preview would open a view that differs from their failed views, and
  every check would still pass.
- **Impact if no action:** The walkthrough can regress to a pending view that
  drops the draft or the saved preview, and the suite does not notice.
- **Root question:** How do the checks protect the values that the first edit
  attempt keeps through Try again and Update preview?
- **Options:** The letters follow the options of the review finding and of
  its finding check on the source branch, which covered the later attempt.
  - **A.** Add a view facts row for `design/canvas/props/states`: "Get
    started" in the Label field and "Continue" in both Default frames. The
    existing test then checks every view of the entry, with no browser run.
    Effort: Small.
  - **B.** Extend the browser case. After Try again, assert the Label field
    and the Default · Light preview. Also follow Update preview of Preview
    expired. This adds page loads in two suites and two viewports. Effort:
    Small.
  - **C.** Render the failed and the pending views of each edit attempt from
    one record, so that their values cannot differ, and keep a targeted
    check. [props-edit-attempt-records.md](props-edit-attempt-records.md)
    holds the record as its option B. Effort: Medium.
  - **D.** Add a design catalogue check. Each Props alert action that opens
    another design entry must open one with the same field values and
    Default frames. It is a new check, so the user must approve it.
    [props-edit-attempt-records.md](props-edit-attempt-records.md) holds it
    as its option D. Effort: Medium.
- **Left out:** A check of the address alone: it still passes when the
  destination shows other values.
- **Wider fix:** C, which
  [props-edit-attempt-records.md](props-edit-attempt-records.md) records. D
  only detects the class, and it needs the user's approval.
- **Previous examples:** The earlier Storybook mockups, commit `986ba28d2`,
  gave two failures one pending view while their drafts and previews
  differed. On 2026-11-25 the branch checked the later attempt with a view
  facts row.
- **Related:** [props-edit-attempt-records.md](props-edit-attempt-records.md)
  holds the wider fix C and the check D. A guards the values that its record
  must keep, so no options conflict. The branch that applies the record
  keeps the row of A passing.
- **Recommendation:** A. One row of the existing table checks both values in
  every view of the entry. C best keeps the failed and the pending views from
  drifting apart.
- **Action:** fix after merge, apply A, because the first attempt lies
  outside the states that the branch changes.

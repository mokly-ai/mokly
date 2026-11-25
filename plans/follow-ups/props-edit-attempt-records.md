# Props edit attempts are wired by hand

- **Severity:** Medium. **Effort:** Medium. **Confidence:** High. **Harder later:** Yes.
- **Kind:** Fix after merge.
- **Added:** 2026-11-25, from the branch
  `calummoore/storybook-milestone-1a-canvas-mockups-omnr`, review round 1,
  finding 4. It is the wider fix B, which the branch split off its direct
  fix.
- **Location:**
  - `examples/basic/specs/design/canvas/props/parts/forms.tsx:18-30`, the
    `EditState` cases, and `:43-99`, `editOf`, which sets the alert and the
    Try again address of each case.
  - `examples/basic/specs/design/canvas/props/states.tsx:13-75`, the
    `DefaultState` of each edit state.
  - `examples/basic/specs/design/canvas/props/parts/default_state.tsx:16-30`,
    the `DefaultState` shape.
  - `examples/basic/specs/design/canvas/props/parts/values.ts:13-42`, the
    drafts.
  - `examples/basic/specs/design/components/controls/parts/copy.ts:108-119`,
    `SAVED_PREVIEW_COPY`.
  - `docs/protocol/mokly-component-controls-design.md:50-62`, the rules of
    the edit states.
- **Reason:** B changes the shared state shape of every Props edit state,
  beyond the later-edit states that the branch fixed.

- **Source:** Review.
- **Category:** Mockup.
- **Terms:**
  - **Props:** the Inspect section where a reader edits the values that a
    component preview renders.
  - **Edit attempt:** one draft of the props, with the preview that the
    frames keep while it renders or after it fails, the last valid props.
  - **Try again:** the action of a failed render's alert. It renders the same
    draft again, through a pending view.
- **Background:**
  - The screen `design/canvas/props/states` draws the edit states of Default,
    a saved variant of the Action. Its views are Updating preview, Invalid
    value, Values not valid together, Render failed, Later edit failed,
    Updating the later edit, and Preview expired.
  - Each view is a `DefaultState` constant in `states.tsx`: the form state,
    the field values, the preview, and whether a render is pending.
  - The form state names a case of `editOf` in `forms.tsx`. Each case sets
    the copy of the alert and the Try again address by hand.
  - The draft of the first attempt, `DEFAULT_EDITS.edited`, has the label
    "Get started". Its preview is the saved props, with the label "Continue".
    Render failed and Preview expired belong to it. Their action opens its
    pending view, `design/canvas/props/states`.
  - The draft of the later attempt, `DEFAULT_EDITS.later`, has the label
    "Start now". Its preview is the first draft, which rendered. Later edit
    failed belongs to it.
  - The alert sentence names the preview. While the saved props show, it is
    "Your edits are kept. The preview shows the saved props.", from
    `SAVED_PREVIEW_COPY.failedBody`.
  - After an edit rendered, it is "Your edits are kept. The preview shows the
    last valid props.", from `CONTROLS_COPY.failedBody`.
  - So the form states `failed` and `failed-later` differ only in that
    sentence and in their Try again address.
  - On 2026-11-25 the branch also added the `viewFacts` rows of
    `tests/fixtures/design/expectations.json`. The design catalogue test
    "Props retries and Storybook Details show the expected values" reads
    them through `tests/helpers/design_view_facts.ts`.
  - The rows require "Start now" in the Label field and "Get started" in
    both Default frames of `later-pending`. They also require the alert
    sentence of `error`, `invalid`, and `later-edit`. No row names the
    pending view of the first attempt.
- **Problem:** Four facts of one attempt live in three places. The facts are
  the draft, the preview, the sentence, and the Try again address. The places
  are the state constant, the case of `editOf`, and the destinations. Before
  the direct fix, Try again of Later edit failed opened the pending view of
  the first attempt. That view showed "Get started" in the Label field and
  the saved "Continue" in the Default frames. On 2026-11-25 the branch added
  the pending view `design/canvas/props/states/later-pending` and its address
  by hand.
- **Screenshot:** The finding asked for a picture of the Updating preview
  view that Try again opens from Later edit failed. It boxes the Label field
  and the Default preview. No picture was saved. Before the direct fix, that
  view showed the values of the first attempt.
- **Impact if no action:** A new edit state can again link Try again to a
  pending view with other values. The walkthrough then depicts Retry as
  discarding the draft and the last successful preview.
- **Root question:** How does each edit attempt keep its draft and its preview
  through its pending view, its failed view, and Try again?
- **Options:** The letters follow the options of the review finding and of
  its finding check on the source branch. The branch applied A.
  - **A.** Add a pending view and a Try again address by hand for each new
    attempt. The branch did so for the later attempt. Effort: Small for each
    attempt, repeated.
  - **B.** Define one record for each edit attempt. Effort: Medium.
    - The record holds the draft, the preview, and the destinations of its
      pending view and its failed view.
    - The record renders both views, so their values cannot differ.
    - Try again of the failed view opens the pending view of the same record.
    - The alert chooses its sentence from the preview of the record: the
      saved props, or an edit that rendered. So `failed` and `failed-later`
      merge into one form state. The invalid notice can follow the same rule.
    - Preview expired uses the record of the first attempt.
  - **C.** Draw Try again of Later edit failed as a picture with no address,
    as the removed previews draw Retry. Effort: Small.
    - It needs a flag of the `@mokly/ui` controls panel that draws the alert
      action as a picture. A text button without an address renders an
      enabled button, which `tests/helpers/design_rules.ts:110` rejects.
    - It changes the rule "Retry leads back through the pending design state"
      of `docs/protocol/mokly-component-controls-design.md`, so it needs a
      decision.
    - The walkthrough then stops at the failure.
  - **D.** Add a design catalogue check. Each Props alert action that opens
    another design entry must open one with the same field values and Default
    frames. It is a new check, so the user must approve it. It fixes nothing
    alone. The finding check of round 2 proposed the same check again, for
    the later attempt. D also covers the first attempt. Effort: Medium.
- **Left out:**
  - Keeping the address of the first attempt: it drops both values.
  - Making the later edit the canonical pending view: it moves the mismatch
    to Render failed and Preview expired.
  - Removing Later edit failed: the orchestrator of the Storybook support
    plan chose that state on 2026-11-23, to show a failure after an earlier
    edit rendered.
- **Wider fix:** B. D only detects the class, and it needs the user's
  approval.
- **Previous examples:** The earlier Storybook mockups, commit `986ba28d2`,
  also gave both failures one pending view while their drafts and previews
  differed. Commit `54e0a948e` repeated it on the Canvas design.
- **Related:**
  - [storybook-plan-saved-props-copy.md](storybook-plan-saved-props-copy.md)
    plans the removal of `SAVED_PREVIEW_COPY`, which `editOf` reads at
    `forms.tsx:54` and `:62`. Both change the same cases of `editOf`, and no
    options conflict. The branch that comes second adapts them.
  - [props-first-retry-values-unchecked.md](props-first-retry-values-unchecked.md)
    records that no check covers the values of the first attempt's pending
    view, `design/canvas/props/states`. Its option A adds a `viewFacts` row
    for it, and B of this item keeps those values in one record. No options
    conflict. B keeps that row passing.
- **Recommendation:** B. One record per attempt sets the values, the sentence,
  and Try again of its views. So a new attempt cannot open the pending view of
  another attempt.
- **Action:** fix after merge, apply B, because B changes the shared state
  shape of every Props edit state.

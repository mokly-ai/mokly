# Use screen copy for screen evidence

- **Severity:** Low (estimate). **Effort:** Small (estimate).
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan: outside the scope of the W2 viewer review.
- **Location:** `packages/viewer/src/shell/workspace_evidence.tsx:135`,
  `packages/viewer/src/shell/entry_wording.ts:1`,
  `docs/protocol/mokly-component-workspace-design.md:194`, and
  `examples/basic/specs/design/parts/reason_sentences.tsx:20`.
- **Reason:** A viewer review found the wording in a file that its change
  did not touch, and a protocol page states the sentence, so the change
  waits for the user's choice.

- **Source:** Review.
- **Category:** UX wording (estimate).
- **Terms:**
  - **Change reason:** one reason why Changes lists an entry, such as
    `material`, `inputs`, or `metadata`. The evidence panel prints one line
    for each reason.
- **Background:** The `Reason` component of `workspace_evidence.tsx` maps
  each change reason to one fixed line. For the `metadata` reason it prints
  "Page details or saved examples changed." for every entry kind.
  `entry_wording.ts` holds shared Details copy that differs for screens,
  components, and pages.
  - `docs/protocol/mokly-component-workspace-design.md:194` states this exact
    sentence for the `metadata` reason. The design mockup
    `examples/basic/specs/design/parts/reason_sentences.tsx:20` shows it.
    `tests/browser/design_reason_sentences.ts:13` and
    `packages/viewer/tests/details_reasons_presentation.test.tsx:51` pin it.
  - On 2026-10-21 the user chose to put the nouns of each entry kind in one
    place, in `entry_wording.ts`. That choice kept the visible copy the same.
    The protocol still uses "saved example" for a variant at
    `docs/protocol/mokly-component-workspace-design.md:108` and `:115`.
- **Problem:** A screen or a component with changed metadata shows "Page
  details", and the line calls variants "saved examples". The product calls
  them variants.
- **Impact if no action:** The evidence panel uses the wrong entry noun on
  screens and components, and an old term for variants.
- **Root question:** How should the metadata reason name the entry and its
  variants?
- **Options:**
  - **A.** Change the fixed line to words that fit every kind, such as
    "Details or variants changed.". It changes the sentence of
    `mokly-component-workspace-design.md:194` and the design mockup.
    Effort: Small (estimate).
  - **B.** Add the metadata line to `EntryWording`, so that each entry kind
    gets its own noun. It changes the sentence of
    `mokly-component-workspace-design.md:194` and the design mockup.
    Effort: Small (estimate).
- **Left out:** Keeping "saved examples" keeps an old product term.
- **Wider fix:** B. The shared wording for each entry kind removes fixed
  page nouns from this panel.
- **Previous examples:** `entry_wording.ts` already gives screens,
  components, and pages their own Details copy.
- **Related:** [slot-owner-copy.md](./slot-owner-copy.md) has the same
  class: "this page" in the Props slot line for every entry kind. One noun
  source per entry kind would serve both.
- **Recommendation:** B. (estimate) It reuses the existing noun source and
  fixes both words.
- **Action:** ask the user, because condition 1 holds: each option changes
  the reason sentence that `docs/protocol/mokly-component-workspace-design.md:194`
  states, and no recorded user decision changes it.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6728).

# Decision 2 of the viewer checks change

This file holds decision 2 of [the plan](../viewer-checks-from-rust.md) in
full. [decisions.md](./decisions.md) holds decision 1 and the shared terms.
The decision waits for the user. The options check of 2026-11-02 added option
D and changed the recommendation. The pull request of the plan deletes this
file with the plan.

## 2. The core and the viewer apply different rules

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Medium.
- **Source:** Design.
- **Category:** Product bug.
- **Location:** `packages/viewer/src/components/data.ts:40-41`,
  `crates/mokly-model/src/validation.rs:43`,
  `crates/mokly-model/src/public_validation.rs:158-189`,
  `packages/viewer/src/catalogue/references.ts:136-206`,
  `packages/viewer/src/navigation/logical.ts`,
  `crates/mokly-html/src/links.rs:272-284`,
  `crates/mokly-html/src/components.rs:53`, and
  `crates/mokly-catalogue/src/relationships.rs:29-50`.
- **Background:**
  - The investigation of 2026-11-01 and a code search of 2026-11-02 found
    these differences:
    - A schema property named `__proto__`, `constructor`, or `prototype`:
      the viewer rejects it. The core accepts it, but rejects every props
      object with such a key. So the prop can never get a value.
    - A title with leading or trailing spaces: the core rejects it. The
      viewer rejects only a blank title.
      `docs/protocol/mokly-documents.md:45-47` gives the shared title rule.
    - The view rule of removed screens and components: the core applies
      it. The viewer skips it, in `references.ts:204-206`.
    - A stylesheet path: the viewer accepts the suffix `.CSS`, in
      `packages/viewer/src/review/css/stylesheet_path.ts:3`. The core does
      not, in `crates/mokly-model/src/review_validation.rs:193`. These are two
      meanings of one word, so a combined rule set does not choose one.
    - A link path: the viewer checks only its syntax. The core resolves it
      against the linking entry, and rejects a path that leaves the root,
      enters `mokly-generated/`, or is empty.
    - Fragment letters: the core accepts some letters that the viewer
      rejects, such as U+24B6.
    - Instance ids: the core rejects Windows device names, such as `con`.
      The viewer does not. `docs/protocol/mokly-instances.md:34-35` gives
      explicit ids only the kebab-case grammar.
    - `details.sourcePath`: the viewer rejects a path of only spaces and a
      NUL character. The core rejects only an empty path.
    - `relatedDocs`, evidence paths, and the `dependency` reason path: the
      viewer checks them. The core does not.
    - The options of a select control: the viewer checks them. The core
      does not.
    - A lone surrogate escape in a JSON string: the core rejects it. The
      viewer accepts it.
  - On 2026-11-01 the user chose to leave the reserved-name difference
    unchanged until option F.
  - Milestone 2 of the plan finds every other difference.
  - `docs/protocol/mokly-catalogue-serialization.md:106-115` already splits
    one rule by role: the core rejects unknown fields, and a viewer ignores
    them.
  - All options assume that each difference needs a new rejection or one
    less. Source: the text of the options. It holds, because only select
    options allow a writer repair, and
    `plans/follow-ups/select-option-builder.md` already applies one.
- **Problem:** One shared reader applies one rule for each difference. The
  shared reader alone does not choose that rule.
- **Impact if no action:** A catalogue that the core accepts can stay
  unreadable in every viewer. The viewer can accept JSON that the core would
  reject.
- **Root question:** What must the core reject, and what must a viewer
  reject, so that every catalogue that the core accepts opens in every
  viewer, and no viewer shows unsafe data? The options check widened the
  first question, which asked for one rule for each field in both places.
- **Options:**
  - **A.** Apply every rule of either side everywhere. The core then
    rejects what the viewer rejects, with a build error, so no catalogue that
    it writes fails in a viewer. The viewer then rejects what the core
    rejects, also in JSON that the core did not write. Effort: Medium.
  - **B.** Apply the core's rules only. The viewer drops its extra checks
    and gains the core's, such as the trimmed title. The viewer's JavaScript
    must then handle a schema property named `__proto__` safely.
    Effort: Small.
  - **C.** Choose a rule for each difference after the inventory of
    Milestone 2. The milestones after it wait for the answers.
    Effort: Medium.
  - **D.** Split the rules by role. The core applies the rules of both
    sides, with a build error, as in A. A viewer applies a rule only when its
    break makes the data unsafe or the shown content wrong, such as the
    reserved names and the privacy rules. A viewer ignores a rule that only a
    writer needs, such as outer spaces in a title, as it ignores unknown
    fields. The shared reader runs each writer-only rule in strict mode only.
    Each rule of the inventory needs a role. Effort: Medium.
- **Left out:**
  - Apply the viewer's rules only: it breaks the shared title rule of
    `docs/protocol/mokly-documents.md:45-47`, which stays.
  - Accept what either side accepts: it fails the goal, because it drops the
    reserved-name rule that keeps viewer objects safe.
  - A writer that repairs a bad value: only select options allow it, and
    `plans/follow-ups/select-option-builder.md` already does it.
  - A new format number for the new rules: the core's own output meets both
    rule sets, and the project is not in production.
- **Wider fix:** None, because one implementation in decision 1 is the wider
  fix of this class.
- **Previous examples:**
  `plans/follow-ups/reserved-navigation-names-in-authored-html.md` and
  `plans/follow-ups/select-option-builder.md`.
- **Related:**
  - Decision 1 has the same cause. Under its option A, this decision has no
    effect.
  - `plans/follow-ups/select-option-builder.md`: under A or D, the core gains
    the viewer's select-option check. The user chose option E of that item on
    2026-11-02. Its branch should merge first, so that the check adds no
    build error for Storybook catalogues.
- **Recommendation:** D, after the options check. The first recommendation
  was A. D makes the same core change as A, so every catalogue that the core
  accepts opens in every viewer. A viewer then fails only when the data is
  unsafe or wrong, as the always-on rules ask. A protects one simple rule set
  best.
- **Action:** ask the user, because A and D add new build errors in the core,
  and A also adds new rejections in the viewer.

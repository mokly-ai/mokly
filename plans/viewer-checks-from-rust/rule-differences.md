# Decisions 2 and 3 of the viewer checks change

This file holds decisions 2 and 3 of [the plan](../viewer-checks-from-rust.md)
in full. [decisions.md](./decisions.md) holds decision 1 and the shared terms.
Decision 2 is closed. Decision 3 waits for the user. The pull request of the
plan deletes this file with the plan.

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
- **Outcome:** closed on 2026-11-03. The user chose G for decision 1, so the
  viewer checks no catalogue content, and the user confirmed that this
  decision no longer applies. Decision 3 holds the part that stays: the
  TypeScript checks that run outside the viewer's reading.

## 3. The TypeScript checks that stay disagree with the core

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Medium.
- **Source:** Design.
- **Category:** Product bug.
- **Location:** `packages/mokly/src/authoring/components.ts:38` and
  `:80-88`, `packages/mokly/src/authoring/links.ts:19-31`,
  `packages/mokly/src/sidecar/session.ts:140`,
  `packages/viewer/src/shell/control_values.ts:137`,
  `packages/viewer/src/components/data.ts:40-41`,
  `packages/viewer/src/navigation/logical.ts`,
  `crates/mokly-model/src/validation.rs:43`,
  `crates/mokly-model/src/usage_context.rs:54-63`,
  `crates/mokly-html/src/links.rs:272-284`, and
  `crates/mokly-html/src/components.rs:53`.
- **Terms:**
  - **`./data` checks:** the prop-schema checks and the path, link, and
    fragment checks that `@mokly/viewer/data` exports, in TypeScript.
- **Background:**
  - Under option G of decision 1, the viewer checks no catalogue content.
  - Some TypeScript checks stay, because they check what an author writes:
    - The wrapper checks the props of each render before the author's code
      runs. `docs/protocol/mokly-component-props.md:91-93` requires that
      props check. Today the wrapper also checks the schema again, which the
      core already checked once, in
      `crates/mokly-catalogue/src/prepare_parent.rs:80-81`.
    - The wrapper checks an explicit instance id, with its own pattern at
      `components.ts:38`.
    - The link helpers of `@mokly/mokly` check link paths and fragments.
    - The sidecar checks entry paths.
    - Serve's prop editor checks each edit. It also checks the entry's
      schema again, through `validateProps` at `control_values.ts:137`.
  - These differences exist between the TypeScript checks and the core:
    - A schema prop named `__proto__`, `constructor`, or `prototype`: the
      TypeScript schema check rejects it. The core accepts it. Both reject
      such a key in a props value, as
      `docs/protocol/mokly-component-props.md:59-61` requires.
    - Fragment characters: the core accepts symbols such as U+24B6, the
      circled capital A. TypeScript rejects them, as
      `docs/protocol/mokly-navigation.md:82-83` requires. Here the core
      breaks the doc.
    - An explicit instance id such as `con`: the core rejects it. The
      wrapper accepts it, as `docs/protocol/mokly-instances.md:34-35`
      allows. Here the core breaks the doc.
    - The TypeScript value check counts the size of a value in another way
      than the core, so a large or deep value can pass one and fail the
      other.
  - `@mokly/mokly` keeps using the `./data` exports `validateProps`,
    `isLinkPath`, and `isLogicalFragment` to check author input.
  - Under G, a difference can cause a confusing error at build time. It can
    no longer make a catalogue unreadable in a viewer.
- **Problem:** An author's component or link can pass one check and fail the
  other. Each later rule change needs a Rust change and a TypeScript change.
- **Impact if no action:** Authors keep getting errors from two checks that
  disagree. For example, a component can pass the core's schema check and
  then fail at every render.
- **Root question:** How does each prop and each link that an author writes
  get one clear answer, early, that the core's later check never reverses?
  The options check of 2026-11-03 widened the first question, which assumed
  that the TypeScript checks stay and that the core's rules win.
- **Options:** The options check of 2026-11-03 added F to J.
  - **A.** Change nothing. Effort: Small.
  - **B.** Make each TypeScript check follow the core's rule where it can,
    and run one shared set of test cases through both sides. The core also
    rejects a schema prop named `__proto__`, `constructor`, or `prototype`,
    which is a new build error. The fragment and instance id rules then
    leave their protocol docs, which must change. Effort: Medium.
  - **C.** Apply B without the new core rule. The TypeScript schema check
    then accepts such a prop name. Effort: Medium.
  - **D.** Drop the wrapper's early props check, and rely on the core's check
    after each render. It changes `docs/protocol/mokly-component-props.md:91-93`.
    Authors can get a crash in their own code in place of a clear prop
    error. Workspace 463 removes the core's check of its written output, so
    D also needs a core check of recorded props that stays. Effort: Medium.
  - **E.** Give the wrapper the core's own prop checker in Node as a `.wasm`
    file. That needs the trial's two `jsonschema` patches, or a second Rust
    validator. It brings back the Rust-to-WebAssembly build. Effort: Large.
  - **F.** Take the side that rejects less, where that is safe, and run B's
    shared test cases through both sides. No build gets a new error.
    Effort: Medium.
    - The TypeScript schema check accepts a schema prop named `constructor`,
      as the core does. Both sides still reject that key in a props value.
    - TypeScript accepts the core's wider set of fragment characters, and
      `docs/protocol/mokly-navigation.md:82-83` changes to match.
    - The core accepts an explicit instance id such as `con`, as
      `docs/protocol/mokly-instances.md:34-35` allows.
  - **G.** Apply F. Also check each schema only once, in the core, when it
    accepts the definition. The wrapper and Serve's prop editor then check
    only the props value against that schema, with a new value check in
    `./data`. The wrapper can then never reject a schema that the core
    accepted. Effort: Medium.
  - **H.** Apply D, but report the prop error first when a render fails. The
    sidecar returns the instances that it recorded before the crash, and the
    core checks their props before it reports the crash. The author's code
    still runs with bad props, and the sidecar's error answer changes. Like
    D, it needs a core check of recorded props that stays. Effort: Medium.
  - **I.** Apply E as a native Node addon in the five `@mokly/native-*`
    packages. It runs the core's own validator with no patches. It adds a
    native build for each platform. Serve's prop editor keeps its
    TypeScript copy. Effort: Large.
  - **J.** Apply I, and give Serve's prop editor the core's validator as a
    module that only Serve loads. Every prop check then uses one copy. It
    brings back the WebAssembly build and the two patches, for Serve only.
    Effort: Large.
- **Left out:**
  - Ship the Rust checks to every browser delivery: J is better on every
    point, because only Serve runs live edits.
  - Generate the TypeScript checks from Rust: the differences are in the
    logic and in where each rule runs, not in lists that a generator writes.
  - Call the core from the wrapper during a render: React renders the
    component synchronously, and the sidecar sends the core only answers and
    events.
- **Wider fix:** J for the prop rules, because one copy of the core's
  validator cannot drift. The path and fragment grammar keep two copies
  under every option.
- **Previous examples:** Decision 2 of this plan, and
  `plans/follow-ups/reserved-navigation-names-in-authored-html.md`.
- **Related:** Decision 2, which the answer to decision 1 closed. This item
  holds its leftover. `plans/follow-ups/wrapper-plain-data-error-code.md`
  holds a bug that the options check found in the same wrapper code.
- **Recommendation:** G, after the options check. The first recommendation
  was B. G removes the real differences with no new build error, and the
  wrapper can never again reject a schema that the core accepted. B adds a
  build error and moves two rules away from their protocol docs.
- **Action:** ask the user, because the options change protocol rules and
  have real trade-offs.

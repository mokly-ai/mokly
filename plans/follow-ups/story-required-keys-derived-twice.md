# Story required keys are derived twice

- **Severity:** Low. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-24, from the implementation review of pull request
  #492, branch `conductor/storybook-support-b-story-reading`, finding 6 of
  round 1.
- **Location:** `crates/mokly-catalogue/src/prepare_parent.rs:36-40`, the
  story branch that picks the props for inference, and `:43-53`, the call of
  `infer` and the story override of `required`.
  `crates/mokly-catalogue/src/prepare_entry.rs:120-124`, the story branch
  that picks the props for validation. `crates/mokly-model/src/inference.rs:1`
  and `:8-14`, the function `infer` and its comments.
  `crates/mokly-model/README.md:131` and `crates/mokly-catalogue/README.md:244-245`.
- **Reason:** The orchestrator merged pull request #492 before its review
  findings were fixed, and asked for each open finding as an item.

- **Source:** Review.
- **Category:** Code structure.
- **Terms:**
  - **Complete props:** the props that an entry or a variant renders with.
    An ordinary variant's complete props are the entry's props with its
    top-level keys replaced. A story variant's complete props are its own
    story's data args.
- **Background:**
  - On 2026-11-23 the plan's orchestrator decided that a story variant's
    props are only its own data args, and that a top-level key of a stories
    entry is required only when every included story sets it.
  - `infer(own, merged_variants)` in `crates/mokly-model/src/inference.rs`
    computes the schema of all prop sets. Its helper `objects` already marks
    the keys that every set contains as required. Then `infer` replaces that
    list with the keys of `own`.
  - For an ordinary entry, the two lists are equal, because merging only
    adds keys.
  - For a stories entry, `prepare_parent.rs` passes each story's own props
    and then computes the common keys again, in a story override of
    `required`. `prepare_parent.rs` and `prepare_entry.rs` each have their
    own `if story` branch that picks the complete props.
  - The output, the order of `required` included, is the same for every
    path today, because each calculation walks sorted keys.
- **Problem:** Three places decide the story case: two branches that pick
  the complete props, and one override of `required`. The shared inference
  code computes the common keys and then throws them away.
- **Impact if no action:** A later change of one branch or of the
  inference can give a stories entry's schema and its validation different
  props, with no test to catch it.
- **Root question:** How does Mokly decide each variant's complete props and
  its required keys in one place, for stories and for other entries?
- **Options:**
  - **A.** Keep the result of `objects` in `infer`, and remove both
    overrides. Add a case with a parent-only key to the existing test in
    `crates/mokly-model/src/_tests_/inference_tests.rs`. The two `if story`
    branches stay. Effort: Small.
  - **B.** Resolve each variant's complete props once at the catalogue
    boundary, and give inference and validation those same sets through an
    interface that does not tell parent props from variant props. Remove
    both overrides and both branches. Effort: Medium.
  - **C.** Change `infer` to take one list of complete prop sets and return
    the result of `objects`, and update its callers:
    `crates/mokly-catalogue/src/prepare_parent.rs:43`,
    `crates/mokly-cli/src/_tests_/build_tests.rs:84`, and
    `crates/mokly-model/src/_tests_/inference_tests.rs:14` and `:36`. The two
    branches stay, so a later change of one branch can still give inference
    and validation different props. Effort: Small.
- **Left out:** A separate story inference function keeps two copies of the
  rule. A parameter on `infer` that selects parent keys or common keys: A
  is better on every point, because the two give the same result for merged
  sets. A test that the two calculations agree: both calculations stay.
  Inference in the sidecar breaks the rule that the Rust core infers the
  schema.
- **Wider fix:** B. One step resolves each variant's complete props for both
  inference and validation, so a later story rule cannot split them.
- **Previous examples:** Commit `f08d02df` removed viewer calculations of
  values that the core already provided.
- **Related:** `plans/follow-ups/variant-props-docs-say-merged.md`, the same
  cause in the protocol docs. Use its term "complete props" in the `infer`
  comments and in the two README lines. Neither fix waits for the other.
- **Recommendation:** B. It is the structural fix. `mokly-model` has
  `publish = false`, and only `prepare_parent.rs` and two test files call
  `infer`. No option changes behaviour, so no option needs a new test;
  `tests/storybook_strict_build.test.ts:65-79` already fails when the
  inference requires a key that only the first story sets.
- **Action:** fix after merge, apply B, because the pull request merged
  before its review findings were fixed. Each option must also correct
  `crates/mokly-model/README.md:131`, which says that `infer` builds schemas
  "from own and merged variant props", and the `infer` comments.

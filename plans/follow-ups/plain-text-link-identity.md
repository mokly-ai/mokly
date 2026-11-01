# Separate plain-text link existence from content identity

- **Severity:** Low. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan: option C of finding 2 of the decision work review of 2026-10-26, kept as a possible later change.
- **Location:** `crates/mokly-graph/src/planning_resources.rs:75`,
  `crates/mokly-graph/src/planning_resources.rs:139`, and
  `docs/protocol/mokly-documents.md:134`.
- **Reason:** On 2026-10-28 the user fixed the review finding with option A
  and left option C undecided as a possible later change.

- **Source:** Review.
- **Category:** Performance.
- **Terms:**
  - **Document key:** the identity of one rendered document. Serve and the
    static output reuse a render while its key stays the same.
  - **Plain-text link target:** a repository file that a Markdown link
    names and that the document shows only as its link text.
- **Background:** A Markdown document key includes the local files that
  its links reach. `docs/protocol/mokly-documents.md` sets two rules. A
  linked source file joins the private source inventory, and its edits and
  removals render the document again. A linked Markdown file under `plans/`
  keys only on whether it exists. `planning_resources.rs` applies that
  second rule by path, with the `planning-document` fact.
- **Problem:** The existence-only key is a special case for one path
  prefix. Every other plain-text link target keys on its content, although
  the document shows only the link text. So an edit to a linked source file
  changes the document key and the deployment identity without a change in
  output.
- **Impact if no action:** The `plans/` special case stays. Any later
  extension of the rule must decide again which targets need content, and a
  wrong choice can miss an asset content change.
- **Root question:** Which changes to a plain-text link target should change
  the document key?
- **Options:**
  - **A.** Keep the `plans/` special case and the current keys. The user
    chose this for the review finding on 2026-10-28. Effort: Small.
  - **B.** Check once for each generation, outside the render cache, that
    each plain-text link target exists. Then no plain-text target needs a
    key input. Effort: Medium.
  - **C.** Give every plain-text link target separate content and existence
    inputs, and remove the `plans/` special case. Preparation must then
    decide which targets are resources. A missed resource would stop an
    edited asset from changing its document key. This changes the source
    target rule of the documents protocol. Effort: Medium.
- **Left out:** Keying every target only by existence hides edits to linked
  assets, so it fails the goal.
- **Wider fix:** C. It models both reasons why a document key must change,
  for every target.
- **Previous examples:** A planning link once changed one document's two
  scheme keys and the deployment identity. On 2026-10-26 a user decision took
  `plans/` Markdown out of document identity, in `735c7d2e`. Next,
  a removed plan kept a warm Serve render while a fresh build failed with
  `link target ... does not exist`. The user's fix of 2026-10-28, in
  `e236ea78`, keyed each linked plan by existence.
- **Recommendation:** C. It removes the path special case. The
  review that found the problem named C as the best protection.
- **Action:** ask the user, because C changes the rule of
  `docs/protocol/mokly-documents.md` that edits of a linked source file render
  the document again.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L5543).

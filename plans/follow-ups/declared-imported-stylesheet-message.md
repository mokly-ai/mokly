# Name the importer of a declared stylesheet

- **Severity:** Low (estimate). **Effort:** Small (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-10-31, from the branch
  `conductor/built-repository-packages-in-changes`. A finding check of its
  first review found it outside the scope.
- **Location:** `crates/mokly-render/src/declarations.rs:79-85`,
  `crates/mokly-render/src/error.rs:38-47`,
  `crates/mokly-graph/src/public_denial.rs:41-43`, and
  `crates/mokly-graph/src/graph.rs:249-256`.
- **Reason:** That branch changed neither this check nor its text.

- **Source:** Review.
- **Category:** UX wording.
- **Terms:**
  - **Declared stylesheet:** a CSS file that a component lists in the
    `stylesheets` field of its `defineComponent` registration.
  - **Listed authoring input:** the public-file policy denial for a file in
    the source inventory, such as a CSS file that a JavaScript module
    imports.
- **Background:** `docs/protocol/mokly-component-stylesheets.md` forbids a
  declared stylesheet that a module import makes private, except when the
  file is also configured. `declarations.rs` checks this with the public-file
  policy, and `graph.rs` checks the same root again after CSS collection. A
  failure prints this message:
  `component {component} stylesheet {path}: listed authoring input`.
- **Problem:** The message names neither the module that imports the file
  nor a recovery. An author who adds a `stylesheets` entry for a file that a
  component already imports gets no hint about what to change.
- **Impact if no action:** The author must search the module graph to learn
  why the declaration fails.
- **Root question:** How does the failure tell the author which import makes
  the file private, and what to do?
- **Options:**
  - **A.** Keep the message. Effort: Small.
  - **B.** Name the importing module and one recovery: remove the
    `stylesheets` entry, or the JavaScript import. The policy needs the
    importer for each listed file. Effort: Medium.
  - **C.** Name only the recovery, without the importer. Effort: Small.
- **Left out:** A warning that ignores the declaration, because it breaks the
  rule that source protection is not graceful.
- **Wider fix:** None found.
- **Previous examples:** None found.
- **Recommendation:** C. One recovery action helps at once, with no new
  data in the policy.
- **Action:** ask the user, because condition 6 of the decision test holds:
  a UX wording choice that no copy rule settles waits for the user.

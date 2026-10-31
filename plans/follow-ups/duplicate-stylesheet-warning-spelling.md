# Duplicate stylesheet warning names the kept spelling

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-31, from the branch
  `conductor/built-repository-packages-in-changes`, review finding 3.
- **Location:** `crates/mokly-render/src/declarations.rs:96-104`,
  `docs/protocol/mokly-component-stylesheets.md:188-190`,
  `crates/mokly-render/tests/integration/declaration_alias_tests.rs:1-57`,
  and `crates/mokly-render/tests/integration/declared_stylesheet_tests.rs:181-202`.
- **Reason:** The component stylesheet contract states the warning text,
  and a test on `main` pins it, so a new text needs the user's decision.

- **Source:** Review.
- **Category:** UX wording.
- **Terms:**
  - **Declared stylesheet:** a CSS file that a component lists in the
    `stylesheets` field of its `defineComponent` registration. Mokly links
    it in each document that renders the component.
  - **Duplicate warning:** the `duplicate-component-stylesheet` build
    warning. Mokly gives it when one component lists one real file twice.
- **Background:** Mokly groups the declared values of a component by the
  real file that each value names. It keeps the first value, links the file
  once at that position, and gives the duplicate warning for each later
  value. The text is
  `duplicate component stylesheet "{path}" is ignored; it is linked once.`,
  and `{path}` is the first authored value.
  `docs/protocol/mokly-component-stylesheets.md` states this text. Since
  2026-10-31 a declared value may use `.`, `..`, and empty segments, so
  `../styles/declared.css` and `../styles/./declared.css` name one file.
  Before that, two spellings of one file needed a symbolic link, as in
  `declaration_alias_tests.rs`.
- **Problem:** When the two spellings differ, the warning names the kept
  first spelling and says that it is ignored. Mokly ignores the later
  spelling, which the warning does not name.
- **Impact if no action:** An author who searches the component for the
  named value finds the entry that Mokly links. The warning does not name
  the entry to remove.
- **Root question:** How does the duplicate warning identify the entry that
  Mokly ignores, so that the author can remove it and keep the link order?
- **Options:**
  - **A.** Keep the text. Effort: Small.
  - **B.** Name the ignored spelling instead of the first one. The text then
    means what it says. Update the contract sentence, the test in
    `declared_stylesheet_tests.rs`, and the test and the module comment in
    `declaration_alias_tests.rs`. Effort: Small.
  - **C.** When the spellings differ, name both the ignored spelling and the
    kept one. Keep today's text for equal spellings. Update the contract and
    the same tests. Effort: Small.
  - **D.** Name the ignored entry by its spelling and by its position in the
    `stylesheets` array, and name the position of the kept entry, for
    example
    `duplicate component stylesheet "./a.css" at stylesheets[2] is ignored; stylesheets[0] links the file once.`
    One form covers equal and
    different spellings. The example in `docs/protocol/mokly-build-warnings.md`
    changes too. Effort: Small.
- **Left out:**
  - A build error for a second spelling of one file, because it breaks the
    graceful-handling rule and adds stricter validation.
  - Keep the last entry instead of the first, because the first entry sets
    the link position and the bundle route.
  - Name the repository path of the file, because the ignored entry need not
    contain that text.
- **Wider fix:** None. One place in the code produces this warning.
- **Previous examples:** `declaration_alias_tests.rs` on `main` pins the
  first spelling for two spellings of one file through a symbolic link.
- **Recommendation:** B. It names the entry to remove with one changed
  value, as the duplicate-match error of the configuration loader names the
  later entry.
- **Action:** ask the user, because condition 1 of the decision test holds:
  options B, C, and D change the warning text that the component stylesheet
  contract states and that a test on `main` pins.

# Remove parser mechanics from the HTML screens protocol

- **Severity:** Low (estimate). **Effort:** Small (estimate).
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan:
  a problem outside the scope of the re-review of the HTML pipeline
  implementation review of 2026-10-28.
- **Location:** `docs/protocol/mokly-html-screens.md:71`.
- **Reason:** The review found the sentence in a protocol page that its
  change did not edit, so the fix needs a separate docs branch.

- **Source:** Review.
- **Category:** Docs or spec.
- **Terms:**
  - **Protocol page:** a page under `docs/protocol/` that states the
    requirements and decisions in force, not implementation details.
- **Background:**
  - `docs/protocol/mokly-html-screens.md` defines HTML screens, components,
    and their template language.
  - Line 70 already states the observable rule: a component body uses the
    same template language as a screen.
  - Line 71 starts with "One parser and one renderer serve both." The rest
    of the line states behaviour. Checks and warnings read each body in the
    parser's text modes, with scripting disabled, so raw text holds no
    elements.
  - The crate READMEs already describe the shared parser driver, for
    example `crates/mokly-catalogue/README.md:113`.
- **Problem:** The first sentence of line 71 describes how the code is
  built, not a result that a user can observe.
- **Impact if no action:** The protocol page keeps a mechanic that can go
  stale when the code changes, against the documentation rules.
- **Root question:** What does the HTML screens contract need to say about
  parsing?
- **Options:**
  - **A.** Delete the sentence, and keep the rest of line 71. Effort: Small.
  - **B.** Replace it with an observable rule, for example "Screens and
    components follow the same checks." Effort: Small.
- **Left out:** Move the sentence to a crate README. The READMEs already
  describe the shared driver, so a copy adds nothing. Fewer than three
  approaches exist, because the only choice is whether a replacement
  sentence is needed.
- **Wider fix:** None. The `documentation` skill already says that protocol
  pages hold no mechanics.
- **Previous examples:** Commit `89c12ef1` of PR #218 removed mechanics from
  many protocol pages.
- **Related:** [ci-timing-protocol-mechanics.md](ci-timing-protocol-mechanics.md)
  records the same class on another protocol page. One docs branch can fix
  both, and each item stays valid alone.
- **Recommendation:** A (estimate). Line 70 and the rest of line 71 already
  state the observable rules.
- **Action:** fix after merge, apply A (estimate), because the content is
  implementation detail, and the page is outside the reviewed change.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L5619).

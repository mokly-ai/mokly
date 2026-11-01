# Let the parser choose the plaintext point

- **Severity:** Low. **Effort:** Large. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan: user item 98, engine review 2 finding 2, with user decisions 98 B, 147 B, and the one-tokenizer decision.
- **Location:** `crates/mokly-html/src/normalization.rs:88`,
  `crates/mokly-html/src/serialize.rs:50`, and
  `crates/mokly-html/src/text_mode.rs:1`.
- **Reason:** On 2026-10-21 the user chose option B as work outside the merge
  of PR #199, and confirmed its serializer part on 2026-10-28.

- **Source:** Review.
- **Category:** Code structure.
- **Terms:**
  - **`plaintext` element:** an HTML element after which the HTML parser
    reads the rest of the document as raw text.
  - **Repair id:** the private `data-mokly-normalize` attribute that
    normalization puts on elements, so that it can find each element again
    after a parse.
- **Background:** Normalization handles the plaintext point as follows.
  - `normalization::reparse` serializes a composed document and parses the
    bytes as a browser would. Then it restores Mokly's regions by repair id.
  - Text after a `plaintext` start tag must be written raw, and text before it
    escaped.
  - `serialize::document` predicts that point with its own text-mode rules in
    `text_mode.rs`.
  - `reparse` checks the prediction: the parse must confirm the predicted
    `plaintext` element and each raw-text start by repair id.
  - Otherwise it serializes again with all text escaped and prediction off.
- **Problem:** The serializer still predicts the plaintext point instead of
  reading it from the parser. Four review findings and fixes of the rebuild
  found cases where the prediction and the parser disagreed. One example is
  commit `b0842cad` of 2026-10-20, which fixed repaired foreign SVG end tags.
- **Impact if no action:** The prediction keeps a copy of parser rules.
  Each new case of divergence needs another prediction fix, and the escaped
  retry hides the case until a review finds it.
- **Root question:** How should serialization learn where the HTML parser
  enters plaintext mode?
- **Options:**
  - **A.** Keep the fail-safe check that retries with all text escaped when
    the parser disagrees. A fix round of the rebuild applied it.
    Effort: Small.
  - **B.** Serialize first with all text escaped. Find the first HTML
    `plaintext` element in that parse by its repair id. Write raw text only
    after it. Effort: Large.
- **Left out:** Only two approaches exist: predict the parser's choice and
  check it, or let the parser choose. A is the first, and B is the second.
- **Wider fix:** B. The parser alone decides the text mode, so no copy of
  its rules can drift.
- **Previous examples:** The rebuild already moved the other text-mode
  choices to the parser. The source-identity redesign, which gives each
  element its source position, landed in `dc4d8127`. On 2026-10-22 the
  work under option B moved to the post-merge set. On 2026-10-26 the user
  chose one tokenizer run for the catalogue checks and the tree. `3c90b1e1`
  landed it, so html5ever's tree builder now chooses every text mode.
- **Recommendation:** B. The user chose it, and it removes the last place
  where Mokly predicts a parser decision.
- **Action:** fix after merge, apply B, because the user chose B on
  2026-10-21 as non-blocking work and confirmed its serializer part on
  2026-10-28.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L5455).

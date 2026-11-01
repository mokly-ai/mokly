# Empty end tags misplace substitution errors

- **Severity:** Low. **Likelihood:** Rare. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-01, from branch
  `conductor/rust-rebuild-87-diagnostics-and-html-messages`, finding 9 of its
  implementation review.
- **Location:** `crates/mokly-catalogue/src/html_source_map.rs:80` and
  `:115`, `crates/mokly-catalogue/src/templates.rs:139`, and
  `crates/mokly-html/tests/source_map_corpus_tests.rs:66` and `:81-84`.
- **Reason:** The defect needs malformed HTML, an empty end tag after text,
  and its fix changes no stored format or interface, so it costs the same
  after the merge.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Substitution:** a `{{...}}` expression in an authored HTML body that
    Mokly replaces with a prop value.
  - **Source map:** the `SourceMap` record in
    `crates/mokly-catalogue/src/html_source_map.rs`. It maps each decoded
    byte offset of a text token or an attribute value to a byte of the
    authored source.
  - **Empty end tag:** the malformed markup `</>`. The HTML tokenizer
    discards it and reports a `MissingEndTagName` parse error.
- **Background:**
  - `docs/protocol/mokly-html-screens.md:201` requires that, in a body, a
    `{{…}}` failure names the line and column of its own `{{`, also in an
    attribute value, after character references, and after CRLF or CR line
    ends.
  - `templates.rs:134-139` reports an undeclared prop in a substitution at
    `value.source_offset(start)`, the source byte that the source map gives
    for the decoded offset of the substitution.
  - The source map is sparse. The recorder records a breakpoint at the end
    of each chunk that html5gum 0.8.4 emits, before the callback emitter
    joins the chunks of one text token. Inside a chunk, a walk aligns the
    source bytes and the decoded bytes. A chunk that does not align, such as
    a character reference, maps each offset to its first source byte. This
    design keeps the html5gum-compatible token spans, and it has no second
    character-reference decoder. Both are decisions of 2026-10-28 and
    2026-11-01 that stay in force.
  - `Buffer::begin`, at `html_source_map.rs:80-86`, moves the start and the
    alignment cursor `end` only when no decoded byte is buffered yet.
    `Buffer::record`, at `html_source_map.rs:111-141`, aligns each new chunk
    from `end`, the source byte after the previous chunk.
  - In the Data state, html5gum discards an empty end tag, reports only a
    `MissingEndTagName` error, and keeps the text buffered, at
    `machine.rs:187-199` of html5gum 0.8.4. The text before and after the
    empty end tag is one text token. html5gum calls `init_string`, which
    calls `Buffer::begin` through `Recorder::init_string`, before each Data
    and RCDATA chunk, at `machine.rs:29` and `:57`.
- **Problem:** After an empty end tag, the next chunk does not start where
  the previous chunk ended. `Buffer::begin` ignores the new position,
  because text is already buffered. `record` then aligns the next literal
  chunk from the discarded tag, so each later offset in the token maps to
  the wrong source byte.
- **Evidence:** Catalogue preparation, the public interface, reports these
  locations for `specs/home.screen.html` with the front matter
  `---`, `title: Home`, `---` on lines 1 to 3:
  - `<p>a</>`, then `{{missing}}</p>` on line 5: `4:5`, not `5:1`.
  - `<p>a</>{{missing}}</p>` on line 4: `4:5`, not `4:8`.
  - A gap followed by three lines of text: `4:5` for a substitution at
    `7:11`.
  - Two empty end tags, a brace that a character reference produces after
    the gap, and a second substitution after a gap also give wrong
    locations.
  - `<p></>{{missing}}</p>` gives the right location, because no text is
    buffered before the gap.
  - `origin/main` before the source maps also gave wrong locations for
    these inputs, but different ones, such as `4:6` for the two-line case.
  - In 923,521 generated inputs, every location mismatch came from an empty
    end tag.
- **Test premise:** The corpus property test
  `corpus_source_maps_are_monotonic_bounded_and_preserve_aligned_bytes`, an
  integration test of `mokly-html`, treats a value as plain when its source
  range has no `&`, CR, or NUL, at
  `crates/mokly-html/tests/source_map_corpus_tests.rs:66`. For a plain value
  it asserts `offset == range.start + decoded`, at `:81-84`. A discarded empty end tag
  breaks that premise: the assertion accepts the wrong offset of `b` in
  `a</>b` today, and it rejects the correct offset after the fix. The
  vendored corpus has no empty end tag, so the test passes now.
- **Impact if no action:** A diagnostic can name the wrong line and column.
  The author must find the failed substitution by hand.
- **Root question:** How should every substitution error name its own
  source characters?
- **Options:**
  - **A.** Skip the discarded empty end tag before the next literal chunk is
    aligned, and add a regression case for both line layouts. This handles
    the reproduced syntax only. It must not skip `</>` that RCDATA text or an
    attribute value keeps as text. Effort: Small.
  - **B.** Record the source start of each emitted chunk before the chunks
    are joined. Keep the discontinuities in the existing sparse source map,
    keep the compatibility spans, and add the reproduced cases as
    regression tests. A probe showed the change: in `Buffer::begin`, when
    the value continues, set `self.end = self.end.max(position)`. The probe
    fixed all 11 probe inputs, kept every `mokly-catalogue` test and the 114
    `mokly-html` unit tests green, and gave no mismatch in 923,521
    generated inputs or in the vendored corpus. Also correct the premise of
    the corpus test, so that a value is plain only when its source bytes
    equal its decoded bytes, and keep both assertions. Effort: Small.
  - **C.** Store an explicit source offset beside every decoded byte, from
    the same chunk starts, and keep the compatibility spans. This uses more
    memory and replaces the sparse representation. Effort: Medium.
- **Left out:**
  - Change nothing. Substitution errors keep the wrong characters.
  - Search the source for literal braces. Character references can produce
    the braces.
  - Flush the tokenizer's text buffer at discarded syntax. It changes the
    compatibility spans that the decision of 2026-11-01 keeps, and it splits
    one text token into two, so the slot check runs twice.
  - A hook on the tokenizer's missing-end-tag-name error, at
    `crates/mokly-catalogue/src/html_driver_events.rs:222`. B is as small
    and also covers other skipped bytes.
  - A fork or an upstream change of html5gum that reports each chunk start.
    B reads the same start from a call that exists now.
  - A forward search for the next brace in `templates.rs`. A stray brace
    earlier in the same chunk gives the wrong location.
  - A corpus property that rejects every unaligned byte that does not map to
    `&` or NUL. It is a detection fix and a test for the class, and B
    removes the wrong case.
- **Wider fix:** B. Chunk origins keep every gap in the consumed source
  without a second character-reference decoder.
- **Previous examples:** Commit `02eec937` fixed diagnostic locations in raw
  text and after CDATA sections. No earlier empty-end-tag case was found.
- **Recommendation:** B. It corrects the shared mapping, so later
  diagnostics also survive discarded source gaps. C needs the same chunk
  starts and uses more memory.
- **Action:** fix after merge, apply B, because the defect needs malformed
  HTML and the fix changes no stored format or interface.

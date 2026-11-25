# A lone surrogate stops the whole build

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-25, from the implementation review of the branch
  `calummoore/storybook-track-b-finish-ekj1`, round 1, outside the scope.
- **Location:** `crates/mokly-sidecar/src/wire.rs:175-182`, `decode`, which
  turns the payload of a reply into its typed result.
  `crates/mokly-sidecar/src/error.rs:155-160`, the `Json` protocol error with
  the text `invalid JSON frame`. `packages/mokly/src/sidecar/json.ts:2-12`,
  `jsonText`, which writes each string with `JSON.stringify`.
  `packages/mokly/src/sidecar/story-parameters.ts:21` and `:33`, which avoid
  the failure for parameter paths with `toWellFormed()`.
  `docs/protocol/mokly-sidecar.md:200`, the `sidecar-protocol` row of the
  fail-closed rules.
- **Reason:** The failure is older than the branch that found it, and the
  recommended fix adds a build warning, which waits for the user.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Lone surrogate:** a UTF-16 code unit from U+D800 to U+DFFF without its
    pair. A JavaScript string can hold one. A Rust string cannot.
  - **Describe result:** the reply of the sidecar that lists the catalogue
    definitions of one bundle generation, with their authored text.
  - **Frame:** one JSON message between the core and the sidecar.
- **Background:**
  - The sidecar answers each request with one frame. `jsonText` in `json.ts`
    writes each string with `JSON.stringify`, which writes a lone surrogate as
    an escape such as `\ud800`.
  - The core decodes the payload of each reply with `serde_json` in `decode`.
    `serde_json` rejects the escape of a lone surrogate, because a Rust string
    cannot hold one.
  - The decode error becomes the protocol error `invalid JSON frame`. The
    fail-closed rules of `docs/protocol/mokly-sidecar.md` give
    `sidecar-protocol` for a malformed frame: `build-invalid`, and the sidecar
    is replaced.
  - The describe result carries authored text: titles, tags, descriptions,
    and the keys and values of props and story args. A lone surrogate can come
    from a string that cuts an emoji in half, such as
    `"\u{1F600}".slice(0, 1)`, or from an escape in source text.
  - `docs/protocol/mokly-sidecar-definitions.md` already says that an invalid
    authored schema fails with its own diagnostic, not `sidecar-protocol`, and
    does not replace a healthy sidecar.
  - The paths of the `mokly` parameter avoid this failure with
    `toWellFormed()`, which replaces each lone surrogate with U+FFFD.
  - The same decoder reads every reply, so a render result with such a string
    fails in the same way, by a read of the code.
- **Problem:** One lone surrogate in any string of the describe result stops
  the whole build with `invalid JSON frame`, and the message names no story,
  field, or value. A probe with a lone surrogate in a malformed key of the
  `mokly` parameter, before its paths used `toWellFormed()`, failed with
  `[mokly/build-invalid] invalid JSON frame: unexpected end of hex escape at line 1 column 176`.
- **Impact if no action:** The author cannot find the bad string from the
  message, and every build fails until the author finds it. In Serve, each
  attempt replaces the sidecar.
- **Root question:** What does Mokly do with a lone surrogate in authored
  text, so that the build does not fail with an unexplained protocol error?
- **Options:**
  - **A.** Replace each lone surrogate of every reply string with U+FFFD in
    the encoder of the sidecar, `jsonText`, with no warning. The build
    continues, and a document shows U+FFFD, as a UTF-8 document must. The
    author gets no hint. Effort: Small.
  - **B.** Do A, and give a new build warning that names the entry and the
    field path of each replaced string of the describe result. It needs a new
    warning code in `docs/protocol/mokly-build-warnings.md` and a new field in
    the describe result. Effort: Medium.
  - **C.** Keep the failure, but fail in the sidecar before it encodes the
    reply, with `bundle-failed` that names the module, the export, and the
    field path of the first such string. The build still stops, but the
    author can find the value, and the sidecar stays. Effort: Small.
  - **D.** Accept the escape of a lone surrogate in the decoder of the core,
    with a lossy pass that maps each one to U+FFFD, and keep the sidecar as it
    is. Effort: Medium.
- **Left out:** A transport of UTF-16 code units for every string: a Rust
  string still cannot hold a lone surrogate, so the core must still replace or
  reject it.
- **Wider fix:** A. The encoder then never writes an escape that the core
  rejects, for every reply. B adds the warning to A.
- **Previous examples:** The paths of `story-parameters.ts` already use
  `toWellFormed()` against this failure.
- **Related:** `plans/follow-ups/story-parameter-surrogate-warnings-merge.md`,
  the same cause: that item keeps apart the warnings of parameter keys that
  differ only in a lone surrogate. It still needs its own visible text when
  this item replaces lone surrogates in the encoder. Neither fix waits for the
  other.
- **Recommendation:** B. The input is recoverable, because a UTF-8 document
  can only show U+FFFD for a lone surrogate. So Mokly can continue and tell
  the author where the string is, as the user chose on 2026-11-25 for
  malformed values of the `mokly` parameter. C is the option that adds no
  warning.
- **Action:** ask the user, because B adds a new build warning, which needs
  the user's approval, and no requirement says what Mokly does with a lone
  surrogate in authored text.

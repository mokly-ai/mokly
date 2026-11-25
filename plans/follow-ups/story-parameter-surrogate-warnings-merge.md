# Distinct malformed keys share one warning

- **Severity:** Low. **Likelihood:** Rare. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-25, from the implementation review of the branch
  `calummoore/storybook-track-b-finish-ekj1`, finding 4 of round 1.
- **Location:** `packages/mokly/src/sidecar/story-parameters.ts:21` and `:33`,
  where `readStoryParameters` builds each path with `toWellFormed()`.
  `crates/mokly-catalogue/src/provided_entries.rs:48-59`, which builds the
  warning message with `json_quoted`.
  `crates/mokly-catalogue/src/diagnostic.rs:219-229`, `normalize_warnings`,
  which drops equal warnings. `tests/storybook_strict_build.test.ts:117`, the
  test "malformed Storybook parameters warn per included page and fail strict
  builds".
- **Reason:** The second key still gets its warning after the author fixes
  the first one, and the first warning already fails a strict build.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **`mokly` parameter:** a Storybook parameter whose `colorSchemes` and
    `viewports` fields map each Mokly view to Storybook globals.
  - **Lone surrogate:** a UTF-16 code unit from U+D800 to U+DFFF without its
    pair. A JavaScript string can hold one. A Rust string and the JSON
    transport of the sidecar cannot.
- **Background:**
  - The user chose on 2026-11-25 that Mokly ignores each malformed value of
    the `mokly` parameter and gives a `storybook-parameter-ignored` build
    warning for it on each story page whose composed parameters hold it. The
    message is `parameter {path} is ignored: {reason}`, with the JSON-quoted
    path, for example
    `parameter "mokly.viewports.tablet" is ignored: unknown viewport`. The
    section "Globals For Views" of `docs/protocol/mokly-storybook-setup.md`
    holds the rule.
  - `readStoryParameters` in the sidecar builds each path from the keys of
    the parameter. It calls `toWellFormed()` on each key, because a lone
    surrogate in a string of the describe result stops the build with
    `invalid JSON frame`.
  - The core quotes the path with `json_quoted`. `normalize_warnings` then
    drops each warning whose code, subject, and message equal those of
    another warning, as `docs/protocol/mokly-build-warnings.md` defines
    duplicates.
  - The same contract asks producers to write each authored C0 and C1 control
    character as a visible lowercase `\uXXXX` escape before normalization.
    `json_quoted` does this in the core, so a newline in a key shows as
    `\u000a`.
- **Problem:** `toWellFormed()` replaces each lone surrogate with U+FFFD. So
  two keys that differ only in a lone surrogate get one path. A probe with the
  viewport keys `tablet\uD800` and `tablet\uD801` gave two records with the
  path `mokly.viewports.tablet` followed by U+FFFD, and `normalize_warnings`
  merged them into one warning.
- **Impact if no action:** The author sees one warning for two malformed keys,
  and finds the second key only after fixing the first. A strict build still
  fails.
- **Root question:** How does each malformed value keep its own warning, with
  a path that the author can find, when its key holds a lone surrogate?
- **Options:**
  - **A.** Send the path as escaped JSON text, and keep those escapes in the
    warning. The sidecar must then follow the single-line escape rules of
    diagnostics. Effort: Medium.
  - **B.** Carry the UTF-16 code units of the path to the core, and quote them
    there. The path keeps its identity through the transport, and the core
    keeps the warning format. It changes the type of the path in the transport
    and in the generated sidecar types for a Low and rare defect. Effort:
    Medium.
  - **C.** Change no code, and record the rule that keys that differ only in a
    lone surrogate share one warning. Effort: Small.
  - **D.** Write each lone surrogate of a key as visible `\uXXXX` text in the
    sidecar, in place of `toWellFormed()`. Keep the string transport and
    `json_quoted`. Effort: Small.
- **Left out:** An occurrence number keeps the count, but the author still
  cannot tell the keys apart. Each option keeps the key text apart.
- **Wider fix:** None. D keeps the path of each key apart, and the transport
  limit itself belongs to
  `plans/follow-ups/sidecar-transport-rejects-lone-surrogates.md`.
- **Previous examples:** None found for warnings that replacement characters
  merged.
- **Related:** `plans/follow-ups/sidecar-transport-rejects-lone-surrogates.md`,
  the same cause: the transport of the sidecar cannot carry a lone surrogate.
  Neither fix waits for the other.
- **Recommendation:** D. Each key keeps its own warning with a visible path,
  and only the sidecar changes. `json_quoted` then doubles the backslash of
  the sidecar's text, so the message shows `\\ud800`, while a control
  character shows `\u000a`. A key that holds the literal text `\ud800` still
  shares the path of a key with a lone U+D800, but only when one parameter
  holds both. Extend the test above with two keys that differ only in a lone
  surrogate, and expect two warnings.
- **Action:** fix after merge, apply D, because it is a Low product bug with
  the likelihood Rare.

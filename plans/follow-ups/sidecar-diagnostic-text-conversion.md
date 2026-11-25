# Sidecar diagnostics lack one safe text conversion

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-25, from the implementation review of the branch
  `calummoore/storybook-track-f-failed-stories-omid`, round 1. It holds the
  wider fixes that the agent split off findings 1 and 5. It also holds two
  problems outside the scope that the checks of those findings found. The
  problem of a root with a space in Vite diagnostics was found while this
  item was written.
- **Location:**
  - `packages/mokly/src/sidecar/errors.ts:14-16`, `detail`, which turns a
    thrown value into text for about 25 calls in
    `packages/mokly/src/sidecar/`.
  - `packages/mokly/src/sidecar/vite-errors.ts:121-139`, `viteDetail`, the
    path rewrite of Vite diagnostics. Line 132 holds its path matcher.
    `packages/mokly/src/sidecar/vite-urls.ts:51-59`, `viteName`, which gives
    a file its logical name, or its base name outside every root.
  - `packages/mokly/src/sidecar/story-reason.ts`, `storyReason`, the
    conversion and the path rewrite of the reason of a failed story.
  - `packages/mokly/src/sidecar/render-session.ts`, `withRenderSession`, the
    catch around each screen and component render. The catch of
    `renderPage` in `packages/mokly/src/sidecar/session.ts`.
  - `packages/mokly/src/sidecar/session.ts:53-74`, `Session.call`, which
    wraps each error that is not a `SidecarError`.
  - `docs/protocol/mokly-sidecar.md:203`, the `render-failed` row of the
    fail-closed rules. Section "Module Graph" of
    `docs/protocol/mokly-vite-adapter.md`. Section "The Reason" of
    `docs/protocol/mokly-storybook-failures.md`.
- **Reason:** Sharing the module changes how Vite diagnostics and unrelated
  sidecar errors read, outside the diff of the branch that found it.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Sidecar:** the Node process in `packages/mokly/src/sidecar/` that
    bundles and renders the JavaScript entries for Mokly's Rust core.
  - **Diagnostic text:** the message of a sidecar error, such as
    `render-failed` or `bundle-failed`, or the reason of a failed story,
    which its error document shows.
  - **Logical name:** the name of a file relative to its source root or its
    dependency root, such as `src/a.ts` or `node_modules/pkg/index.js`.
  - **Known-root pass:** a pass over the text that replaces each copy of a
    known folder, longest first, such as the source root or the home folder.
- **Background:**
  - Three producers turn a thrown value into diagnostic text. Each has its
    own conversion and its own path rules:
    - `storyReason` writes the reason of a failed story.
    - `viteDetail` rewrites the paths of each Vite diagnostic.
    - `detail` gives the text of each other sidecar error, for example in the
      catches of the screen, component, page, and `describe` requests.
  - Section "The Reason" of `docs/protocol/mokly-storybook-failures.md`
    gives the rules of the reason. A path inside the source root reads
    relative to it. A path inside a dependency root reads as its logical
    name. Each other absolute path or `file:` URL becomes `…`.
  - The same section says that the reason is `Unknown error` when the
    thrown value, its message, or its name cannot become text. Each lone
    surrogate becomes U+FFFD, so the text is well-formed.
  - The review of 2026-11-25 and its finding checks found these problems in
    the reason:
    - A path right after `<`, as in
      `Could not open </home/alice/project/input.json>`, kept its absolute
      path.
    - A path inside a URL that is not a `file:` URL, such as
      `http://localhost:6006/@fs/home/...`, kept its absolute path.
    - A Windows home folder with a space kept a part of the user name.
    - A thrown `Object.create(null)`, or a message or a name that is not a
      string, made the conversion throw. That stopped a non-strict build.
    - A lone surrogate in the reason reached the decoder of the Rust core,
      which rejects it.
  - The review fix of the same day fixed them in `story-reason.ts` only. It
    guards the whole conversion and adds the known-root pass over the source
    root, the dependency roots, the home folder, and the temporary folder. It
    ends with `toWellFormed()`, and it keeps a closing tag such as `</div>`.
  - Section "Module Graph" of `docs/protocol/mokly-vite-adapter.md` says
    that no Vite diagnostic shows an absolute path or a virtual module.
    `viteDetail` gives a path its logical name, or its base name when the
    path is outside every root.
  - `detail` returns `error.message` for an `Error`, and `String(error)` for
    each other value.
  - The `render-failed` row of the fail-closed rules in
    `docs/protocol/mokly-sidecar.md` gives `build-invalid` with the entry.
    For a view render, it also names the viewport and the scheme.
- **Problem:** The three producers differ, and two of them have defects:
  - `String(Object.create(null))` throws
    `TypeError: Cannot convert object to primitive value`. When a screen,
    component, or page render throws such a value, its catch calls `detail`,
    which throws. `Session.call` then gives `render-failed` with the text
    `{every entry file of the generation, joined by ", "}: Cannot convert object to primitive value`.
    So the error names no entry, viewport, or scheme. The catch of
    `describe` has the same problem, with `bundle-failed`.
  - The Vite matcher at `vite-errors.ts:132` accepts a path right after `<`.
    So a Vite diagnostic that quotes markup reads `<div>` in place of
    `</div>`. The matcher reads `/div` as a path outside every root, and
    `viteName` gives its base name. A probe of the matcher gave
    `Expected <div> but found <span>` for
    `Expected </div> but found </span>`.
  - The Vite matcher ends a path at a space. A probe of the matcher and of a
    stand-in for `ModulePaths.name`, with the source root
    `/home/alice smith/project`, turned
    `Transform failed in /home/alice smith/project/src/a.ts:3:7` into
    `Transform failed in alice smith/project/src/a.ts:3:7`. The text then
    shows the home folder name and loses the logical name `src/a.ts`.
- **Impact if no action:** An author whose code throws an unusual value gets
  an error that names every entry file and hides the failing entry. Vite
  diagnostics can change quoted markup and show the name of the home folder.
  Each new producer copies one of the three rule sets.
- **Root question:** How can every sidecar diagnostic turn any thrown value
  into safe text with logical paths, with one set of rules?
- **Options:**
  - **A.** Share only the conversion. One function turns any thrown value
    into text. It never throws, reads no stack and no custom inspection, and
    gives `Unknown error` as the fallback. It makes the text well-formed. It
    replaces `detail` and the conversion of `storyReason`. Each producer
    keeps its own path rules, so the two Vite problems stay. Effort: Small.
  - **B.** One sidecar module for diagnostic text. It holds the conversion of
    A and one path tokenizer with the known-root pass. The tokenizer finds
    quoted, bracketed, and bare paths, `file:` URLs, and paths inside other
    URLs. Each caller keeps its own replacement rules. The story reason gives
    a relative path, a logical name, or `…`. Vite diagnostics give the
    logical name or the base name. `storyReason`, `viteDetail`, and each
    caller of `detail` use the module. Effort: Medium.
  - **C.** Do B with one replacement rule for every producer. A path outside
    the source and dependency roots then becomes `…` also in Vite
    diagnostics, in place of its base name. A Vite diagnostic then loses the
    base name of such a file. Effort: Medium.
- **Left out:**
  - A path rewrite in the Rust core for every sidecar message: the core cannot
    catch a throw during the conversion, so it cannot fix `detail`.
  - Change nothing: the defects stay, and each new producer copies one of the
    rule sets.
- **Wider fix:** B. One module gives every producer the same safe conversion
  and the same path boundaries.
- **Previous examples:**
  - The problems of the reason of a failed story that the review of
    2026-11-25 found, above.
  - Commit `59cc768f6`, "feat(sidecar): apply mokly parameter globals and
    warn on bad values", made the paths of the `mokly` parameter well-formed
    with `toWellFormed()` in `packages/mokly/src/sidecar/story-parameters.ts`.
  - Commit `3378cb3ba`, "fix(render): key environments without the checkout
    folder", removed the checkout folder from render keys.
- **Related:** `plans/follow-ups/sidecar-transport-rejects-lone-surrogates.md`,
  the same cause for lone surrogates. Its option A makes every reply string
  well-formed in the encoder `jsonText`. This item makes diagnostic text
  well-formed when the sidecar writes it. That item waits for the user.
  Neither fix waits for the other.
- **Recommendation:** B. It fixes the conversion and the path boundaries
  once, and each producer keeps the rules that its protocol page states.
- **Action:** fix after merge, apply B, because sharing the module changes
  how Vite diagnostics and unrelated sidecar errors read, outside the diff of
  the branch that found it.

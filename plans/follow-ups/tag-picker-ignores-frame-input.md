# Tag picker ignores clicks and Escape in frames

- **Severity:** Low. **Likelihood:** Rare. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-23, from the branch
  `calummoore/m12-escape-and-search-keys-in-frames-dzj0`, item 2 of its
  report.
- **Location:** `packages/viewer/src/shell/store_interactions.ts:12`
  (`shellKeyDown`), `:25` (`dismissOverlays`) and `:38-66`
  (`useShellBindings` and its document `click` and `keydown` listeners);
  `packages/viewer/src/shell/embedded_viewer.tsx:94` (the embedded root's
  `onKeyDown`, which reaches `shellKeyDown` through
  `packages/viewer/src/shell/store_host.ts:286`);
  `packages/viewer/src/shell/canvas_input.ts:84` (`listenForShellKeys`);
  `packages/viewer/src/shell/use_canvas_selection.ts:213` (the clear on a
  forwarded `escape`); `docs/protocol/mokly-shell-design-tag-picker.md:38-40`.
- **Reason:** The change that forwards Escape from canvas frames owned only
  the canvas selection and the search field, and the fix belongs in the
  shell's own bindings, which the tag picker's outside click never extended
  to frames.

- **Source:** Implementation.
- **Category:** Product bug.

- **Terms:**
  - **Tag picker:** the tag button at the end of the catalogue search field
    and the panel of tag chips that it opens, under
    `docs/protocol/mokly-shell-design-tag-picker.md`.
  - **Canvas frame:** an iframe on the viewer's canvas that shows one screen,
    component or page. A click or a key inside it fires its events in the
    frame's document, not in the shell's document.
  - **Forwarded Escape:** an Escape that a canvas frame's document did not
    handle. The frame sends it to the viewer as the `escape` value of its
    `canvas-key` event, under the "Keys" section of
    `docs/protocol/mokly-frame-canvas-input.md`.
  - **`mokly-shell-key` event:** the bubbling DOM event that
    `packages/viewer/src/shell/canvas_input.ts` sends from the frame element
    for a forwarded Escape or search key. `listenForShellKeys` in the same
    file hears it.
- **Background:** The tag picker page says that Escape closes the panel and
  returns focus to the control, and that an outside click closes it. The
  shell closes the picker on a `click` event of its own document, and on
  Escape through `shellKeyDown`, which also cancels the keydown. The canvas
  selection's own Escape listener skips a cancelled keydown, so in the shell
  Escape first closes an open picker and keeps the selection. A click inside a
  canvas frame fires no event in the shell's document. Since 2026-11-23 the
  viewer clears the canvas selection on a forwarded Escape, which
  `shellKeyDown` never hears.
- **Problem:** With the picker open, a click on an element in a canvas frame
  leaves the picker open. Escape pressed in that frame then clears the canvas
  selection, and the picker stays open. In the shell, the same Escape closes
  the picker and keeps the selection.
- **Screenshot:** A capture after the first check under **Evidence** showed
  the Tags panel still open below the search field, and Inspect's Selection
  section with its empty text, "Click an element on a frame to see its
  props.".
- **Evidence:** Two one-time checks with a Playwright script on 2026-11-23.
  Both ran on the static build of the example catalogue (`npm run build`,
  then
  `npx mokly build --config examples/basic/mokly.config.json --strict --out ../../.context/example`,
  served over HTTP), at `/view/example/screens/welcome/` in a 1440 × 900
  window:
  - Press Filter by tag: the picker opens. Click the text "Workspace actions"
    in the Mobile · Light frame: the Toolbar is selected, and the picker stays
    open. Press Escape: the canvas draws no selection, and the picker stays
    open.
  - Click "Workspace actions" in the same frame, then press Filter by tag,
    then press Escape while focus is in the shell: the picker closes, and the
    Toolbar stays selected.
- **Impact if no action:** A reader who opens the picker and then clicks into
  a frame keeps an open picker over the canvas. Escape pressed there clears
  the selection instead of closing the picker.
- **Root question:** How does the tag picker close when the reader works
  inside a canvas frame?
- **Options:**
  - **A.** Change nothing. The order differs only while the picker is open and
    focus is in a frame. Effort: Small.
  - **B.** Let a forwarded Escape close an open picker first and keep the
    selection, as the shell's own Escape does. The shell's key bindings also
    hear the `mokly-shell-key` event through `listenForShellKeys`, and the
    selection skips its clear while the picker is open. A test sends a
    forwarded `escape` with the picker open and checks both results.
    Effort: Small.
  - **C.** Count a click into a canvas frame as an outside click, and also
    apply B. The shell can read the click from the `blur` event of its own
    window, after which its active element is the frame element, for
    same-origin and cross-origin frames alike. B still covers a picker that
    stays open, such as after a move into a frame by Tab. Tests check that a
    click into a frame closes an open picker, and that a forwarded Escape
    closes it before it clears the selection. Effort: Small.
- **Left out:** Reading clicks inside a cross-origin frame from the host,
  because the browser does not allow it. A new frame event for each click in
  a frame, because the shell's window already tells it when focus moves into
  a frame, with no new wire value.
- **Wider fix:** C. It makes the picker's outside-click rule hold for frames,
  so the order of Escape cannot differ.
- **Previous examples:** None found.
- **Recommendation:** C. It applies both rules of the tag picker page inside
  frames, with a small change in the shell's bindings.
- **Action:** fix after merge, apply C, because the likelihood is Rare and
  the severity is Low.

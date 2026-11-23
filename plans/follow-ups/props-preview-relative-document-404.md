# A Props preview cannot load a generated document by a relative path

- **Severity:** Low. **Likelihood:** Rare. **Effort:** Small. **Confidence:** Low. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-23, from the branch
  `calummoore/canvas-redesign-m11-canvas-stage-in-knaz`.
- **Location:** the temporary preview route
  `/mokly-viewer/components/renders/{render-id}/` in
  `docs/protocol/mokly-runtime.md:139`, and its callers in
  `packages/viewer/src/shell/component_controls.tsx`
- **Reason:** Milestone 11 saw it while it moved Props edits onto every shown
  frame. It looks older than that milestone, so the milestone did not change
  it.

- **Source:** Implementation.
- **Category:** Product bug.
- **Terms:**
  - **Props preview:** the temporary document that `mokly serve` renders when
    a reader edits a component's props in the viewer.
- **Background:** A Props preview lives under its own render path. The saved
  documents of the catalogue live under their generated paths.
- **Problem:** When a Props preview loads another generated document by a
  relative path, the request resolves under the render path and gets a 404.
  Two ownership tests allow this 404, so no test fails.
- **Impact if no action:** A component whose preview loads a sibling document,
  such as a frame or a linked page, shows a broken resource while a reader
  edits its props.
- **Root question:** Which base must a Props preview resolve relative paths
  against?
- **Options:**
  - **A.** Reproduce it first, then make the preview resolve relative paths
    against the saved variant's generated path, for example with a base
    element or a route alias. Change the runtime page. Effort: Small.
  - **B.** Change nothing, and name the limit in the runtime page. Effort:
    Small.
- **Left out:** Copying every generated document under each render path,
  because a preview is temporary.
- **Wider fix:** A.
- **Previous examples:** None found.
- **Recommendation:** A, after a reproduction. A preview then loads what the
  saved variant loads.
- **Action:** ask the user after a reproduction, because the cause and its age
  are not confirmed.

# Component frames keep a stale size while loading

- **Severity:** Medium. **Likelihood:** Common. **Effort:** Medium. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-25, from the implementation review of the branch
  `calummoore/storybook-track-f-failed-stories-omid`, round 2, outside the
  scope. The finding check of finding 13 found it.
- **Location:**
  - `packages/viewer/src/shell/canvas_workspace.tsx:53`, `frameSize`, which
    gives a component frame its last measured size, or the desktop size when
    the frame has no measurement yet.
  - `packages/viewer/src/shell/workspace_selection_view.tsx:50`,
    `nominalSize`, the same rule for the canvas selection, from its own
    record of measured sizes.
  - `packages/viewer/src/shell/canvas_frame_size.ts:1-7`, the module comment.
    Its lines 4-6 say that a component frame holds the desktop size until
    its adapter measures each load of the document.
  - `packages/viewer/src/shell/canvas_live_frame.tsx`, `sizeListener`, which
    measures each document of a component frame once its session is ready.
  - `docs/protocol/mokly-shell-device-chrome.md`, section "Canvas Frames": the
    frame rules.
- **Reason:** The code on `origin/main` keeps the same size, and each fix sets
  canvas behaviour that no requirement states, outside the failed-story work
  of the branch that found it.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Component frame:** a canvas frame that holds the document of a
    registered component's example, of a saved variant, or of a story.
  - **Measurement:** the read of the box of a document's content after the
    document loads, which gives a component frame its size.
  - **Serve:** Mokly's local development server, which rebuilds the catalogue
    after a source change, so that the open frames load their new documents.
- **Background:**
  - Section "Canvas Frames" of `docs/protocol/mokly-shell-device-chrome.md`
    says that a component's frame holds its document at the document's own
    size. The desktop size is 1280 × 800 CSS pixels.
  - For a comparison in Changes, the same section says that a component's
    frame holds the desktop size until both documents load, "at which each
    document lays out for its measurement".
  - The module comment of `canvas_frame_size.ts` gives the same rule for a
    live component frame: the adapter measures the content once after each
    load, and until then the frame holds the desktop size.
  - The code keeps the last measured size of a frame, by the key of the
    frame, while the frame loads its next document. Only a frame without a
    measurement takes the desktop size. `CanvasWorkspaceStage` and
    `useWorkspaceSelection` each keep such a record, and neither clears it
    when the document changes.
  - The measurement reads the box of the content. So a document whose content
    follows the width of its frame, such as a block that fills the page,
    measures the width at which it lays out.
  - The review of 2026-11-25 found that the error document of a failed story
    filled its frame, so a one-line reason measured 1280 × 800. The review
    fix of the same day gives the error document a width that does not
    follow its frame.
- **Problem:** A component frame lays out its next document at its last
  measured size, not at the desktop size. So in Serve, a document whose width
  follows its frame measures at the old width after a rebuild, and at 1280 on
  a new visit. For example, a story that failed and then renders again can
  keep the narrow width of its error document until the page reloads. This
  comes from a read of the code. Nobody ran it.
- **Impact if no action:** One document can show two sizes, which depend on
  the document that the frame held before. The size tag and the layout of the
  canvas then change after a reload with no source change.
- **Root question:** At which size does a component frame lay out its next
  document for the measurement?
- **Options:**
  - **A.** Reset a component frame to the desktop size each time its document
    changes, until the new measurement. This matches the comment and the rule
    of comparison frames. At each rebuild in Serve, each such frame shows
    1280 × 800 for a moment, and the frames around it move. Effort: Small.
  - **B.** Keep the code, and correct the comment. State in the device chrome
    page that a component frame keeps its last measured size while its next
    document loads. The size of a document whose width follows its frame
    then depends on the earlier document. Effort: Small.
  - **C.** Lay out each new document at the desktop size out of view, and
    keep the shown frame at its last size until the new measurement. For
    example, load the new document in a hidden frame at 1280 × 800, measure
    it, and then show it at its size. Each document then has one size, and
    the canvas does not move. Effort: Medium.
- **Left out:** A measurement at the content's own width, with a
  shrink-to-fit layout: it breaks the comparison rule that each document lays
  out at the desktop size for its measurement, and a document that fills its
  frame on purpose then gets a narrow frame.
- **Wider fix:** C. Each document then gets one size, whatever document the
  frame held before, with no movement on the canvas.
- **Previous examples:**
  - The error document of a failed story that filled its frame, above.
  - Commit `6d4f4f6cf`, "feat!: redesign the site, the viewer and the cloud
    chrome in Canvas (#488)", added the sizes of component frames from the
    content of their documents.
- **Recommendation:** C. It gives each document one size and keeps the canvas
  still at each rebuild. A is the cheapest way to one size, at the cost of
  that movement.
- **Action:** ask the user, because `docs/protocol/mokly-shell-device-chrome.md`
  does not say at which size a component frame lays out its next document,
  and each option sets that visible behaviour.

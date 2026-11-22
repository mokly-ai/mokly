# Canvas redesign: decisions 33 to 36

These decisions came from Milestone 18, one Canvas family of Browse designs,
and Milestone 17, the Canvas default in the open-source shell, of the [Canvas redesign plan](./canvas-redesign.md). This file is a part of
the plan, and the pull request that deletes the plan deletes it too.

Terms:

- **Device frame:** today's phone bezel (390 × 844) or fluid browser window
  (up to 1180px wide, 640 to 760px high), from `@mokly/ui`.
- **Canvas frame:** the Canvas viewer's bare frame at a fixed size (1280 × 800
  or 390 × 844). It scales with the zoom and has a mono label and a size tag.

Two contracts keep device frames for the states of these decisions:
`docs/protocol/mokly-shell-device-chrome.md:56-58` and
`docs/protocol/mokly-shell-canvas-stage.md:59-60`. If both decisions choose B,
the device frame and the flow step leave `@mokly/ui` and the design library.

## 33. How a use case stands on the canvas

- **Severity:** Medium. **Effort:** Medium.
- **Source:** Implementation.
- **Category:** Docs or spec.
- **Location:** `docs/protocol/mokly-shell-device-chrome.md:56-58` and
  `:110-116`, `docs/protocol/mokly-shell-canvas-stage.md:59-60`
- **Background:** A use case is an ordered list of steps, and each step shows
  one screen. Today the steps stand in a vertical column with number tiles.
  Each step shows its desktop view in a browser frame, or its mobile view in a
  phone frame at 760px or less.
- **Problem:** A fluid browser frame cannot scale with the canvas zoom.
- **Impact if no action:** The viewer keeps two frame systems, and the device
  frame and the flow step stay in `@mokly/ui`.
- **Root question:** How does a reader see the steps of a use case in the
  Canvas viewer?
- **Options:**
  - **A.** Keep the vertical column with device frames inside the Canvas
    chrome, with no zoom. Effort: Small.
  - **B.** One section on the canvas: one canvas frame for each step, in a row
    from left to right, each with its step number, title and a link to its
    screen. It pans, zooms and fits like a screen. The compact layout shows
    one step at a time with the frame picker. Effort: Medium.
  - **C.** Keep the vertical column, but put each step in a canvas frame at a
    fixed zoom, with no pan or zoom. Effort: Medium.
- **Left out:** Four frames for each step, because five steps would show
  twenty frames. The Frames filter still chooses the viewport and scheme.
- **Wider fix:** B, because one frame model then serves every entry kind.
- **Previous examples:** None found.
- **Recommendation:** B. A use case then reads like a prototype flow in a
  design file, and the viewer keeps one frame system.
- **Action:** ask the user, because B and C change two requirements.
- **Answer:** Cal chose **B** on 2026-11-22. Milestone 18 does the work.

## 34. How a removed entry's previous version stands on the canvas

- **Severity:** Medium. **Effort:** Medium.
- **Source:** Implementation.
- **Category:** Docs or spec.
- **Location:** `docs/protocol/mokly-shell-device-chrome.md:56-58`,
  `docs/protocol/mokly-shell-canvas-stage.md:59-60`,
  `docs/protocol/mokly-removed-previews.md:19-40`
- **Background:** A removed screen shows its previous version from the base
  commit under "Showing previous version", with no compare mode. Today a
  viewport control picks Mobile, Desktop or both, in device frames. A
  viewport with no historical view shows a note. A removed page or document
  shows its previous version in a bordered pane.
- **Problem:** On the canvas, the Frames filter replaces the viewport control,
  and every other screen opens as canvas frames.
- **Impact if no action:** Only removed screens keep device frames and the
  viewport wording in the Canvas viewer.
- **Root question:** How does a reader see a removed entry's previous version
  in the Canvas viewer?
- **Options:**
  - **A.** Keep device frames and the bordered pane inside the Canvas chrome.
    Effort: Small.
  - **B.** Open the removed entry as a section of its historical views: one
    canvas frame for each view, Light above Dark, with the Removed status and
    "Showing previous version" in the section head. A removed page or document
    opens as one reading frame. A viewport with no historical view draws its
    note where its frame would stand. Effort: Medium.
  - **C.** Show only the frames that the Frames filter keeps, starting with one
    historical frame, and keep the viewport note. Effort: Medium.
- **Left out:** The previous version as the Before side of an empty
  comparison, because a removed screen offers no compare mode.
- **Wider fix:** B, because one frame model then serves every entry kind.
- **Previous examples:** None found.
- **Recommendation:** B. It matches how every other screen opens.
- **Action:** ask the user, because B and C change three requirements.
- **Answer:** Cal chose **B** on 2026-11-22. Milestone 18 does the work.

## 35. The zoom pill while an entry loads or failed

- **Severity:** Low. **Effort:** Small.
- **Source:** Implementation.
- **Category:** Docs or spec.
- **Location:** `docs/protocol/mokly-shell-canvas-stage.md:28-32`
- **Background:** The canvas stage contract shows the zoom pill while an entry
  is selected. It hides the pill with nothing selected, because the canvas
  then holds no section to zoom or fit.
- **Problem:** While the selected entry's preview loads or failed, the canvas
  also holds no section, but the requirement still shows the pill and the
  dock's Fit.
- **Impact if no action:** The pill and Fit show while they act on nothing.
- **Root question:** When does the canvas show its zoom controls?
- **Options:**
  - **A.** Keep the requirement: the pill and Fit show while an entry is
    selected. The mockup draws this now. Effort: Small.
  - **B.** Show the pill and Fit only while the canvas holds a section. Change
    the contract line and two loading mockups. Effort: Small.
- **Left out:** A disabled pill, because a control that does nothing adds
  noise.
- **Wider fix:** None, because one rule settles it.
- **Previous examples:** The home state has no pill for the same reason.
- **Recommendation:** B. The rule then follows its own reason.
- **Action:** ask the user, because B changes a requirement.
- **Answer:** Cal chose **B** on 2026-11-22. Milestone 18 does the work.

## 36. The fonts of a Markdown document

- **Severity:** Medium. **Effort:** Large.
- **Source:** Implementation.
- **Category:** Docs or spec.
- **Location:** `docs/protocol/mokly-viewer-palette.md:57-61`,
  `crates/mokly-html/src/document_palette.css`,
  `crates/mokly-graph/src/urls.rs:43-61`,
  `plans/follow-ups/markdown-documents-load-no-geist.md`
- **Background:** The palette page says each consumer that draws in Canvas
  hosts Geist and Geist Mono itself. Each Markdown document is its own page
  in a frame, so it does not get the shell's font rules. The documents now
  name the Geist font stacks but load no font file. On `main`, they named
  Inter and loaded no file either.
- **Problem:** A reader without Geist installed sees the documents in system
  fonts, inside a shell that uses Geist.
- **Impact if no action:** Documents look different from the shell and from
  the Canvas design screen `design/canvas/stage/document`.
- **Root question:** Which fonts does a Markdown document show to a reader
  who does not have Geist installed?
- **Options:**
  - **A.** Change the requirement: documents name the stacks and load no
    font file. Effort: Small.
  - **C.** Each document loads the viewer's two Geist files from a
    document-relative address. The build fails a font address outside
    `static/`, so this also needs a new delivery rule. Effort: Large.
  - **D.** Embed both fonts in each document. Each document grows by about
    190 KB, and the cloud's content rules block embedded fonts. Effort:
    Medium.
- **Left out:** A status line that links the follow-up item, because it does
  not answer the question.
- **Wider fix:** None, because only Markdown documents load no font.
- **Previous examples:** On `main`, the Markdown style named Inter and loaded
  no font file.
- **Recommendation:** C. Decision 1 chose one Canvas look on every surface,
  and the work can follow the merge, because it blocks nothing.
- **Action:** ask the user, because A changes a requirement and C adds
  delivery behaviour that no requirement covers.
- **Answer:** Cal chose **C** on 2026-11-22. Milestone 19 does the work.

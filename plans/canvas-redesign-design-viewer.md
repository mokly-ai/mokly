# Canvas redesign: viewer design calls

These are the design calls of Milestones 11, 17, 19, 22 and 23 of the
[Canvas redesign plan](./canvas-redesign.md), as the
[design record](./canvas-redesign-design.md) keeps them for the other
milestones. This file is a part of the plan, and the pull request that deletes
the plan deletes it too.

- Calls on Milestone 17, 2026-11-22:
  - `npm run palette:generate` writes the `@mokly/ui` theme and the Markdown
    palette part from the palette module, and `npm run palette:check` in the
    repository suite guards them. The build does not generate them.
  - The theme stays one file at its path with the same selectors. The
    Markdown style is a generated palette part plus hand-kept typography.
  - The generator mixes colours in sRGB and writes plain values, so tests can
    measure contrast. The theme uses the Canvas role names.
  - The mark reads the Canvas signal roles directly. `--chrome-brand` and
    `--serif` had no reader, so they are gone.
  - The embedded stylesheet names its faces "Mokly Geist" and "Mokly Geist
    Mono", so the cloud app's own Geist keeps its file.
  - Codex stopped on its usage limit, so a Claude subagent did the non-UI
    work.

- Calls on Milestone 19, 2026-11-22:
  - The renderer writes each document's two `@font-face` rules, with an
    address relative to the document's route, so a build under a sub-path
    works. The generated palette keeps only the font stacks.
  - The closure check skips only those two font files, only in a Markdown
    document's own stylesheet, with no query string.
  - Each comparison generation holds copies of both fonts, 140,700 bytes,
    which the cloud stores once per project. Serve answers the copies from
    its own viewer files. The comparison treats both font addresses as the
    same file.

- Call of 2026-11-22: the viewer bar follows the prototype's order and
  shows the mark at 390px. This replaces the earlier call that the embedded
  compact bar hides the brand. Milestone 22 does it.

- Calls on Milestone 22, 2026-11-22: `@mokly/viewer` gets an optional
  `topBarCenter` slot, and the cloud puts the publication pill in it. The
  live cloud controls take the prototype look now, with no behaviour change;
  Milestone 13 builds the account menu. The package bar takes two optional
  consumer properties, `--mokly-top-bar-inset-start` and `-end` (default 0),
  so its mark clears the Mac window buttons that the cloud reports.
  The registered Button gains a muted lead text, so the project trigger
  mutes the workspace and stays one control. History gets a `history` icon.
  The Button also gets an icon-only form, so History and Settings drop their
  labels and the full bar fits at 1024px. The pill sits in `topBarCenter` on
  both bars. The start slot fills its column, so that space still moves the
  Mac window. Milestone 11 removes the preview scheme switch from the bar.

- Calls on Milestone 11, 2026-11-22: a component frame keeps 1280 × 800 from
  one function until Milestone 23's content-box measurement lands. A
  component's variant set starts with its own example, then the saved
  variants. The focus glow is `signalDeep` at 75%, 4px. The preview scheme
  switch leaves the bar, and the Frames filter chooses the scheme.

- Call on Milestone 23, 2026-11-22: the frame probe budget rises from 9,216
  to 10,240 bytes, because the content-box measurement needs about 360 bytes
  and Milestone 10 had filled the old budget. Each published page grows by
  about 360 bytes before compression.

- Calls on Milestone 22, later on 2026-11-22: the full bar shows from 1022px.
  The bar's readability test helper measured the search placeholder wrongly
  and passed a cut placeholder; it now measures the input's overflow. Narrow
  desktop drawings may centre the compact pill, which the app never does.

- Call on Milestone 25, 2026-11-23: the frame probe budget rises from 10,240
  to 11,264 bytes for the forwarded canvas input and the frame focus events.
  The probe is one cached script file. A touch pinch over a frame on Android
  is a follow-up item, because it needs a non-passive touch listener.

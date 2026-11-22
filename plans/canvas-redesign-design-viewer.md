# Canvas redesign: viewer design calls

These are the design calls of Milestones 17, 19 and 22 of the
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

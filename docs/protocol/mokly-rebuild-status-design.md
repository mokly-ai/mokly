# Rebuild Status Design

## Delivery Status

Delivered mockup scope for Milestone 2 of the
[Serve rebuild status plan](../../plans/serve-rebuild-status.md). The design
catalogue depicts the five states below, and this document records the final
progress placement, dimensions and copy. The shell implements them in
Milestone 5; until then no served page shows them. The behavioral source is the
[rebuild status contract](./mokly-rebuild-status.md).

## Placement And Ownership

The failure notice is package-owned shell chrome, full width immediately below
the 48px top bar and before `.mbk-body`. It appears in the same place on home,
screen, component, page, flow, comparison, removed, and missing routes. It is
outside preview frames, so Static and Live use the same notice. Compact and
wide shells keep the same information and order; compact presentation may wrap
but may not hide or abbreviate the copy. The narrow catalogue drawer and the
compact tag-picker sheet open under the top bar over the notice, exactly as they
cover the rest of the shell below the bar.

The notice is one full-surface treatment with an icon, background, padding, and
a complete perimeter or tonal edge treatment. It must never use a contrasting
left-edge border, inset stripe, pseudo-element, gradient edge, shadow rail, or
adjacent vertical bar. Color is not its only failure cue. It reuses the shell's
semantic palette, type, focus, disclosure, spacing, and icon conventions rather
than introducing environment or developer-tool styling.

The approved notice geometry:

- **Band** — spans the shell on `--chrome-bg` with a 1px `--chrome-border`
  bottom hairline; padding 8px 16px, or 8px 12px in a compact shell.
- **Card** — `--mbk-danger-bg` fill inside one complete 1px `--mbk-danger-edge`
  outline, 8px radius, 9px 12px padding. Like the validation alert, the outline
  is decorative: the card names its state in 15.22:1 ink, as the
  [palette](./mokly-viewer-palette.md) records.
- **Icon** — a 16px circled exclamation mark in `--mbk-danger-ink`, 10px before
  the text, centred on the first 20px line.
- **Copy** — the headline in 13px/600 `--chrome-ink` and the explanation in
  13px `--chrome-ink-2`, both on 20px lines: one line in a wide shell, stacked
  in a compact one.
- **Disclosure** — 12px/600 `--mbk-danger-ink` with a 12px chevron that turns
  over when open. Both labels share one cell sized to the longer, so the
  control keeps its size in either state. A wide shell holds it at the end of
  the first line, labels aligned to the chevron, and reserves 112px of that
  line for it; a compact shell places it on its own line after the
  explanation, labels aligned to the text. Opening it never moves it.
- **Detail** — below the copy in the text column: `--chrome-surface` fill,
  1px `--mbk-danger-edge` outline, 6px radius, 8px 10px padding, 11.5px/1.55
  `--mono` in `--chrome-ink-2`, preserved line breaks, wrapping anywhere, and
  at most 168px tall with its own scrolling.

Collapsed, the notice measures 57px wide and 101px compact in the mockups.

## Required Screen States

The screen-spec page contains exactly these five standalone screen components,
each with separate mobile and desktop variants:

| State                  | Required depiction                                                         |
| ---------------------- | -------------------------------------------------------------------------- |
| Failure                | A Static screen with the notice and collapsed disclosure; no progress      |
| Failure details        | The same screen with the real text detail disclosed                        |
| Updating               | A screen with delayed progress visible and no failure notice               |
| Failure and updating   | The failure remains visible while delayed progress is also visible         |
| Live component failure | A component saved variant with Live selected and the same collapsed notice |

The first Failure screen is the canonical representation. These are shell
states, not a user flow; none may invent a screen inline. Existing shell,
top-bar, workspace, device, preview-mode, artboard, and inspector components
must be reused.

The Static and Live examples must differ only in their existing workspace
state. The notice cannot enter the device frame, cover its content, replace an
interactive-preview failure, or add a mode badge. The details mockup uses one
bounded, sanitized repository-relative fixture diagnostic; it must not use an
absolute path, ANSI styling, HTML, or explanatory implementation annotations.

## Owning Catalogue

Source lives under `examples/basic/entries/design/rebuild-status/`; the
`design-rebuild-status` collection, **Mokly design → Update status**, holds the
five states with the canonical Failure screen as its first child. All are
light-only artboards.

| Entry id                          | Route                                         | State                                                        |
| --------------------------------- | --------------------------------------------- | ------------------------------------------------------------ |
| `design-rebuild-failure`          | `design/rebuild-status/failure.html`          | Failure: Welcome in Static under the collapsed notice        |
| `design-rebuild-details`          | `design/rebuild-status/details.html`          | Failure details: the same screen with the detail disclosed   |
| `design-rebuild-updating`         | `design/rebuild-status/updating.html`         | Updating: delayed progress beside search, with no notice     |
| `design-rebuild-failure-updating` | `design/rebuild-status/failure-updating.html` | Failure and updating: the notice and progress together       |
| `design-rebuild-live-component`   | `design/rebuild-status/live-component.html`   | Live component failure: Action in Live under the same notice |

The four Welcome states draw the selected Welcome screen in Static with the
workspace of `design-interactive-static`, and keep the controls and links of
the canonical `design-browse-screen`. The Live component state draws
`design-interactive-component` unchanged and keeps its links. No control opens a rebuild status artboard: like the Changes
availability states, they are entered from the catalogue navigation, and the
disclosure opens and closes in place.

The notice is the registered `design-ui-rebuild-notice` component in the Chrome
gallery, saved as `collapsed` and `details`. Progress belongs to the registered
top bar through its `updating` flag and saved `updating` example.

## Product Copy

The approved copy keeps the proposed wording, set with the typographic
apostrophe (U+2019) and ellipsis (U+2026):

- headline: **Your latest changes couldn’t be loaded.**
- explanation: **You’re seeing the last working version.**
- collapsed disclosure: **Show details**
- expanded disclosure: **Hide details**
- progress: **Updating…**

Headline and explanation never mention builds, bundles, generations, watch
actions, schemas, file formats, or environment names. The disclosed diagnostic
is secondary developer detail and is never promoted into the headline,
explanation, navigation, or progress copy.

## Progress Placement

Progress appears only after the contract's 1,000 ms delay, in one place at every
width and whether or not the notice is shown: in the top bar, immediately after
the search field and before the Appearance control, one bar gap from each. The
search field and the progress slot share the search field's flexible allotment
of at most 440px. While progress shows, the field narrows by the slot's width
plus one bar gap; hidden progress takes no room and leaves no placeholder. The
menu, brand and Appearance control keep their positions, and top-bar height,
notice height, `.mbk-body` position, stage size, navigation height and scroll
position never change at either width.

The slot is 30px tall, the controls' height, and never wraps: a 12px ring
spinner (a 1.5px `--chrome-border` ring with a `--chrome-muted` arc turning
every 0.8s), a 6px gap, and “Updating…” in 12px/500 `--chrome-muted`, which is
5.23:1 on the bar. The mockups measure it at 81px. At 1440px the field narrows
from 440px to 343px; at 390px, from 231px to 140px, keeping its placeholder on
one line with an ellipsis. The Appearance control stays at x = 572px and 328px.

A 390px bar has no free room, so visible text must take space from the search
field, the bar's only flexible control. The alternatives were rejected: a slot
after Appearance moves Appearance at narrow widths; an overlay on the bar's
edge collides with the controls and the notice; a row after the delay is
forbidden.

## Interaction And Accessibility

The notice is a `section` named by its `h2` headline through
`aria-labelledby`, a peer of the screen title's heading; its decorative icon is
hidden from assistive technology. It is not itself an assertive alert. The
existing polite, atomic `#mb-status` region owns the once-per-failure live
announcement defined by the behavioral contract. Initial server-rendered
failure content remains ordinary discoverable document content, which avoids
announcing it again on reload.

The disclosure is a native details/summary interaction or a button with
`aria-expanded` and `aria-controls`. Its visible label reflects open state,
works by keyboard, retains visible focus, and never moves focus when the
failure changes. The mockups use native `details`, whose summary carries both
labels and shows only the one that matches its state; the hidden label is not
named. Keyboard focus draws a 2px `--mbk-sage-deep` ring 2px outside the
summary. Detail text is selectable, wraps long tokens, preserves line breaks,
and cannot create horizontal page scrolling.

Progress always has the visible text “Updating…”; the spinner is supplementary
and hidden from assistive technology. Progress is ordinary text, not a live
region, so saving never makes the shell speak. Under
`prefers-reduced-motion: reduce`, the ring stops turning while the same
geometry, text, and contrast remain. Failure, disclosure, and progress must
remain understandable at 200% zoom and without color.

## Verification

The design suites build all ten viewport variants and pin the five ids and
routes, the collection order, copy, notice/detail/progress presence, the
notice's position between the top bar and the body outside every preview,
Static and Live modes, disclosure state, the sanitized fixture, reused
workspaces, canonical controls and links, the shared components, and the
absence of any edge accent. Browser checks from disk compare content geometry
immediately before and after progress appears, with and without the notice,
and exercise keyboard toggling and focus, reduced motion, long-detail wrapping
at 390px, the palette colours, and the card's complete outline.

## Related Docs

- [Watched Serve rebuild status](./mokly-rebuild-status.md)
- [Shell design](./mokly-shell-design.md)
- [Interactive views design](./mokly-interactive-views-design.md)
- [Component workspace design](./mokly-component-workspace-design.md)

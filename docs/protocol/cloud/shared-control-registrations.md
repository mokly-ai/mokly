# Shared Control Registrations

This is the wrapper sub-contract of [Shared controls](./shared-controls.md).

## Registered Wrapper Contract

A registration keeps its prop names and types, slots, controls and saved
variant coverage across package changes. A component is identified by its
path and a variant by its slug, never by an ID, because paths and slugs are
stable across regeneration and readable in links. Registrations are defined in
their owning `*.mockup.tsx` entry; wrapper inputs live in `src/components`
and render the real package components. A screen uses a registered wrapper
before adding any control, and a control the table lacks is registered as a
wrapper first.

| Registered component     | Firna rendering                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `design/button`          | `Button`; primary/secondary/danger pass through; `quiet` → `plain`, the library's borderless neutral-ink action for repeat and dismiss; going back is never a button but the ink back link (back glyph, underline on hover); `size="lg"` and 44px minimum target; arrow uses the decorative trailing slot; `busy` passes through for a [write in progress](./folio-chrome.md#compositions): the package draws its spinner in the leading slot, sets `aria-busy`, refuses the press and keeps focus                                                                                                                                                                                                                                                                                                                                                               |
| `design/input`           | Labelled `Input`; `size="lg"` gives 16px text and a 48px field; helper → hint; error takes precedence; email keyboard/autocomplete; identifier fields disable capitalization, correction and spellcheck; name → DOM id; its waiting form keeps the label and the field's own frame, read-only, holding a bar or the operation's name, and a waiting label can hold a bar beside its known words for a name that the read supplies                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `design/badge`           | `Badge`, soft variant; success → primary; other tones pass through; text states the status                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `design/options-list`    | `DropdownList` with `highlightVariant="ringFill"`: the chosen row takes `primarySoft`, a `primary` ring and a trailing check, never a solid fill                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `design/selector`        | `DropdownSelector`, closed, `variant="field"` and `searchable`, at the input's density; the trigger is the field the reader opens, the open surface is `design/options-list`; its waiting form keeps the label and the trigger's own frame, read-only, holding a bar or the operation's name; placeholder, chosen, disabled and waiting saved variants                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `design/responsive-menu` | A row's actions behind a quiet square `Button` drawing the lucide `Ellipsis` glyph, named by `accessibilityLabel`, with `hasPopup="menu"` and `expanded` while open. Open on a pointer viewport it draws `PopoverSurface` holding `DropdownList` with `listRole="menu"` in the package's own menu chrome, end-aligned 6px below the trigger, its first row marked with the `ringFill` highlight because the live popover marks the keyboard's row as it opens; open on a touch viewport it draws the registered `design/panel` sheet titled with the row's name, with **Cancel** and the same rows. Rows carry a label and an optional `danger` tone, the library's destructive ink without a fill. The live `ResponsiveMenu` and `WebModalFrame` draw nothing in static markup, so the mockup composes their public parts and the live app takes the components |
| `design/avatar`          | `Avatar`; label, decorative, shape, size and tone; soft/solid saved variants                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `design/status-dot`      | `StatusDot`; success → primary; four saved tone variants; decorative beside a status label                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `design/table`           | `Table` with `TableCell`; serializable columns and rows; optional muted and monospace cells; `size` selects public `md`/`lg` density; large ordinary cells use Firna Body (15px), other cells use TableCell; a waiting row keeps the row's own frame with bars in place of its text, not the package's `loading` rows, whose heights differ; publications, members, and readable-row variants                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

### Density And Target Size

A wrapper reads `context.viewport` and selects the package density from it, so
one registration serves both compositions and no screen passes a size for
density alone. Pointer viewports take the compact scale; touch viewports take
the roomy one:

| Registered component                          | Desktop | Mobile |
| --------------------------------------------- | ------- | ------ |
| `design/input`, `design/textarea`             | `md`    | `lg`   |
| `design/selector`                             | `md`    | `lg`   |
| `design/segmented`, `design/switch`           | `md`    | `lg`   |
| `design/content-list` (`List` and `ListItem`) | `sm`    | `md`   |

`design/button` keeps an explicit optional `size` because emphasis, not
viewport, chooses it: `sm` for a section action beside a heading, `md` for a
page, form or dialog action, `lg` (the default) for a primary call to action on
account entry and onboarding. One tone vocabulary covers every surface:
`primary` is the one action that moves the screen forward, `secondary` is a
real alternative path beside it, `quiet` repeats or dismisses, and `danger`
destroys; going back is the ink back link, not a button. A screen spends one
`primary` and pairs it with at most one alternative; two filled buttons is two
primaries. It takes an optional `block` for a full-width action, an optional
`icon` naming one of `github`, `start`, `retry`, `external`, `signOut` or
`history`, which the wrapper resolves to the shared lucide glyph and Firna
tints to the label color, and an optional `chevron` that places the shared
switcher glyph in the same decorative trailing slot the `arrow` uses, so a
viewer switcher trigger reads as one. `arrow` and `chevron` are mutually
exclusive; `arrow` wins if both are passed. It takes an optional `lead`, a
muted text before the label with a slash between them, such as a workspace
before its project: the wrapper draws it inside the Button through the
package's own content, in the muted text role at the regular weight, so the
whole row is one control. The label keeps its tone's ink and weight. The lead
gives up its width before the label gives up any, and each is cut on one line.
A lead takes the place of the `icon` and the `arrow`, and a busy Button draws
its working word alone. It takes an optional `accessibilityLabel`, the whole
value behind a label that is a shortened form of it: only a shortened label is
given a longer name to answer to, so a reader who cannot hover still reaches
the whole one. A Button with a lead and no `accessibilityLabel` is named by the
lead, the slash and the label. Every one of these props is optional.

Target size follows the viewport too. Mobile keeps `minTouchTarget={44}`, so
every action is at least 44px (WCAG 2.1 — 2.5.5, AAA). Desktop keeps the size
scale's visible height — 30, 38 or 46px — and extends the pressable area with
`hitSlop={8}`, which holds the effective target at or above 44px while the
chrome keeps a pointer-appropriate density. A desktop control's visible box is
not floored at 44px: a 44px floor makes pointer chrome read as oversized, and
the hit slop holds the target instead.

The thread uses the registered Avatar and one dotted Badge. Firna owns the
decorative dot inside the pill; ordinary badges keep the plain soft treatment.
Status badges keep their intrinsic width in a layout row; a grid parent must not
stretch a pill across its entire record.
Consumer screen source must not assign interactive roles, selected/pressed
states, event handlers or keyboard focus to plain spans/divs. Use registered
controls; navigation anchors remain allowed. Two literal `tabIndex` values keep
document semantics: `-1`, which only lets a handler move focus to the element,
such as the build card's title after Cancel, or takes a frame out of the tab
order; and `0` on a `region` with an accessible name, which a keyboard reader
focuses to scroll, such as the build card's output. Consumer screen source
assigns no other `tabIndex` value. Every conditional role branch resolves to a
document role or an omitted attribute, so no role is left undetermined in
source. The avatar is decorative beside the author's name. Every registration
appears under Design in both viewports and both themes.
Package typography supplies ordinary card/thread text; custom marketing
type stays local as the [ownership rule](./shared-controls.md#imports-and-ownership) specifies.

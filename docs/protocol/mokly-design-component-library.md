# Mokly Design Component Library Inventory

## Components And Saved Examples

Each row defines parent `design/library/{group}/{slug}` and its variant entries under the
[variant contract](./mokly-variants.md). Each variant's slug is the table's
kebab-case name, so its path is the parent's path plus that name, and every
file name follows the [artifact contract](./mokly-artifact-paths.md). A
variant's props replace the parent's own props key by key, so the parent's own
`props` hold the keys that every variant sets, with the first listed variant's
values. The parent page shows its own example first, then each variant. A slot
holds caller content: the parent's own example renders without slot content,
and only its variants and the screens that compose it fill slots.

Group indexes are pure galleries, containing at most five component entries.
Samples are light-only except the appearance selector and the top bar that
composes it, whose own subject is the catalogue's appearance: those render in
both schemes like the Canvas screens, and the outer viewer shows both
renders under the [preview scheme
rules](./mokly-shell-device-chrome.md#color-scheme). A dual-scheme sample
derives the props whose own subject is the scheme from its render context
rather than pinning them in its fixture, so the top bar's samples name the
scheme they rendered for; a fixture sets such a prop only to depict a different
setting, as the `auto-appearance` sample does.

| Group / slug                  | Variant names                                                                                                                                 |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| chrome / top-bar              | `default`, `search`, `tag-picker`, `drawer-open`, `auto-appearance`                                                                           |
| chrome / catalogue-navigation | `all`, `changes`, `empty`, `drawer`, `loading`, `preparing`, `unavailable`, `variants`, `changed-variants`, `folder-screen`, `changed-member` |
| chrome / screen-header        | `screen`, `component`, `changed`, `removed`                                                                                                   |
| chrome / appearance-selector  | `auto`, `light`, `dark`, `compact`                                                                                                            |
| controls / view-controls      | `default`, `both`, `highlighted`, `unavailable`, `changed-views`                                                                              |
| controls / tag-picker         | `all`, `selected`, `empty`                                                                                                                    |
| controls / tag-chip           | `default`, `selected`, `inactive`                                                                                                             |
| controls / change-status      | `unmodified`, `added`, `changed`, `removed`                                                                                                   |
| inspector / inspector         | `details`, `props`, `closed`                                                                                                                  |
| inspector / metadata-row      | `text`, `code`, `linked`, `tags`                                                                                                              |
| inspector / prop-field        | `text`, `boolean`, `invalid-number`, `select`, `optional-unset`                                                                               |
| preview / device-frame        | `phone`, `browser`, `dark`, `light-only`, `failed`                                                                                            |
| preview / empty-state         | `home`, `missing-route`, `no-changes`                                                                                                         |

The [Canvas viewer parts](./mokly-design-component-library-canvas.md) page
lists the other eleven components: the `canvas` and `panels` groups, and the
Frames filter and the box model of the `inspector` group.

The kept tag picker screen of the
[shell design inventory](./mokly-shell-design-inventory.md) is the only
screen that renders four of the parts above: `chrome/screen-header`,
`controls/view-controls`, `inspector/inspector` and `preview/device-frame`.
No Canvas screen renders them.

Each variant depicts the corresponding screen state with complete explicit
props, apart from the render-context fallback a dual-scheme sample uses above.
A sample never renders its complete owning artboard. The kept tag picker
screen uses the icon panel for its selected-screen footer and the grouped
icons for the viewport control. No disclosure variant or segmented viewport
presentation is supported.

## Data, Slots And Controls

Lists are typed arrays of plain records; optional means omitted, distinct
from an empty value. Numbers are finite, counts/depth are nonnegative integers
and step numbers start at one. Logical destinations are current catalogue
paths from the [design-link contract](./mokly-design-links.md), never raw URLs
or guessed labels. The catalogue's resource and prop limits apply. Controls
below use text, boolean, number and primitive enum selections only.

1. **Top bar:** an optional query string; menu state `none/open/close`;
   available tag records, optional active tag and picker-open flag; explicit
   navigation destinations; and an `auto/light/dark` interface appearance that
   falls back to the render context's scheme. Controls: query,
   picker-open, menu state and appearance. The appearance setting is the
   catalogue's own and is the design catalogue's only appearance control. This
   component owns it, so every artboard with a top bar draws it; screens do not
   opt in. The value defaults to the scheme the file was rendered for and is
   overridden only to depict a different setting, as the `auto-appearance`
   sample does.
   Brand/search structure belongs to this component;
   it composes the registered picker, chip and appearance selector. Mobile keeps
   compact branding.
2. **Catalogue navigation:** row records with stable key, label, kind
   `folder/screen/component/flow/page/document/variant`, depth, optional
   count/open/destination, changed mark, moved flag, and variant-list state; a variant row
   requires `variantParentKind: "screen" | "component"`, and `contents` marks a
   folder's own screen whose list also holds the folder's members after its
   variants and names its disclosure for the contents; selected destination,
   All/Changes state, changed count and presentation
   `responsive/drawer`, and optional Changes availability
   `ready/pending/preparing/unavailable`.
   Controls: All/Changes, availability and presentation. A `variant` row is a
   leaf one depth below its parent while that list is open; it never counts as a
   folder child. Its icon overlaps two outlines of `variantParentKind`, so
   screen and component variants remain distinct and muted. A parent carrying a variant list adds a trailing 16px
   chevron disclosure button with its own expanded state and accessible name;
   the row link is unchanged. The changed mark is a trailing dot, never an edge or
   rail. A moved row's label ends in `· Moved` and, like a Removed row, it takes
   no changed mark; its disclosure keeps the entry's own title as its name. The
   sections are `Specs` and `Components`, one tree filtered by kind. Pending and preparing
   both reserve the count slot with a spinner and replace selected Changes rows
   with their own message; only preparing adds a secondary detail line beneath
   its title. Unavailable keeps the tabs with a dash and one plain message for
   every failure. Counts and rows come from the same fixture scenario.
   Responsive uses the desktop sidebar and the mobile drawer; the drawer
   variant explicitly depicts the drawer.
3. **Screen header:** title, breadcrumb records, optional path chip and
   optional `unmodified/added/changed/removed` status. An `actions` slot holds
   caller controls. Controls: title and optional status. The header composes
   the change status and draws no comparison band.
4. **View controls:** selected preview `mobile/desktop/both`, the highlight
   state, optional unavailable reason
   `empty/unavailable/loading/failed/comparison/removed` in the shell's own
   words, and optional changed views as viewport/scheme records. Controls:
   selection, highlight and reason. A changed view marks the viewport dropdown
   when its viewport is not selected; `both` never marks the dropdown. The
   top-bar Appearance selector marks changes in another scheme. Both marks
   describe evidence about other views, and the details inspector names them.
   The single header icon group contains the viewport dropdown and the
   highlight toggle, in the state that the shell shows for the depicted view;
   one Appearance control sets the catalogue scheme.
5. **Tag picker:** tag records containing stable id, label and optional
   destination, plus optional active id, the open flag and an optional toggle
   destination. Controls: optional active tag, with the forms and onboarding
   tags as examples. It draws the search field's tag button and, while open,
   its panel, whose chips are the registered tag chip; a closed picker draws
   only its button. An empty tag list hides the picker; the outer inspector
   can still inspect the empty variant.
6. **Tag chip:** stable tag id, label, selected state and optional destination.
   Controls: label and selected state. Missing destinations stay non-links;
   repeated picker/metadata instances are keyed by tag identity, not label.
7. **Change status:** `unmodified/added/changed/removed` status. Control: status.
   It is a pictured badge; it does not set the actual outer component's change
   status, comparison eligibility or Changes membership.
8. **Inspector:** ordered plain tabs with id/label, initial tab or `closed`,
   initial mobile-sheet size and named `info`, `components`, `props`, `usage`
   slots containing caller-owned bodies. Controls: initial tab and sheet size.
   The sample initial-tab control offers only its supplied Details/Props/Usage
   tabs and Closed. Available tabs follow the provided list. A screen with only
   metadata supplies Details alone. Opening and closing tabs is native and keeps
   the current screen and query. The shared workspace supplies desktop resizing
   and mobile-sheet placement and sizing; the inspector owns the sheet surface,
   and the open mobile dock spans the workspace width. The icon strip stays
   fixed while content scrolls. There are no alternate presentation, behavior or
   destination props.
9. **Metadata row:** label plus a `children` slot for text, code, links or tags.
   Control: label. An explicit `metadata/props` presentation chooses between a
   plain `div` row and a `dt`/`dd` pair inside a `dl`. Registered chips may be
   supplied by the screen through the slot; row framing must not take
   ownership of their values or of source/doc paths.
10. **Prop field:** label, stable input id, optional description/error and
    optional-field/supplied flags; a `control` slot contains the native input or
    selection control. Controls: label and optional description/error. Typed
    field values and disabled/read-only behavior stay with the caller's slot,
    while the field frames that control's surface, border and invalid state so
    a prop panel reads the same in every host.
    Label, input, and error associations hold, and repeated forms use unique
    ids. This is reusable field framing, not a forms or schema engine.
11. **Device frame:** device `phone/browser`, depicted dark state, light-only
    note, compact-phone and expandable flags, browser address, and an optional
    retry destination that depicts a failed load whose Try again opens it;
    `children` is the screen-content slot. Controls: device, dark state, compact frame and
    address. It stands on a stage and names its viewport above the chrome, as
    the shell's frames do. No screen draws its own frame caption.
    Depicted device is independent of render viewport. Saved phone samples use
    compact sizing so the whole phone fits both viewports. Turning compact
    sizing off preserves the full-size frame in a scrolling host.
12. **Empty state:** no required prop: an optional title, body, code, action
    label, destination, and busy flag. The busy flag marks a loading state,
    sets `aria-busy`, and makes the body a status. On a page that the shell
    draws before it has a catalogue, it stands alone in the viewer root, in
    the root's appearance, as the shell's startup states do.
    Controls: title, body, loading and action label. It keeps the canonical
    recovery links and non-interactive cases and adds no library-specific
    navigation.
13. **Appearance selector:** the catalogue's `auto/light/dark` setting and a
    compact flag for narrow bars. Controls: setting and compact. It is a native
    selection control named Appearance, holding one value. It is the
    catalogue's single appearance setting, and the [standalone appearance
    control](./mokly-viewer-appearance-standalone.md#choosing-a-value) says
    which previews follow it. It does not fabricate a native open list.

Screens map their scenario data to these semantic fields. No component takes
an uncontrolled catch-all object, a per-screen CSS string, or a function prop.
Components expose only supported controls. Optional props can be unset. Slots
and list data stay inspectable with their real supplied values.

## Styles, Hosts And Screen Families

The [design components contract](./mokly-design-components.md) gives each
component's stylesheet location. A component's sheet holds a rule only when
every element that the rule styles belongs to that component. Decorative icons
and shared tokens can stay in shared styles. Cross-component `:has()`
behaviour stays in the documented shared layout and state sheets unless it is
genuinely isolated. A registration or fixture change is a metadata or
rendered-output change, never path-based implementation evidence.

Every library component declares its own exclusive local CSS delivery root in
`stylesheets`. The [component stylesheet contract](./mokly-component-stylesheets.md)
links only components actually rendered in a view, including nested components
and transient prop edits; an absent child adds no link. CSS changes use
[own-page rule matches](./mokly-css-attribution-rules.md), not declared owners.
Mixed and global sheets stay in configured rules. Standalone samples render in
a minimal host with design tokens, the screens' root classes, required
semantic parents (such as a `dl` for prop rows), bounded panel dimensions, and
enough overflow space for popovers and frames. The host supplies no hidden
scenario data and no other full-screen component.

| Design family     | Required components                                                                                                                                                                     |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Kept Browse state | Top bar, navigation, header, view controls, device frame and inspector, and the tag picker and tag chips that the state shows                                                           |
| Canvas viewer     | Top bar, floating panel and phone dock, except on the startup states; frame and panel tabs with an entry; the zoom pill while the canvas holds a section; the other parts a state shows |

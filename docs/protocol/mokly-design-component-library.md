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
both schemes so the outer Appearance control switches them like the appearance
screens. A dual-scheme sample derives the props whose own subject is the scheme
from its render context rather than pinning them in its fixture, so the top
bar's samples name the scheme they rendered for; a fixture sets such a prop only
to depict a different setting, as the `auto-appearance` sample does.

| Group / slug                  | Variant names                                                                                                                                 |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| chrome / top-bar              | `default`, `search`, `tag-picker`, `drawer-open`, `auto-appearance`                                                                           |
| chrome / catalogue-navigation | `all`, `changes`, `empty`, `drawer`, `loading`, `preparing`, `unavailable`, `variants`, `changed-variants`, `folder-screen`, `changed-member` |
| chrome / screen-header        | `screen`, `component`, `changed`, `removed`                                                                                                   |
| chrome / appearance-selector  | `auto`, `light`, `dark`, `compact`                                                                                                            |
| controls / comparison-toolbar | `current`, `side-by-side`, `overlay`, `difference`, `side-by-side-apart`                                                                      |
| controls / view-controls      | `default`, `both`, `highlighted`, `unavailable`, `changed-views`                                                                              |
| controls / tag-picker         | `all`, `selected`, `empty`                                                                                                                    |
| controls / tag-chip           | `default`, `selected`, `inactive`                                                                                                             |
| controls / change-status      | `unmodified`, `added`, `changed`, `removed`                                                                                                   |
| inspector / inspector         | `details`, `props`, `closed`                                                                                                                  |
| inspector / metadata-row      | `text`, `code`, `linked`, `tags`                                                                                                              |
| inspector / prop-field        | `text`, `boolean`, `invalid-number`, `select`, `optional-unset`                                                                               |
| preview / device-frame        | `phone`, `browser`, `dark`, `light-only`                                                                                                      |
| preview / comparison-pane     | `before`, `current`, `missing-before`, `missing-current`                                                                                      |
| preview / empty-state         | `home`, `missing-route`, `no-changes`                                                                                                         |
| preview / flow-step           | `first`, `second`                                                                                                                             |

Each variant depicts the corresponding screen state with complete explicit
props, apart from the render-context fallback a dual-scheme sample uses above.
A sample never renders its complete owning artboard. All selected-screen
footers use the icon panel and the viewport control uses the grouped icons. No
disclosure variant or segmented viewport presentation is supported.
Comparison modes keep their segments.

## Data, Slots And Controls

Lists are typed arrays of plain records; optional means omitted, distinct
from an empty value. Numbers are finite, counts/depth are nonnegative integers
and flow numbers start at one. Logical destinations are current catalogue
paths from the [design-link contract](./mokly-design-links.md), never raw URLs
or guessed labels. The catalogue's resource and prop limits apply. Controls
below use text, boolean, number and primitive enum selections only.

1. **Top bar:** query and placeholder strings; menu state `none/open/close`;
   text or icon menu presentation; available tag records, optional active
   tag and picker-open flag; explicit navigation destinations; and an
   `auto/light/dark` interface appearance that falls back to the render
   context's scheme. Controls: query,
   picker-open, menu state and appearance. The appearance setting is the
   catalogue's own and is the only scheme control in the design catalogue. This
   component owns it, so every artboard with a top bar draws it; screens do not
   opt in. The value defaults to the scheme the file was rendered for and is
   overridden only to depict a different setting, as the Auto artboard does.
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
3. **Screen header:** title, breadcrumb records, optional path chip,
   optional `unmodified/added/changed/removed` status, explicit comparison
   eligibility/mode, the Scroll together state and destinations. An `actions`
   slot holds caller controls. Controls: title and optional status. The header
   composes the change status and the comparison toolbar. An ineligible screen
   state shows no comparison band.
4. **Comparison toolbar:** `current/side-by-side/overlay/difference` mode,
   explicit eligible state, accessibility flag, Scroll together state and
   available mode destinations. Controls: mode, eligibility and Scroll together.
   Ineligible renders no band; stories depicting a band supply eligible fixture
   data. A diff mode draws the native Scroll together switch between the mode
   group and Refresh, and `side-by-side-apart` saves it off; Current draws
   neither. The band keeps its opaque background and refresh depiction, and each
   screen family keeps its linked, native, or inactive mode behaviour.
5. **View controls:** selected preview `mobile/desktop/both`, optional
   highlight state, unavailable reason `empty/unavailable/comparison/removed`,
   and optional changed views as viewport/scheme records. Controls: selection,
   highlight and reason. A changed view marks the viewport dropdown when its
   viewport is not selected; `both` never marks the dropdown. The top-bar
   Appearance selector marks changes in another scheme. Both marks describe
   evidence about other views, and the details inspector names them. The single
   header icon group contains the viewport dropdown and optional highlight
   toggle; one Appearance control sets the catalogue scheme.
6. **Tag picker:** tag records containing stable id, label and optional
   destination, plus optional active id. Controls: optional active tag, with
   the forms and onboarding tags as examples. An empty tag list hides the
   picker; the outer inspector can still inspect the empty variant.
7. **Tag chip:** stable tag id, label, selected state and optional destination.
   Controls: label and selected state. Missing destinations stay non-links;
   repeated picker/metadata instances are keyed by tag identity, not label.
8. **Change status:** `unmodified/added/changed/removed` status. Control: status.
   It is a pictured badge; it does not set the actual outer component's change
   status, comparison eligibility or Changes membership.
9. **Inspector:** ordered plain tabs with id/label, initial tab or `closed`,
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
10. **Metadata row:** label plus a `children` slot for text, code, links or tags.
    Control: label. An explicit `metadata/props` presentation chooses between a
    plain `div` row and a `dt`/`dd` pair inside a `dl`. Registered chips may be
    supplied by the screen through the slot; row framing must not take
    ownership of their values or of source/doc paths.
11. **Prop field:** label, stable input id, optional description/error and
    optional-field/supplied flags; a `control` slot contains the native input or
    selection control. Controls: label and optional description/error. Typed
    field values and disabled/read-only behavior stay with the caller's slot,
    while the field frames that control's surface, border and invalid state so
    a prop panel reads the same in every host.
    Label, input, and error associations hold, and repeated forms use unique
    ids. This is reusable field framing, not a forms or schema engine.
12. **Device frame:** device `phone/browser`, optional caption, a `scheme`
    flag that adds the rendered scheme to the caption, depicted dark state,
    light-only note, compact-phone and expandable flags, browser address;
    `children` is the screen-content slot. Controls: device, scheme in caption,
    dark state, compact frame and address. The component explorer previews
    caption their frames through the `scheme` flag, so no screen draws its own
    frame caption. Depicted device is independent of render viewport. Saved
    phone samples use compact sizing so the whole phone fits both viewports.
    Turning compact sizing off preserves the full-size frame in a scrolling
    host.
13. **Comparison pane:** side `before/after`, label, state `present/missing`,
    optional missing message and `children` slot. Controls: label, state and
    optional message. Missing state hides the content slot and shows the
    explicit missing pane; comparison-grid layout remains caller-owned.
14. **Empty state:** no required prop: an optional title, body, code, action
    label, destination, and busy flag. The busy flag marks a loading state,
    sets `aria-busy`, and makes the body a status.
    Controls: title, body, loading and action label. It keeps the canonical
    recovery links and non-interactive cases and adds no library-specific
    navigation.
15. **Flow step:** positive step number, title, description, the owning
    screen's title and path, and `children` slot containing the reused screen
    preview. The reference reads `This screen in the catalogue: <title> →`.
    Controls: number, title, description and screen title. References point to
    the standalone owning screen, and a flow never becomes the home of screen
    markup.
16. **Appearance selector:** the catalogue's `auto/light/dark` setting and a
    compact flag for narrow bars. Controls: setting and compact. It is a native
    selection control named Appearance, holding one value; it is the catalogue's
    single setting, so the value it holds is also the scheme the previews
    around it follow, and it does not fabricate a native open list.

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

| Design family                                        | Required components                                                                                                       |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Browse, tag, scheme, missing-route and drawer states | Top bar, navigation, header, relevant tag/control/frame/inspector/empty components                                        |
| Changes and review outcomes                          | Shared chrome, eligible comparison toolbar, device frames, comparison panes and inspector; empty states where applicable  |
| Component pages, states and inspection               | Shared chrome/status/view controls, inspector/metadata and comparison parts; fixture previews remain content              |
| Component controls states                            | Shared chrome/inspector plus repeated prop-field framing; fixture values and validation outcomes remain explicit          |
| Use-case depiction                                   | Shared chrome, flow steps and framed owning screen content                                                                |
| Appearance states, panels and status                 | Shared chrome plus the appearance selector, and the navigation, header, frame, inspector, comparison and empty components |

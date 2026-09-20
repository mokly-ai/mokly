# Mokly Design Component Library Inventory

## Delivery Status

Delivered inventory for [design component adoption](./mokly-design-components.md).
Source paths below are relative to `examples/basic/entries/design/` and identify
the original composition points, which now delegate to registered implementations
in `library/{group}/{slug}.view.tsx`. Saved pages and consuming artboards share
those implementations.

## Components And Saved Examples

Each row defines `design-ui-{slug}` at `design/library/{group}/{slug}.html`.
The first listed variant is the default. Every variant has mobile and desktop
output; the existing shell selects one saved variant at a time.
Group indexes are pure galleries, containing at most five component entries.
Samples are light-only except the appearance selector and the top bar that
composes it, whose own subject is the catalogue's appearance: those render in
both schemes so the existing preview control switches them like the appearance
screens. A dual-scheme sample derives the props whose own subject is the scheme
from its render context rather than pinning them in its fixture, so the top
bar's samples name the scheme they rendered for; a fixture sets such a prop only
to depict a different setting, as the `auto-appearance` sample does.

| Group / slug                  | Existing implementation                                             | Saved variant ids                                                          |
| ----------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| chrome / top-bar              | `parts/top_bar.tsx`, `parts/tag_filter.tsx`                         | `default`, `search`, `tag-picker`, `drawer-open`, `auto-appearance`        |
| chrome / catalogue-navigation | `parts/nav.tsx`, scenario data in `components/parts/navigation.tsx` | `all`, `changes`, `empty`, `drawer`, `loading`, `preparing`, `unavailable` |
| chrome / screen-header        | `parts/shell.tsx: ScreenHead`                                       | `screen`, `component`, `changed`, `removed`                                |
| chrome / appearance-selector  | new for the appearance mockups                                      | `auto`, `light`, `dark`, `compact`                                         |
| controls / comparison-toolbar | `parts/compare.tsx: CompareToolbar`                                 | `current`, `side-by-side`, `overlay`, `difference`                         |
| controls / view-controls      | `components/parts/view_controls.tsx`, `parts/shell.tsx: ViewSwitch` | `default`, `both`, `highlighted`, `unavailable`                            |
| controls / tag-picker         | `parts/tag_filter.tsx: TagPicker`                                   | `all`, `selected`, `empty`                                                 |
| controls / tag-chip           | `parts/tag_filter.tsx: TagChips`                                    | `default`, `selected`, `inactive`                                          |
| controls / change-status      | `components/parts/comparison_details.tsx: ChangeStatusBadge`        | `unmodified`, `added`, `changed`, `removed`                                |
| inspector / inspector         | `parts/details.tsx`, `components/parts/inspector.tsx`               | `details`, `props`, `closed`                                               |
| inspector / metadata-row      | `parts/metadata_row.tsx: MetaRow`, shared details/prop rows         | `text`, `code`, `linked`, `tags`                                           |
| inspector / prop-field        | `components/controls/parts/fields.tsx: field chrome`                | `text`, `boolean`, `invalid-number`, `select`, `optional-unset`            |
| preview / device-frame        | `parts/stage.tsx: PhoneFrame/BrowserFrame`                          | `phone`, `browser`, `dark`, `light-only`                                   |
| preview / comparison-pane     | `parts/compare.tsx: Pane/MissingPane`                               | `before`, `current`, `missing-before`, `missing-current`                   |
| preview / empty-state         | `parts/stage_content.tsx: EmptyState`                               | `home`, `missing-route`, `no-changes`                                      |
| preview / flow-step           | `parts/stage_content.tsx: FlowStep`                                 | `first`, `second`                                                          |

Fixtures for each variant come from the corresponding existing screen state,
assembled into complete explicit props at declaration time, apart from the
render-context fallback a dual-scheme sample uses above. They may reuse the
same typed fixture values used by screen adapters. They never import/render the
complete owning artboard. All selected-screen footers use the icon panel and the
viewport control uses the grouped icons. The legacy disclosure variant and
segmented viewport presentations are removed. Comparison-mode segments remain.

## Data, Slots And Controls

Use literal object schemas and the existing validator/codec. Lists are typed
arrays of plain records; optional means omitted, distinct from an empty value.
Numbers are finite, counts/depth are nonnegative integers and flow numbers start
at one. Logical destinations are existing catalogue ids from the design-link
contract, never raw URLs or guessed labels. Existing resource/prop budgets apply.
Controls below use text, boolean, number and primitive enum selections only.

1. **Top bar:** query and placeholder strings; menu state `none/open/close`;
   existing text/icon menu presentation; available tag records, optional active
   tag and picker-open flag; explicit navigation destinations; and an
   `auto/light/dark` interface appearance that falls back to the render
   context's scheme. Controls: query,
   picker-open, menu state and appearance. The appearance setting is the
   catalogue's own and is the only scheme control in the design catalogue. This
   component owns it, so every artboard with a top bar draws it; screens do not
   opt in. The value defaults to the scheme the file was rendered for and is
   overridden only to depict a different setting, as the Auto artboard does.
   Brand/search structure belongs to this component;
   it composes the registered picker, chip and appearance selector. Preserve compact mobile branding.
2. **Catalogue navigation:** row records with stable key, label, kind
   `collection/screen/component/flow`, depth, optional count/open/destination;
   selected destination, All/Changes state, changed count and presentation
   `responsive/drawer`, and optional Changes availability
   `ready/pending/preparing/unavailable`.
   Controls: All/Changes, availability and presentation. Pending and preparing
   both reserve the count slot with a spinner and replace selected Changes rows
   with their own message; only preparing adds a secondary detail line beneath
   its title. Unavailable keeps the tabs with a dash and one plain message for
   every failure. Counts and rows come from the same fixture scenario. Responsive uses the original desktop
   sidebar/mobile drawer; the drawer variant explicitly depicts the drawer.
3. **Screen header:** title, breadcrumb records, optional entry-id chip,
   optional `unmodified/added/changed/removed` status, explicit comparison
   eligibility/mode and destinations. An `actions` slot holds caller controls.
   Controls: title and optional status. Compose the status/toolbar implementations
   without introducing a comparison band into ineligible screen states.
4. **Comparison toolbar:** `current/side-by-side/overlay/difference` mode,
   explicit eligible state, accessibility flag and available mode destinations.
   Controls: mode and eligibility. Ineligible renders no band; stories depicting
   a band supply eligible fixture data. Preserve the opaque background, refresh
   depiction and current linked/native/inactive behavior for each screen family.
5. **View controls:** selected preview `mobile/desktop/both`, optional
   highlight state and unavailable reason `empty/unavailable/comparison/removed`.
   Controls: selection, highlight and reason. The single icon group lives in the
   screen header: viewport dropdown and optional highlight toggle. The component
   carries no scheme control, because one Appearance control in the top bar sets
   the whole catalogue. The dropdown controls actual mobile/desktop previews
   inside the bounded scrolling workspace.
6. **Tag picker:** tag records containing stable id, label and optional
   destination, plus optional active id. Controls: optional active tag using
   the existing forms/onboarding examples. Empty input follows the current hidden
   picker behavior; the outer inspector can still inspect the empty variant.
7. **Tag chip:** stable tag id, label, selected state and optional destination.
   Controls: label and selected state. Missing destinations remain non-links;
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
   fixed while content scrolls. There are no legacy presentation, behavior or
   destination props.
10. **Metadata row:** label plus a `children` slot for text, code, links or tags.
    Control: label. Keep the correct existing `div`/`dl` semantics through an
    explicit `metadata/props` presentation. Registered chips may be supplied by
    the screen through the slot; row framing must not take ownership of their
    values or of source/doc paths.
11. **Prop field:** label, stable input id, optional description/error and
    optional-field/supplied flags; a `control` slot contains the native input or
    selection control. Controls: label and optional description/error. Typed
    field values and disabled/read-only behavior remain with the caller's slot,
    while the field frames that control's surface, border and invalid state so
    a prop panel reads the same in every host.
    Preserve label/input/error associations and assign unique ids for repeated
    forms. This is reusable field framing, not a new forms or schema engine.
12. **Device frame:** device `phone/browser`, optional caption, depicted dark
    state, light-only note, compact-phone and expandable flags, browser address;
    `children` is the screen-content slot. Controls: device, dark state, compact frame and
    address. Depicted device is independent of render viewport. Saved phone samples use compact sizing so the whole phone fits both viewports.
    Turning compact sizing off preserves the full-size frame in a scrolling host.
13. **Comparison pane:** side `before/after`, label, state `present/missing`,
    optional missing message and `children` slot. Controls: label, state and
    optional message. Missing state hides the content slot and uses the existing
    explicit missing pane; comparison-grid layout remains caller-owned.
14. **Empty state:** title, body, optional code, action label and destination.
    Controls: title, body and action label. Retain the existing canonical recovery
    links and non-interactive cases rather than adding library-specific navigation.
15. **Flow step:** positive step number, title, description, owning screen id
    and `children` slot containing the reused screen preview. Controls: number,
    title and description. References still point to the standalone owning
    screen, and flows never become the original home of screen markup.
16. **Appearance selector:** the catalogue's `auto/light/dark` setting and a
    compact flag for narrow bars. Controls: setting and compact. It is a native
    selection control named Appearance, holding one value; it does not change
    any preview's colour scheme and does not fabricate a native open list.

Scenario adapters explicitly map current names to these semantic fields. Do not
add uncontrolled catch-all objects, per-screen CSS strings or function props to
avoid an adapter. Only expose supported controls; optional props can be unset,
while slots and list data remain inspectable with their real supplied values.

## Styles, Hosts And Adoption Coverage

The core contract specifies exact component-owned file locations. Extract rules
from the existing source sheet into that owner's sheet only when all affected
elements belong to its implementation. Decorative icons and shared tokens can
remain shared dependencies; existing cross-component `:has()` behavior stays in
documented shared layout/state sheets unless genuinely isolated.
Keep registered definitions/variant fixtures outside the exclusive `.view.tsx`
implementation and its dependency declarations, so editing an example alone
cannot be mistaken for a shared implementation change.

Every library route needs ordered stylesheet candidates covering all descendant
components, slot examples and supported prop edits. The per-render collector
specified in the core contract selects only the exclusive sheets actually used
by that view; a union of every variant's emitted links would incorrectly attribute
absent-child CSS changes to parents. Retain required mixed/global sheets; remove
only migrated selectors from them, preserving their remaining behavior.
Use a minimal host for standalones, with design tokens, original root classes,
required semantic parents (such as a `dl` for prop rows), bounded panel dimensions
and enough overflow space for popovers and frames.
The host must not supply hidden scenario data or another full-screen component.

| Existing design family                               | Required reuse                                                                                                                     |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Browse, tag, scheme, missing-route and drawer states | Top bar, navigation, header, relevant tag/control/frame/inspector/empty components                                                 |
| Changes and review outcomes                          | Shared chrome, eligible comparison toolbar, device frames, comparison panes and inspector; empty states where applicable           |
| Component pages, states and inspection               | Shared chrome/status/view controls, inspector/metadata and comparison parts; existing fixture previews remain content              |
| Component controls states                            | Shared chrome/inspector plus repeated prop-field framing; fixture values and validation outcomes remain explicit                   |
| Use-case depiction                                   | Shared chrome, flow steps and framed owning screen content                                                                         |
| Appearance states, panels and status                 | Shared chrome plus the appearance selector, and the existing navigation, header, frame, inspector, comparison and empty components |

Adoption tests enumerate the actual owning screen inventory, assert the expected
component ids per viewport, and verify there are no calls bypassing the registered
implementations at migrated composition points. Test ids/routes and behavior,
not raw marker counts. Keep existing visual contracts and meaningful source
attribution coverage when replacing old exact counts with the expanded inventory.

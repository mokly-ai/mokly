# Registered Components In Mokly's Design Catalogue

## Delivery Status

Implemented in the basic consumer. All 56 existing design screens retain their
112 mobile/desktop fragments and now record shared component instances. Fifteen
registered components and 56 saved variants live under Components → Design → Shared components,
alongside the separate Example Action and Toolbar.

This contract and the [library inventory](./mokly-design-component-library.md)
define the delivered behavior tracked by the [adoption plan](../../plans/mokly-design-components.md).
The existing [shell design](./mokly-shell-design.md),
[design links](./mokly-design-links.md), and component design contracts retain
their current screen behavior and navigation authority.

## Outcome And Scope

Give Mokly's shared design UI its own real component pages, saved variants,
editable local props and recorded consumers. Existing Browse, Changes, component
explorer, inspection and controls artboards must render the same registered
implementations used by those pages. One component implementation or owned-style
edit appears at its component entry; consuming artboards are affected unless
they also have independent changes.

This is adoption under `examples/basic/entries/design`, the repository's owning
mockup catalogue. It does not replace the package's actual browser/server shell
with example code or move consumer fixtures into package runtime code. Existing
Example Action/Toolbar components, miniature subject screens and pictured usage
fixtures keep their separate roles. New usage in the outer inspector comes from
the real generated manifest, not from those pictured fixtures.

All existing design ids, routes, relationships, mobile/desktop artboards, copy,
links and supported native controls remain. The requested normalization replaces
the legacy Details disclosure and segmented viewport/theme controls throughout
the catalogue with the shared icon inspector and view toolbar. The legacy footer
variant and its presentation/behavior fields are removed, not retained as options.
New component entry metadata belongs outside the rendered sample;
samples contain no implementation notes, environment badges or extra footers.

## Catalogue And Source Ownership

Add `Components → Design → Shared components` from the same authored root that
places `Pages → Design → Mokly design` in the Pages projection. Keep the
existing Component explorer design section and Components → Example → Components group.
The new pure gallery collections are `design-library` and
`design-library-{chrome,controls,inspector,preview}`. They contain the 15 routed
components in the inventory, with no duplicate screen entries for variants.

Use flat `defineComponent`/`defineCollection` exports from
`entries/design/library/library.mockup.ts`, adding `design-library` to the
existing `design-root.childIds`. The current nested `collection` marker accepts
screens and collections, not component entries; this adoption must not cast
components into that marker or require a new package API.

For inventory group `G` and slug `S`:

- Component id: `design-ui-S`; route: `design/library/G/S.html`.
- Registration/schema/variants: `entries/design/library/G/S.tsx`, split into
  short metadata siblings if needed. Render logic: `G/S.view.tsx` and its
  exclusive implementation helpers. Source and visible hierarchy must agree.
- Public stylesheet: `generated/design-library/G/S.css` when styles are owned
  exclusively by that component. It is authored CSS, not generated HTML.
- Saved variant ids and exposed props are defined by the inventory. A single
  selected variant renders at a time, in both actual viewport contexts.

Gallery-only collection indexes need no additional canonical artboard. Any
later screen-spec sub-page must retain the canonical-screen and five-screen
limits; variants must not become an unbounded screenshot gallery.

## Reuse And Component Boundaries

Extract from the existing `parts` and `components/parts` implementations; do not
create a story-only copy. Existing scenario helpers can remain as small adapters
that assemble typed data and slots, but must call the registered `.Component`.
There must be one markup/style implementation per inventory component.

Keep `Shell`, `ExplorerShell`, `ComponentLayout`, `PreviewWorkspace`, stage/grid
layout helpers and owning screen components as ordinary composition. Register
their meaningful constituent controls, panels and frames. A whole-artboard
component would make initial highlighting select nearly the entire screen and
would obscure the screen's independent content boundary.

Browse and Changes share the same bounded preview/inspector layout as component
designs. Desktop keeps the divider resize grip; mobile uses the same icon strip
and compact/expanded sheet. Only panel content and the preview scroll. Opening
and closing Details acts locally through its icon; its canonical owning artboard
remains in the catalogue. Preserve descriptions, metadata, tags and comparison
evidence when moving the previous disclosure content into its Details slot.

Selected-screen view options appear once, together in the header: a viewport
dropdown, a theme icon and highlighting where relevant. Remove the old top-bar
theme placement. Authored light/dark links retain their canonical destinations;
unsupported transitions stay disabled. Viewport changes select the actual
mobile/desktop previews without scrolling the whole page. Simultaneous previews
reserve their intrinsic minimum width and wrap when needed; full-size phone
frames must never overlap adjacent desktop content. Comparison mode
segments remain comparison controls and are not removed by this normalization.

Every owning screen keeps its separate desktop/mobile React components. Flows
continue to compose their owning screen components, with links back to those
screens. Do not turn complete screens or a `state → entire screen` renderer into
saved component variants. Icons, decorative primitives and miniature subject
screen implementations remain internal helpers unless separately specified.

Components instantiate other registered components where the child is part of
their implementation: Top bar → Tag picker → Tag chip is a required example.
Screen-provided actions, metadata content and preview documents are slots owned
by the calling screen. Repeated siblings use stable semantic `moklyInstance`
ids (such as a field key or tag id), never array positions or displayed labels.
Flow adapters require a semantic `name` independent of their destination; two
steps may reference the same screen, and reordering retains their identities.
Use slots for multi-root content without adding layout-altering wrappers.

## Inputs And Standalone Rendering

All screen-varying inputs are explicit schema-validated data props or declared
slots: titles, selected state, query, navigation destinations, counts, addresses,
status and field values. Resolve existing scenario fixtures in the screen
adapter, then pass the actual values. Do not hide a whole screen's content or
navigation behind a fixture-name prop resolved inside a registered component.

Navigation context must not be an unrecorded input. Adapt the existing explicit
navigation-state tables into plain destination records supplied to registered
components. `DesignLink`/`MockLink` remain the link boundary; absent destinations
retain the existing non-link behavior. Shared components must render outside an
owning artboard without depending on a missing `DesignNavigation` provider.

Callbacks, React nodes in nested data objects and arbitrary style objects are
not data props. Replace `PreviewWorkspace.render(viewport)`-style functions at
registered boundaries with explicit mobile/desktop content slots; keep the
unregistered composition helper if it still benefits screen authors. Adapt
`InspectorPanel.content` into the inspector's named slots plus a plain tab list.

Use the existing Firna renderer and providers. Component pages get a minimal
consumer-owned preview host supplying design tokens and any required layout
context; it lives outside the registered implementation and is not recorded as
another component. Do not embed a complete shell merely to make a button work.
Components must work in both their standalone host and original screen context.
Mobile comparison buttons, links and static labels share the same compact
sizing so the control remains usable with different system fonts.
No renderer imports of entire screen registries or circular variant imports.

All new design components use `colorSchemes: ["light"]`, like the owning
artboards. A depicted dark-preview state is an explicit prop, distinct from the
outer catalogue's color scheme. Select real mobile/desktop render contexts;
device-frame `device` chooses a pictured phone/browser independently of the
artboard viewport, so a mobile artboard may still depict a desktop comparison.

Local controls edit the selected component's supplied data and Reset restores
the saved variant. Published pages show the same examples and read-only props.
Slots and complex lists stay inspectable without inventing JSON editors or
turning the whole artboard into a second running application.

## Styles And Change Attribution

Mixed files such as `design.css`, `design-stage.css`, `design-review.css` and
`design-component-*.css` retain shared, layout and global rules after extraction.
Never declare one of these whole files owned by a single component. Separate
exclusive component selectors into the inventory's owned sheets; keep global
tokens, resets, cross-component selectors and screen layout conservatively
attributed until an actual exclusive owner exists.

Use exact `ownedDependencies` for a component's exclusive implementation modules
and stylesheet, with matching entries in its `dependencies`. Shared fixtures,
navigation tables, icons and mixed helpers are not exclusively owned. Screens
and ancestor collections must not explicitly depend on an extracted exclusive
component file: the classifier intentionally treats an exact declared screen
dependency as independent evidence. Keep their genuine layout/global dependencies.

Registration, variant fixtures and controls metadata must not live in an owned
render module or be declared implementation-impact dependencies. Their imports
are already observed by the build graph, and their values are compared as entry
metadata. Declaring their files as implementation dependencies would incorrectly
create affected consumers for a variant-only edit. Keep render transformations in the view module; registration only forwards
validated props and the actual viewport to that renderer. Test real source
edits to saved variants and control labels as well as implementation source edits.

Separate stylesheet loading from review dependency declaration. A typed consumer
style map describes ordered candidate sheets for each design route and library
entry, covering its variants and supported control states, descendants and slots.
All design rules share the ordered exclusive candidate pool in
`library/style_files.ts`; route rules select their required mixed sheets. The
pool authorizes descendant and transient rendering without emitting unused CSS.
Order the configured blocks as shared base styles, exclusive component candidates,
then context/layout overrides. Equal-specificity mobile component rules must not
override the workspace’s bounded scrolling.
Feed it into existing first-matching `config.stylesheets` rules, with specific
library rules before the broad design fallback. The example renderer uses a
fresh per-render React style collector: rendered library implementations request
their exclusive sheets, and the renderer emits only those requested candidates,
in configured order, alongside the required shared/global sheets. There is no
module-global collector or inspection of private Mokly markers. Reject an
unconfigured request rather than emitting an invented URL; preserve the supplied
validated relative hrefs. This also applies to transient prop renders.

An unused child's stylesheet must not be linked merely because another saved
variant uses that child: an absent component cannot justify suppressing that
resource in the current view. Test a closed Top bar picker and an empty Tag picker
alongside their populated variants so nested CSS edits do not become parent or
screen changes through unused stylesheet links. No shared global sheet is filtered
out as a substitute for proving exclusive ownership.
Observe new public CSS through the existing watch configuration/resource graph;
do not copy the same rules into standalone stories and screen stylesheets.

Keep descendant and state selectors working in situ and in the minimal host,
including `:has()` viewport/theme state, inspector sizing, popovers and focus
rings. Cross-component state remains explicit or a documented shared context;
class proximity is not proof of exclusive ownership.

Acceptance after a registered baseline exists:

| Edit                                                           | Direct Changes                   | Secondary evidence                        |
| -------------------------------------------------------------- | -------------------------------- | ----------------------------------------- |
| Top bar implementation or its exclusive CSS                    | Top bar                          | Consuming design screens                  |
| Nested Tag chip implementation                                 | Tag chip                         | Picker/Top bar and their screen consumers |
| A screen changes query, title, target, status or a field value | That screen                      | Actual usage updates                      |
| A screen changes supplied slot content or instance order       | That screen                      | Actual usage updates                      |
| A saved variant's props change                                 | That component                   | No automatic consumer change              |
| Global tokens or screen layout change                          | Existing conservative membership | Existing dependency evidence              |
| Temporary local prop edit or Reset                             | None                             | Preview only                              |

The initial registration migration may create legitimate one-time structural
changes against an unregistered baseline. Do not add blanket Review ignores to
hide them. Prove steady-state attribution with two fully registered snapshots.
Update existing legacy style-attribution tests deliberately: retain meaningful
global/layout assertions and use the shared component-aware classifier for
owned styles, not the old raw changed-path helper.

## Verification And Completion

Freeze the existing id/route inventory before migration and assert it remains a
subset of the finished catalogue. Every existing design screen must record its
actual shared components in both views. Every inventory component must have a
page, the specified saved variants, and real screen consumers (directly or through
composition); expected relationships are asserted against generated usage.

Tests must cover props/slot ownership, repeated/nested identity, standalone vs
in-screen geometry, working and intentionally inactive links, real usage and
highlighting, editable/reset and published read-only controls, and the attribution
matrix. Preserve comparison-bar eligibility/backgrounds, icons/carets, desktop
divider alignment, mobile sheets and bounded scrolling across the full inventory.

Build/check derived output deterministically, open every changed HTML fragment
directly from disk, smoke-test actual Serve and an exported catalogue, and verify
that no consumer scripts or fake usage data were introduced. Measure the expanded
catalogue's plain `npm run dev` startup and assert bounded baseline Git batching
by command count rather than relaxing readiness deadlines. Run the complete
repository gate before implementation delivery, then commit, push and review.

# Registered Components In Mokly's Design Catalogue

Status: In progress under the [shell views plan](../../plans/ui-package-shell-views.md).

## Scope

Mokly's shared design UI has its own component pages, saved variants,
editable local props and recorded consumers. The Browse, Changes, component
explorer, inspection and controls artboards render the same registered
implementations as those pages. One component implementation or owned-style
edit appears at its component entry; consuming artboards are affected unless
they also have independent changes.

The components live in the repository's mockup catalogue under
`examples/basic/specs/design`. The package's browser shell stays in the
package source, and consumer fixtures stay out of package runtime code. An
inventory component that the [shared UI package](./mokly-ui-package.md)
provides renders that package component through its `defineComponent`
registration. Its public stylesheet imports the package stylesheets of the
component and of each package component that it renders. The component keeps
no copy of that markup or CSS. Decision: the mockup renders
the package component, not its own copy kept aligned by tests, because two
implementations drift and one serves the product and its mockups.

A desktop render follows the shell's
[layout breakpoint](./mokly-shell-device-chrome.md#responsive-behavior), so
below it the chrome draws the shell's narrow form. Decision: no mockup rule
holds the desktop form at that width, because the mockups show what the shell
draws.

Every other artboard part that a package component provides renders that
component too, such as an artboard's shell and workspace layout, its panels
and lists, and its highlight mask. The sheet that styles such a part imports
the package stylesheets by repository path, and the artboard keeps no copy of
that markup or CSS. Decision: the rule covers the artboard scaffolds, not only
the inventory components, because an artboard copy drifts as an inventory copy
does. Those parts stay unregistered, because a gallery group holds at most
five components.

The Example Action and Toolbar components, the miniature subject screens and
the pictured usage fixtures keep their separate roles. Usage in the outer
inspector comes from the entry detail Mokly records, not from those pictured
fixtures. Samples and artboards add no consumer scripts.

Each screen uses the shared Details inspector and viewport toolbar. Top-bar
Appearance owns the scheme. The footer has one current form; no alternative
disclosure, presentation or behavior fields are supported. Comparison-mode
controls keep their segments. Component entry metadata stays outside the
rendered sample. Samples contain no implementation notes, environment badges
or extra footers.

## Catalogue And Source Ownership

`Components → Design → Shared components` sits beneath the same `Design`
folder as `Specs → Design`: a folder holding both kinds appears in both
sections with its own children in each, under the
[catalogue tree rule](./mokly-catalogue.md#tree). The Component explorer
design section and the Components → Example → Components group stay beside
it. The gallery folders are `Design → Shared components` and its `Chrome`,
`Controls`, `Inspector`, and `Preview` children. They contain the 16
component parents in the inventory; each parent's variant entries nest
beneath its row under the [variant contract](./mokly-variants.md) rather than
adding folder members.

Each component is a `defineComponent` definition. For inventory group `G` and
slug `S`:

- Component slug: `S` (for example, `style`); its path places it in gallery `G` under the
  [path contract](./mokly-paths.md).
- Public stylesheet: `design-library/G/S.css` when styles are owned
  exclusively by that component. It is authored CSS, not generated HTML. When
  the shared UI package provides the component, that sheet imports the package
  stylesheets of the component and of each package component that it renders,
  each by its repository path. It adds only mockup rules. Decision: the
  repository path, not the package name, because a comparison's base side
  renders from Git, which holds the package sources and not their build
  output; the core fix for built repository packages is a separate plan.
- Variant entry slugs, exposed props, and the parent's own props follow the
  [inventory](./mokly-design-component-library.md). Each variant entry
  renders in both viewports.

Every inventory component has a page, the specified saved variants, and real
screen consumers, directly or through composition. Every design screen
records its shared components in both views.

Gallery-only folder indexes need no additional canonical artboard. A
screen-spec sub-page keeps the canonical-screen and five-screen limits.
Variants never become an unbounded screenshot gallery.

## Reuse And Component Boundaries

Each inventory component has one markup and style implementation. Screens
render it through its registered `.Component`, and no story-only copy exists.

Shells, page layouts, preview workspaces, stage and grid layout helpers, and
owning screen components stay ordinary composition. Where the shared UI
package provides one of these parts, the composition renders the package
component. Their meaningful constituent controls, panels and frames are
registered components. A whole-artboard component would make initial
highlighting select nearly the entire screen and would obscure the screen's
independent content boundary.

Browse and Changes share the same bounded preview/inspector layout as component
designs. Desktop keeps the divider resize grip; mobile uses the same icon strip
and compact/expanded sheet. Only panel content and the preview scroll. Opening
and closing Details acts locally through its icon; its canonical owning artboard
stays in the catalogue. The Details slot holds the descriptions, metadata,
tags and comparison evidence.

Selected-screen view options appear once in the header: a viewport dropdown
and the Highlight components toggle, which every screen and component page
draws in the state that the shell shows for its view. The top-bar Appearance
selector owns the catalogue-wide scheme; there is no second scheme icon in the
header and no authored light/dark link pair. Unsupported transitions stay
disabled. Viewport changes select the actual mobile/desktop previews without
scrolling the whole page. Simultaneous previews reserve their intrinsic minimum
width and wrap when needed; full-size phone frames must never overlap adjacent
desktop content. Comparison mode segments stay comparison controls.

Every owning screen has separate desktop and mobile React components. Flows
compose their owning screen components, with links back to those screens. No
complete screen and no `state → entire screen` renderer is a saved component
variant. Icons, decorative primitives and miniature subject screen
implementations remain internal helpers unless separately specified.

Components instantiate other registered components where the child is part of
their implementation: Top bar → Tag picker → Tag chip is a required example.
Screen-provided actions, metadata content and preview documents are slots owned
by the calling screen. Repeated siblings use stable semantic `moklyInstance`
ids (such as a field key or tag id), never array positions or displayed labels.
Flow adapters require a semantic `name` independent of their destination; two
steps may reference the same screen, and reordering retains their identities.
Multi-root content uses slots, without layout-altering wrappers.

## Inputs And Standalone Rendering

All screen-varying inputs are explicit schema-validated data props or declared
slots: titles, selected state, query, navigation destinations, counts, addresses,
status and field values. Screens resolve their scenario fixtures and pass the
actual values. No registered component resolves a fixture-name prop that hides
a whole screen's content or navigation.

Navigation context is never an unrecorded input. Registered components receive
plain destination records. `MockLink` is the link boundary, and an absent
destination stays a non-link. Shared components render outside an owning
artboard without its navigation context.

Callbacks, React nodes in nested data objects and arbitrary style objects are
not data props. A registered boundary takes content slots, never a render
function. The inspector takes named slots plus a plain tab list.

Components render through the catalogue's renderer and providers. Component
pages get a minimal consumer-owned preview host supplying design tokens and
any required layout context; it lives outside the registered implementation
and is not recorded as another component. No sample embeds a complete shell
merely to make a control work. Components work in their standalone host and
in their screen context. Mobile comparison buttons, links and static labels
share the same compact sizing so the control remains usable with different
system fonts.

Design components use `colorSchemes: ["light"]`, like the artboards that own
them, except the appearance selector and the top bar that composes it: their own
subject is the catalogue's appearance, so they render in both schemes alongside
the appearance screens. A depicted dark-preview state is an explicit prop,
distinct from the outer catalogue's color scheme; the appearance artboards set
that prop from the scheme they were rendered for, so their chrome and previews
change together. Select real mobile/desktop render contexts;
device-frame `device` chooses a pictured phone/browser independently of the
artboard viewport, so a mobile artboard may still depict a desktop comparison.

Local controls edit the selected component's supplied data and Reset restores
the saved variant. Published pages show the same examples and read-only props.
Slots and complex lists stay inspectable without inventing JSON editors or
turning the whole artboard into a second running application.

## Styles And Change Attribution

Mixed files such as `design.css`, `design-stage.css`, `design-review.css` and
`design-component-*.css` hold the shared, layout and global rules. Component
selectors live in the inventory's component sheets. Shared tokens, resets,
cross-component selectors and screen layout live in configured sheets. All
these files use the same kept own-page match rule; none has an owner record
that decides attribution.

Each component declares its local CSS in its `stylesheets` array for bundled
delivery. Different components can share one file. A declaring path only says
which component inserted a link. Shared fixtures, navigation tables, icons and
mixed helpers do not establish path-based ownership or evidence. Only rendered
resources, CSS analysis, reviewable metadata and usage determine Changes.

Registration, variant fixtures and controls metadata are compared as entry
metadata, not exclusive implementation files. Their imports remain render
inputs.

Route rules select only the required mixed and global stylesheets, with the
`$componentStylesheets` marker between shared base CSS and context and layout
overrides. Mokly inserts the links of the components that a view renders, in
first-render, authored-file order. The renderer adds no stylesheet links. The
core writes the links into each document head. This applies equally to
transient prop renders; see
[component stylesheets](./mokly-component-stylesheets.md).

An unused child's stylesheet must not be linked merely because another saved
variant uses that child: an absent component cannot justify suppressing that
resource in the current view. A nested CSS edit never becomes a parent or
screen change through an unused stylesheet link, as in a closed Top bar picker
or an empty Tag picker. No shared global sheet is filtered out as a substitute
for matching changed rules to component output. Standalone stories and screen
stylesheets never hold copies of the same rules.

Descendant and state selectors work in situ and in the minimal host,
including `:has()` viewport/theme state, inspector sizing, popovers and focus
rings. Cross-component state remains explicit or a documented shared context;
class proximity is not proof of exclusive ownership.

Change attribution for these components follows the
[component change contract](./mokly-component-changes.md), including each CSS
delivery path and the input and slot rules.

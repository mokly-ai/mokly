# Shell Views In The UI Package

Status: Active. On branch `calummoore/mokly-ui-component-migration`, no pull
request yet. The work lands as a stack of five pull requests, one for each
slice, as design call 11 says. Each earlier pull request keeps this plan. The
last one deletes it, as the `plans` skill says.

`@mokly/ui` holds four parts of the Browse shell since
[PR #243](https://github.com/mokly-ai/mokly/pull/243): the icons, the change
mark, the appearance selector, and the comparison toolbar. `@mokly/viewer`
still renders the rest of the shell's markup itself. On `main` at `f93afcea`,
53 viewer `.tsx` files render 398 HTML and SVG elements directly, and 22
TypeScript string modules hold 2,576 lines of shell CSS: 21 under
`packages/viewer/src/shell` and `packages/viewer/src/viewer/styles.ts`. The
design library under `examples/basic/specs/design/library` keeps its own
markup and CSS for 14 of its 16 inventory components.

On 2026-10-29 the user asked that every styled view of the shell move to
`@mokly/ui`, so that no UI lives in `@mokly/viewer`. This plan moves all of
it. Each viewer file that renders an element splits into a package component
and a viewer container. The package component holds the markup, the local
interaction, and the CSS, and it takes props and callbacks. The viewer
container reads the store, the contexts, and the frames, and it passes the
props and the callbacks. The shell CSS moves into package CSS files: the
theme, the components, the layout, and the embedded root rules. Then the
design library renders each inventory component that the package provides,
as the [design components contract](../docs/protocol/mokly-design-components.md)
requires.

The shell does not change for a reader. The markup, the class names, the data
attributes, the ids, and the computed styles stay the same, so the viewer's
string-rendered tests, the browser specs, and host CSS keep working.

Out of scope: the removal of the embedded selector transform, which design
call 10 leaves for later, and the design catalogue's own palette in
`examples/basic/design.css`. Decision 3 settles where the highlight drawings
outside React live.

No brainstorm ran. The user's message of 2026-10-29 and decision 1 of the
[shared UI package plan](./ui-package.md) choose the approach, and the
product rule of [`AGENTS.md`](../AGENTS.md) sets the split: a component that
needs the store stays in the viewer and composes a package component. These
decisions of the shared UI package plan stay in force: 1, a separate package
whose components the design library renders; 3, happy-dom and Testing Library
for DOM tests; 4, boundary lints in the ESLint configuration; 5, kebab-case
file names; 9, the design library imports the package sources by repository
path; 11, unlayered package rules; and 12, `@mokly/ui/styles.css` is the only
stylesheet subpath.

Evidence goes under `.context/ui-package-shell-views/`.

Contract owners:

- [Shared UI package](../docs/protocol/mokly-ui-package.md): the package
  holds every element and every style rule of the shell.
- [Embeddable viewer contract](../docs/protocol/mokly-viewer.md): the
  package sentence and the theming paragraph.
- [Viewer appearance](../docs/protocol/mokly-viewer-appearance.md): the owner
  of the palette.
- [Design components](../docs/protocol/mokly-design-components.md): which
  mockup parts render the package components.
- [Package boundary](../docs/architecture/package-boundary.md): the viewer
  and UI package responsibilities.
- [`AGENTS.md`](../AGENTS.md), the
  [UI package README](../packages/ui/README.md), the
  [viewer README](../packages/viewer/README.md), the
  [shell README](../packages/viewer/src/shell/README.md), and the
  [design library README](../examples/basic/specs/design/library/README.md).

## Decisions

The four decisions were asked on 2026-10-29. Decision 1 is answered, and
decisions 2, 3, and 4 are open. Each went through
the options check of the `plans` skill. The first check added options 1 D,
1 E, and 2 D, changed the recommendation of decision 1 from C to D, and
raised decisions 3 and 4. The second check measured decisions 3 and 4, added
options 3 D, 3 E, 3 F, 4 D, 4 E, and 4 F, and changed their recommendations
from B to 3 D and 4 E. Its notes are under
`.context/ui-package-shell-views/options-check/`.

### 1. Keep UI out of the viewer with a lint

Decision 1 (2026-10-30, the user): option C, a local ESLint rule that
rejects every intrinsic element in `packages/viewer/src`, with an exemption
list that each slice empties. Rejected: the recommended D, whose rule also
rejects element-creating DOM calls and HTML strings, so markup that the
viewer builds with DOM calls stays a review matter. Rejected: A, because only
review then holds the boundary. Rejected: B, because it allows unstyled
elements that package rules still style. Rejected: E, because it sees JSX
only and can start only after the last slice.

- **Severity:** Medium. **Effort:** Medium.
- **Source:** Design.
- **Category:** Repository rule.
- **Location:** `eslint.config.js`, `scripts/eslint/`, `packages/viewer/src`.
- **Terms:**
  - **Intrinsic element:** a JSX element with a lower-case name, such as
    `<div>`, that React renders as an HTML element.
- **Background:** After this plan, `@mokly/ui` renders every element of the
  shell, and the viewer only composes package components. The import lints
  of shared UI package decision 4 stop the package from reaching into the
  viewer. No check stops a viewer file from rendering its own markup again.
  The viewer builds markup in two ways today: JSX, and DOM calls such as
  `createElement` in `client/same_origin_highlight.ts`.
- **Problem:** The rule "no UI in the viewer" has no check. Only review holds
  it.
- **Impact if no action:** UI returns to the viewer over time. Then the
  product and the design mockups drift again.
- **Root question:** How does the repository keep new UI out of the viewer?
- **Options:**
  - **A.** Change nothing. The product rule of `AGENTS.md` and review hold
    the boundary. Effort: Small.
  - **B.** Add a local ESLint rule that rejects a `className` or `style` prop
    on an intrinsic element in `packages/viewer/src`. Unstyled elements, such
    as a bare `<div>`, stay allowed. 141 of the 398 elements have neither
    prop, and package rules still style some of them, such as the rows of
    `.mbk-props > div`. Effort: Medium.
  - **C.** Add a local ESLint rule that rejects every intrinsic element in
    `packages/viewer/src`, so that the viewer renders only package
    components, fragments, providers, and portals. During the plan, a file
    list in the rule exempts the files that later slices move, and each slice
    empties its part of the list. Effort: Medium.
  - **D.** C, and the same rule also rejects a DOM call that creates an
    element from a literal tag name, and HTML written through `innerHTML`,
    `outerHTML`, or `insertAdjacentHTML`. Three uses that are not UI stay
    exempt with a reason: the clipboard `textarea` of
    `shell/store_actions.ts`, the `<base>` and `<head>` of
    `previews/presentation_document.ts`, and the in-frame inspector under
    decision 3. Effort: Medium.
  - **E.** A typecheck-only configuration for the viewer's `src` maps
    `react/jsx-runtime` to a local declaration whose JSX namespace has no
    intrinsic elements, so `npm run typecheck` rejects `<div>` in the viewer.
    The build and the package do not read it. It sees JSX only and cannot
    exempt one file, so it can start only after milestone 15. Effort: Medium.
- **Left out:** A Node test that parses the viewer sources, because ESLint
  runs the same check, shows it in the editor, and holds the other boundary
  rules under shared UI package decision 4.
- **Wider fix:** D. It still holds when markup moves from JSX to DOM calls.
- **Previous examples:** Shared UI package decision 4 added the import lints
  of the same boundary.
- **Recommendation:** D, changed from C by the options check. D is the only
  option that sees both ways the viewer builds markup today.
- **Action:** ask the user, because condition 3 holds: the recommended
  option adds a lint.

### 2. Artboards keep copies of product views

- **Severity:** Medium. **Effort:** Large.
- **Source:** Design.
- **Category:** Mockup.
- **Location:** `examples/basic/specs/design`,
  `docs/protocol/mokly-design-components.md`.
- **Terms:**
  - **Artboard:** a design screen under `examples/basic/specs/design` that
    composes the shared design components into one depicted state.
  - **Inventory component:** one of the 16 registered components of the
    [design component inventory](../docs/protocol/mokly-design-component-library.md).
  - **Scaffold:** the artboards' own shell, workspace, and stage layout, such
    as `specs/design/parts/shell.tsx`, which draws desktop and mobile as two
    structures.
- **Background:** The design components contract makes each inventory
  component render the package component that provides it. The artboards
  also draw shell parts outside the inventory with their own markup and CSS,
  such as the Details body (`mbk-details-body`), the Props panel
  (`ce-props`), and the Usage list (`ce-usage-list`). This plan moves the
  product versions of those parts into the package. Some copies already
  differ: the artboard Details body has no padding, and the product's has
  `6px 24px 20px`.
- **Problem:** The contract does not cover those artboard copies, so they
  stay and can drift from the product.
- **Impact if no action:** An artboard can show a Details body, a Props
  panel, or a Usage list that the product does not draw.
- **Root question:** How do the design artboards keep showing the shell parts
  that the product draws, outside the 16 inventory components?
- **Options:** Every option keeps the adoption of the 14 inventory components
  in milestones 4, 7, 10, and 13.
  - **A.** Only the inventory components render package components. The
    artboard copies stay, and a follow-up item records B. Effort: Small.
  - **D.** B for panels, lists, controls, labels, and frames only, such as
    the Details body, the Props and Controls panels, the Usage list, the
    instance tree, the evidence, the variant bar, and the highlight labels.
    The scaffolds stay the artboards' own composition, which the contract
    calls ordinary composition, and a follow-up item records them.
    Effort: Large.
  - **B.** Every artboard part that a package component provides renders that
    component, in the mockup milestone of the slice that moves it, the
    scaffolds included. The design components contract states the rule.
    Effort: Large.
  - **C.** Register those parts as new inventory components with their own
    pages and saved variants, then adopt them. This breaks the inventory limit
    of five components in a group: Inspector grows from 3 to about 9.
    Effort: Large.
- **Left out:** Copies that tests keep in step, because shared UI package
  decision 1 rejected that approach: two implementations drift. Artboards
  that render the viewer's store-connected shell with fixture data, because
  the contract forbids a sample that embeds a complete shell.
- **Wider fix:** B.
- **Previous examples:** Shared UI package decision 1 removed the mockup
  copies of the appearance selector and the comparison toolbar.
- **Recommendation:** B. It leaves one implementation of each shipped part,
  which is the reason of shared UI package decision 1. Choose D to keep the
  artboard scaffolds.
- **Action:** ask the user, because condition 1 holds: B changes the design
  components contract, and no recorded decision covers artboard parts outside
  the inventory.

### 3. The highlight mask is drawn outside React

- **Severity:** Medium. **Effort:** Large.
- **Source:** Design. The first options check raised it from a design call.
- **Category:** Code structure.
- **Location:** `packages/viewer/src/client/same_origin_highlight.ts`,
  `packages/viewer/src/client/component_overlay.ts`,
  `packages/viewer/src/inspector/overlay.ts`.
- **Terms:**
  - **Frame adapter:** the viewer's transport to a preview frame. The
    same-origin adapter reaches the frame directly. The postMessage adapter
    talks to the in-frame inspector.
  - **In-frame inspector:** the React-free script that the static build
    injects into published previews. It uses 9,168 of its 9,216-byte budget.
  - **Highlight mask:** the dimmed layer with outlined cutouts that marks
    component instances over a preview.
- **Background:** The highlight labels are React components already, and the
  layout slice moves them as `highlight-label`. Only the mask is drawn
  outside React. The same-origin adapter builds it in the shell document
  with DOM calls. The in-frame inspector draws its own SVG mask with an
  inline `<style>` inside the preview document. The viewer contract names
  that script the viewer's one React-free part.
- **Problem:** The mask is a styled view, and the plan has no home for code
  that draws without React in a package of React components.
- **Impact if no action:** The mask stays the one styled view in the viewer,
  against the user's request.
- **Root question:** Which code draws the highlight mask over a preview, and
  where does it live, so that the mask has one implementation in
  `@mokly/ui`?
- **Options:**
  - **A.** Keep both mask drawings in the viewer as frame-layer code. Their
    shell rules move with the shell CSS. The lint of decision 1 reads JSX
    only, so it does not see them. Effort: Small.
  - **B.** Move the drawing into `@mokly/ui` as a React-free module that
    builds the mask from boxes, for both adapters. One shared DOM drawer puts
    the in-frame inspector 267 bytes over its budget. Moving today's markup
    function unchanged leaves 13 bytes, and package code then runs in every
    published preview. Effort: Large.
  - **C.** The shell draws the same-origin mask with a React package
    component, and the in-frame mask stays. The frame adapter contract
    changes, and the shell must know which adapters draw. Effort: Large.
  - **D.** The package provides a React mask component and a React-free
    module with the mask's colours, stroke width, and radius. The same-origin
    adapter renders the component into its layer with its own React root, so
    the frame adapter contract does not change. The in-frame drawer stays in
    the viewer and imports the constants, which adds no byte. The design
    artboard's own mask can render the package component. Effort: Large.
  - **E.** Only the look moves: a React-free package module holds the
    colours, stroke width, and radius, and both drawers stay in the viewer.
    The user's request is then met for the look only. Effort: Large.
  - **F.** The shell draws every mask with the React package component, from
    the boundary geometry that already places the labels. The adapters keep
    only the pick listeners, and the in-frame inspector stops drawing, which
    frees 960 bytes. This changes the frame adapter contract and the overlay
    section of the published inspector contract, and a cross-origin mask then
    redraws after a message round trip, as its labels do. Effort: Large.
- **Left out:** A React drawing inside the preview document, because the
  in-frame inspector must stay React-free and React DOM alone exceeds its
  budget. The whole in-frame inspector in the package, because it is
  transport and wire code. A separate React-free package for frame drawings,
  because the user named `@mokly/ui` and B is better on every point.
- **Wider fix:** F.
- **Previous examples:** None found.
- **Recommendation:** D, changed from B by the second options check. D gives
  the mask one React implementation for the shell and the artboard, and it
  keeps the frame contracts and the inspector budget. F protects the codebase
  best, because then no drawing stays in the viewer or in the preview.
- **Action:** ask the user, because condition 1 holds: D adds a module that
  is not a component to the shared UI package contract, which holds
  components and stylesheets only.

### 4. Page rules in the package stylesheet

- **Severity:** Medium. **Effort:** Large.
- **Source:** Design. The first options check raised it.
- **Category:** Code structure.
- **Location:** `packages/viewer/src/shell/css_tokens.ts`,
  `packages/viewer/src/shell/css_theme.ts`.
- **Terms:**
  - **Page rules:** rules that select the page around the shell: the base
    rules for `*`, `html`, `body`, `a`, headings, paragraphs, and reduced
    motion, the theme's `:root` rules with their `color-scheme`, and the
    component rules that select `body` with a shell mark, such as
    `body.frame-expanded`.
  - **Embedded root:** the `.mokly-viewer` element that `MoklyViewer`
    renders in a host page. Its loading and failure states carry only
    `mokly-viewer mbk-empty`, not `mbk`.
- **Background:** The standalone stylesheet applies the page rules to the
  stub page that Serve and the static build deliver. The embedded build turns
  `:root`, `html`, and `body` into the embedded root itself. Design call 8
  moves the tokens and the palette into the package. Other React libraries
  use each form, as research of 2026-10-30 found: Mantine puts its resets in
  its main stylesheet (A). MUI's `CssBaseline`, Ant Design's `reset.css`, and
  Tailwind's Preflight are separate imports (E). MUI's `ScopedCssBaseline`,
  Chakra UI's scoped preflight, and Fluent UI's provider scope them to a root
  element (F). Radix Themes puts its tokens on its root element and its
  resets on each component's own elements (D with F). The sources are under
  `.context/ui-package-shell-views/research/`.
- **Problem:** In the published `styles.css`, the page rules style the page
  of any host that imports it. A Chrome measurement under a dark system
  preference showed a host page turn `color-scheme: dark` and change its
  link colour, also with option B.
- **Impact if no action:** A host that renders package components gets the
  shell's page colours, margins, link colours, and box sizing.
- **Root question:** How do the shell's theme and base rules reach every
  shell root, standalone and embedded, without styling the page of a host
  that imports `@mokly/ui/styles.css`?
- **Options:**
  - **A.** Move the page rules into `styles.css` unchanged. Effort: Small.
  - **C.** Keep the base rules in the viewer build beside the `@font-face`
    rule. The theme's `:root` rules still reach a host page. Effort: Small.
  - **B.** The package scopes its element rules to the shell roots with
    `:where()` in a subject-first form that lists both `.mbk` and
    `.mokly-viewer`, and the `html` and `body` rules stay in the viewer. The
    theme's `:root` rules still reach a host page. Effort: Large.
  - **D.** Each component stylesheet applies the base properties to its own
    elements only. About 40 stylesheets repeat the block, and the theme's
    `color-scheme` still reaches a host page. Effort: Large.
  - **E.** A second stylesheet subpath, such as `@mokly/ui/page.css`, holds
    the page rules. `styles.css` keeps the component rules and the token
    values. The viewer build bundles both, so both viewer outputs keep every
    computed style without a selector rewrite. The token values still land
    on a host's `:root`. This replaces the "only stylesheet subpath" wording
    of shared UI package decision 12. Effort: Large.
  - **F.** The package writes the whole theme under the shell roots, so no
    package rule names `:root`, `html`, `body`, or a bare element outside a
    root. The viewer build derives the stub's page form and the embedded
    form. A host must render components inside a root element. Effort:
    Large.
- **Left out:** The theme in the viewer, because it fails the goal: the
  user's message covers the palette. The viewer reading a package file that
  the package does not export, because the package contract allows exported
  subpaths only. A JavaScript export of the page CSS, because it is a second
  stylesheet in another form.
- **Wider fix:** F.
- **Previous examples:** None found.
- **Related:** The follow-up item
  [embedded-styles-need-css-scope](./follow-ups/embedded-styles-need-css-scope.md)
  shares the wider fix: rules authored under the root class need no `@scope`
  transform.
- **Recommendation:** E, changed from B by the second options check. E keeps
  every rule in the package, keeps both viewer outputs without a selector
  rewrite, and keeps page rules off a host page. F protects the codebase
  best, because then no package rule selects the page.
- **Action:** ask the user, because condition 1 holds: E replaces the wording
  of shared UI package decision 12, a user decision.

## Design Calls

Each call is the orchestrator's own, made on 2026-10-29.

1. **New plan.** The shared UI package plan moved the remaining components to
   later plans, one slice each. One plan holds every slice, because the user
   asked for all of them at once.
2. **Identical output, adoption after the components.** No mockup milestone
   comes first, because no screen changes and the approved artboards stay the
   reference. A mockup can render a package component only after it exists,
   so each mockup milestone follows its slice. Precedent: milestones 3 and 4
   of the shared UI package plan.
3. **The split.** A package component takes props and callbacks. Each id that
   the viewer derives from `useShellIdentifier` becomes a prop, and store
   state and store actions become props and callbacks. Interaction that
   touches only the component's own elements moves into the package, such as
   focus return, roving focus, and a pointer drag. Interaction that spans the
   shell root, the store, or a frame stays in the viewer container.
4. **Frames.** The package renders the `<iframe>` element and the device
   chrome as markup. The viewer passes the frame's `ref`, its source, and its
   data attributes as props. It keeps the mount hooks, the adapters, the
   sources, and the frame registry. A package component never reads a frame's
   document.
5. **Copy.** Static interface text stays beside its markup in the package.
   Text that the viewer derives from catalogue data, such as the sentences of
   `entry_wording.ts` and the change-mark wording of `view_marks.ts`, stays in
   the viewer and arrives as props.
6. **Names.** A package component that provides an inventory component takes
   its slug, such as `top-bar`. The other names follow the shell's own terms.
   The implementor of a slice may refine a name in the inventory below and
   records the change in the milestone.
7. **Stylesheet order.** The package build writes `styles.css` in the order
   that `packages/ui/src/styles.css` lists, with one `@import` for each
   component stylesheet, not in name order. The list keeps the shell's
   cascade order: the theme, the shared controls, the components, then the
   layout and its responsive rules. A component stylesheet that the list
   omits joins the end in name order, with a build warning. Reason: the
   shell's rules rely on their order today. A later rule of equal specificity
   overrides an earlier one, as the narrow-width rules of
   `css_views_responsive.ts` override the rules of `css_views_layout.ts`, and
   name order would move such rules apart.
8. **Theme.** The tokens and the Light and Dark palette move into a package
   `theme` stylesheet, first in `styles.css`. Decision 4 settles where the
   page rules go, including the theme's `color-scheme` and the standalone
   stub rule. The user's message covers the move, because the palette is a
   styled part of the shell.
9. **Font.** The Inter font file and its `@font-face` rule stay with the
   viewer's delivery assets. The Rust server and the release archive read the
   font from the viewer package, and the rule's URL is a delivery path. The
   package's `--sans` token names the family with system fallbacks.
10. **Embedded transform.** The viewer build keeps the selector transform that
    scopes the shell rules to an embedded root. A rule that names the
    embedding root or a host slot stays outside the `@scope` block, as the
    rules of `viewer/styles.ts` do today. A post-merge follow-up proposes to
    remove the transform once every rule is authored under the root class.
11. **Delivery.** A stack of five pull requests, one for each slice, each on
    the one before. The first uses this branch. Each later slice starts its
    own branch from the one before, with `gh stack`. Each pull request keeps
    the product working and passes the complete gate. Reason: one pull
    request of about 20,000 changed lines would hold the shell for days and
    conflict with the other branches that change it.
12. **Verification.** Each slice compares the computed style of every shell
    element with a baseline from `main`, over a matrix of states, in the
    standalone shell and in an embedded root. It also lists each pair of rules
    whose order changed in the built stylesheets and that can set the same
    property on one element. Both tools stay under `.context/`.

## Inventory

Each slice moves the elements of these viewer files and the CSS that styles
them. Files under `src/shell` drop the prefix. `views.tsx` and
`workspace.tsx` hold parts of three slices.

### Chrome

- Viewer files: `top_bar`, `nav`, `nav_filter`, `nav_rows`, `nav_leaf_rows`,
  `nav_resize`, and `head`.
- Package components: `top-bar`, `catalogue-navigation`, `screen-header`, and
  `segmented-control`.
- CSS sources: `css_nav_rail`, `css_nav_rows`, `css_nav_search`,
  `css_nav_variants`, `css_nav_changed`, `css_nav_status`, `css_nav_resize`,
  and the header and `.mbk-seg` rules of `css_views_layout` and
  `css_views_responsive`.
- Design library: `chrome/top-bar`, `chrome/catalogue-navigation`, and
  `chrome/screen-header`.

### Controls

- Viewer files: `tags`, `workspace_controls`, and the status badges of
  `views` and `workspace`.
- Package components: `tag-picker`, `tag-chip`, `view-controls`, and
  `change-status`.
- CSS sources: the tag picker rules of `css_nav_rail` and `css_nav_search`,
  the chip rules of `css_details`, the icon control and status rules of
  `css_workspace`, and `css_workspace_marks`.
- Design library: `controls/tag-picker`, `controls/tag-chip`,
  `controls/view-controls`, and `controls/change-status`.

### Inspector

- Viewer files: `inspector`, `details`, `details_rows`,
  `component_control_fields`, `component_controls_panel`, `workspace_props`,
  `workspace_usage`, `workspace_instances`, `workspace_evidence`,
  `evidence_details`, `workspace_stylesheet_list`, and `page_evidence`.
- Package components: `inspector`, `details-panel`, `metadata-row`,
  `prop-field`, `controls-panel`, `props-panel`, `usage-list`,
  `instance-tree`, and `comparison-evidence`.
- CSS sources: `css_details`, `css_inspector_resize`, and the inspector,
  props, field, instance, and evidence rules of `css_workspace`.
- Design library: `inspector/inspector`, `inspector/metadata-row`, and
  `inspector/prop-field`.

### Preview

- Viewer files: `frames`, `status_bar`, `stage_frame`, `document_stage_frame`,
  `preview_frame`, `public_stage`, `stages`, `stage_delivery`,
  `preview_unavailable`, `previews`, `scheme_fallback`, `comparison_chrome`,
  `comparison_frame`, `comparison_side`, `comparison_stack`,
  `comparison_viewport`, `comparison_views`, `diffs`, `workspace_stage`,
  `workspace_variant_bar`, and the empty states of `views`.
- Package components: `device-frame`, `preview-frame`, `flow-step`, `stage`,
  `preview-state`, `previous-version`, `scheme-fallback`, `comparison-pane`,
  `comparison-stage`, `empty-state`, and `variant-bar`.
- CSS sources: `css_chrome_devices`, `css_chrome_expansion`,
  `css_chrome_flow`, `css_preview_scheme`, `css_previews`, `css_review`, and
  the frame, stage, flow, and empty-state rules of `css_views_layout` and
  `css_views_responsive`.
- Design library: `preview/device-frame`, `preview/comparison-pane`,
  `preview/empty-state`, and `preview/flow-step`.

### Layout and theme

- Viewer files: `views`, `workspace`, `embedded_viewer`,
  `embedded_stage_overlay`, `workspace_inspection_labels`,
  `standalone/shell`, `standalone/version_failure`, `viewer/component`,
  `viewer/ready`, `viewer/host_bridge`, `viewer/inspection_layer`, and
  `viewer/marker_layer`. When decision 3 is B, also the drawings of
  `client/same_origin_highlight.ts`, `client/component_overlay.ts`, and
  `inspector/overlay.ts`.
- Package components: `shell-layout`, `workspace-layout`, `embedded-layout`,
  `highlight-label`, and the `theme` stylesheet.
- CSS sources: `css_tokens` without its `@font-face` rule, `css_theme`, the
  rest of `css_views_layout`, `css_views_responsive`, and `css_workspace`, and
  `viewer/styles.ts`.
- Design library: none.

## Milestone 1: Documentation and protocol

Depends on: none

State the end state, so that each slice and its review can check the code
against it. Each touched protocol, architecture, and README page gets the
repository's status line until milestone 17 removes it.

- [ ] `docs/protocol/mokly-ui-package.md`: the package holds every element
      and every style rule of the Browse shell, including the tokens and the
      palette. Every element that the viewer shows comes from a package
      component. Replace the sentences that say the viewer stylesheet
      declares the tokens and the `.mbk-seg` rules. Add the outcomes of
      decisions 3 and 4: where the mask is drawn, and which stylesheet
      carries the page rules.
- [ ] `docs/protocol/mokly-viewer.md`: the package sentence, and the theming
      paragraph. Every rule of `styles.css` comes from the shared UI package,
      unlayered, so a host rule competes with it by specificity and order.
      Keep the decision on unlayered rules.
- [ ] `docs/protocol/mokly-viewer-appearance.md`: the shared UI package owns
      the semantic palette. The page stands at 248 of its 250 lines, so the
      change keeps the line count.
- [ ] `docs/protocol/mokly-design-components.md` and the design library
      README: the outcome of decision 2.
- [ ] `docs/architecture/package-boundary.md`: the viewer owns the shell
      state, the containers, the data, the frames, and the browser entry. The
      UI package owns every element and every style rule.
- [ ] `AGENTS.md`, Product section: every element and every stylesheet of the
      shell lives in `@mokly/ui`, and a viewer file composes package
      components only.
- [ ] `packages/ui/README.md`, `packages/viewer/README.md`, and
      `packages/viewer/src/shell/README.md`: the responsibilities and the
      stylesheet order. Each slice updates the Key Code entries and the
      paragraphs of the files that it moves.

## Milestone 2: Stylesheet order and verification tools

Depends on: none

Give the package an explicit stylesheet order and build the tools that prove
each slice changes nothing for a reader. The product does not change.

- [ ] Design call 7: `packages/ui/scripts/build.mjs` and `styles.mjs` read
      `packages/ui/src/styles.css` and concatenate the listed component
      stylesheets in its order. The three current stylesheets keep their
      order. Update `packages/ui/tests/styles.test.ts` and the package README.
- [ ] Computed-style tool under `.context/ui-package-shell-views/tools/`:
      build the viewer of `origin/main` as a baseline, serve the example
      catalogue, and record the computed style and the element path of every
      shell element. The state matrix covers each entry kind, Changes, each
      comparison mode, each inspector tab, the tag picker, the compact search,
      the drawer, Light and Dark, a desktop and a narrow width, and the
      standalone shell and an embedded root. Save the baseline.
- [ ] Order tool in the same folder: parse the built `shell.css` and
      `styles.css` of the baseline and the branch with `lightningcss`, and
      list each pair of rules whose order changed, which set the same property
      at the same specificity on selectors that share a subject class.
- [ ] Decision 1 C: add the rule under `scripts/eslint/` with the exemption
      list of the 53 files, its cases in the ESLint rule tests, and its
      sentence in `AGENTS.md`.
- [ ] Check: `npm run build`, `npm run typecheck`,
      `cargo xtask check --suite repository`, and the package tests.

## Milestone 3: Chrome components

Tags: ui

Depends on: 1, 2

Move the top bar, the catalogue navigation, and the screen header. The
navigation takes plain section, group, and row records that the viewer
builds from `nav_tree.ts` and `nav_model.ts`, which stay in the viewer.

- [ ] Create the package components of the chrome slice of the inventory,
      with their CSS, their subpath exports, and their place in
      `src/styles.css`. `ViewportSwitch` and `SchemeSwitch` render the
      package segmented control, and the comparison toolbar's mode group
      renders it too.
- [ ] The viewer files of the slice become containers that read the store
      and render the package components. Move their rules out of the CSS
      modules of the slice, and delete each module that the move empties.
- [ ] Tests in `packages/ui/tests` with Testing Library: the roles and names
      that the shell specs query, each callback, the compact search focus, the
      roving focus, the resize handle keys and drag, and the disclosure
      toggles. Move each viewer test that covers only the moved markup, and
      keep every assertion.
- [ ] Remove the files of the slice from the lint exemption list of
      decision 1.
- [ ] Check: `npm run build`, the targeted viewer and package tests, the
      browser specs of the top bar, the navigation, and the header, the
      computed-style tool with no difference, the order tool with each listed
      pair checked, and the mockup check of `AGENTS.md`. Smoke-test through
      `npm run dev` in Light and Dark, at a desktop and a narrow width, in the
      standalone shell and the embedded fixture. Save screenshots under
      `.context/ui-package-shell-views/chrome/`.

## Milestone 4: Chrome mockups

Tags: mockup

Depends on: 3

- [ ] `chrome/top-bar`, `chrome/catalogue-navigation`, and
      `chrome/screen-header` render the package components from their sources
      under `packages/ui/src`. Each sheet imports the package stylesheets by
      repository path and keeps only mockup rules. The hand-written markup and
      CSS go, which shared UI package decision 1 approves.
- [ ] Where a mockup draws a static destination or an inert control, the
      package component gains an optional prop, as `ComparisonToolbar` gained
      `modeHref` and `interactive`. The product output does not change.
- [ ] Decision 2: when the answer is B, C, or D, adopt the artboard parts
      of this slice in the same way.
- [ ] Compare each changed artboard and component page with its render
      before the change, in both viewports and both schemes. Record each
      difference as a finding with options, ask the user in one message, and
      apply the answers. An answer that keeps the artboard form changes the
      product, as shared UI package finding 1 did.
- [ ] `tests/design_boundaries.test.ts` and `tests/helpers/design_styles.ts`
      read the package CSS of the adopted components. The design browser specs
      pass.
- [ ] Run the mockup check of `AGENTS.md`. Smoke-test the changed pages
      through `npm run dev`.

## Milestone 5: First pull request

Depends on: 1, 2, 3, 4

- [ ] Merge `origin/main` with the `git-merge` skill.
- [ ] Run the complete gate of `AGENTS.md`.
- [ ] Commit with Conventional Commits and push the branch.
- [ ] Review the diff against `origin/main` with the `implementation-review`
      skill. Fix the `fix now` findings, record follow-up items for the rest,
      re-review once, and report.
- [ ] Open the pull request into `main`. Put its link in the status
      paragraph.

## Milestone 6: Control components

Tags: ui

Depends on: 3, 5

Move the tag picker, the tag chip, the view controls, and the change status
badge.

- [ ] Create the package components of the controls slice, with their CSS,
      exports, and order. The top bar takes the tag picker in its search slot,
      and the details rows render the package tag chip.
- [ ] The viewer files of the slice become containers. Move their rules and
      delete each emptied module.
- [ ] Tests as in milestone 3: the picker's roving focus, Escape, and focus
      return, the chip's pressed state, the viewport select and its change
      mark, the highlight toggle, and each status.
- [ ] Remove the files of the slice from the lint exemption list.
- [ ] Check as in milestone 3. Save evidence under
      `.context/ui-package-shell-views/controls/`.

## Milestone 7: Control mockups

Tags: mockup

Depends on: 6

- [ ] Adopt `controls/tag-picker`, `controls/tag-chip`,
      `controls/view-controls`, and `controls/change-status` as milestone 4
      adopts the chrome, including decision 2 and the comparison with the
      earlier renders.
- [ ] Run the mockup check and smoke-test the changed pages.

## Milestone 8: Second pull request

Depends on: 6, 7

- [ ] Start the slice's branch from the first one. Merge the first branch
      into it, or `origin/main` after the first pull request merges. Run the
      complete gate. Commit and push.
- [ ] Review against the first pull request's branch. Fix, re-review once,
      and report.
- [ ] Open the pull request on the first one. Put its link in the status
      paragraph.

## Milestone 9: Inspector components

Tags: ui

Depends on: 6, 8

Move the inspector, the details, the controls and props panels, the usage
list, the instance tree, and the comparison evidence. The catalogue lookups
of `details_rows.tsx` and the evidence projections stay in the viewer and
pass plain records.

- [ ] Create the package components of the inspector slice, with their CSS,
      exports, and order. Decide under design call 3 whether the sheet and
      divider behaviour of `inspector_resize.ts` moves, and record the call.
- [ ] The viewer files of the slice become containers. Move their rules and
      delete each emptied module.
- [ ] Tests as in milestone 3: the tab keys, Escape and focus return, each
      field kind with its label, description, and error ids, Reset, the usage
      links, the instance tree selection, and each evidence block.
- [ ] Remove the files of the slice from the lint exemption list.
- [ ] Check as in milestone 3. Save evidence under
      `.context/ui-package-shell-views/inspector/`.

## Milestone 10: Inspector mockups

Tags: mockup

Depends on: 9

- [ ] Adopt `inspector/inspector`, `inspector/metadata-row`, and
      `inspector/prop-field` as milestone 4 adopts the chrome, including
      decision 2 and the comparison with the earlier renders.
- [ ] Run the mockup check and smoke-test the changed pages.

## Milestone 11: Third pull request

Depends on: 9, 10

- [ ] Merge, gate, commit, push, review, and open the pull request on the
      second one, as milestone 8 says.

## Milestone 12: Preview components

Tags: ui

Depends on: 9, 11

Move the device frames, the preview frames, the stages, the flow steps, the
previous-version presentation, the comparison panes and stage, the empty
states, and the variant bar. The frame hooks, the adapters, the comparison
scroll controllers, and the snapshot loaders stay in the viewer.

- [ ] Create the package components of the preview slice, with their CSS,
      exports, and order. The package renders each `<iframe>` element under
      design call 4.
- [ ] The viewer files of the slice become containers. Move their rules and
      delete each emptied module.
- [ ] Tests as in milestone 3: the copied address and its message, expand and
      collapse, each frame label and Light-only note, the loading,
      unavailable, and retry states, each comparison pane state, and each empty
      state.
- [ ] Remove the files of the slice from the lint exemption list.
- [ ] Check as in milestone 3, with the comparison and scrolling browser
      specs. Save evidence under `.context/ui-package-shell-views/preview/`.

## Milestone 13: Preview mockups

Tags: mockup

Depends on: 12

- [ ] Adopt `preview/device-frame`, `preview/comparison-pane`,
      `preview/empty-state`, and `preview/flow-step` as milestone 4 adopts the
      chrome, including decision 2 and the comparison with the earlier renders.
- [ ] Run the mockup check and smoke-test the changed pages.

## Milestone 14: Fourth pull request

Depends on: 12, 13

- [ ] Merge, gate, commit, push, review, and open the pull request on the
      third one, as milestone 8 says.

## Milestone 15: Layout, theme, and embedded root

Tags: ui

Depends on: 12, 14

Move the shell layout, the workspace layout, the embedded root and its host
slots, the highlight labels, and the theme. After this milestone the viewer
holds no element and no style rule, apart from the `@font-face` rule of
design call 9 and the page rules that decision 4 keeps there.

- [ ] Create the package components of the last slice, and the `theme`
      stylesheet under design calls 8 and 9, first in `src/styles.css`.
- [ ] The viewer files of the slice become containers. Delete `css.ts`, every
      `css_*.ts` module, and `viewer/styles.ts`. The viewer build writes
      `shell.css` and `styles.css` from the `@font-face` rule and the package
      stylesheets, with the page rules where decision 4 puts them, and keeps
      the embedded transform under design call 10.
- [ ] Tests as in milestone 3. The viewer's styles tests read the built
      stylesheets, and keep every assertion.
- [ ] Decision 3: move the mask drawing as its answer says.
- [ ] `localPresentation` of `client/same_origin_adapter.ts` and the label
      branch of `installLocalHighlight` run only from a test. Check them
      against the dead-code rule of the `git-commit` skill. When they are
      dead, delete them and record the search.
- [ ] Empty the lint exemption list of decision 1.
- [ ] Check as in milestone 3, with the embedded viewer specs and the
      appearance specs. Save evidence under
      `.context/ui-package-shell-views/layout/`.

## Milestone 16: Layout mockups

Tags: mockup

Depends on: 15

Runs only when decision 2 is B. The layout slice has no inventory component.

- [ ] The artboard scaffolds `specs/design/parts/shell.tsx`,
      `specs/design/components/parts/workspace.tsx`, and
      `specs/design/components/parts/highlight.tsx` render the package
      layout components, and the artboard mask renders the package mask
      when decision 3 is D or F, with the comparison and the findings step of
      milestone 4.
- [ ] Run the mockup check and smoke-test the changed pages.

## Milestone 17: Last pull request

Depends on: every other milestone

- [ ] Remove the status lines that milestone 1 added.
- [ ] Merge, run the complete gate, commit, push, and review as milestone 8
      says.
- [ ] Delete this plan when the `plans` skill says, under "Deleting the
      plan".
- [ ] Open the pull request on the fourth one. Its description gives the
      decisions and the design calls of this plan with their dates, a
      permalink to this plan, and the follow-up items that the change adds.

## Post-merge follow-up (non-blocking)

- [ ] Remove the embedded selector transform once every shell rule is
      authored under the root class (design call 10).
- [ ] Let the design catalogue import the package theme in place of its own
      palette in `examples/basic/design.css`.

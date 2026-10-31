# Shell Views In The UI Package

Status: Active. [PR #249](https://github.com/mokly-ai/mokly/pull/249), with
milestones 1 to 5, merged on 2026-10-30 as `14c6f9ec`. The later slices are
stacked branches: milestones 6 to 8 on `calummoore/mokly-ui-controls`, where
[PR #251](https://github.com/mokly-ai/mokly/pull/251) is open, 9 to 11 on
`calummoore/mokly-ui-inspector`, 12 to 14 on `calummoore/mokly-ui-preview`,
and 15 to 20 on `calummoore/mokly-ui-layout-theme`. The work lands as a stack
of five pull requests, one for each slice, as design call 11 says. Each
earlier pull request keeps this plan. The last one deletes it, as the `plans`
skill says.

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
[shared UI package plan](https://github.com/mokly-ai/mokly/blob/14c6f9ec4c6a328bd90a5cc06481ebf45e409fd9/plans/ui-package.md) choose the approach, and the
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

The four decisions were asked on 2026-10-29, and the user answered them on
2026-10-30. Each went through
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

Decision 2 (2026-10-30, the user): option B. Every artboard part that a
package component provides renders that component, in the mockup milestone
of the slice that moves it, the scaffolds included, and the design components
contract states the rule. Rejected: A, because the copies stay and drift.
Rejected: D, because it keeps the scaffold copies. Rejected: C, because it
breaks the inventory limit of five components in a group.

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

Decision 3 (2026-10-30, the user): option F. The shell draws every highlight
mask with a React package component, from the boundary geometry that already
places the labels. The adapters keep only the pick listeners, and the in-frame
inspector stops drawing. The frame adapter contract and the overlay section of
the published inspector contract change, and a cross-origin mask redraws
after a message round trip, as its labels do. Rejected: the recommended D,
because it keeps a second drawer in the in-frame inspector. Rejected: A, B,
C, and E, because each keeps a mask drawing outside the shell's React tree.

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

Decision 4 (2026-10-30, the user): option G, which the orchestrator added on
2026-10-30 after research into other libraries. The tokens live on the shell
root element, each package component puts a reset class on its own elements,
no package rule selects the page, and the viewer build drops the `@scope`
transform. Rejected: the recommended E, because its page stylesheet still
resets a whole page. Rejected: A, B, C, and D, because each leaves a page rule
or the theme's `:root` rules on a host page. Rejected: F, because rules under a
root class still reach host slot content without `@scope`.

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
  - **G.** D and F together, the Radix Themes model: the tokens on the root
    element, and a reset class on each component's own elements. The viewer
    can then drop `@scope`. Most selectors change, so the product needs its
    own visual check. Effort: Large.
- **Left out:** The theme in the viewer, because it fails the goal: the
  user's message covers the palette. The viewer reading a package file that
  the package does not export, because the package contract allows exported
  subpaths only. A JavaScript export of the page CSS, because it is a second
  stylesheet in another form.
- **Wider fix:** G.
- **Previous examples:** None found.
- **Related:** The follow-up item
  [embedded-styles-need-css-scope](./follow-ups/embedded-styles-need-css-scope.md)
  shares the wider fix: rules authored under the root class need no `@scope`
  transform.
- **Recommendation:** E, changed from B by the second options check, for
  this plan, with G after it. E keeps every rule in the package, keeps both
  viewer outputs without a selector rewrite, and keeps page rules off a host
  page. G protects the codebase best.
- **Action:** ask the user, because condition 1 holds: E replaces the wording
  of shared UI package decision 12, a user decision.

### 5. A standing rule for the later mockups

Decision 5 (2026-10-30, the user): option B. The mockup milestones after
milestone 7 apply the shipped look by default. They ask the user only when the
shipped form is broken, such as a wrong state or a missing element, or when
the user must choose between the product and a contract, and they record each
other difference in the milestone. Rejected: A, asking about every difference,
because each round stops the work for answers that follow the user's rule of
milestones 4 and 7.

## Design Calls

Each call is the orchestrator's own, made on 2026-10-29.

1. **New plan.** The shared UI package plan moved the remaining components to
   later plans, one slice each. One plan holds every slice, because the user
   asked for all of them at once.
2. **Identical output, adoption after the components.** No mockup milestone
   comes first, because no screen changes and the approved artboards stay the
   reference. A mockup can render a package component only after it exists,
   so each mockup milestone follows its slice. Precedent: milestones 3 and 4
   of the shared UI package plan. The theme milestone of decision 4 adds the
   reset class to the markup and rewrites selectors, and the mask milestone
   of decision 3 moves a drawing. Both keep the computed styles of the shell,
   and each lists every intended difference that the computed-style tool
   reports.
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
   `theme` stylesheet, first in `styles.css`, declared on the shell root
   class under decision 4. The user's message covers the move, because the
   palette is a styled part of the shell. Updated on 2026-10-30 for decision 4
   G: every viewer root carries the root class, including the loading and
   failure roots. The standalone stub's `<html>` element carries a document
   class, which the Rust stub writes, so the stub keeps the Auto appearance
   before the bundle runs, as the appearance contract requires. The page
   marks that the standalone shell sets on `body` or `<html>` today, such as
   `frame-expanded`, `mbk-nav-resizing`, and the preview scheme, move to the
   shell root, as the embedded shell already sets them.
9. **Font.** The Inter font file and its `@font-face` rule stay with the
   viewer's delivery assets. The Rust server and the release archive read the
   font from the viewer package, and the rule's URL is a delivery path. The
   package's `--sans` token names the family with system fallbacks.
10. **Embedded transform.** The viewer build keeps the selector transform that
    scopes the shell rules to an embedded root until the theme milestone. A
    rule that names the embedding root or a host slot stays outside the
    `@scope` block, as the rules of `viewer/styles.ts` do today. Updated on
    2026-10-30 for decision 4 G: the theme milestone removes the transform and
    its selector mapping. The build keeps the font URL rewrite and the
    fallbacks that let a host's accent value inherit. This fixes the follow-up
    item `embedded-styles-need-css-scope`, which the last pull request
    deletes.
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
13. **Reset class.** Added on 2026-10-30 for decision 4 G. The reset class
    is `mbk-reset`. Its rules use `:where()` element filters, so they add no
    specificity, as Radix Themes' `.rt-reset` does. Each package component
    puts it on its own elements that need a reset, and it never reaches host
    slot content. The theme milestone decides whether box sizing sits in the
    reset class or in each component's rules, and records the call.
14. **Mask switch.** Added on 2026-10-30 for decision 3 F. The layout slice
    adds the package mask component unused. A later milestone switches the
    shell to it and removes both adapter drawings in one change, so no state
    shows two masks or none.
15. **Media queries of package rules.** Added on 2026-10-30 by milestone 3.
    Package rules may use the layout breakpoint, the device breakpoint, and
    reduced motion. `layout_breakpoint.ts` holds both breakpoints, and the
    viewer's styles test rejects every other query. Reason: the device
    chrome contract names both breakpoints, and the slice moved rules that
    use them.
16. **Interim selectors.** Added on 2026-10-30 by milestone 3. Until
    milestone 18, package stylesheets keep the shell's page-mark selectors,
    such as `body.mbk-nav-resizing`, and embedded-root selectors that the
    `@scope` transform reads, such as `:scope.mokly-viewer`. Milestone 18
    rewrites them under decision 4 G.

## Inventory

Each slice moves the elements of these viewer files and the CSS that styles
them. Files under `src/shell` drop the prefix. `views.tsx` and
`workspace.tsx` hold parts of three slices.

### Chrome

- Viewer files: `top_bar`, `nav`, `nav_filter`, `nav_rows`, `nav_leaf_rows`,
  `nav_resize`, and `head`.
- Package components: `top-bar`, `catalogue-navigation`, `catalogue-tree`,
  `screen-header`, and `segmented-control`. Milestone 3 split the tree from
  the column, because one navigation stylesheet passed 500 lines, and the
  viewer's `nav_rows`, `nav_leaf_rows`, `nav_filter`, and `nav_resize` became
  `.ts` modules that build records or provide hooks.
- CSS sources: `css_nav_rail`, `css_nav_rows`, `css_nav_search`,
  `css_nav_variants`, `css_nav_changed`, `css_nav_status`, `css_nav_resize`,
  and the header and `.mbk-seg` rules of `css_views_layout` and
  `css_views_responsive`.
- Design library: `chrome/top-bar`, `chrome/catalogue-navigation`, and
  `chrome/screen-header`.

### Controls

- Viewer files: `tags`, `workspace_controls`, and the status badges of
  `views` and `workspace`.
- Package components: `tag-picker`, `tag-chip`, `view-controls`,
  `icon-control`, and `change-status`. Milestone 6 added `icon-control`,
  because one stylesheet styles both the view controls and the inspector
  tabs.
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
  `prop-field`, `controls-panel`, `edit-status`, `props-panel`,
  `usage-list`, `instance-tree`, `text-button`, and `comparison-evidence`.
  Milestone 9 added `edit-status`, which draws over the preview, and
  `text-button`, which three panels share. `evidence_details` became a `.ts`
  module, and `workspace_stylesheet_list.tsx` went into the evidence
  component.
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
  `viewer/marker_layer`. Under decision 3 F, the mask drawings of
  `client/same_origin_highlight.ts`, `client/component_overlay.ts`, and
  `inspector/overlay.ts` go, and the shell draws the package mask instead.
- Package components: `shell-layout`, `workspace-layout`, `embedded-layout`,
  `highlight-label`, `highlight-mask`, the `theme` stylesheet, and the
  `mbk-reset` stylesheet.
- CSS sources: `css_tokens` without its `@font-face` rule, `css_theme`, the
  rest of `css_views_layout`, `css_views_responsive`, and `css_workspace`, and
  `viewer/styles.ts`.
- Design library: none in the inventory. Under decision 2 B, the artboard
  scaffolds `specs/design/parts/shell.tsx` and
  `specs/design/components/parts/workspace.tsx` and the artboard mask
  `specs/design/components/parts/highlight.tsx`.

## Milestone 1: Documentation and protocol

Depends on: none

State the end state, so that each slice and its review can check the code
against it. Each touched protocol, architecture, and README page gets the
repository's status line until milestone 20 removes it.

- [x] `docs/protocol/mokly-ui-package.md`: the package holds every element
      and every style rule of the Browse shell, including the tokens and the
      palette. Every element that the viewer shows comes from a package
      component. Replace the sentences that say the viewer stylesheet
      declares the tokens and the `.mbk-seg` rules. Add the outcomes of
      decisions 3 and 4: where the mask is drawn, and which stylesheet
      carries the page rules.
- [x] `docs/protocol/mokly-viewer.md`: the package sentence, and the theming
      paragraph. Every rule of `styles.css` comes from the shared UI package,
      unlayered, so a host rule competes with it by specificity and order.
      Keep the decision on unlayered rules.
- [x] `docs/protocol/mokly-viewer-appearance.md`: the shared UI package owns
      the semantic palette. The page stands at 248 of its 250 lines, so the
      change keeps the line count.
- [x] `docs/protocol/mokly-design-components.md` and the design library
      README: decision 2 B. Every artboard part that a package component
      provides renders that component, the scaffolds included.
- [x] Decision 3 F: `docs/protocol/mokly-frame-adapter.md`,
      `docs/protocol/mokly-published-inspector.md`, and, when it names the
      overlay, `docs/protocol/mokly-inspector-wire.md`. The shell draws the
      highlight mask from the geometry that the adapters return. An adapter
      keeps its pick listeners and draws nothing, and the in-frame inspector
      draws nothing.
- [x] Decision 4 G: the theming paragraph of `docs/protocol/mokly-viewer.md`
      and the stub and palette sentences of
      `docs/protocol/mokly-viewer-appearance.md`. The tokens live on the
      shell root, components reset their own elements, no package rule
      selects the page, and the embedded stylesheet needs no `@scope`. Check
      `docs/protocol/mokly-shell-delivery.md` for the stub's `<html>` element
      and add the document class where the page names the stub markup.
- [x] `docs/architecture/package-boundary.md`: the viewer owns the shell
      state, the containers, the data, the frames, and the browser entry. The
      UI package owns every element and every style rule.
- [x] `AGENTS.md`, Product section: every element and every stylesheet of the
      shell lives in `@mokly/ui`, and a viewer file composes package
      components only. Name the lint of decision 1 C.
- [x] `packages/ui/README.md`, `packages/viewer/README.md`, and
      `packages/viewer/src/shell/README.md`: the responsibilities and the
      stylesheet order. Each slice updates the Key Code entries and the
      paragraphs of the files that it moves.

## Milestone 2: Stylesheet order and verification tools

Depends on: none

Give the package an explicit stylesheet order and build the tools that prove
each slice changes nothing for a reader. The product does not change.

- [x] Design call 7: `packages/ui/scripts/build.mjs` and `styles.mjs` read
      `packages/ui/src/styles.css` and concatenate the listed component
      stylesheets in its order. The three current stylesheets keep their
      order. Update `packages/ui/tests/styles.test.ts` and the package README.
- [x] Computed-style tool under `.context/ui-package-shell-views/tools/`:
      build the viewer of `origin/main` as a baseline, serve the example
      catalogue, and record the computed style and the element path of every
      shell element. The state matrix covers each entry kind, Changes, each
      comparison mode, each inspector tab, the tag picker, the compact search,
      the drawer, Light and Dark, a desktop and a narrow width, and the
      standalone shell and an embedded root. Save the baseline.
- [x] Order tool in the same folder: parse the built `shell.css` and
      `styles.css` of the baseline and the branch with `lightningcss`, and
      list each pair of rules whose order changed, which set the same property
      at the same specificity on selectors that share a subject class.
- [x] Decision 1 C: add the rule under `scripts/eslint/` with the exemption
      list of the 53 files and its cases in the ESLint rule tests. Milestone 1
      writes its sentence in `AGENTS.md`.
- [x] Check: `npm run build`, `npm run typecheck`,
      `cargo xtask check --suite repository`, and the package tests.
- [x] Done on 2026-10-30 by the non-ui implementor and checked: zero
      computed-style differences across 160 states and no reordered rule
      pair. Evidence: `.context/ui-package-shell-views/reports/m2.md`.

## Milestone 3: Chrome components

Tags: ui

Depends on: 1, 2

Move the top bar, the catalogue navigation, and the screen header. The
navigation takes plain section, group, and row records that the viewer
builds from `nav_tree.ts` and `nav_model.ts`, which stay in the viewer.

- [x] Create the package components of the chrome slice of the inventory,
      with their CSS, their subpath exports, and their place in
      `src/styles.css`. `ViewportSwitch` and `SchemeSwitch` render the
      package segmented control, and the comparison toolbar's mode group
      renders it too.
- [x] The viewer files of the slice become containers that read the store
      and render the package components. Move their rules out of the CSS
      modules of the slice, and delete each module that the move empties.
- [x] Tests in `packages/ui/tests` with Testing Library: the roles and names
      that the shell specs query, each callback, the compact search focus, the
      roving focus, the resize handle keys and drag, and the disclosure
      toggles. Move each viewer test that covers only the moved markup, and
      keep every assertion.
- [x] Remove the files of the slice from the lint exemption list of
      decision 1.
- [x] Check: `npm run build`, the targeted viewer and package tests, the
      browser specs of the top bar, the navigation, and the header, the
      computed-style tool with no difference, the order tool with each listed
      pair checked, and the mockup check of `AGENTS.md`. Smoke-test through
      `npm run dev` in Light and Dark, at a desktop and a narrow width, in the
      standalone shell and the embedded fixture. Save screenshots under
      `.context/ui-package-shell-views/chrome/`.
- [x] Done on 2026-10-30 by the ui implementor and checked: zero
      computed-style differences across 166 states, 111 browser specs and 800
      Node tests passed, and two order-tool pairs that cannot match one
      element. The orchestrator applied design call 15 and deleted the dead
      `.mbk-basewatch` rules, which no product code, test, mockup, or Rust
      code renders. Evidence: `.context/ui-package-shell-views/chrome/`.

## Milestone 4: Chrome mockups

Tags: mockup

Depends on: 3

The adoption found 13 visible differences between the old mockup copies and
the shipped components, with evidence under
`.context/ui-package-shell-views/chrome-mockups/compare-final/findings/`.
Answered on 2026-10-30 by the user: option A, the shipped look, for all 13.
The mockups show the shipped components, and the product does not change:

- Item 1: the segmented control keeps its pale border, and the design
  control-edge test exempts its rule with the reason. Rejected: B, the
  control edge in the product.
- Item 2: desktop renders narrower than 900px show the shipped narrow form.
  Rejected: a mockup rule that holds the desktop navigation.
- Item 3: a parent row and its selected variant row both show the current-row
  highlight, and the tests expect both. Rejected: one current row.
- Item 4: the menu draws the shipped hamburger, and the top bar's
  `menuPresentation` prop goes from the registration, its callers, and the
  inventory contract.
- Item 5: the narrow top bar keeps its shipped spacing and placeholder, and
  the top bar's `placeholder` prop goes from the registration, its callers,
  and the inventory contract.
- Items 6 to 12: the row ink, the component row glyph, the drawer, the filter
  and path chip heights, the narrow header gaps, the empty Changes message,
  and the resize grip keep the shipped form.
- Item 13: the search field keeps its shipped focus style. A follow-up item
  records that it shows no focus ring.

- [x] `chrome/top-bar`, `chrome/catalogue-navigation`, and
      `chrome/screen-header` render the package components from their sources
      under `packages/ui/src`. Each sheet imports the package stylesheets by
      repository path and keeps only mockup rules. The hand-written markup and
      CSS go, which shared UI package decision 1 approves.
- [x] Where a mockup draws a static destination or an inert control, the
      package component gains an optional prop, as `ComparisonToolbar` gained
      `modeHref` and `interactive`. The product output does not change.
- [x] The comparison toolbar's sheet imports `segmented-control.css`, which
      the package toolbar now renders, and the `.mbk-seg` copy in the shared
      design CSS goes where nothing else uses it.
- [x] Decision 2 B: the artboard parts of this slice that a package
      component provides render that component in the same way, and their
      copies and CSS go.
- [x] Compare each changed artboard and component page with its render
      before the change, in both viewports and both schemes. Record each
      difference as a finding with options, ask the user in one message, and
      apply the answers. An answer that keeps the artboard form changes the
      product, as shared UI package finding 1 did.
- [x] `tests/design_boundaries.test.ts` and `tests/helpers/design_styles.ts`
      read the package CSS of the adopted components. The design browser specs
      pass.
- [x] Run the mockup check of `AGENTS.md`. Smoke-test the changed pages
      through `npm run dev`.
- [x] Done on 2026-10-30 by the ui implementor and checked, in two passes:
      the adoption, then the 13 answers. The product did not change: zero
      computed-style differences across 166 states. 732 design browser tests,
      the design Node and Rust tests, the strict mockup build, and the
      repository suite passed. Calls of the second pass: the control-edge
      test lists the exempt segmented control rule with its reason, the Rust
      checklist test expects both current rows, the inventory's Top bar entry
      names an optional query string, `docs/protocol/mokly-design-components.md`
      states that a desktop render follows the layout breakpoint, and
      `tests/helpers/design_accessibility.ts` splits from `design_rules.ts`
      under the 300-line cap. The orchestrator aligned
      `docs/protocol/mokly-viewer-palette.md` (the two kept hairlines) and
      `docs/protocol/mokly-component-design.md` (the component row icon) with
      answers 1, 7, and 12. Evidence:
      `.context/ui-package-shell-views/chrome-mockups/` and the worktree's
      `.context/m4-finish/`.

## Milestone 5: First pull request

Depends on: 1, 2, 3, 4

- [x] Merge `origin/main` with the `git-merge` skill.
- [x] Run the complete gate of `AGENTS.md`.
- [x] Commit with Conventional Commits and push the branch.
- [x] Review the diff against `origin/main` with the `implementation-review`
      skill. Fix the `fix now` findings, record follow-up items for the rest,
      re-review once, and report.
- [x] Open the pull request into `main`. Put its link in the status
      paragraph.
- [x] Done on 2026-10-30: `origin/main` had not moved, the remote gate passed
      7 of 7 suites on `73e2f3ea`, and review round 1 found no finding in
      scope. Its two out-of-scope notes have follow-up items. Reports:
      `.context/reviews/calummoore/mokly-ui-component-migration/`.
- [x] Merged `origin/main` at `afc9f58d` in `5db03042` with an empty remerge
      diff, and the remote gate passed 7 of 7 suites on it.

## Milestone 6: Control components

Tags: ui

Depends on: 3, 5

Move the tag picker, the tag chip, the view controls, and the change status
badge.

- [x] Create the package components of the controls slice, with their CSS,
      exports, and order. The top bar takes the tag picker in its search slot,
      and the details rows render the package tag chip.
- [x] The viewer files of the slice become containers. Move their rules and
      delete each emptied module.
- [x] Tests as in milestone 3: the picker's roving focus, Escape, and focus
      return, the chip's pressed state, the viewport select and its change
      mark, the highlight toggle, and each status.
- [x] Remove the files of the slice from the lint exemption list.
- [x] Check as in milestone 3. Save evidence under
      `.context/ui-package-shell-views/controls/`.
- [x] Done on 2026-10-30 by the ui implementor on
      `calummoore/mokly-ui-controls` and checked: zero computed-style
      differences across 166 states and the 6 states at 520 pixels, 1168
      browser tests and 812 Node tests passed, and no new order-tool pair.
      The orchestrator removed the `afterSelect` parameter of `selectTag`,
      which no product code passed after the package took the picker's focus
      return, with the test step that covered only it. Evidence:
      `.context/ui-package-shell-views/controls/`.

## Milestone 7: Control mockups

Tags: mockup

Depends on: 6

The adoption found 9 visible differences, with evidence under the worktree's
`.context/ui-package-shell-views/controls-mockups/`. Answered on 2026-10-30
by the user, option C:

- Item 1: the Highlight components toggle. Each artboard passes the highlight
  state that the shell shows for its view, so a screen where the shell offers
  highlighting shows an enabled toggle. Rejected: A, a disabled toggle where an
  artboard gives no state; B, a product header without the toggle.
- Items 2 and 3: a pressed icon control (a pressed Highlight toggle or a
  selected inspector tab) and a tag chip keep their shipped hairline. The
  palette contract names both as exceptions, and the design tests exempt the
  rules with the reason. Rejected: B, the control edge in the product.
- Items 4, 5, and 8: the borderless view controls, the fixed viewport glyph,
  and the tag picker sample with its button keep the shipped form.
- Item 6: the status badge keeps its shipped shape and weight, and the
  palette contract's sentence about status edges follows it.
- Item 7: the chips and controls keep their shipped focus rings, and the
  follow-up item about the search field's focus ring covers them too.
- Item 9: a narrow desktop render draws the shipped picker sheet, under the
  rule of milestone 4 that a desktop render follows the layout breakpoint.

- [x] Adopt `controls/tag-picker`, `controls/tag-chip`,
      `controls/view-controls`, and `controls/change-status` as milestone 4
      adopts the chrome, including decision 2 and the comparison with the
      earlier renders.
- [x] Run the mockup check and smoke-test the changed pages.
- [x] Done on 2026-10-30 by the ui implementor and checked, in two passes:
      the adoption, then the answers. The product did not change: zero
      computed-style differences across 166 states. The design Node tests,
      the design browser tests, the Rust design tests, the strict mockup
      build, and the repository suite passed. Calls: the highlight state is a
      required prop of the header, so no artboard draws the toggle without
      the shell's state; the mockups use the shell's exact reason sentences,
      with a new `failed` reason, under the user's answer to item 1; the
      design components and component explorer contracts say that every
      screen and component page draws the toggle. Follow-up item added:
      `plans/follow-ups/highlight-reason-after-failed-details.md`. Found for
      milestone 10: the explorer artboard's Components panel says "for this
      screen" where the shell says "for this view", in
      `examples/basic/specs/design/components/parts/screen_details.tsx`.
      Evidence: the worktree's
      `.context/ui-package-shell-views/controls-mockups/`.

## Milestone 8: Second pull request

Depends on: 6, 7

- [x] Start the slice's branch from the first one. Merge the first branch
      into it, or `origin/main` after the first pull request merges. Run the
      complete gate. Commit and push.
- [x] Review against the first pull request's branch. Fix, re-review once,
      and report.
- [x] Open the pull request on the first one. Put its link in the status
      paragraph.
- [x] Done on 2026-10-30: the branch merged `origin/main` at `e9c20225` and
      at `133782a9` (#247), and the remote gate passed 7 of 7 suites on
      `c45a87cb`. Review round 1 found findings 1 and 2, and round 2 found 3
      and 4. The fixes are `34357fa0`, `ffc19e11`, and `1d81517f`. The rest
      of finding 1, the Highlight components switch of 22 Browse and 8
      Changes artboards, waits for the user under
      `plans/follow-ups/browse-artboard-highlight-drawing.md`. On `1d81517f`
      the remote gate passed 6 of 7 suites, and browser shard 2 passed on a
      rerun after the known flaky handoff test. Reports:
      `.context/reviews/calummoore/mokly-ui-controls/`.

## Milestone 9: Inspector components

Tags: ui

Depends on: 6, 8

Move the inspector, the details, the controls and props panels, the usage
list, the instance tree, and the comparison evidence. The catalogue lookups
of `details_rows.tsx` and the evidence projections stay in the viewer and
pass plain records.

- [x] Create the package components of the inspector slice, with their CSS,
      exports, and order. Decide under design call 3 whether the sheet and
      divider behaviour of `inspector_resize.ts` moves, and record the call.
- [x] The viewer files of the slice become containers. Move their rules and
      delete each emptied module.
- [x] Tests as in milestone 3: the tab keys, Escape and focus return, each
      field kind with its label, description, and error ids, Reset, the usage
      links, the instance tree selection, and each evidence block.
- [x] Remove the files of the slice from the lint exemption list.
- [x] Check as in milestone 3. Save evidence under
      `.context/ui-package-shell-views/inspector/`.
- [x] Done on 2026-10-30 by the ui implementor on
      `calummoore/mokly-ui-inspector` and checked: identical markup in 1488
      cases, zero computed-style differences across 166 states, 805 browser
      tests and 2803 Node tests passed, and 19 new order-tool pairs that
      cannot change a computed value. Calls under design call 3: the
      inspector tabs keep their own buttons with the `icon-control`
      stylesheet, because `IconButton` writes its attributes in another order;
      `inspector_resize.ts` and the Escape listener on the shell root stay in
      the viewer, and the listener now has a browser test. Evidence:
      `.context/ui-package-shell-views/inspector/`.

## Milestone 10: Inspector mockups

Tags: mockup

Depends on: 9

The inventory gives the prop field a `control` slot and the inspector tabs
that open natively with links, while the package draws typed controls and
buttons with callbacks. Add optional static props to the package components,
as `ComparisonToolbar` gained `modeHref` and `interactive`. Found by milestone
9 on 2026-10-30.

- [x] Adopt `inspector/inspector`, `inspector/metadata-row`, and
      `inspector/prop-field` as milestone 4 adopts the chrome, including
      decision 2 and the comparison with the earlier renders.
- [x] Run the mockup check and smoke-test the changed pages.
- [x] Adoption done on 2026-10-31 by the ui implementor and checked, apart
      from the parts above: the library's inspector, metadata row, and prop
      field, and every other artboard copy of the inspector slice, render the
      package components. Zero computed-style differences across 166 states,
      2851 Node tests, 1420 browser tests, and the repository suite passed.
      Calls: static tabs are native disclosures and the grab is a native
      switch; static actions link to the artboard of their outcome; the
      selected instance renders `PropsPanel`; the approved evidence card
      renders `ComparisonEvidence`; the dead `.mbk-inspector select` rule
      goes; the highlight artboard stays reached through the catalogue tree;
      the explorer's prose-link rule skips shipped links. Intended product
      changes: one shared count helper writes "1 instance", "1 view", "1
      component", and "1 nested instance", and the static Reset link takes
      the Reset button's look. Evidence:
      `.context/ui-package-shell-views/inspector-mockups/`.
- [x] Apply decision 6 to the six parts that waited for the user. Done on
      2026-10-31 by the ui implementor and checked: an invalid prop field
      draws `--mbk-danger-ink`; the resize grip, the sheet grabber, and the
      use-case and screen chips draw `--chrome-control-edge`; the Components
      tab renders the shipped `InstanceTree`, with a link form and lists that
      start open; the component Props tab renders the controls panel in
      place; `ComparisonEvidence` shows the saved variant and its saved props;
      the mobile sheet spans the workspace. The explorer, component design,
      and controls design contracts follow. The selected instance keeps its
      shipped hairline, which the palette contract and the boundary audit
      now name, under decision 6. The computed-style tool lists only these
      intended differences. Evidence:
      `.context/ui-package-shell-views/decision6/`.

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

## Milestone 15: Layout components

Tags: ui

Depends on: 12, 14

Move the shell layout, the workspace layout, the embedded root and its host
slots, and the highlight labels. Add the package highlight mask unused, under
design call 14. After this milestone, the viewer renders no element of its
own, and only the theme modules remain of its CSS.

- [ ] Create the package components of the last slice, with their CSS,
      exports, and order. The embedded root rules of `viewer/styles.ts` move
      to the `embedded-layout` stylesheet and stay outside the `@scope`
      block until milestone 18.
- [ ] Create `highlight-mask`: the dimmed layer with outlined cutouts, drawn
      from a width, a height, and boxes, in the colours of today's mask.
- [ ] The viewer files of the slice become containers. Move their rules and
      delete each emptied module.
- [ ] `localPresentation` of `client/same_origin_adapter.ts` and the label
      branch of `installLocalHighlight` run only from a test. Check them
      against the dead-code rule of the `git-commit` skill. When they are
      dead, delete them and record the search.
- [ ] Tests as in milestone 3, also for the mask's cutouts and outlines.
- [ ] Empty the lint exemption list of decision 1.
- [ ] Check as in milestone 3, with the embedded viewer specs. Save evidence
      under `.context/ui-package-shell-views/layout/`.

## Milestone 16: The shell draws the highlight mask

Depends on: 15

Decision 3 F. The shell's inspection layers render the package mask from the
boundary geometry that already places the labels, for both adapters. The
same-origin adapter keeps its pick listeners and draws nothing. The in-frame
inspector reports geometry and picks and draws nothing.

- [ ] The workspace inspection overlay and the embedded viewer's inspection
      layer render `highlight-mask` with the boxes of the shown instances.
- [ ] The same-origin adapter stops drawing: remove the mask layer of
      `client/same_origin_highlight.ts` and `client/component_overlay.ts`.
      Keep its pick, Escape, and redraw listeners where the shell needs them.
- [ ] The in-frame inspector stops drawing: remove `inspector/overlay.ts`
      and its calls. The built inspector stays within its 9,216-byte budget.
- [ ] Update `packages/viewer/src/client/README.md` and
      `packages/viewer/src/inspector/README.md`, which still describe the
      adapter overlay. Found by milestone 1 on 2026-10-30.
- [ ] Tests: the adapter tests no longer expect a drawn layer, the inspector
      tests no longer expect an overlay, and the shell tests and browser specs
      of highlighting see one mask over same-origin and cross-origin frames.
- [ ] Check: `npm run build`, the targeted tests, the highlighting and
      embedded browser specs, the inspector budget test, and the
      computed-style tool, which lists the mask as its one intended
      difference. Smoke-test highlighting in Serve and in a published
      catalogue. Save evidence under `.context/ui-package-shell-views/mask/`.

## Milestone 17: The stub document class

Depends on: 15

Decision 4 G needs a class on the standalone stub's `<html>` element, so the
stub keeps the Auto appearance before the bundle runs. Nothing styles the
class yet, so the product does not change.

- [ ] `crates/mokly-model/src/shell.rs` writes the document class on the
      stub's `<html>` element, with its Rust test, and every Rust or Node
      test that compares the stub markup.
- [ ] Check: `cargo test -p mokly-model`, the repository suite of
      `cargo xtask check`, and the tests that read the stub.

## Milestone 18: Theme on the shell root and the reset class

Tags: ui

Depends on: 16, 17

Decision 4 G. After this milestone the viewer holds no style rule apart from
the `@font-face` rule of design call 9, and the embedded stylesheet has no
`@scope` block.

- [ ] Create the `theme` stylesheet under design call 8: the tokens and the
      palette on the shell root class and the stub document class, never on
      `:root`, `html`, or `body`.
- [ ] Create the `mbk-reset` stylesheet under design call 13, and put the
      class on the elements of each package component that need a reset.
      Record where box sizing lives.
- [ ] Every viewer root carries the root class. The standalone shell sets its
      page marks on the shell root instead of `body` or `<html>`.
- [ ] Rewrite each rule that selects `body`, `html`, or `:root` with a shell
      mark to select the shell root.
- [ ] Update the Key Code entry of `src/shell` in `packages/viewer/README.md`,
      which still says "scoped styles". Name the shell root class and the
      stub document class in the docs that milestone 1 left unnamed. Found by
      milestone 1 on 2026-10-30.
- [ ] Delete `css.ts` and the remaining CSS modules. The viewer build writes
      `shell.css` and `styles.css` from the `@font-face` rule and the package
      stylesheet. Remove the `@scope` transform and its selector mapping, and
      keep the font URL rewrite and the accent fallbacks under design call 10.
- [ ] Tests: the package and viewer styles tests read the new forms, a test
      shows that no package rule selects the page or reaches a host slot, and
      every earlier assertion stays.
- [ ] Check as in milestone 3, with the appearance, embedded viewer, and
      device chrome specs. The computed-style tool lists every intended
      difference. Run a visual check of the standalone shell and an embedded
      host in Light and Dark at both widths, also in Firefox. Save evidence
      under `.context/ui-package-shell-views/theme/`.

## Milestone 19: Layout mockups

Tags: mockup

Depends on: 18

Decision 2 B. The layout slice has no inventory component, but the
artboards draw its parts with their own scaffolds.

- [ ] The artboard scaffolds `specs/design/parts/shell.tsx` and
      `specs/design/components/parts/workspace.tsx` render the package
      layout components, and the artboard mask
      `specs/design/components/parts/highlight.tsx` renders the package mask,
      with the comparison and the findings step of milestone 4.
- [ ] The design library's sheets import the `theme` and `mbk-reset`
      stylesheets where a package component needs them.
- [ ] The artboard "Details" draws its own clipped scrim in
      `specs/design/components/parts/screen_preview.tsx`, and
      `docs/protocol/mokly-component-design.md` says "Details uses a clipped
      scrim". When the scrim depicts the highlight mask, render the package
      mask and align the doc. Found by milestone 1 on 2026-10-30.
- [ ] Run the mockup check and smoke-test the changed pages.

## Milestone 20: Last pull request

Depends on: every other milestone

- [ ] Remove the status lines that milestone 1 added.
- [ ] Delete the follow-up item
      `plans/follow-ups/embedded-styles-need-css-scope.md`, which milestone 18
      fixes.
- [ ] Merge, run the complete gate, commit, push, and review as milestone 8
      says.
- [ ] Delete this plan when the `plans` skill says, under "Deleting the
      plan".
- [ ] Open the pull request on the fourth one. Its description gives the
      decisions and the design calls of this plan with their dates, a
      permalink to this plan, and the follow-up items that the change adds.

## Post-merge follow-up (non-blocking)

- [ ] Let the design catalogue import the package theme in place of its own
      palette in `examples/basic/design.css`.

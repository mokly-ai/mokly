# Basic Mokly Consumer

`examples/basic` is the repository's reference consumer. It is a synthetic
catalogue for a small workspace product, and it holds the design mockups of
Mokly's own Browse shell. Mokly reads it through
[`mokly.config.json`](./mokly.config.json). It contains no application
product code.

## What the example holds

| Part                 | Source                                                | Catalogue paths                                                |
| -------------------- | ----------------------------------------------------- | -------------------------------------------------------------- |
| Team area            | `specs/example/team/`                                 | `example/team/**`                                              |
| Workspace components | `src/components/workspace-*.component.html`           | `example/components/workspace-*`                               |
| Example screens      | `specs/catalogue.tsx`, `specs/example/**/*.mockup.ts` | `example/screens/*`, `example/getting-started`, `example/tour` |
| Example components   | `src/components/action/`, `src/components/toolbar/`   | `example/components/action`, `example/components/toolbar`      |
| Example documents    | `specs/example/*.md`                                  | `example`, `example/workspace-guide`                           |
| Design catalogue     | `specs/design/`                                       | `design/**`                                                    |

The Team area and the workspace components are HTML and YAML files that the
Rust core composes without JavaScript. The example screens, the example
components, and the design catalogue are React modules that render through
the [render sidecar](../../docs/protocol/mokly-sidecar.md).
`specs/example/README.md` is the Example folder's Overview. It links to the
example's screens and documents.

## The Team area

The Team area shows the main features of the
[HTML screens](../../docs/protocol/mokly-html-screens.md) and
[HTML components](../../docs/protocol/mokly-html-components.md) contracts:

- `example/team/members` is the **Team members** screen. Its `invited` variant
  sets the `invited` prop and shows the new invitation in the member list.
- `example/team/invite` is the **New invitation** screen, a form that sends
  an invitation.
- `example/team/invite-teammate` is a use case that walks from the member list
  to the form and to the `invited` variant.
- `example/team/invitation` is the invitation email, a page: one complete,
  light document that owns its styles.
- `example/team/member-roles` is a Markdown document. Both screens list it in
  `relatedDocs`, and the New invitation screen links to it.
- `specs/example/team/_folder.json` orders the folder in the order that a
  reader meets its entries.

The three HTML components declare a prop schema, saved props, and slots:

- `<workspace-nav>` draws the workspace name, its plan, and its sections: a
  side navigation in the desktop view and a top bar in the mobile view.
- `<workspace-panel>` has a heading, an optional count, a `children` slot with
  default content, and an `actions` slot. Its `with-actions` variant fills
  both slots.
- `<workspace-member>` is one person, with a role from an `enum` and a
  `pending` boolean. Its `pending` variant shows an open invitation.

The screens and components use the template language as follows:

| Feature              | Example                                                                      |
| -------------------- | ---------------------------------------------------------------------------- |
| `$name` reference    | `workspace="$workspace"` passes the screen's `workspace` object to the nav   |
| `{{name}}`           | `{{workspace.name}}` and `{{openSeats}}` in text                             |
| `mokly-if`           | the invitation notice and the pending row follow `invited`                   |
| `mokly-viewport`     | the roles panel shows on desktop, and a link to the roles document on mobile |
| Coerced attributes   | `count="3"` is an integer, `role="Owner"` an `enum`, `pending` a boolean     |
| Named slot           | `slot="actions"` puts the buttons in the panel's actions row                 |
| `mokly-instance`     | each member row has its own instance id                                      |
| `mock:` link         | the screens, the page, and the document link to each other by path           |
| `to` link control    | **Send invitation** opens `example/team/members/invited`                     |
| Review-ignore region | `<mokly-ignore id="workspace-nav">` around the navigation's own output       |

The navigation is shell chrome that repeats on every Team screen. Its
component wraps its own output in a Review-ignore region, so a change inside
the chrome alone is ignored in the screens' comparison. The region's
`material-key="{{current}}"` names the selected section, so a change of the
section still counts as a change. A screen does not wrap the
`<workspace-nav>` element itself: an ignore region may not enclose a component
instance, under the
[component changes contract](../../docs/protocol/mokly-component-changes.md).

Screens and components render at the mobile and desktop viewports, in light
and dark. The `example/{team,components/workspace-*}/**` stylesheet rule
links `workspace.css`, the tokens and screen layout, and
`workspace-components.css`, the component styles, into every view. It adds
`workspace-dark.css`, the dark tokens, to the dark views.

`{{ name }}` with spaces inside the braces is the same substitution as
`{{name}}`. Prettier formats `*.component.html` files as Angular templates by
default. The Angular parser reads a substitution as an expression, so it
rewrites a prop with a hyphen, such as `{{open-seats}}`, to
`{{ open - seats }}`, which is no longer a prop path. It also stops on a
literal `{` in text. The repository's
[`.prettierrc.json`](../../.prettierrc.json) formats these files as plain
HTML, which keeps every substitution as written.

## The React example

The Welcome and Details screens use `@firna/ui` controls. Welcome declares
one boolean prop, `empty`, with the title **Empty workspace**, and its `empty`
variant sets it. Welcome has a Review-ignore region around its navigation and
a small `WorkspaceNote`. Both screens read the viewport from the render
context and use the compact layout on mobile. Both screens link to each other
with `MockLink`, and their Firna buttons use `MockLink asChild`.
`getting-started` is a `definePage` handbook that `specs/document.tsx`
renders, and `tour` is a use case through both screens.
`specs/example/workspace-guide.md` is a document with the `workspace.svg`
image.

`Action` and `Toolbar` under `src/components/` are React components. Each
directory holds the plain component, its `defineComponent` definition in
`*.mokly.tsx`, and the entry module `*.mockup.tsx`, which re-exports the
definition. A definition declares a JSON prop schema, its own props, and its
variants as props sets. A variant's props replace the own props key by key,
so the own props hold only the keys that every variant sets, with the first
variant's values. Action has `default`, `disabled`, and `secondary` variants
and live controls. Toolbar composes two Action instances and takes caller
content in its `children` slot; its variant fills the slot. Both declare `example-components.css`. No
HTML file uses them, so neither declares an `element` name.

`WorkspaceNote` combines a CSS Module, a stylesheet that references
`examples/imported-assets/workspace-note-signal.png` outside the catalogue
root, and Tailwind v4 utilities. `postcss.config.mjs` runs Tailwind with a
fixed `base` and no optimization, and runs Autoprefixer with the Safari 14
target in `.browserslistrc`. `utilities.css` scans only this example's `src/`
tree. The module sets `BROWSERSLIST_IGNORE_OLD_DATA=1` so that a demo build
prints no Browserslist age warning; an application updates its Browserslist
data instead.

`renderer.tsx` is the reference
[renderer module](../../docs/protocol/mokly-rendering.md#renderer-module) for a
React Native Web component library. It returns the entry's React node inside
the `@firna/ui` theme for the view's colour scheme, with the tokens in
`theme.ts`. The sidecar collects React Native Web's styles, and the Rust core
writes the document head. The collected styles come before the configured
stylesheets, so `styles.css`, and `styles-dark.css` in dark views, colour the
plain HTML around the components. The renderer also places each design library
component in `LibraryHost`, which gives the standalone sample its frame. The
`moduleResolution` settings give
the bundle the `react-native-web` alias, the `react-native` conditions and
fields, the `.web.*` extensions, and the JSX loader for `.js` files. A
consumer that renders plain React DOM needs none of these settings.

## The design catalogue

`specs/design/` holds the approved mockups of Mokly's Browse shell and its
Changes views. The product screens live in `packages/viewer/src/shell`.
Design screens use the shared design components in `specs/design/library/`;
see the [library README](./specs/design/library/README.md). Each shared
component's own styles live in `design-library/`, and the shared, layout, and
global design styles stay in the `design*.css` files. The configured rules
link those styles by route, and `$componentStylesheets` marks where each
document links the styles that its rendered components declare.

Each design screen is one `defineScreen` definition per export, and each
folder's `index.mockup.ts` re-exports the definitions from its helper
modules. A design screen draws a separate artboard for each viewport:
`artboards()` in `specs/design/parts/artboards.ts` selects the artboard from
the render context's viewport. `artboardStates()` makes one screen whose
variants show other states: a `state` prop names the state, and each variant
sets it. The helper adapts design artboards, each a different tree; a product
screen derives its states from real props instead.
`specs/design/browse/loading/` shows the shell before the catalogue arrives,
its failure and version states, and the stage while a preview loads.
`specs/design/components/controls/parts/copy.ts` holds the settled copy of the
Props tab's controls, and the Read-only and recovery gallery under
`specs/design/components/controls/limits/` draws the states without editing
and the recovery states that keep the edits.

`tests/design_catalogue.test.ts` serves this configuration once with
`--no-watch` and the unresolved base `refs/mokly/browser-suite-no-base`, so
Changes stays unavailable. It checks the design catalogue against the
link and adoption rules of the design contracts below.
`tests/fixtures/design/` holds the frozen
screen inventory with the screens that only the catalogue tree reaches, the
family parts of the adoption table, and the link expectations. The test also
checks the shared components each design screen records, the stylesheets each
view links, and every link's destination and focus behaviour. A new design
screen updates the inventory. A family part that most screens show lists the
screens without it, so a new screen without that part joins its `except` set.
A part that only some screens show, such as the comparison toolbar, a
comparison pane, an empty state, or the tag picker, lists those screens in its
`only` set, so the test checks a new screen with that part only after it joins
the set.

The [shell design](../../docs/protocol/mokly-shell-design.md),
[design inventory](../../docs/protocol/mokly-shell-design-inventory.md),
[depicted catalogue](../../docs/protocol/mokly-shell-design-catalogue.md),
[design links](../../docs/protocol/mokly-design-links.md),
[design components](../../docs/protocol/mokly-design-components.md),
[component library](../../docs/protocol/mokly-design-component-library.md),
[component design](../../docs/protocol/mokly-component-design.md),
[palette](../../docs/protocol/mokly-viewer-palette.md), and
[appearance](../../docs/protocol/mokly-viewer-appearance.md) contracts own
the details of these designs.

## Configuration

[`mokly.config.json`](./mokly.config.json) follows the
[configuration contract](../../docs/protocol/mokly-configuration.md). Its
paths resolve from the file:

- `roots` reads `specs`, and reads `src/components` under the
  `example/components` prefix, so component mockups stay beside the
  component code.
- `colorSchemes` renders every screen and component in light and dark, unless
  an entry declares fewer schemes.
- `renderer`, `postcss`, and `moduleResolution` configure the React render and
  the CSS transform.
- `stylesheets` lists route rules in order. The first rule that matches an
  entry route applies to all of its views. The last rule links `styles.css`
  to the React example's screens and components, and adds `styles-dark.css`
  to their dark views.
- `repoRoot` is the repository root, two directories up.
- `$schema` names the editor schema that `@mokly/mokly` ships.

## Build and serve

From the repository root:

```bash
npm run dev
```

`npm run dev` runs watched Serve on this configuration and prints its URL.
Before Serve starts, it installs the dependencies with `npm ci` when they are
missing or `package-lock.json` changed after the last install. It builds with
`npm run build` when a build output is missing or older than the install. The
build covers the native binary, the UI package, the viewer, the shim, and the
sidecar. After you change Mokly's own sources, run `npm run build` before
`npm run dev`. Put Serve options after `--`, for example
`npm run dev -- --port 0`.

To validate the catalogue and write the static site:

```bash
npx mokly build --config examples/basic/mokly.config.json --strict --out ../../.context/example
```

`build` renders every view, fails on an error and, with `--strict`, on a
warning, and writes the site into the `--out` directory. A `base-dependencies`
warning still prints when the branch's dependency files differ from the base,
but it does not fail `--strict`. Without `--out` it
writes `mokly-static/` at the repository root. No command writes into the
example. Never commit an output directory. Serve and `build` compare the
working tree with the merge base of `HEAD` and `origin/main`; `--base` names
another ref, and `build --no-changes` skips the comparison. The
[static build contract](../../docs/protocol/mokly-export.md) owns the output,
and the [preview deployments](../../docs/protocol/npm-preview-deployments.md)
publish this example for `main` and for pull requests.

To check the packed packages against this example:

```bash
npm run package:smoke
```

It packs the UI package, the viewer, the CLI, and the host's native package and
installs them into a copy of this example outside the repository. The copy also
holds the UI package sources that the design mockups import by repository path.
It starts the installed `mokly serve` in a directory below `mokly.config.json`
and opens a React, a design, and an HTML screen and a Markdown document in
headless Chrome. It builds the copy with `--strict` and opens the same entries
in the built site. Last, it builds the copy again through `npx` with an empty
npm cache and no Mokly package in the copy. The
[developer test commands](../../docs/protocol/developer-test-commands.md#packed-consumer-smoke)
own its rules.

## What needs the sidecar

The Rust core parses and composes the Team area's screens, components, page,
and use case, the Markdown documents, and the `_folder.json` records without
JavaScript. It also rewrites links and bundles stylesheets.

The sidecar runs the JavaScript: every `*.mockup.ts` and `*.mockup.tsx` entry
module, which includes the React example, the React components, the
`getting-started` page, the `tour` use case, and the design catalogue; the
renderer module; and the PostCSS module. The configuration names a PostCSS
module, so every local stylesheet, the Team area's stylesheets included,
passes through the sidecar's `processCss` call before the core bundles it.
Serve and `build` of this example therefore always start the sidecar. A
catalogue of HTML files without a `postcss` module starts none.

## Related docs

- [Entry props and variants](../../docs/protocol/mokly-entry-props.md)
- [Pages](../../docs/protocol/mokly-pages.md),
  [Markdown documents](../../docs/protocol/mokly-documents.md), and
  [folders](../../docs/protocol/mokly-folders.md)
- [Link controls](../../docs/protocol/mokly-link-controls.md)
- [Imported stylesheets](../../docs/protocol/mokly-imported-styles.md) and
  [PostCSS](../../docs/protocol/mokly-imported-styles-postcss.md)
- [Large consumer fixture](../../tests/fixtures/large/README.md), the
  scale counterpart of this example

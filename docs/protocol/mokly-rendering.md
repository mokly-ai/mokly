# Rendering And Document Assembly

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

This contract defines how the Rust core turns one view of an entry into a
document: the boundary between the core and the sidecar, the renderer module,
the stylesheet list of a document and its order, and document assembly. The
[HTML screens contract](./mokly-html-screens.md) owns the template language,
the [sidecar contract](./mokly-sidecar.md) owns the JavaScript renders, the
[comparison contract](./mokly-comparison.md) owns ownership and ignore
regions, and the [artifact path contract](./mokly-artifact-paths.md) owns the
routes. Public-resource eligibility follows
[source protection](./mokly-source-protection.md) and the
[referenced closure](./mokly-public-closure.md).

## Rendering Boundary

The core composes every document in memory and owns its tree. It renders HTML
screens, HTML components, `.page.html` pages, and Markdown documents without
JavaScript. JavaScript runs only in the sidecar: `renderScreen` renders a
React screen, `renderComponent` one React component instance, `renderStory`
one story, and `renderPage` one `definePage` callback. A render returns an
HTML fragment, the styles the render produced, the resources the renderer
declared, and warnings. The core parses the fragment with a spec-compliant
HTML parser, reads its comment markers into ownership and ignore regions,
drops the markers, and grafts the tree in. The core memoizes every fragment
under the render graph of the
[architecture page](../architecture/rust-core.md#render-graph). A page render
returns a complete document instead, and the core applies the
[page contract](./mokly-pages.md) to it.

Every screen and component is a render over props under the
[entry props contract](./mokly-entry-props.md); a variant is a props set.
The core renders one document per view, that is per viewport and colour
scheme that the entry enables. Light is the canonical scheme. A page and a
Markdown document have no viewport axis.

Mokly depends on no consumer component library, React Native Web, product
tokens, or app components. `@mokly/mokly` declares `react` and `react-dom`
`>=19.0.0` as peer dependencies and ships no private runtime. The sidecar
resolves both from the consumer and bundles every entry module, stories file,
and the renderer module into one graph with one React instance, under the
[bundling rules](./mokly-sidecar.md#bundling). The same holds when Mokly is
installed locally and when npx fetches it into its cache; a configuration
module's imports resolve from the configuration directory, never from the
temporary directory or the npx cache.

## Renderer Module

The optional `renderer` configuration names one consumer module. The sidecar
bundles it with the entry modules and calls its default export around every
React screen render and every React component render, including a component
that an HTML screen uses. A story renders through Storybook's own decorators,
and a page keeps its own document, so neither is wrapped. The module is
consumer code: it installs a theme provider, collects React Native Web
styles, injects product fonts, or establishes other render context. It has
one synchronous default export with this contract:

```ts
import type { ReactNode } from "react";
import type { ColorScheme, Viewport } from "@mokly/mokly";

interface RenderInput {
  colorScheme: ColorScheme;
  entry: { kind: "screen" | "component"; path: string; title: string };
  node: ReactNode;
  props: Readonly<Record<string, unknown>>;
  viewport: Viewport;
}

interface RenderResult {
  node: ReactNode;
  resources?: readonly string[];
}

export default function render(input: RenderInput): ReactNode | RenderResult;
```

- `node` is the entry's render over the props of the entry or the variant;
  `props` repeats them. The renderer returns the node it wants rendered,
  normally `node` inside its providers. It returns no HTML string and no
  document; the sidecar renders the returned node to a fragment.
- Styles that the render produces reach the document through
  [style collection](./mokly-sidecar.md#style-collection): a style registry
  the sidecar knows, or `<style>` elements in the returned tree. Their owner
  is the rendered component, or the entry for a whole-screen render.
- `resources` names repository-relative public files that the document uses
  without a reference the parser can read, such as a font that a script of
  the renderer loads. Each enters the referenced closure as a seed with the
  entry as owner, after the same checks as a document link; a seed grants no
  access and supplies no CSS evidence.
- The renderer reads `colorScheme` and `viewport` to select its theme and
  layout. It cannot write the `html` element, the head, or the stylesheet
  links. Mokly owns no product theme state.
- A renderer that throws or returns a value that is not a React node fails
  the render with `render-failed` under the sidecar contract.

## Renderer Stylesheets

This section owns the complete stylesheet list of a screen or component
document and its order. The core writes the list into the document head after
the collected style elements; the renderer and the sidecar add no links.
Stylesheet rules are the ordered, declarative
[configuration](./mokly-configuration.md) of the consumer. Their globs match
the entry route `<path>/index.html` before views are derived, so one exact
rule applies to both viewports and every enabled scheme. The head links these
hrefs, in this order:

1. The shared list of the first matching rule: each local path as its bundled
   route and each HTTP(S) URL unchanged, with the entry's declared component
   stylesheets at the `componentStylesheets` marker of that list, or after
   the shared entries when the list has no marker, under the
   [component stylesheet contract](./mokly-component-stylesheets.md).
2. That rule's scheme-specific list for the view's colour scheme, in the
   same form.
3. The renderer module's bundled stylesheet, when the renderer imports CSS.
4. The entry's bundled stylesheet, when the entry module or stories file
   imports CSS.

A configured local stylesheet is bundled like an imported one, and bundled
stylesheets exist without a configured rule. The
[imported stylesheet contract](./mokly-imported-styles.md) defines the
delivery roots and the routes. A local href resolves relative to the view's
route, with each segment URL-encoded: from `home/index.mobile.html` to
`styles/src/home.mockup.tsx.css` the href is
`../styles/src/home.mockup.tsx.css`. The same order applies to dark views,
component parents, variants, and stories. A `definePage` page, a `.page.html`
page, and a Markdown document receive no configured link and no bundled link;
a `definePage` module that imports CSS still has a bundled stylesheet route,
which the page's author may link with a relative URL. A configured file that a declaration also
names is linked once, at the configured position. A pending bundled route is
a valid link and resource target during validation, before anything is
written. Shell and device-frame CSS is package-owned and self-contained;
product CSS is never copied into the npm package.

## Document Assembly

The core assembles one document per view from the composed tree; nothing is
written into the repository:

- `<!doctype html>`, an `html` element with `style="color-scheme: light"` or
  `style="color-scheme: dark"`, and a head with the UTF-8 charset meta, the
  viewport meta, the entry title, the collected style elements as
  `<style data-mokly-owners>` elements under
  [style ownership](./mokly-comparison.md#style-ownership), and the stylesheet
  links above. The body holds the composed fragment. A consumer sets a root
  class, a theme attribute, or a `lang` through the renderer's wrapper
  element or the screen body.
- Component instances, slots, and ignore regions are node annotations of the
  tree under the [comparison contract](./mokly-comparison.md#markers); ignore
  scopes are resolved during composition and leave nothing in the output.
  Served and built documents carry no markers and embed no catalogue
  data.
- After composition the core adapts `to` controls under the
  [link control contract](./mokly-link-controls.md), rewrites every complete
  or relative `mock:<path>[#fragment]` value in `href` and `data-nav-href`
  under the [navigation contract](./mokly-navigation.md), and validates
  links, anchors, and resources under
  [link validation](./mokly-link-validation.md) and the
  [referenced closure](./mokly-public-closure.md), where a relative reference
  resolves against the document's route. A logical `href` is valid
  only on a native HTML or SVG link; a document with an activatable catalogue
  link rejects `<base href>`. A Markdown document also passes
  [document safety](./mokly-document-safety.md).
- The core records the entry's usage, resource evidence, and instance
  identities from the attached regions into the catalogue model; the
  [shell delivery contract](./mokly-shell-delivery.md) delivers them in the
  entry detail.
- The document is serialized once. Identical inputs give identical bytes on
  every platform, and `documentKey` is the hash of those bytes. The document
  and its tree live in the render cache keyed by their inputs. Serve answers
  `/static/mokly-generated/<route>` from the cache, `build` writes
  `static/mokly-generated/<route>` into its output directory, and the base
  side of a comparison renders the base commit's sources through the same
  path. The [artifact path contract](./mokly-artifact-paths.md) names the
  routes.

A build warning that a render raises, such as a link control tier or a
foster-parented component element, follows the
[build warning record](./mokly-build-warnings.md); it never enters the
document bytes.

## Related Docs

- [Render sidecar](./mokly-sidecar.md)
- [HTML screens, pages, and use cases](./mokly-html-screens.md)
- [HTML components](./mokly-html-components.md)
- [Imported stylesheet delivery](./mokly-imported-styles.md)
- [Rust core architecture](../architecture/rust-core.md)
- [Render pipeline](../architecture/build-pipeline.md)

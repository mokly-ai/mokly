# Mokly Rendering And Generated Output Contract

This contract expands the [package contract](./mokly-package.md) for the
[authoring API](./mokly-authoring.md) and
[configuration](./mokly-configuration.md). Public-resource eligibility follows
[source protection](./mokly-source-protection.md) and the
[referenced closure](./mokly-generated-output.md#closure-urls-and-publication).

## Delivery Status

Removing derived CSS owners, filtering renderer CSS owners and recording root
output boundaries are implemented in [M19](../../plans/remove-source-path-evidence.md#milestone-19-classify-css-by-where-its-rules-match) of the [source-path removal plan](../../plans/remove-source-path-evidence.md).

The remaining contract is implemented.
Rendering and the generated-output lifecycle use path-derived file names and
manifest v9. Mokly renders discovered Markdown definitions under the
[document contract](./mokly-documents.md); source Markdown stays private.

## Rendering Boundary

Mokly provides a plain React static renderer. A consumer may configure one
renderer module that receives the screen node, entry metadata, viewport,
resolved stylesheet links, and render context, and returns one complete HTML
document synchronously.

The renderer module is consumer code. It may add a component-library theme
provider or collect React Native Web atomic styles. Mokly must not depend on a
consumer component library, React Native Web, product tokens, or app components.

The renderer module has one default synchronous export with this exact
contract:

```ts
import type { ReactNode } from "react";
import type {
  ColorScheme,
  ScreenDefinition,
  ComponentVariantDefinition,
  ComponentStyleOwnership,
  ComponentResourceOwnership,
  Viewport,
} from "@mokly/mokly";

interface RenderInput {
  colorScheme: ColorScheme;
  entry: ScreenDefinition | ComponentVariantDefinition;
  componentProps?: Readonly<Record<string, unknown>>;
  node: ReactNode;
  stylesheets: readonly string[];
  viewport: Viewport;
}

interface RenderResult {
  html: string;
  styles?: readonly ComponentStyleOwnership[];
  resources?: readonly ComponentResourceOwnership[];
}

export default function render(input: RenderInput): string | RenderResult;
```

For a component variant entry, `entry` is the variant entry itself and
`componentProps` carries its validated props; the parent component is never
rendered on its own, and `RenderInput` has no `variantId` field.

The string or `html` field must contain a complete `<html>` document. Optional
document-style and non-CSS resource records provide exact ownership; unclaimed or mixed
material stays conservative. Every renderer resource path also declares a
checked closure resource, including a stylesheet with no HTML link. CSS
ownership claims are ignored after public-file validation, with the documented
warning; their paths remain private closure seeds for delivery and watching.
A seed supplies no component reason, inserted-link span or CSS rule proof.
The [component contract](./mokly-components.md)
and [attribution contract](./mokly-component-changes.md) define validation. Mokly
serializes Review-ignore markers, adapts opt-in `MockLink asChild` controls,
and rewrites every complete
`mock:<path>[#fragment]` value, complete or relative, found in `href` or
`data-nav-href` after this function returns, including when one element has
both attributes. The rewrite
is element-aware and applies to complete page output: logical `href` is valid only on
native HTML/SVG links, every other owner fails the build, documents with an
activatable logical link reject `<base href>`. Final rendered documents
receive the same link and resource validation. The
package declares `react` and `react-dom` `>=19.0.0` as peers and does not ship a
private runtime. The builder resolves both peers and their subpaths from
consumer config, then bundles every React-bearing input in one internal graph.

The builder invokes the renderer once for every effective viewport and color
scheme. Light stays the default and canonical render. The consumer renderer
uses `colorScheme` to select its theme and may stamp `color-scheme` or a data
hook on the complete document; Mokly does not own product theme state.

All entry modules and the renderer are bundled into one build-time graph with
one React instance. This must work when Mokly is installed locally and when
it is fetched into npm's npx cache. Consumer dependencies resolve from the
consumer project, while imports of `@mokly/mokly` resolve to the executing
package version.
Config dependencies are bundled from the config directory before the temporary
module is evaluated, so bare workspace/package imports never resolve from the
operating-system temporary directory or npx cache.

## Stylesheet Selection

## Renderer Stylesheets

This section owns the complete `RenderInput.stylesheets` list and its order.
Stylesheet rules are ordered, declarative consumer configuration. Their globs
match the entry's catalogue route (`<path>/index.html`) before viewport
fragments are derived, so one exact screen-route rule applies to both viewports
and every enabled scheme.

`RenderInput.stylesheets` contains these hrefs, in this order:

1. The first matching rule's shared paths.
2. That rule's scheme-specific paths.
3. The configured renderer's generated stylesheet, if present.
4. The entry's generated stylesheet, if present.

Generated links exist even without a configured rule. Resolve local paths
relative to each fragment route and URL-encode each segment. For example, from
`mokly-generated/home/index.mobile.html` to
`mokly-generated/styles/src/home.mockup.tsx.css` the href is
`../styles/src/home.mockup.tsx.css`. The same order
applies to dark views, component variants and saved viewports. The
[imported stylesheet contract](./mokly-imported-styles-assets.md) defines the
exporting entry root and generated resources. The built-in renderer contributes
no generated stylesheet. The consumer renderer decides whether to emit the
supplied links; Mokly does not inject these link tags. Pages receive no render
input or automatic link. They still cause an entry stylesheet to be generated
and can link it themselves with a relative URL. Pending generated routes are
valid link/resource targets before the transaction writes them.

The `componentStylesheets` marker and component declarations add no hrefs to
this list. Component `RenderInput.entry` has no declaration list. Mokly inserts
declared component stylesheets beside the renderer's configured links after
rendering; see the
[component stylesheet contract](./mokly-component-stylesheets.md) for marker
placement and nearest-present-link fallback, and the linked
[ownership contract](./mokly-component-stylesheet-ownership.md) for private
inserted-link provenance, final-link validation and style-offset rebasing.
Only links that Mokly inserts receive recorded spans after the package
finishes ordinary link edits. No transient token is written. No CSS resource
owners are derived. Renderer stylesheet ownership is ignored with a warning;
the validated resource declaration remains in the checked closure. CSS
attribution still needs actual linked rule proof. Document `styles` and
non-CSS owners retain their meaning.
Shell and device-frame CSS is package-owned and self-contained; product CSS is
never copied into the npm package.

## Generated Contract

The deterministic generated views, manifest v9 shape, CSS/assets and ownership
rules are defined in the linked [Generated Rendering Contract](./mokly-rendering-generated.md).
Exact identity-derived routes follow [Artifact Paths](./mokly-artifact-paths.md).

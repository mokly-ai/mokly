# Mokly Rendering And Generated Output Contract

This implemented contract expands the [package contract](./mokly-package.md)
for the [authoring API](./mokly-authoring.md) and
[configuration](./mokly-configuration.md). Public-resource eligibility follows
[source protection](./mokly-source-protection.md) and the
[referenced closure](./mokly-generated-output.md#closure-urls-and-publication).

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
style/resource records provide exact component ownership; unclaimed or mixed
material stays conservative. The [component contract](./mokly-components.md)
and [attribution contract](./mokly-component-changes.md) define validation. Mokly
serializes Review-ignore markers, adapts opt-in `MockLink asChild` controls,
and rewrites every complete
`mock:<id>[#fragment]` value found in `href` or `data-nav-href` after this
function returns, including when one element has both attributes. The rewrite
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

Stylesheet rules are ordered, declarative consumer configuration. Their globs
match the entry's catalogue route (`<prefix>/<id>.html`) before viewport
fragments are derived, so one exact screen-route rule applies to both viewports
and every enabled scheme. Shared
stylesheets come first, followed by the matching scheme-specific list.
Generated fragment links are relative to the fragment route and URL-encoded by
segment.
Shell and device-frame CSS is package-owned and self-contained; product CSS is
never copied into the npm package.

With [imported CSS](./mokly-imported-styles.md), the configured renderer
stylesheet follows configured links, then the entry stylesheet. The built-in
renderer adds none; a custom renderer emits the supplied links. Complete page
callbacks receive no injected links and must link their generated entry CSS
explicitly.

## Generated Contract

The deterministic generated views, manifest v8 shape, CSS/assets and ownership
rules are defined in the linked [Generated Rendering Contract](./mokly-rendering-generated.md).
Exact identity-derived routes follow [Artifact Paths](./mokly-artifact-paths.md).

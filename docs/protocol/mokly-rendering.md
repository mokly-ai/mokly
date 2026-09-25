# Mokly Rendering And Generated Output Contract

This implemented contract expands the [package contract](./mokly-package.md)
for the [authoring API](./mokly-authoring.md) and
[configuration](./mokly-configuration.md). Public-resource eligibility follows
[source protection](./mokly-source-protection.md), including configured
public exclusions.

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
  ComponentDefinition,
  ComponentStyleOwnership,
  ComponentResourceOwnership,
  Viewport,
} from "@mokly/mokly";

interface RenderInput {
  colorScheme: ColorScheme;
  entry: ScreenDefinition | ComponentDefinition;
  variantId?: string;
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
activatable logical link reject `<base href>`, and final compatibility output
is checked through that fail-closed contract. The
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

### Temporary Document Compatibility

A consumer with already-authored output may configure one synchronous
`compatibility.transformer` module. It is bundled into the same consumer graph
and default-exports this contract:

```ts
interface CompatibilityTransformInput {
  availableRoutes: readonly string[];
  colorScheme: "dark" | "light";
  content: string;
  logicalRoutes: Readonly<Record<string, string>>;
  outputPath: string;
  route: string;
  viewport: "mobile" | "desktop";
}

type CompatibilityTransformer = (input: CompatibilityTransformInput) => string;
```

`availableRoutes` contains the complete pending output plus retained existing
public static files; generated files scheduled for orphan removal are excluded.
`logicalRoutes` maps screen/use-case catalogue routes to concrete artifacts for
the current viewport and color scheme. A dark document targets dark fragments
when the destination supports them and otherwise falls back to the light
fragment. `outputPath` is repository-relative; no absolute checkout path is
exposed. Mokly applies the transformer after id links resolve and before
Review-marker, link, resource, and ownership validation. It must return a
complete document, retain the exact generated source owner, remain
deterministic, and stay consumer-owned. The shared ownership parser accepts LF
or CRLF after the header and strictly decodes its versioned canonical-base64
source field, but a missing or changed source identity fails before write. This
keeps source filenames out of HTML comment syntax; former raw-path headers are
accepted only when their source is comment-safe so existing files can be
recognized for migration. A transformer must retain the current encoded form
and cannot weaken final validation. New catalogues should author portable links
directly and leave this option unset.

Stylesheet rules are ordered, declarative consumer configuration. Their globs
match the catalogue route before viewport fragments are derived, so one exact
screen-route rule applies to both viewports and every enabled scheme. Shared
stylesheets come first, followed by the matching scheme-specific list.
Generated fragment links are relative to the fragment route and URL-encoded by
segment.
With [imported CSS](./mokly-imported-styles.md), the
configured renderer stylesheet follows these links, then the entry
stylesheet, even when no configured rule matches. The built-in renderer adds
none; the custom renderer emits any `<link>` tags. Complete page callbacks
receive no `RenderInput` or injected links; their entry CSS is still generated
for explicit relative linking.
Shell and device-frame CSS is package-owned and self-contained; product CSS is
never copied into the npm package.

The remaining contract is continued in [Generated Rendering Contract](./mokly-rendering-generated.md).

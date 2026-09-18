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

The renderer module is consumer code. It is where Accounting may add a Firna UI
theme provider or collect React Native Web atomic styles. Mokly must not
depend on `@firna/ui`, React Native Web, Accounting tokens, or Juno components.

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
Shell and device-frame CSS is package-owned and self-contained; product CSS is
never copied into the npm package.

## Generated Contract

`mokly build` writes deterministic output under `mockupsDir`:

- `<screen>.mobile.html` and `<screen>.desktop.html` fragments for each screen;
- `<screen>.mobile.dark.html` and `<screen>.desktop.dark.html` when that screen's
  effective schemes include dark;
- one complete HTML document at each page route;
- `mokly-manifest.json` using schema version 5.

Screen and use-case routes are durable identifiers and do not imply a composed
HTML file. A screen's fragments are bare product renders with required head
content but without Mokly shell chrome. Collections generate no page.
Light fragments remain canonical and unsuffixed. Turning dark off makes the
previous dark documents proven generated orphans: `check` reports them and
`build` removes them through the normal ownership-safe lifecycle.

Manifest source and output paths are repository-relative; routes are relative
to `mockupsDir`. The manifest includes every entry, fragment, source input,
relationship, related doc, and dependency needed by Browse and Review. It is
stable across operating systems and independent of absolute checkout paths.
Repository paths are canonical POSIX paths with no empty, dot, parent, drive,
or backslash segments; generated manifests are self-validated before writing.

Generated documents carry a generic generated-file header. After compatibility
transformation, every pending document must retain the expected source path in
that header. The same parser accepts LF and CRLF and lets Build remove only
files proven to have been generated by the configured catalogue: an HTML
header's source must belong to the current entries root even when
that source was just deleted. It never deletes an unknown or foreign-catalogue
file.

All catalogues emit [manifest v5](./mokly-component-manifest.md), including
pages, source inventory, saved component variants and per-view invocation/ownership
records. Historical readers accept v3, both disjoint v4 formats, and opt-in v2.
The common current shape is:

```ts
interface ManifestV5 {
  schemaVersion: 5;
  generatedBy: "mokly";
  entries: readonly ManifestEntry[];
  sourceFiles: readonly string[];
}

interface CommonEntry {
  id: string;
  kind: "screen" | "collection" | "use-case" | "page" | "component";
  title: string;
  description: string;
  rationale?: string;
  navPath: readonly string[];
  sourcePath: string;
  relatedDocs: readonly string[];
  dependencies: readonly string[];
  declaredDependencies: readonly string[];
}

type ManifestEntry =
  | ManifestComponent // See the component manifest contract for the complete shape.
  | (CommonEntry & { kind: "page"; route: string; tags?: readonly string[] })
  | (CommonEntry & {
      kind: "screen";
      route: string;
      address?: string;
      tags?: readonly string[];
      componentViews?: readonly ComponentViewRecord[];
      darkFragments?: { mobile: string; desktop: string };
      fragments: { mobile: string; desktop: string };
      viewports: readonly ["mobile", "desktop"];
      useCaseIds: readonly string[];
    })
  | (CommonEntry & {
      kind: "collection";
      childIds: readonly string[];
    })
  | (CommonEntry & {
      kind: "use-case";
      route: string;
      tags?: readonly string[];
      steps: readonly {
        screenId: string;
        title?: string;
        description?: string;
      }[];
    });
```

Entries sort by route then id; source inputs, dependencies, and generated files
sort lexically. Optional properties are omitted, not emitted as `null`.
`navPath` is derived output derived from collection ancestry;
it contains the ordered ancestor collection titles and is empty for catalogue
roots. It is not an authoring input and it is not a second source of hierarchy.
`darkFragments` is present exactly when the screen's effective schemes include
dark. Its routes use the `.mobile.dark.html` and `.desktop.dark.html` names and
participate in the same safe-route and collision validation as light fragments.
Light-only manifests omit the field.
`tags` carries the authored classification list, in authored order and never
sorted, and is written only for a page, screen, or use case that declares a non-empty
one; an absent or empty declaration is omitted, so an untagged catalogue
serializes exactly as it did before the field existed.
`sourcePath`, related docs, and dependencies use repo-relative POSIX paths.
Manifest dependencies retain the file-or-directory-root matching semantics of
the authoring API.

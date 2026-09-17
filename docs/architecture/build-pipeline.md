# React To Static HTML Build Pipeline

## Overview

```text
mokly.config.ts
        |
        v
discover *.mockup.tsx + renderer + optional compatibility modules
        |
        v
one esbuild graph, with React resolved from the consumer
        |
        v
validate definitions and cross-references in memory
        |
        v
renderer({ node, entry, viewport, colorScheme, stylesheets })
        |
        v
adapt explicit child controls -> resolve mock:id links -> compatibility bridge
        |
        v
validate markers/links/resources
        |
        v
mobile/desktop light and optional dark HTML, saved component variants, whole documents + schema-v5 manifest in memory
        |
        +---- check (committed): compare with disk, write nothing
        |
        +---- check (derived): reject Git-tracked generated output, write nothing
        |
        `---- build: stage, back up owned files, rename, roll back on failure
```

## 1. Config Loading

Mokly searches upward from the process working directory, or loads the path
given by `--config`. Config code is bundled to a temporary ESM module so `.ts`,
`.mts`, `.js`, and `.mjs` work from a local install or npx cache. Every path is
then resolved from the config file and confined to `repoRoot`.

## 2. One Consumer Graph

Registry `*.mockup.ts(x)` files, the configured renderer, imported page
helpers, and an optional temporary compatibility transformer are imported by a single virtual entry and
bundled together. The internal bundle is CommonJS so Node-oriented consumer
dependencies can retain dynamic built-in imports. Esbuild returns this bundle
in memory; evaluation creates no temporary module file. A private compilation
association retains the exact bundle, configuration and accepted artifacts for
local controls. Serve prepares a distinct validated live index and transfers that
index and bundle over private IPC before readiness, without rendering the catalogue.
Failed index candidates preserve the last-good graph. `DocumentCompiler` reuses
Build's rendering, compatibility, ownership, links, ranges and resource validators
for a requested view. Foreground and Props workers retain only bounded
generation-local documents/resources. Background compilation runs the ordinary
exhaustive Build pipeline with cooperative checkpoints in the original render order,
then uses the existing transactional writer. Build/Check/Export stay exhaustive.
Background Git I/O is parent-owned over a private worker channel. Cancellation
drains the actual subprocesses before worker termination, even if the worker cannot
yield; CPU-intensive classification stays in the worker.
See [on-demand Serve](../protocol/mokly-on-demand.md) and the
[local rendering service](../../src/server/controls/README.md).

An esbuild resolver uses `createRequire(configPath)` for `react`, React
subpaths, `react-dom`, and React DOM subpaths. Imports of `mokly` resolve to
the executing package. The result is one React runtime even when Mokly itself
lives in npm's transient npx directory.

Consumer-owned aliases, export conditions, package fields, loaders, resolution
extensions, and in-repository package roots pass directly to this graph after
strict config validation. This supports React Native Web or other workspace
layouts without putting an app alias or TypeScript-root assumption in Mokly.

Every module beneath `entriesDir` imports a module-bound Mokly authoring
facade. Each definition or nested marker is therefore attributed at the helper
call itself, including calls made later through a shared helper factory, without
sticky process-global state or an absolute checkout path.

Both config and consumer bundle metafiles supply the complete source inventory,
including tree-shaken repository inputs. Serving and publication resolve these
graphs without evaluation to reject stale inventories; reserved `.source.*`
names remain private even when no longer imported.

## 3. Rendering

Each page calls its synchronous `render()` exactly once for one complete HTML
document. It bypasses the screen renderer and variant loop, then uses the same
ownership, link, resource, and transactional validation.

Each screen owns a mobile and desktop React node. Mokly selects the first
stylesheet rule matching the screen's catalogue route, applies it to each
effective viewport/color-scheme view, and resolves each emitted URL relative to
that view's generated fragment route. It then calls the configured renderer, or
its neutral default. The renderer receives:

```ts
interface RenderInput {
  entry: ScreenDefinition | ComponentDefinition;
  variantId?: string;
  node: ReactNode;
  stylesheets: readonly string[];
  viewport: "mobile" | "desktop";
  colorScheme: "light" | "dark";
}

type Renderer = (input: RenderInput) => string | RenderResult;
```

The returned string, or `RenderResult.html`, must be a complete HTML document.
The optional structured result supplies exact component style/resource ownership;
see the [component manifest](../protocol/mokly-component-manifest.md).
Registered entries render each saved variant in every configured context through
the same consumer graph. Wrappers record actual invocations, data, caller-owned
slots, and layout-neutral ranges. The root saved variant is not its own instance.
All catalogues emit manifest v5 with the complete source inventory. Registered
components add saved variants and complete per-view invocation/ownership records;
explicit page callbacks still emit exactly one complete document. Both historical
v4 envelopes remain readable only at the Git boundary. Current readers require v5.

The [child-control adapter](../protocol/mokly-link-controls.md) uses parsed
source locations to patch only the marked control and its boundary templates.
It validates one supported root with no independent descendant interactions,
retains inactive destinations as metadata, and adds default link/focus CSS only
to documents with active adapted controls. Custom screen renderers and page callbacks use the
same adapter before logical records are captured. Compatibility output cannot
reintroduce unresolved child markers or change package-owned control metadata
and its logical owners. One parsed attribute policy enforces case-insensitive
reserved names at both boundaries, including inert template contents, without
mistaking ordinary text for metadata. Unmarked document bytes stay unchanged.

The [catalogue navigation contract](../protocol/mokly-navigation.md) retains
the stable id and optional fragment in a reserved `data-mokly-link`
marker when an HTML `<a>`/`<area>` or SVG `<a>` has a logical `href`. A
`data-nav-href`-only reference remains validated portable metadata and does not
gain Browse interaction. The builder rejects logical `href` on every non-link
or resource element and rejects `<base href>` in a document containing an
activatable logical link. It validates matching destinations when both
navigation attributes coexist, rejects consumer-authored markers, verifies
fragment anchors across every target view, and binds expected marker presence,
element namespace/native-link class, and each logical attribute to the exact
portable value produced for that element.

During a staged migration only, a configured consumer transformer receives the
complete document, current route/viewport/color scheme, repository-relative
output path, available static/output routes, and view-resolved logical routes. The
transformed document must remain complete and then passes every normal
Review-marker, link, resource, path, and ownership check.
The final ownership header must still decode to the route's expected source.
Its versioned canonical-base64 field keeps the source path comment-safe, and
the shared parser accepts either an LF or CRLF line ending. Final transformed
output must retain this current encoding; safe legacy raw-path headers remain
readable only so existing files can be recognized and migrated.

This boundary preserves complete catalogue-reference records rather than
markers alone. A transformer cannot add, remove, or alter an expected marker,
change a
metadata-only reference into an activatable link, change the owning element's
namespace or native-link class, change the set of navigation attributes that
carried its logical destination, or alter those attributes' resolved portable
values. Adding `<base href>` to a document that retains an activatable record
also fails. After transforming the complete output set, the build
re-indexes anchors from those final documents and repeats every logical fragment's
cross-view check. This keeps Browse, standalone, and Review navigation aligned.

React Native Web style collection is not a second conversion stage. If an app
uses it, its renderer wraps the node in the app provider, registers or renders
the tree with the app's React Native Web version, obtains that version's style
element, and inserts the result in the returned document. Mokly sees only
the completed HTML string.

## 4. Validation And Commit

Registry ids, routes, relationships, files, output collisions, stylesheets,
ordinary and `data-nav-href` links, anchors, local HTML resource attributes,
`srcset`, inline/style-block CSS, transitive CSS imports/URLs,
Review-ignore/material markers, protected source inventory, and manifest data are
validated before output changes. All expected bytes are held in memory.
In committed mode, `check` compares those bytes with disk and reports grouped
missing, stale, and proven-orphan paths. In derived mode, it rejects Git-tracked
generated routes, the manifest and cache contents; local generated files may be
absent or stale. Authored public assets remain tracked in either mode.

This repository's example uses derived mode. Both test entrypoints build the
package and example before tests read generated files, so the verification order
(`npm test` before `example:check`) works on a fresh clone. Comparisons rebuild
the baseline commit with `npm ci`, `npm run build`, then `npm run example:build`
inside its extraction and read the validated cached output. Head and baseline
compilation use their respective source and package versions; see the
[derived baseline contract](../protocol/mokly-derived-baselines.md).

Declared dependency paths may be files or directories. The manifest preserves
that declaration, and downstream Browse/Review impact matching treats a
directory as a root containing every changed descendant rather than requiring
an exact Git path match.

Pending generated orphans are derived once from the same ownership rule used by
Check and the output transaction. Link/resource validation and the temporary
compatibility route inventory exclude those routes before any write begins, so
a document cannot validate against a file that the successful transaction will
remove.

Watched Serve and Browse authentication reuse that same versioned,
comment-safe, newline-portable ownership proof when pruning or presenting
generated HTML. Public HTML without the header remains a consumer-owned static
input and may be classified by an explicit watch rule.

Catalogue routes use portable URL-unreserved segments, reject Windows device
filename stems, and end in `.html`. Framework-generated links and redirects
still percent-encode every path segment defensively; static asset paths may
therefore contain characters such as spaces without corrupting HTML attributes
or URL query/fragment boundaries.

`build` writes a same-filesystem staging tree, backs up only files identified by
Mokly's generated header and a source path beneath this config's authored
roots, or by the reserved manifest name. It installs staged files by rename and
restores backups on error. It refuses to overwrite an unknown or foreign HTML
file, rejects lexical or symlink-resolved targets beneath authored roots, and
never recursively replaces the consumer's mixed source/asset root.

## Package Browser Assets

The root build compiles the viewer workspace before the CLI. Viewer TypeScript
emits declarations and ESM modules; its asset step bundles the inspector, shared
vanilla modules, navigation, fonts and scoped embedding CSS. The CLI asset step
builds only private Serve/update/control composition modules and rewrites their
public runtime imports to the existing delivery paths.

Serve's live-state restoration does not depend on the catalogue validator.
An evidence refresh loads the public revision adopter dynamically after its
response arrives, then rechecks cancellation and navigation before adoption.
The package graph gate validates both static and dynamic import destinations.

Serve/export combine package-owned assets from both distributions under the
existing `__mokly/client`, `__mokly/navigation`, shell CSS and font paths. The
standalone stylesheet is unchanged; embedding CSS is a separate scoped artifact.
No React, hydration or consumer runtime is bundled into exported browsers.
Shared catalogue validation uses synchronous browser-safe SHA-256, checked against
Node digests; source inventory excludes the resolved viewer runtime even when
npm installs it as a workspace symlink. Browser
packaging fails if a client imports Node-only code. Comparison JSON is decoded
with the same new-record validator used by its producer; v2 artifacts remain
supported without adding component suppression.

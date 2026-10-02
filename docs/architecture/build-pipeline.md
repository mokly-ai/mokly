# React To Static HTML Build Pipeline

## Overview

```text
mokly.config.ts
        |
        v
walk `roots` -> entry modules, Markdown documents, `_folder.json` records + renderer + optional compatibility modules
        |
        v
one esbuild graph, with React resolved from the consumer
        |
        v
derive paths, collect exports, validate definitions and cross-references in memory
        |
        v
renderer({ node, entry, viewport, colorScheme, stylesheets })
        |
        v
adapt explicit child controls -> resolve mock:<path> links -> compatibility bridge
        |
        v
validate markers/links/resources
        |
        v
mobile/desktop light and optional dark HTML for every screen, screen variant, and component variant entry, whole documents, Mokly-rendered Markdown documents + schema-v8 manifest in memory
        |
        +---- check (committed): compare with disk, write nothing
        |
        +---- check (derived): reject Git-tracked generated output, write nothing
        |
        `---- build: stage, back up owned files, rename, roll back on failure
```

Path identity, `roots`, Markdown documents, manifest v8, and review result v5
are approved contracts under the
[path identity plan](../../plans/path-identity.md); the current implementation
still resolves `entries` globs and derives routes from kind and id until that
plan delivers them.

## 1. Config Loading

Mokly searches upward from the process working directory, or loads the path
given by `--config`. Config code is bundled to a temporary ESM module so `.ts`,
`.mts`, `.js`, and `.mjs` work from a local install or npx cache. Every path is
then resolved from the config file and confined to `repoRoot`. The configured
`roots`, defaulting to `[{ dir: "specs" }]`, are walked once into a sorted set
of matched files. Each root's `files` globs define the file shape without
another suffix filter; the default `**/*.mockup.{ts,tsx}` and `**/*.md`
patterns select the recommended `.mockup.ts` and `.mockup.tsx` convention and
Markdown documents. A matched `.md` file is a document, every other matched
file is an entry module, and a `_folder.json` file is a folder record whose
`exclude` globs remove files from its directory before derivation. Every
matched file derives one path from the root prefix, the directories between
the root and the file minus transparent names, and its leaf, under the
[path contract](../protocol/mokly-paths.md); duplicate and case-colliding
paths fail before bundling.

Before any walk, discovery projects the repository and every distinct root
once for the pass; Review projection alone falls back to its lexical path. A
non-benign root failure, including one for a later root, therefore precedes all
per-root file validation. Walks and file validation then run in declared root
order. An earlier denial precedes a later empty-root failure, and reversing the
roots reverses that diagnostic precedence. Accepted and vanished candidates are
validated once per pass. Every root must retain a file so another root cannot
hide a typo or omission; a file matched by two roots derives two paths and
fails as a duplicate path.

Walks skip `review.outDir` and denied directories. Directories that vanish or
are replaced mid-walk (`ENOENT` or `ENOTDIR`) are skipped and listed with denied
paths in the empty-root message. Other read or projection errors fail with
`config-invalid`, naming the repository-relative path and error code (`unknown`
if absent). A matched file that is deleted, or replaced by something other
than a regular file, between the directory listing and validation is dropped
and listed under `not searched` when its root is then empty. A projection or
lstat failure with any code other than `ENOENT` fails with `config-invalid`.

Config validation rejects private-cache roots before discovery. Direct
discovery retains a defense for surviving `.mokly-cache/` candidates, while a
candidate that vanishes during its preceding existence check is dropped. Each
file is classified by the shared source policy so none lies inside Review
output, the baseline cache, or a denied directory below its root. A matched
file may be nested below `mockupsDir`; it joins `sourceFiles`, stays private
through lexical and realpath aliases, and cannot overlap a generated path. The
resolved set travels with the config beside `sourceFiles`.

## 2. One Consumer Graph

The resolved entry modules, the configured renderer, imported page
helpers, and an optional temporary compatibility transformer are imported by a single virtual entry and
bundled together; Markdown documents are not bundled, because Mokly reads and
renders them itself under the [document contract](../protocol/mokly-documents.md).
The internal bundle is CommonJS so Node-oriented consumer
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

Every repository-owned module, meaning one whose real path is inside
`repoRoot` and outside `node_modules`, `.mokly-cache/`, and Mokly's own runtime,
imports a module-bound Mokly authoring facade. Each definition or nested marker
is therefore attributed at the helper call itself, including calls made later
through a shared helper factory or from a helper beside a product component,
without sticky process-global state or an absolute checkout path. Installed
packages import the plain API and cannot self-attribute. Registry validation
accepts an attributed source only when it is a resolved entry module or an
inventoried source file. Generated and Git-tracked ownership additionally trust
a repository-relative owner below a configured root that matches one of its
`files` globs with dotfile matching enabled, preserving cleanup, and the
[move pairing](../protocol/mokly-moves.md) that depends on it, after a matched
source is renamed, moved, or deleted. A root at the repository root trusts
every matching owner path and no other path through this branch. Export and
Review confinement remain limited to directories that hold resolved entry
modules and documents; a repository-root root does not protect the whole
repository as an export source root.

Both config and consumer bundle metafiles supply the complete source inventory,
including tree-shaken repository inputs. Serving and publication resolve these
graphs without evaluation to reject stale inventories; reserved `.source.*`
names remain private even when no longer imported.

## 3. Rendering

Each page calls its synchronous `render()` exactly once for one complete HTML
document. It bypasses the screen renderer and variant loop, then uses the same
ownership, link, resource, and transactional validation. Each Markdown
document is rendered by Mokly's own CommonMark renderer into one light document
and, when the catalogue enables dark, one dark document; the consumer renderer
never sees it, and its relative links and image resources are resolved under
the [document contract](../protocol/mokly-documents.md).

Each screen owns a mobile and desktop React node. Mokly selects the first
stylesheet rule matching the screen's logical route (`<path>/index.html`),
applies it to each effective viewport/color-scheme view, and resolves each
emitted URL relative to that view's generated file. It then calls the configured
renderer, or its neutral default. The renderer receives:

```ts
interface RenderInput {
  entry: ScreenDefinition | ComponentVariantDefinition;
  componentProps?: Readonly<Record<string, unknown>>;
  node: ReactNode;
  stylesheets: readonly string[];
  viewport: "mobile" | "desktop";
  colorScheme: "light" | "dark";
}

type Renderer = (input: RenderInput) => string | RenderResult;
```

`RenderInput` has no `variantId`: for a component render, `entry` is the
variant entry itself and `componentProps` carries its validated props.

The returned string, or `RenderResult.html`, must be a complete HTML document.
The optional structured result supplies exact component style/resource ownership;
see the [component manifest](../protocol/mokly-component-manifest.md).
Each component variant entry renders in every configured context through the
same consumer graph. Wrappers record actual invocations, data, caller-owned
slots, and layout-neutral ranges. The variant's root render is not its own
instance. All catalogues emit manifest v8 with the complete source inventory.
Registered components add variant entries and complete per-view
invocation/ownership records; explicit page callbacks still emit exactly one
complete document. Current and Git-baseline readers require v8; earlier output
makes Changes unavailable under
[baseline compatibility](../protocol/mokly-baseline-compatibility.md).

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
the target path and optional fragment in a reserved `data-mokly-link`
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

Registry paths, relationships, files, output collisions, stylesheets,
ordinary and `data-nav-href` links, anchors, local HTML resource attributes,
`srcset`, inline/style-block CSS, transitive CSS imports/URLs,
Review-ignore/material markers, protected source inventory, and manifest data are
validated before output changes. All expected bytes are held in memory.
In committed mode, `check` compares those bytes with disk and reports grouped
missing, stale, proven-orphan, and unclaimed paths. Unclaimed paths are HTML
files with a valid Mokly ownership header whose owner is neither a resolved
file, an inventoried source, nor a path below a configured root matching its
`files` globs; ordinary authored HTML is not reported.
In derived mode, Check does not add this filesystem diagnostic and instead
rejects Git-tracked generated routes, the manifest and cache contents; local
generated files may be absent or stale. Authored public assets remain tracked
in either mode.

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

Every generated file name derives from the entry's path under the
[artifact path contract](../protocol/mokly-artifact-paths.md): the entry
document is `<path>/index.html`, each view is
`<path>/index.<viewport>[.dark].html`, and each shell is
`view/<path>/index.html`. Path segments are portable ASCII letters, digits,
`-`, and `_` with case preserved; a segment that is a Windows device name is
rejected, and two paths that differ only by case collide. Framework-generated
links and redirects still percent-encode every path segment defensively; static
asset paths may therefore contain characters such as spaces without corrupting
HTML attributes or URL query/fragment boundaries.

`build` writes a same-filesystem staging tree, backs up only files identified by
Mokly's generated header and a source path beneath this config's authored
roots, or by the reserved manifest name. It installs staged files by rename and
restores backups on error. It refuses to overwrite an unknown or foreign HTML
file, rejects lexical or symlink-resolved targets beneath authored roots, and
never recursively replaces the consumer's mixed source/asset root.

## Package Browser Assets

The root build compiles the viewer workspace before the CLI. Viewer TypeScript
emits declarations and ESM modules; its asset step bundles the standalone
hydration entry (the shell tree with React and React DOM), the transport and
geometry modules it imports, the inspector, navigation, fonts and scoped
embedding CSS. The CLI asset step builds only its private Serve capability
composition and rewrites its public runtime imports to the existing delivery
paths. After each browser directory is complete, its build writes an adjacent
generated manifest containing the sorted delivered module names. Serve and the
package gate require exact manifest/directory equality, so a missing or extra
output fails before delivery rather than silently changing the inventory.
The package graph gate checks each delivered module's static and dynamic
imports against that inventory. It rejects unresolved relative imports, bare
package imports and Node dependencies, and confines React to the standalone
hydration bundle. The temporary source partition used during the rewrite is
retired with the old implementation.

Serve's live-state restoration does not depend on the catalogue validator.
An evidence refresh loads the public revision adopter dynamically after its
response arrives, then rechecks cancellation and navigation before adoption.
The package graph gate validates both static and dynamic import destinations.

Serve/export combine package-owned assets from both distributions under the
existing `__mokly/client`, `__mokly/navigation`, shell CSS and font paths. The
standalone stylesheet is unchanged; embedding CSS is a separate scoped artifact.
Exported browsers receive the same hydration bundle as Serve, including React;
no consumer runtime is ever bundled, and the in-frame inspector stays a
React-free IIFE under its byte budget.
Static shell documents reference the single owned catalogue JSON and validate
its identity and finalized deployment before hydration. They still contain the
complete server-rendered route, but do not repeat the full catalogue payload
for every route. Serve retains its inline accepted snapshot.
Shared catalogue validation uses synchronous browser-safe SHA-256, checked against
Node digests; source inventory excludes the resolved viewer runtime even when
npm installs it as a workspace symlink. Browser
packaging fails if a client imports Node-only code. Comparison JSON is decoded
with the same strict review-result v5 validator used by its producer.

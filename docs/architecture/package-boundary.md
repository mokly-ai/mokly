# Package And Consumer Boundary

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

## Rule

Mokly owns the mechanics shared by any mockup catalogue. A consumer owns
everything that gives a screen application meaning or appearance. The boundary
is enforced through the package layout, a renderer module, declarative paths,
and synthetic tests.

| Mokly owns                                                  | Consumer owns                                    | Configured at the boundary        |
| ----------------------------------------------------------- | ------------------------------------------------ | --------------------------------- |
| Discovery, paths, the catalogue model, and validation       | Product screens, components, and fixture data    | Roots and file globs              |
| HTML templating: substitution, slots, `mokly-if`, viewports | Product component library                        | Module resolution for the sidecar |
| Sidecar bundling and React, page, and Storybook renders     | Theme, tokens, providers, and the renderer       | Renderer module and stylesheets   |
| Stylesheet bundling and PostCSS orchestration               | Imported CSS, fonts, images, and PostCSS plugins | `postcss` module                  |
| The render cache and the static output transaction          | Product CSS, fonts, and images                   | Watch inputs                      |
| Safe paths and catalogue navigation                         | Product route semantics                          | Declared `path` and `movedFrom`   |
| Git comparison and Review-ignore rules                      | Comparison policy                                | The comparison base               |
| The static build and publication                            | Hosting, credentials, and deployment             | `--out` and the receiver          |

## Dependency Direction

`@mokly/mokly` holds the Node shim that resolves the `mokly` binary, the
sidecar, and the authoring API. It lists the five `@mokly/native-<target>`
packages as exact optional dependencies and has React and React DOM peer
dependencies for React authoring only. It does not depend on React Native,
React Native Web, consumer applications, or their workspace layouts. The
sidecar resolves React from the consumer's configuration file and bundles every
JavaScript authoring input into one graph, so component trees use one React
runtime.

The renderer module is the only place an app installs theme providers,
collects React Native Web styles, injects product fonts, or establishes other
render context. Those actions depend on app-owned packages and policy, so
moving them into Mokly would make it app-specific. Module resolution is
likewise consumer-owned: aliases, conditions, package fields, extensions, and
package roots describe the consumer component tree, and Mokly applies them
without application-specific defaults. The
[imported CSS contract](../protocol/mokly-imported-styles.md) reserves `.css`
and `.module.css` import handling for Mokly; consumer files, PostCSS plugins,
and their versions stay consumer-owned.

## Registered Components

HTML components and `defineComponent` definitions share one registry under the
[entry props contract](../protocol/mokly-entry-props.md): a prop schema in the
JSON Schema profile, the component's own props, saved variants, slots, and
derived controls. Mokly records usage from the renders themselves; import lists
do not imply usage. During Serve, a live control re-renders the component
through the sidecar with edited props; preview documents stay in memory, and
controls change neither sources nor Changes. The static output carries saved
variants and inspection without the live capability. See the
[component contract](../protocol/mokly-components.md).

## Viewer Package Boundary

The repository uses npm workspaces with `packages/mokly` as
`@mokly/mokly` and `packages/viewer` as `@mokly/viewer`;
`@mokly/mokly` depends on its exact coordinated release version. The viewer
owns the shell component tree and CSS, the browser entry, navigation, frame
adapters, the inspector, and the readers of the catalogue index and entry
detail. Shared shapes come from the generated types of the Rust model crate.
The CLI keeps configuration, rendering, comparison, Serve, the static build,
publish, and the private control and live transports. The viewer never imports
the CLI, Node built-ins, Git, or consumer application code, and it renders only
in the browser under the
[shell delivery contract](../protocol/mokly-shell-delivery.md).

The public boundary consists of
[scoped instances](../protocol/mokly-instances.md), the
[catalogue read model](../protocol/mokly-catalogue.md), the
[viewer API](../protocol/mokly-viewer.md), and the
[frame adapter](../protocol/mokly-frame-adapter.md). Hosts consume packages
and documented public artifacts, without private access, deep imports, or
cloud-specific flags. Consumer code never enters the browser. Serve and the
static output load the viewer's standalone bundle, which includes React; React
hosts render the viewer with their own React. React slots and marker content
stay host-owned; the viewer positions that content from instance geometry but
owns no comment model, tenant, authentication, or persistence. Pack the viewer
first and install the CLI, its host platform package, and the viewer archives
in clean consumers; release automation
publishes the platform packages, then the viewer, then the CLI.

## Rust Core Boundary

The [Rust core architecture](./rust-core.md) describes the backend: a Rust
binary owns the process, the render graph, HTML parsing and rendering,
comparison, the server, the static build, and publish. JavaScript runs only in
the [render sidecar](../protocol/mokly-sidecar.md): esbuild bundling, React,
page, and Storybook renders, and consumer PostCSS. Rendered HTML, collected
styles, definitions, and JSON frames cross that boundary. The Rust model crate
owns every shared shape and generates the TypeScript types that the viewer and
the sidecar consume.

## Complete-Document Boundary

A `.page.html` file or a `definePage` callback supplies a complete HTML
document; a Markdown file matched by a root defines a
[document](../protocol/mokly-documents.md). Mokly composes a page or document
in Rust, or runs the page callback through `renderPage`, while the source
stays protected and watched. The configured renderer wraps screen and
component views; pages keep their own documents. [Paths and roots](../protocol/mokly-paths.md)
determine identity for every kind, and [move detection](../protocol/mokly-moves.md)
pairs entries across commits.

## Runtime Boundary

Serve serves rendered documents from the render cache and authored assets
from the roots. It rejects protected authoring inputs, traversal, and symlink
escapes. Watch targets come from the resolved configuration and the complete
source inventory; dependency, build, and output trees are pruned before broad
consumer rules, while explicit source modules and referenced stylesheets keep
their required action. The sidecar pool is recycled by render count and
resident size and drained on shutdown.

Changes renders the base commit from Git without checking it out over the
working tree: HTML sources come from blobs, and JavaScript sources are
extracted into the cache outside the repository with their dependencies
resolved under the dependency tiers. Comparison generations are immutable and
addressed by hash, JSON routes disable HTTP caching, and shutdown drains
generation work before it removes anything.

Browse promotes only explicit path-addressed catalogue links from composed
documents whose route matches the catalogue. Other authored HTML loses
reserved-looking metadata and is never trusted; a document with an activatable
catalogue link rejects `<base href>`. Browse uses same-origin inspection for
parent enhancement and no top-navigation capability, so consumer contexts
cannot replace the shell. The
[navigation contract](../protocol/mokly-navigation.md) defines the link
marker, the sandbox boundary, and the active-tree invariant.

## Static Build Boundary

`build` writes the complete static catalogue into the directory `--out` names:
the shell stub per route, the index, one detail per entry, every document, the
comparison generation, the viewer bundle, styles, and fonts. It owns file
selection, exclusive output reservation, replacement, and rollback under the
[static build contract](../protocol/mokly-export.md), and it stamps the
deployment identity of the
[static delivery contract](../protocol/mokly-export-delivery.md). `publish`
builds into its own directory outside the repository and uploads through the
[upload exchange](../protocol/mokly-upload-exchange.md). The viewer is a
separate rendering API; it exposes no build engine and takes over no
deployment or authentication.

## Related Docs

- [Render pipeline](./build-pipeline.md)
- [Rust core architecture](./rust-core.md)
- [Package and authoring protocol](../protocol/mokly-package.md)
- [Runtime protocol](../protocol/mokly-runtime.md)
- [Static build contract](../protocol/mokly-export.md)
- [Viewer API](../protocol/mokly-viewer.md)
- [Public catalogue read model](../protocol/mokly-catalogue.md)

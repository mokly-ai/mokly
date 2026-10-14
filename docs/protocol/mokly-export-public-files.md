# Static Build Public Files And Package Boundary

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

Continuation of [Static Build](./mokly-export.md).

## Output Inventory

`build` trusts only the files of its own render: the rendered views, the
pages, the document scheme files, the copied document resources, and the
bundled stylesheets and assets, all taken from the render cache. It never
walks a directory on disk to find output, and nothing on disk is read back.
Entry segments such as `coverage`, `dist`, `node_modules`, and `README` do not
make those files private. Ancestor directories are derived from that set to
reach exact members, not to admit siblings or a whole subtree. The catalogue
model and the stylesheet bundling metadata stay private. Confinement,
regular-file checks, source protection, and file and alias collision checks
apply to every rendered file.

Each comparison side and each removed preview uses its own inventory from its
own render: the base side's routes and closure come from the base commit's
tree under the [comparison contract](./mokly-comparison.md#sides), never
inferred from a current path. Snapshot and preview prefixes are transport
paths, not consumer directories. The metadata `build` writes, the index, the
details, and the marker, uses its own fixed inventory. Every authored file
must belong to the checked closure and pass the shared source,
protected-location, and hidden-name rules. A sibling of an accepted file gains
no permission from that membership. Never trust a header or a filename alone
to add a file to the inventory.

## Public Files And Package Boundary

Write every rendered HTML document, bundled stylesheet, and opaque asset
beneath `static/mokly-generated/` from the render cache's bytes. Copy only the
authored `assetClosure` beneath `static/`, keeping its catalogue-relative
paths. No stale output and no unreferenced authored file participates.
Imported CSS and PostCSS sources stay private; scoped npm asset URLs are
validated against the same inventory. Keep relative resource and document
links and verify their transitive HTML and CSS dependencies, including fonts,
images, `srcset`, nested local documents, and linked stylesheets. A referenced
file that cannot be written safely fails the build instead of producing a
broken link. Navigation fragments in shell and public HTML, including
query-only links, must identify an anchor in the resolved document; Serve and
`build` share fragment decoding and anchor checks. Resource fragments such as
SVG and CSS identifiers keep their resource policy; historical snapshot
navigation is not modified and receives resource-only validation.

The shared public-file confinement check is a minimum boundary, not permission
to copy the whole repository. Prune entry trees, inventoried sources, the
configuration and the renderer module, inventoried source modules, dotfiles
and dot directories, Git, dependency, and cache trees, the output directory,
and the reservation paths for each selected closure file. Explicit HTTP(S) and
data resources keep the resource policy and are not downloaded; a build that
references remote resources is not guaranteed to work offline.

One resource policy applies to current copies and comparison snapshots.
Exclude configured consumer package roots strictly inside `mockupsDir`,
including their metadata and non-source payloads. A package root equal to
`mockupsDir` fails explicitly; ancestor roots such as `packageRoots: ["."]`
are supported. The
[package-root error](./mokly-public-closure.md#one-policy-per-compilation) is
a build policy error, not a configuration-load check.

Copy public resources into the owned output as ordinary files, never
symlinks. Reject selected symlink files and directories and escaping
references explicitly; do not traverse a symlinked directory. Base-side files
come from Git blobs under the comparison contract's regular-file rules.
Documents in the output and in the snapshots carry no markers; the composed
trees of the comparison contract hold ownership in memory.

Ship the package shell assets and the complete browser module graph from the
installed package. Do not ship consumer inputs, source maps, configuration
modules, npm packages, `.git`, local environment files, or comparison
diagnostic summaries. The output's public-safe inventory is distinct from
private comparison data.

`mokly-viewer/index.json` and `mokly-viewer/entries/**` enter the same
collision-checked ownership and upload inventories as every other file,
alongside `mokly-viewer/client/inspector.js`. The index v7 is the public form
of the catalogue model under the [catalogue contract](./mokly-catalogue.md);
the details carry each entry's usage, resource evidence, and workspace lists.
Ownership v3 and upload v2 gate the viewer namespace; the review result is v8.
The deployment identity includes the index and the details under the
[delivery hashing rule](./mokly-export-browser.md#deployment-identity) and
includes the inspector.

Only current rendered HTML copies in the output gain the Mokly-owned inspector
script and its bounded inert boundary metadata under the
[published inspector contract](./mokly-published-inspector.md). The
[inspector contract](./mokly-frame-adapter.md) requires a host handshake
before activation. Authored files and snapshot document bytes are unchanged;
consumer content and portable links are not rewritten to implement
inspection. Default local frames keep scripts disabled.

The static build belongs to the Rust core, in the static crate of the
[architecture](../architecture/rust-core.md#crates). Consumers must not
deep-import package internals or copy repository scripts. The CLI is the
supported interface; there is no public JavaScript build engine API. The
[`@mokly/viewer`](./mokly-viewer.md) package is a separate supported browser
viewer API that consumes the index and the details, not a build engine and
not permission to import CLI internals. Serve and `build` are its first hosts:
they deliver the stub and ship its standalone bundle, including React, so a
built catalogue runs the same shell in the browser as Serve. Consumer code
never enters that bundle.

Keep typed options and results and narrow, testable filesystem, Git, and
capture boundaries. Reuse the render graph and the composition rules rather
than creating a second screen renderer or weakening validation.

## Compatibility And Non-Goals

The repository preview deployment runs `build` on the example catalogue and
deploys its output under the
[preview deployment contract](./npm-preview-deployments.md); it shares the
output transaction, the deployment identity, and the ownership inventory with
every consumer build. Host routing and header files belong to the deployment
step, which must not mutate an installed output or relax confinement. `build`
adopts only an empty destination or one with a valid current ownership marker.

The first version supports HTTP(S) deployment at the origin root. Subpath
hosting, `file://` catalogue browsing, incremental or watched builds, Changes
without Git, hosting adapters in the CLI, deployment credentials, and a new
visual design are outside this contract. Portable individual fragments keep
their direct-from-disk behaviour.

## Verification

Rust tests of the static crate cover option validation and config-relative
paths, custom renderer and module resolution, pages and documents, both
schemes and viewports, invalid empty and removed catalogues, non-default bases,
missing history and resources, output overlap, symlinks, ownership and
collisions, concurrent writers, input changes, rollback, shutdown,
self-attribution, public-file exclusion, and the asset closure.

Browser tests serve only the completed output through a basic static file
server with no Mokly routes, rewrite rules, Git, or source tree, and verify
every static delivery behaviour. The repository preview keeps its Cloudflare
regression coverage.

## Registered Components

Component catalogues carry component and variant entries in the index, with
removed variants in `removedEntries`, and review v8 evidence with actual
affected consumers in the details. The same inspector renders in served and
built shells. The static build supplies no render capability and no token;
controls are read-only and make no render requests. The resource validation,
deployment identity, reservations, transaction, and immutable snapshot rules
apply to component pages as well, and each variant entry's stub is written
once at its derived `view/<path>/index.html`.

The [shared closure builder](./mokly-public-closure.md) is the single capture
boundary. A referenced authored extension or build-folder name is not itself a
denial. Runtime inputs, protected locations, hidden segments, and symlinks stay
private. Required references fail with their referring route.

# Export Public Files And Package Boundary

Continuation of [Consumer Static Export](./mokly-export.md).

## Public Files And Package Boundary

For imported CSS, capture every accepted generated route under
`mokly-generated/styles/` and `mokly-generated/assets/`, not their private
source files. Committed mode checks and copies disk bytes; derived mode uses
validated compiled text and opaque binary bytes without walking the reserved
tree on disk. Inventory, route links and resource validation use that same
capture; no manifest schema change is needed. Private stylesheet and PostCSS
inputs stay outside the static inventory. Validate `%40`-encoded scoped
package asset links against captured routes.

Include current manifest-owned fragments and pages and all public
regular assets/documents that Browse exposes beneath `mockupsDir`, subject to
export exclusions below. Retain relative resource and fallback document links
and verify their transitive HTML/CSS dependencies, including fonts, images,
`srcset`, nested local documents, and linked stylesheets. Referenced files that
cannot be exported safely fail the operation instead of producing broken links.
Navigation fragments in shell/public HTML, including query-only links and host
aliases, must identify an anchor in the resolved document. Build and export
share fragment decoding and anchor checks. Resource fragments such as SVG/CSS
identifiers retain their resource policy; historical snapshot navigation remains
unmodified and receives resource-only validation.

The shared public-file confinement check is a minimum boundary, not permission
to copy the whole repository. Prune entry trees, inventoried sources, the config
and renderer, source modules, dotfiles/directories, Git/dependency/cache trees,
review/export outputs, and transaction paths before traversal. Explicit HTTP(S)
and data resources retain the existing resource policy and are not downloaded;
an export referencing remote resources is not guaranteed to work offline.

One export resource policy applies to current copies and comparison snapshots.
Exclude configured consumer package roots strictly inside `mockupsDir`, including
their metadata and non-source payloads. A package root equal to `mockupsDir`
fails explicitly; ancestor roots such as `packageRoots: ["."]` remain supported.

Copy public resources into owned output as ordinary files, never symlinks.
Reject selected symlink files/directories and escaping references explicitly;
do not recursively traverse a symlinked directory. The existing stricter regular
Git-file and source-root rules continue to apply to baseline dependencies.
Run the shared ownership-aware Browse adapter on published current HTML copies;
comparison documents remain byte-unmodified in separate before/after trees.

Publish the required package shell assets and complete browser/navigation module
graph from the installed package. Do not ship consumer TS/TSX, source maps,
config modules, npm packages, `.git`, local environment files, comparison
diagnostic summaries, or comparison ownership markers. The export's own
public-safe inventory is distinct from private comparison metadata.

[`__mokly/catalogue.json`](./mokly-catalogue.md) is implemented in the same
collision-checked ownership/upload inventories, alongside the implemented
`__mokly/client/inspector.js`. The read model v4 is a public allowlist
projection of manifest v8; `mokly-manifest.json` remains excluded. Ownership v2
and upload v1 keep their schema versions; the review result is v5 and the
delivery descriptor v3. Deployment identity includes the catalogue under the
[delivery hashing rule](./mokly-export-browser.md#deployment-identity) and
includes the inspector and its inert maps.

Only the ownership-aware adapter's current published HTML copies gain the
Mokly-owned inspector script and bounded inert boundary metadata. The
[inspector contract](./mokly-frame-adapter.md) requires a host handshake before
activation. Authored/generated files on disk and comparison document bytes
remain unchanged; consumer content and portable links are not rewritten to
implement inspection. Default local frames keep scripts disabled.

Core export modules belong under `src/export` and compile into `dist`. Consumers
must not deep-import package internals or copy repository scripts. The CLI is
the supported interface for export; no public JavaScript export engine API is
added. The [`@mokly/viewer`](./mokly-viewer.md) package is a separate supported
React/SSR viewer API consuming public catalogue data, not an export engine or
permission to import CLI internals. Serve and export are its first hosts: they
render its shell tree on the server and ship its standalone hydration bundle,
including React, so exported browsers run the same shell as Serve. Consumer
code never enters that bundle.

Keep typed options/results and narrow testable filesystem, Git, and capture
boundaries. Reuse existing generation/rendering rules rather than creating a
second screen renderer or weakening build validation.

## Compatibility And Non-Goals

Repository preview captures the already-built catalogue through Browse and
shares final artifact validation, delivery identity, and the output transaction.
It retains optional Changes and existing snapshot/alias rules. Cloudflare
routing/header files remain adapter concerns. A provider adapter may add metadata before installation;
it must not mutate an already-installed site or relax core confinement.
Test legacy preview ownership migration independently of a clean CI output.

The first version supports HTTP(S) deployment at the origin root. Subpath
hosting, `file://` catalogue browsing, incremental/watch export, Git-free export,
optional omission of comparisons, hosting adapters in the public CLI, deployment
credentials, and a new visual design are outside this change. Portable individual
fragments keep their existing direct-from-disk behavior.

## Verification

Implementation must cover option validation and config-relative paths, custom
renderer/module resolution, v8 pages, both schemes/viewports, invalid empty and
removed catalogues, non-default bases, missing history/resources, output overlap,
symlinks, ownership/collisions, concurrent writers, input changes, rollback,
shutdown, export self-attribution, public-file exclusion, and asset closure.

Packed-consumer tests must exercise the installed CLI from a clean consumer
with no access to repository scripts. Browser tests serve only the completed
artifact through a basic static file server with no Mokly routes, rewrite
rules, Git, or source tree, and verify all static delivery behavior. Retain
Cloudflare preview regression coverage and the existing build/check/serve gate.

## Registered Components

Component catalogues carry manifest-v8 component variant entries and review
result v5 evidence, including removed variants and actual affected consumers.
The same inspector renders in served and exported shells. Export supplies no
local render capability or token; controls are read-only and make no render
requests. The existing resource validation, deployment identity, adapter
aliases, reservations, transaction, and immutable snapshot rules apply to
component pages as well, and each variant entry's shell is written once at its
derived `view/<route>`.

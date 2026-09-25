# Export Ownership And Public Boundaries

Continuation of [Consumer Static Export](./mokly-export.md).

## Output Ownership And Confinement

The output must be a strict descendant of `repoRoot`. Validate both lexical
and projected real paths before creating directories and again before replacing
anything. Reject symlink output entries and escapes through symlink ancestors.

An internal hosting adapter may declare a stricter output root. Require the
output to be a strict descendant of that root both lexically and after projecting
real paths, at preflight and again before installation. The repository preview
uses `.context` as this root. A symlink inside it cannot redirect output elsewhere
in the repo. A symlinked root is supported only when its resolved location still
satisfies all core repository/source protections; the transaction pins the real
output location so retargeting cannot redirect installation.

Output must neither contain nor be contained by `mockupsDir` or
`review.outDir`, and must not contain any resolved entry module or the
directory holding one. It must not contain inventoried authoring inputs, the
config, renderer module, or a consumer package's `package.json`. Reject
repository root, Git metadata, dependency directories, and package runtime
directories as targets. These checks also apply when the requested directory
does not yet exist.

Accept a missing destination or an empty real directory. A nonempty directory
must have a regular `.mokly-export-artifact` ownership file using the
[public v1 schema](./mokly-export-ownership.md) and its generated-file inventory.
Reject missing/malformed markers,
unexpected files outside the inventory, unsafe inventory paths, symlink entries,
and unsupported versions. Treat the marker as public-safe metadata: no absolute
checkout paths, credentials, or timestamps. Never use its strings as unchecked
deletion targets. Export owns replacement of its recorded output files.

Serialize writers to the same resolved output with an exclusive reservation;
a competing process fails clearly. An abandoned reservation is never silently
stolen. An actionable error identifies it for explicit recovery. Transaction
paths are exact, operation-owned paths, never a broad glob or consumer directory.

Reservations use `.mokly-export-reservations/locks/<output-basename>` beside
the resolved output. Native real-path resolution and unmodified filename keys
give case/symlink aliases the filesystem's own lock equivalence, without
serializing genuinely distinct destinations. The internal namespace has a
regular `.owner` containing `mokly-export-reservations-v1` plus a newline and
remains after cleanup; never put authored files or export destinations inside it.
Unowned namespaces and symlinked namespace/lock directories are rejected.
The `.mokly-export-transaction` marker records `schemaVersion: 2` and the
output basename; `stage/` and `backup/` remain inside that reservation. Old
`.mokly-export-<20-hex>.lock` siblings block new exports until explicitly
recovered. Confirm no writer is active, inspect any retained backup, and recover
it before moving an abandoned reservation aside. Nothing is silently stolen.

Do not accept the old `.mokly-preview-artifact` marker through the public
command. The repository-only adapter may explicitly migrate a valid legacy
preview at its known output path with the same backup/rollback guarantees;
malformed markers and unrelated contents still fail.

## Public Files And Package Boundary

Include current manifest-owned fragments and pages and all public
regular assets/documents that Browse exposes beneath `mockupsDir`, subject to
export exclusions below. Retain relative resource and fallback document links
and verify their transitive HTML/CSS dependencies, including fonts, images,
`srcset`, nested local documents, and linked stylesheets. Referenced files that
cannot be exported safely fail the operation instead of producing broken links.
For [imported CSS](./mokly-imported-styles.md), this also includes
every owned route under `mokly-generated/styles/` and
`mokly-generated/assets/`, not their private source files. Committed export
checks and copies disk bytes; derived export captures validated compilation
output as text or binary bytes. Inventory, route links and resource validation
use the same capture; no manifest schema change is needed.
Navigation fragments in shell/public HTML, including query-only links and host
aliases, must identify an anchor in the resolved document. Build and export
share fragment decoding and anchor checks. Resource fragments such as SVG/CSS
identifiers retain their resource policy; historical snapshot navigation remains
unmodified and receives resource-only validation.

The shared public-file confinement check is a minimum boundary, not permission
to copy the whole repository. Prune entry trees, inventoried sources, the config and
renderer, source modules, dotfiles/directories, Git/dependency/cache trees,
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
`__mokly/client/inspector.js`. The read model is a public allowlist projection of manifest v5;
`mokly-manifest.json` remains excluded. Ownership v1, upload v1, review v2/v3
and delivery descriptor v2 keep their schema versions. Deployment identity
includes the catalogue under the [delivery hashing rule](./mokly-export-delivery.md#deployment-identity)
and includes the inspector and its inert maps.
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
permission to import CLI internals. Serve and export are its first hosts:
they render its shell tree on the server and ship its standalone hydration
bundle, including React, so exported browsers run the same shell as Serve.
Consumer code never enters that bundle.
Keep typed options/results and narrow testable filesystem, Git, and capture
boundaries. Reuse existing generation/rendering rules rather than creating a
second screen renderer or weakening build validation.

## Compatibility And Non-Goals

Repository preview captures the already-built catalogue through Browse and
shares final artifact validation, delivery identity, and the output transaction.
It retains optional Changes and its existing snapshot/alias rules. Cloudflare routing/header files
remain adapter concerns. Legacy output migration must be tested independently
of clean CI output. A provider adapter may add metadata before installation;
it must not mutate an already-installed site or relax core confinement.

The first version supports HTTP(S) deployment at the origin root. Subpath
hosting, `file://` catalogue browsing, incremental/watch export, Git-free export,
optional omission of comparisons, hosting adapters in the public CLI, deployment
credentials, and a new visual design are outside this change. Portable individual
fragments keep their existing direct-from-disk behavior.

## Verification

Implementation must cover option validation and config-relative paths, custom
renderer/module resolution, v5 pages, both schemes/viewports, invalid empty and
removed catalogues, non-default bases, missing history/resources, output overlap,
symlinks, ownership/collisions, concurrent writers, input changes, rollback,
shutdown, export self-attribution, public-file exclusion, and asset closure.

Packed-consumer tests must exercise the installed CLI from a clean consumer
with no access to repository scripts. Browser tests serve only the completed
artifact through a basic static file server with no Mokly routes, rewrite
rules, Git, or source tree, and verify all static delivery behavior. Retain
Cloudflare preview regression coverage and the existing build/check/serve gate.

## Registered Components

Component catalogues retain manifest-v5 saved variants and comparison-schema-v3
evidence, including removed variants and actual affected consumers. The same
inspector renders in served and exported shells. Export supplies no local render
capability or token; controls are read-only and make no render requests. The
existing resource validation, deployment identity, route aliases, reservations,
transaction, and immutable snapshot rules apply to component pages as well.

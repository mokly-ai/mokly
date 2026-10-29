# Public File Policy And Referenced Closure

## One Policy Per Compilation

One policy per render generation decides each repository-relative authored
path once, from its logical and physical location, source membership,
protected-location membership, and regular-file status. Configured
stylesheets, declared component stylesheets, renderer resource seeds, and the
transitive link walk receive the same decision for one path. A new generation
after a source, configuration, or resource change decides again; no
filesystem decision outlives its generation.
Stylesheet admission does not authorize source-file delivery. Configured and
component-declared local CSS inputs become private sources; their generated
bundles and assets follow [stylesheet delivery](./mokly-imported-styles.md).

The policy rejects an unsafe or escaping path, a hidden path segment, a
symbolic link at any path component, a non-regular file, a consumer
dependency or package tree, the static output directory and its transaction
paths when they lie inside the repository, and every input that the
[source protection contract](./mokly-source-protection.md) protects: root
matches, entry sources, the source inventory, and reserved basenames. It
keeps the denial precedence and the cause of that contract. It does not
reject an otherwise valid authored file for a `.js`, `.ts`, `.map`, or other
extension, or for a directory named `dist`, `target`, `coverage`,
`test-results`, or `playwright-report`. Actual inputs and actual protected
locations stay private. An unreferenced file stays private whatever its
name.

A configured package root below the repository root is a private tree at its
path after `.` and `..` segments are removed, in the working tree and in the
base tree of a comparison. A package root equal to the repository root, such
as `packageRoots: ["."]`, protects nothing by itself. The policy has no
generated directory to skip: discovery and PostCSS scanning exclude only the
trees that the configuration and the source protection contract name.

## Referenced Closure

Serve, `build`, publish, watch, and the base side of a comparison compute the
same sorted unique authored closure from the same inputs: the composed
documents of a generation, the pending bundled stylesheets and assets of the
[imported stylesheet contract](./mokly-imported-styles.md), the resources
that the renderer declared, and the policy above. In watched Serve, the
repair of an invalid target starts another pass.

References are read from the composed tree, each with the owner of the
referencing element under the
[comparison contract](./mokly-comparison.md#resources): `<a href>`,
`data-nav-href`, resource hints such as `preload`, `<iframe>`, `src`,
`srcset`, `poster`, inline style `url()`, and CSS `@import` and `url()`
chains, including inside embedded documents. Composed `href` and `src` first
pass the [document URL policy](./mokly-document-safety.md#url-policy): `data:`
and protocol-relative `//` URLs fail there. The closure skips permitted
external references. For other resource inputs, including `srcset`, `poster`,
and CSS URLs, it skips external and data references. A relative reference resolves against
the referencing document's route: a result under `static/mokly-generated/`
names a rendered document or resource of the generation, and any other
result under `static/` names the authored file at that repository-relative
path. Relative local paths are decoded and confined, fragments keep their
validation, and authored HTML and CSS are walked transitively; each file is
read and each edge set visited once per pass, and a cycle is visited once. A
binary resource keeps its exact bytes and has no child links. The walk stops
at a catalogue page link: the link's
identity and required anchors are checked through the catalogue, and the
whole catalogue is never rendered to discover one document's closure. In
on-demand mode the closure of a document joins the generation when the
document renders, and the generation's closure only grows until the next
generation replaces it. When a source replacement keeps a document key
unchanged, the replacement carries that document's previous closure files
only after its own policy accepts each file. This includes files reached by
an unchanged document whose render completes after replacement preparation.
A changed or removed document does not carry its previous closure. A full
`build` computes the closure of
every document. Identical input bytes give identical closures in every mode.

Decision: a replacement carries the closure of each unchanged document after its own policy accepts each file. Rendering every retained view again was rejected, because it repeats work that the replacement keeps on purpose. Serving declared files without closure membership was rejected, because it weakens confinement.

A renderer resource declaration is a closure starting point even without an
HTML link. Every seed passes the same policy and existence checks as a
document link before it enters the closure. A declaration cannot bypass
source protection, authorize a symlink, or make an unlisted file public, and
a failure names the declaring route. Closure membership alone supplies no
CSS change reason, no component proof, and no ownership. Link and seed
failures are `build-invalid`:

```text
document links and resources are invalid:
- <route>: protected target <reference>: <reason>
- <route>: missing target <reference>
```

A declared component resource that fails the policy reports
`component resource is not a public file: <path> (<reason>)`, where `<path>`
is the declared public path and `<reason>` is the policy denial, or
`missing, non-regular, or outside the repository` for an unavailable
file. Diagnostics are sorted deterministically, and the URL and anchor
diagnostics of [link validation](./mokly-link-validation.md) are kept.

## Serve Reads And The Static Output

Membership in the closure is necessary but not sufficient at read time.
Serve rechecks confinement and every path component, opens the final file
without following a symbolic link, and verifies that the open handle is a
regular file. `GET` and `HEAD` apply the same rule. A missing, replaced,
protected, or unlisted resource returns 404; no watcher list can authorize
it, and the render cache does not replace these checks. A served authored
file is read from the working tree at request time, and a changed file is a
watch input under the [watch contract](./mokly-watch.md).

`build` copies exactly the closure of its generation under
`static/<repository-relative path>`, as ordinary files, never as symlinks,
with their exact bytes, and enumerates no directory to find extra assets.
Publish uploads that output unchanged. The base side of a comparison reads
the base commit's closure from Git blobs with the same policy applied to the
base's own inventory; the Git reader rejects a symbolic link rather than
following it, and the base's closure is the only public authored set of that
side.

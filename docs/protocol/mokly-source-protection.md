# Catalogue Source Protection

## Delivery Status

Implemented for schema-v5 [pages](./mokly-pages.md), screens, and flows.
The same resolved inventory protects build, runtime, comparisons, and both
publication options. Verification is tracked in
[Unified Catalogue Pages](../../plans/unified-catalogue-pages.md); the
resolved-entry-set rule was delivered by the
[co-located entry discovery plan](../../plans/co-located-entry-discovery.md).

## Protected Inputs

Use one source-classification policy for current HTTP assets, generated-resource
validation, Review resource reads, static publication, and public content-change
classification. A file is protected if it is a resolved entry module, appears
in the validated `sourceFiles` inventory, has a reserved source basename, or
matches a public exclusion. Every resolved entry module is also an inventoried
source, so the entry-set rule is a stable identity for entries rather than a
second inventory. Apply each rule to both its requested path
and its resolved repository-relative target. A public-looking symlink cannot
make a protected target public. Existing regular-file and root-confinement
checks remain mandatory. The same classifier runs over every resolved entry
module at discovery, as defined by the
[configuration contract](./mokly-configuration-discovery.md#entry-discovery). An entry
may be nested below `mockupsDir`, including a `docs/mockups/src` layout, but it
remains an inventoried protected input: public reads and exports deny both its
lexical path and realpath aliases, and generated routes cannot collide with it.
An entry cannot sit inside Review output, the baseline cache, or a
package-owned private directory. The supported nesting and its output and alias
protections are exercised by
[`entry_discovery.test.ts`](../../tests/entry_discovery.test.ts),
[`output_safety.test.ts`](../../tests/output_safety.test.ts), and
[`server_safety.test.ts`](../../tests/server_safety.test.ts).

The canonical `mokly-manifest.json`, former `mokabook-manifest.json`, and legacy
v2 `mockbook-manifest.json` at `mockupsDir` are internal metadata. Deny all
three configured paths and their realpath aliases at every public-resource
boundary, even when their inventory is absent or they are pending generated
output. Keep them readable by internal build, freshness, and Git-baseline
readers. They are not authoring inputs and must not be added to `sourceFiles`
merely to make them private. Ordinary public JSON remains supported. Browsers
receive the catalogue data they need through the shell; no public manifest
endpoint is provided.
The implemented [public catalogue](./mokly-catalogue.md) adds
`/__mokly/catalogue.json` beside this private boundary; it is not a manifest
endpoint. Serve/export allowlist its viewer fields and omit `sourceFiles`,
resolved dependency evidence, ownership/style offsets, legacy envelopes and
absolute paths. Authored display metadata and optional
[instance source locations](./mokly-instances.md#optional-invocation-source)
remain repository-relative and confer no permission to fetch source files.
The existing canonical and historical manifest denials, including realpath
aliases, continue unchanged.
An absent or dangling historical-manifest alias remains private without
preventing unrelated public files from loading.

The repository's `.mokly-cache/` is package-private in every mode, including
physical aliases. Public readers, export, resource references, change evidence
and watchers exclude it before consumer globs or source-watch exceptions.
Only the dedicated historical baseline reader may read its completed output.

Reserve basenames ending in `.source.html`, `.source.htm`, `.source.ts`,
`.source.tsx`, `.source.js`, `.source.jsx`, `.source.mts`, `.source.cts`,
`.source.mjs`, or `.source.cjs`, matched case-insensitively. Their protection is
independent of imports, manifest membership, and whether a page still uses them.
This is a file-access rule, not a source-discovery or navigation mechanism.
It applies to abandoned files under the former legacy directory as well.

For example, removing the final import of `old-page.source.tsx` must leave the
file inaccessible through `/static` and absent from both publication options.
Deleting source files is not a condition of migration. Arbitrarily named helpers
are covered by the inventory while imported; helpers retained without imports
must use a reserved basename, match a public exclusion, or be matched by an
`entries` glob. A glob-matched file is an entry module and therefore protected
authored source. If it exports no registry value, it contributes no definitions
and can only trigger the normal empty-registry error. The `entriesDir` shorthand
alone keeps the `.mockup.ts` and `.mockup.tsx` naming convention by expanding to
its suffixed glob.
Ordinary public browser scripts are not made private merely because they end in `.js`.

Reject generated output routes that use a reserved source basename, match a
public exclusion, or overlap any protected input, including through a symlink.
A generated ownership header, logical link, or asset reference cannot override
source or internal-metadata protection. Only the builder's canonical manifest
output may target its internal metadata path. A request for a protected file has
the existing not-found behavior; a generated document that needs it as a public
resource fails validation with its referring route. The shared classifier retains
the denial cause: entries root, reserved basename, listed input, or exclusion
with its matched glob. Build, ownership, publication, and resource diagnostics
report that cause; exclusion errors name `publicExclude` and the matched glob.
Lexical denial precedence is entries root, reserved basename, listed input,
then exclusion in every alias mode. Full alias resolution additionally checks
the realpath source index as a fallback, including live retargeted aliases.
Canonical manifest validation and ownership bypass only public exclusions via
an explicit classifier option, reusing the index for the accepted `sourceFiles`
array; absent inventories are not cached.
Stylesheet and component-resource failures keep their typed validation errors
and referring routes even when a file's alias cannot be resolved.

## Public Exclusions

`publicExclude` is a config-owned list of safe relative POSIX globs.
Its matching base is `mockupsDir`, not `repoRoot`: a candidate at
`docs/mockups/generated/notes/private.json` with that generated directory as
`mockupsDir` is tested as `notes/private.json`. Do not prefix the glob with
`docs/mockups/generated/`. The [configuration contract](./mokly-configuration.md)
defines validation and resolution.

Ship these defaults, in this order:

- `**/README`
- `**/README.*`
- `**/tsconfig.json`
- `**/tsconfig.*.json`

All exclusion matching is case-insensitive on every platform, including consumer
globs. Match the whole relative path, include dotfiles and dot-directories, and
let `**/` match zero or more directories. Thus defaults cover `README.md`,
`nested/readme.md`, `tsconfig.json`, and `nested/tsconfig.mokly.json`.
Consumer globs extend the defaults; omission and an empty list both retain them.
Any match excludes; there is no negation or later rule that restores access.

Evaluate exclusions inside the one shared source-classification policy, against
both the candidate path relative to `mockupsDir` and its realpath alias relative
to the resolved mockups root. Either match protects the file. Resolve existing
parent aliases for pending output and deleted paths; existing root-confinement
checks still reject targets outside the public root. HTTP GET/HEAD, generated
resource validation, current and historical Review resource reads, both static
publication options, and public content-change classification use this policy.
Do not add a separate name-only matcher at any of those boundaries.

Excluded files return not found through public HTTP, are omitted from publication,
and are not reported as public content changes. Exclusion alone does not make a
file an authoring input or add it to `sourceFiles`; a real authoring import still
joins the inventory and retains its source-watch behavior. Exclusions do not
suppress independently configured source rebuilds or explicit watch actions.
An exclusion cannot make a manifest or `.mokly-cache/` path public, override any
other source protection, or grant access through a generated ownership header.

A generated route colliding with an excluded name fails validation before writing,
with the referring route in the error, just like a reserved source basename.
A generated document referencing an excluded public resource also fails with its
referring route. Ordinary `styles.css`, `image.png`, `page.html`, and `data.json`
remain public unless another protection rule or consumer exclusion matches.

The remaining contract is continued in [Complete Source Inventory](./mokly-source-inventory.md).

# Catalogue Source Protection

## Delivery Status

Implemented for schema-v5 [pages](./mokly-pages.md), screens, and flows.
The same resolved inventory protects build, runtime, comparisons, and both
publication options. Verification is tracked in
[Unified Catalogue Pages](../../plans/unified-catalogue-pages.md).

## Protected Inputs

Use one source-classification policy for current HTTP assets, generated-resource
validation, Review resource reads, static publication, and public content-change
classification. A file is protected if it is beneath `entriesDir`, appears in
the validated `sourceFiles` inventory, has a reserved source basename, or matches
a public exclusion. Apply each rule to both its requested path
and its resolved repository-relative target. A public-looking symlink cannot
make a protected target public. Existing regular-file and root-confinement
checks remain mandatory.

The canonical `mokly-manifest.json`, former `mokabook-manifest.json`, and legacy
v2 `mockbook-manifest.json` at `mockupsDir` are internal metadata. Deny all
three configured paths and their realpath aliases at every public-resource
boundary, even when their inventory is absent or they are pending generated
output. Keep them readable by internal build, freshness, and Git-baseline
readers. They are not authoring inputs and must not be added to `sourceFiles`
merely to make them private. Ordinary public JSON remains supported. Browsers
receive the catalogue data they need through the shell; no public manifest
endpoint is provided.
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
must live under `entriesDir`, use a reserved basename, or match a public exclusion.
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

## Complete Source Inventory

Manifest v5 `sourceFiles` is a sorted, unique array of repository-relative POSIX
paths. Derive it from the union of file inputs resolved by both the config
bundle and the consumer bundle, including inputs eliminated by tree shaking:

- The config entry module and every repository-owned authoring import it loads.
- All discovered entry modules and their transitive authoring imports.
- The configured renderer, compatibility transformer, and their transitive
  authoring imports, including render helpers outside `entriesDir`.
- Repository-owned workspace package modules resolved through aliases or package
  imports; a bare package specifier alone does not imply an external dependency.

Collect real file inputs from the bundler/resolver, including original paths
behind attribution plugins; virtual wrapper IDs are not file paths. Exclude
Mokly's package runtime and installed external dependencies. Include every
entry's `sourcePath` and configured consumer module path. Preserve both the
logical path and an in-repository realpath alias when they differ.

Every non-exempt bundler file input is an authoring source, regardless of its
extension or loader, including `file`, `dataurl`, `base64`, `binary`, `css`, and
`empty`. Imported images and other data can change authored metadata or output;
they must participate in source watching and repository confinement. CSS, fonts,
images, and other assets referenced only by public resource URLs remain public
unless another protection rule applies. If a file serves both roles, source
protection wins; consumers must emit a separate public artifact instead of exposing the input.
Runtime file reads that the bundler cannot enumerate must use protected source
locations or reserved names; a dependency string alone is not a public-asset
permission or a substitute for complete static import discovery.

Reject absolute, escaping, malformed, duplicate, or unsorted inventory paths,
unresolvable source aliases, source/output overlap, and missing entry/configured
module paths. Source targets must remain regular files inside `repoRoot`.
Reject a config or consumer graph containing an outside authoring input; never
silently omit it from the inventory. Apply this after excluding runtime
and installed-dependency inputs, so a consumer's transitive
renderer, transformer, page, and template imports use the same boundary.
The error names the offending input. Consumers must move their authoring code
inside `repoRoot` or explicitly configure a common root containing it.

## Freshness And Lifecycle

Build/check derive the inventory from the same resolved graphs used for that
compilation. Before serving or publishing a current v5 catalogue, independently
resolve the config and consumer input graphs and require the persisted inventory
to match. This scan may bundle modules but must not run page render callbacks,
rewrite generated output, or read Git history. A missing, malformed, or stale
inventory rejects the candidate and directs the author to rebuild.
Freshness compares input-path membership, not content hashes; normal edits to
existing inputs are applied by build or watch. Publication additionally compares
input bytes across its capture transaction.

Watch consumes the same discovered input set. Config-graph changes use the
existing transactional config reload; consumer-module changes rebuild. Recompute
and validate the inventory before replacing the current catalogue and notifying
the browser. A failed candidate keeps the last-good generation. Asset checks
continue resolving the requested realpath at read time so changed symlinks
cannot bypass the generation's protected paths.

For v5 or historical page-v4 Review resources, use that baseline's structurally
validated inventory, entry source paths, and reserved-name rules. Never execute
historical config with the current package or rebuild a Git baseline to refresh
its inventory; a [derived baseline](./mokly-derived-baselines.md) is built once
by its own commit's tooling and then read like any historical baseline.
Historical v2/v3 and component-v4 readers retain their version-specific
source/root safeguards and also deny reserved source basenames; they are the
only readers allowed to lack v5's inventory. Internal manifest paths stay private
for every historical schema.
The active resolved config's public exclusions apply to every historical schema,
matched relative to that baseline's mockups root; never execute historical config
to obtain exclusions or add them to its source inventory. Historical paths use
the baseline reader's validated file kinds, never current disk targets. Git and
derived-baseline resource readers reject historical symlinks rather than
following them.
Current-side resource reads always use the current validated policy.

## Acceptance

Add tests before implementation for abandoned reserved files, removing their
last import, config/renderer/transformer/helper imports outside `entriesDir`,
tree-shaken inputs, local workspace packages, and arbitrary helper filenames.
Test missing/stale inventories, logical and realpath aliases, symlink escapes,
mixed source/asset roles, reserved output routes, and rejected protected links.
Cover outside config, entry, renderer, transformer, page-helper, and raw-template
imports, while proving installed dependencies outside the root still load.

Exercise the same fixtures through GET/HEAD `/static`, resource validation,
current and historical Review reads, and both publication options. Verify that
CSS, fonts, images, and public scripts still work. Test watcher reclassification
after dependency changes and prove default publication validation uses no Git.
Cover internal manifests, their symlink aliases, generated links/resources,
ordinary public JSON, and continued internal current/v2/v3/both-v4 manifest reads.
Cover every shipped exclusion at root and nested paths, mixed case, dot-directories,
consumer extensions, alias matches in either direction, and excluded generated
routes/references. Prove excluded README edits create no public content evidence,
real imported inputs still rebuild, and ordinary CSS, images, HTML and JSON remain
public when no rule protects them.

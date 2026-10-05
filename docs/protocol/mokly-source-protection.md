# Catalogue Source Protection

Build, Check, Serve, Review, export and publication share validated manifest-v9
source inventories. Exact generated files and the checked authored closure are
public under the [shared policy](./mokly-public-closure.md). Source, alias and
metadata denials win. Preview replacement requires current export ownership.

## Protected Inputs

Use one source-classification policy for current HTTP assets, generated-resource
validation, Review resource reads, static publication, and public content-change
classification. A file is protected if it matches a root glob (even when a folder exclusion
skips it without an import), is a resolved entry module or document, appears in the validated `sourceFiles` inventory, has a reserved
source basename. Every resolved entry module and
document is also an inventoried source, so the resolved-file rule is a stable
identity for entries rather than a second inventory. Apply each rule to both its
requested path and its resolved repository-relative target. A public-looking
symlink cannot make a protected target public. Current reads protect new root
matches immediately, before any candidate build succeeds. Historical reads use
their validated inventory without guessing from current root globs. Existing regular-file and
root-confinement checks remain mandatory. The same classifier runs over every
resolved file at discovery, as defined by the
[configuration contract](./mokly-configuration.md#roots). An entry may be nested
below `mockupsDir`, including a `docs/mockups/src` layout, but it remains an
inventoried protected input: public reads and exports deny both its lexical path
and realpath aliases, and authored sources cannot live in `mokly-generated/`. An entry
cannot sit inside Review output, the baseline cache, or a package-owned private
directory. The supported nesting and its output and alias protections are
exercised by [`entry_discovery.test.ts`](../../tests/entry_discovery.test.ts),
[`output_safety.test.ts`](../../tests/output_safety.test.ts), and
[`server_safety.test.ts`](../../tests/server_safety.test.ts).

The canonical `mokly-manifest.json` and its realpath aliases are internal
metadata at every public-resource boundary, even before output exists. Internal
build, freshness and baseline checks may read it. It is not an authoring input
and must not enter `sourceFiles`. Other JSON follows the ordinary closure and
source rules; a filename from an older release grants no special access.
Browsers receive public catalogue data, never the private source manifest.

The implemented [public catalogue](./mokly-catalogue.md) adds
`/mokly-viewer/catalogue.json` beside this private boundary; it is not a manifest
endpoint. Serve/export allowlist its viewer fields and omit `sourceFiles`,
resolved dependency evidence, ownership/style offsets, private envelopes, and
absolute paths. Authored display metadata and optional
[instance source locations](./mokly-instances.md#optional-invocation-source)
remain repository-relative and confer no permission to fetch source files.
An absent or dangling manifest alias remains private without
preventing unrelated public files from loading.

[Markdown file links](./mokly-documents.md#links-and-resources) classify output
targets before inventory: reject the generated tree and metadata, and
render public-resource targets as plain text without adding them to `sourceFiles`.
Sources stay private. [Move evidence](./mokly-moves.md) uses confined internal
reads; it never exposes source bytes as resources or snapshots.

The repository's `.mokly-cache/` is package-private including
physical aliases. Public readers, export, resource references, change evidence
and watchers exclude it before consumer globs or source-watch exceptions.
Only the dedicated historical baseline reader may read its completed output.

Reserve basenames ending in `.source.html`, `.source.htm`, `.source.ts`,
`.source.tsx`, `.source.js`, `.source.jsx`, `.source.mts`, `.source.cts`,
`.source.mjs`, or `.source.cjs`, and `_folder.json`, matched case-insensitively.
Only the exact name `_folder.json` is a discovered folder-record carrier. Their protection is
independent of imports, manifest membership, and whether a page still uses them.
This is a file-access rule, not a source-discovery or navigation mechanism,
and applies in every directory.

For example, removing the final import of `old-page.source.tsx` must leave the
file inaccessible through `/static` and absent from both publication options.
Deleting source files is not a condition of migration. Arbitrarily named helpers
are covered by the inventory while imported; helpers retained without imports
must use a reserved basename, be matched by a
configured root's `files` glob. A matched file is an entry module or a Markdown
document and therefore protected authored source. An entry module that exports
no definition fails the build under the
[entry module contract](./mokly-entry-modules.md#diagnostics).
Ordinary public browser scripts are not made private merely because they end in `.js`.

Reject generated output routes that use a reserved source basename or collide
with internal metadata. A plain generated marker, logical link, or asset reference cannot override
source or internal-metadata protection. Only the builder's canonical manifest
output may target its internal metadata path. A request for a protected file has
the existing not-found behavior; a generated document that needs it as a public
resource fails validation with its referring route. The shared classifier retains
the denial cause: root match, reserved basename, or listed input. Build,
publication and resource diagnostics report that cause. Lexical denial
precedence is root match, reserved basename, then listed input. Full alias
resolution additionally checks
the realpath source index as a fallback, including live retargeted aliases.
Canonical manifest validation reuses the index for the accepted `sourceFiles`
array; absent inventories are not cached.
Stylesheet and component-resource failures keep their typed validation errors
and referring routes even when a file's alias cannot be resolved.

## Referenced Public Assets

Only files reachable in the validated
[asset closure](./mokly-generated-output.md#closure-urls-and-publication) are
public. Files under `mockupsDir` are not implicitly served or published;
hand-written HTML is not an independently published route, but referenced
authored HTML can be a closure asset and its links must be traversed. `README`, `tsconfig`, and
other unreferenced files remain private without special name-based exclusions.
A referenced protected source, symlink, missing file, or escape fails the build
with its referring route; public readers return not found for unlisted files.
The closure validator also rejects hidden path segments under the existing
private static-resource rule before serving or exporting the result; a
referenced hidden path fails `build-invalid` with its referring resource.
The same closure governs Serve, export, publication and Review. Never use a
plain generated marker to grant asset access.

## Complete Source Inventory

The complete inventory includes imported CSS, nested `@import`s, local `url()`
assets and PostCSS-reported file and directory
dependencies. Inventory-only freshness runs the same CSS/PostCSS pass. Ignore
plugin paths outside `repoRoot` or physically below `node_modules` before
normalization, honor directory globs, and never inventory generated output.
An explicit generated-output report fails; directory walks skip generated
files in every command. A reported
public file under `mockupsDir` fails unless the graph already inventoried it
as a source. Every file below `mokly-generated/` remains package-owned output,
not an authored input, even without an HTML header. See
[imported stylesheet delivery](./mokly-imported-styles.md).

Manifest v9 `sourceFiles` is a sorted, unique array of repository-relative POSIX
paths. Derive it from the union of file inputs resolved by both the config
bundle and the consumer bundle, including inputs eliminated by tree shaking:

- The config entry module and every repository-owned authoring import it loads.
- Every resolved entry module and document, and each module's transitive
  authoring imports.
- The configured renderer and its transitive
  authoring imports, including render helpers that no root glob matches.
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
renderer, page, and template imports use the same boundary.
The error names the offending input. Consumers must move their authoring code
inside `repoRoot` or explicitly configure a common root containing it.

## Freshness And Lifecycle

Build/check derive the inventory from the same resolved graphs used for that
compilation. Before serving or publishing a current v9 catalogue, independently
resolve the config and consumer input graphs and require the accepted in-memory
inventory to match. This scan may bundle modules but must not run page render callbacks,
rewrite generated output, or read Git history. A missing, malformed, or stale
inventory rejects the candidate and directs the author to rebuild.
Freshness compares input-path membership, not content hashes; normal edits to
existing inputs are applied by build or watch. Publication additionally compares
input bytes across its capture transaction.

Watch consumes the same discovered input set. Config-graph changes use the
existing transactional config reload; consumer-module changes rebuild. Recompute
and validate the inventory before replacing the current catalogue and notifying
the browser. A failed candidate keeps the last-good generation. Asset checks
recheck realpath confinement and regular-file identity at read time; a
retargeted symlink is not an accepted closure file.

For baseline Review resources, use the accepted v9 inventory, entry sources,
and reserved-name rules. Never execute baseline config with the current package;
a [derived baseline](./mokly-derived-baselines.md) is built by its own commit's
tooling and then read through the v9 boundary. The accepted baseline's closure is the only public authored set. Baseline
paths use the reader's validated file kinds, never current disk targets. Git and
derived-baseline resource readers reject symlinks rather than
following them.
Current-side resource reads always use the current validated policy.

## Acceptance

Add tests before implementation for abandoned reserved files, removing their
last import, config/renderer/helper imports that no root glob
matches, entry modules co-located beside product components, tree-shaken
inputs, local workspace packages, and arbitrary helper filenames.
Test missing/stale inventories, logical and realpath aliases, symlink escapes,
mixed source/asset roles, reserved output routes, and rejected protected links.
Cover outside config, entry, renderer, page-helper, and raw-template
imports, while proving installed dependencies outside the root still load.

Exercise the same fixtures through GET/HEAD `/static`, resource validation,
current and historical Review reads, and both publication options. Verify that
CSS, fonts, images, and public scripts still work. Test watcher reclassification
after dependency changes and prove default publication validation uses no Git.
Cover internal manifests, their symlink aliases, generated links/resources,
ordinary public JSON, v9 internal reads and earlier-envelope rejection.
Cover unreferenced files at root and nested paths, aliases in either direction,
missing and protected closure references, and `mokly-generated/` escapes. Prove
unreferenced README edits create no public content evidence, real imported
inputs still rebuild, and referenced CSS and images remain public when no
source-protection rule denies them.

The approved [public-file policy](./mokly-public-closure.md) centralizes these
checks once per compile. File extensions and build-folder names alone do not
protect a referenced authored file. Actual source and protected-location rules
still win. Renderer seeds use the same validation, and Serve rechecks each
listed file without following symbolic links at read time.

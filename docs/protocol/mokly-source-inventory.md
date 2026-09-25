# Complete Source Inventory

Continuation of [Catalogue Source Protection](./mokly-source-protection.md).

## Complete Source Inventory

Manifest v5 `sourceFiles` is a sorted, unique array of repository-relative POSIX
paths. Derive it from the union of file inputs resolved by both the config
bundle and the consumer bundle, including inputs eliminated by tree shaking:

- The config entry module and every repository-owned authoring import it loads.
- Every resolved entry module and its transitive authoring imports.
- The configured renderer, compatibility transformer, and their transitive
  authoring imports, including render helpers that no `entries` glob matches.
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
For [imported CSS](./mokly-imported-styles.md), this union also includes
the stylesheet pass's nested `@import`s and `url()` assets,
transformer-only CSS inputs, and PostCSS-reported file/directory dependencies.
Inventory-only freshness loads run the same CSS/PostCSS inventory pass;
otherwise Serve and publication would reject the current manifest. Ignore
plugin paths outside `repoRoot` and physically under `node_modules` before normalization,
honor directory globs, and never inventory Mokly-generated output. An explicit
generated-output report fails both modes; directory matches fail committed
mode and skip generated output in derived mode. A reported file under
`mockupsDir` that is not already a graph-inventoried source fails both modes,
preserving public links; a graph-imported entry there remains valid. Every
file below `<mockupsDir>/mokly-generated/` is package-owned public output,
not authored input, even without an HTML ownership header. See
[exact guidance](./mokly-imported-styles-errors.md).
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
last import, config/renderer/transformer/helper imports that no `entries` glob
matches, entry modules co-located beside product components, tree-shaken
inputs, local workspace packages, and arbitrary helper filenames.
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

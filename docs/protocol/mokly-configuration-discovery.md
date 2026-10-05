# Configuration Discovery And Exclusions

Configuration uses [roots](./mokly-configuration.md#roots). Every matched file
has exactly one root. The [root discovery contract](./mokly-root-discovery.md)
defines traversal, physical confinement, filesystem races and source ownership.
The [public exclusion contract](./mokly-public-exclusions.md) defines exclusion
globs and their resolved representation. The [folder contract](./mokly-folders.md)
defines collection exclusions; excluded root matches remain protected sources.

## Traversal And Ownership

Discovery walks each root without following symlinks and keeps every regular
file that matches a `files` glob. Below the root, walks skip directories named
`.git`, `node_modules`, `.mokly-cache`, `dist`, `coverage`, `target`,
`test-results`, `playwright-report`, or `.context`, or prefixed with
`.mokly-review-` or `.mokly-write-`; an explicit root inside such a directory
is still scanned, because the rule applies below the root only. Regular file
basenames are not denied. `_folder.json` files are read as
[folder records](./mokly-folders.md) and never as entries, and a folder
record's `exclude` globs remove matched files from that directory before
derivation. A matched file ending in `.md` is a
[document](./mokly-documents.md); every other matched file is an entry module
under the [entry module contract](./mokly-entry-modules.md). The glob alone
defines the shape, so `files: ["**/*.ts"]` evaluates every matched TypeScript
file as a module.

Every `_folder.json` inside a walked root is also owned by exactly one root,
independently of `files`. Overlapping roots that encounter that record fail with
`config-invalid`: `file <file> is matched by roots[<first>] and roots[<second>]`,
where `<file>` is repository-relative and the indices are in configured order.

The [root discovery contract](./mokly-root-discovery.md) defines physical
confinement, filesystem races and the retained ownership inventory.

Every root must retain a file; otherwise `root matches no file: <dir>` lists
denied and vanished paths, including dropped files, sorted under
`; not searched: <repository-relative paths>`. The union across roots is sorted by repository-relative path.
Discovery retains that ownership, so a file derives from the root that selected
it rather than the deepest directory that happens to contain it.

## Reserved Generated Output

`<mockupsDir>/mokly-generated/` is package-owned output. A root's `dir` or a
`files` pattern's static prefix cannot select that directory or a descendant,
including through physical aliases. Broad roots and globs remain valid; walks
skip the generated tree before reading folder records or entry modules.
Discovery and watch share these boundaries. The
[imported CSS configuration](./mokly-configuration-imported-styles.md) and
[diagnostic catalogue](./mokly-imported-styles-errors.md) own the exact rules.

## Module Resolution

`moduleResolution` has no defaults beyond esbuild's platform behavior. Package
roots must be in-repository directories containing `package.json`; their
`node_modules` directories supplement consumer lookup. Aliases accept bare
package specifiers only. Conditions, package fields, and extensions are ordered,
deduplicated lists, while loader keys are extensions and values are supported
JavaScript-safe esbuild loader names. The `css` loader is rejected for every
extension because it would emit an undelivered sibling stylesheet. React and
React DOM still resolve through Mokly's
consumer-peer plugin so these options cannot introduce a second React runtime.

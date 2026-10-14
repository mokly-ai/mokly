# Configuration Discovery

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

Configuration uses [roots](./mokly-configuration.md#roots). Every matched file
has exactly one root. The [root discovery contract](./mokly-root-discovery.md)
defines traversal, physical confinement, filesystem races and source ownership.
The [folder contract](./mokly-folders.md)
defines collection exclusions; an excluded root match stays a protected source.

## Traversal And Ownership

Discovery walks each root without following symlinks and keeps every regular
file that matches a `files` glob. Below the root, walks skip directories named
`.git`, `node_modules`, `dist`, `coverage`, `target`, `test-results`,
`playwright-report`, or `.context`, and the output directory that `--out`
names; an explicit root inside such a directory is still scanned, because the
rule applies below the root only. Regular file basenames are not denied.
`_folder.json` files are read as [folder records](./mokly-folders.md) and
never as entries, and a folder record's `exclude` globs remove matched files
from that directory before derivation.

A matched file's suffix gives its kind. A file ending in `.md` is a
[document](./mokly-documents.md). A file ending in `.screen.html`,
`.component.html`, `.page.html`, or `.use-case.yaml` is an HTML or YAML entry
of the [HTML screens contract](./mokly-html-screens.md), parsed in Rust. A
file ending in `.stories.ts`, `.stories.tsx`, `.stories.js`, or `.stories.jsx`
is a Storybook stories file. Every other matched file is an entry module under
the [entry module contract](./mokly-entry-modules.md). The glob alone defines
the shape, so `files: ["**/*.ts"]` evaluates every matched TypeScript file as
a module. Entry modules and stories files are bundled and described by the
[sidecar](./mokly-sidecar.md); HTML, YAML, and Markdown files never are.

Every `_folder.json` inside a walked root is also owned by exactly one root,
independently of `files`. Overlapping roots that encounter that record fail with
`config-invalid`: `file <file> is matched by roots[<first>] and roots[<second>]`,
where `<file>` is repository-relative and the indices are in configured order.

Every root must keep at least one file; otherwise `root matches no file: <dir>`
lists denied and vanished paths, including dropped files, sorted under
`; not searched: <repository-relative paths>`. The union across roots is
sorted by repository-relative path. Discovery records that ownership, so a
file derives from the root that selected it rather than from the deepest
directory that happens to contain it. Discovery runs when the configuration
is resolved and again when watched Serve observes a created, renamed, or
deleted file, so the resolved file set follows the filesystem under the
[watch contract](./mokly-watch.md).

## Module Resolution

`moduleResolution` has no defaults beyond esbuild's platform behaviour in the
[sidecar](./mokly-sidecar.md#bundling). Package roots must be in-repository
directories containing `package.json`; their `node_modules` directories
supplement consumer lookup. Aliases accept bare package specifiers only.
Conditions, package fields, and extensions are ordered, deduplicated lists,
while loader keys are extensions and values are supported JavaScript-safe
esbuild loader names. The `css` loader is rejected for every extension because
it would emit an undelivered sibling stylesheet. React and React DOM resolve
from the consumer through the sidecar's bundle, so these options cannot
introduce a second React runtime. For the base side of a comparison the
settings name the `node_modules` directory that the
[dependency tiers](./mokly-comparison.md#sides) chose.

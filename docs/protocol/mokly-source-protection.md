# Catalogue Source Protection

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

## Protected Inputs

One source classifier serves Serve's resource reads, closure validation, the
static output, the base side's resource reads, and Changes resource
evidence. A file is protected when a root glob matches it, even when a folder
exclusion skips it; when it is a resolved entry source, that is an HTML
screen, component, or page, a use case, a Markdown document, an entry module,
or a stories file; when it appears in the
[source inventory](#complete-source-inventory); or when it has a reserved
basename. Every resolved entry source is also an inventoried source, so the
entry rule is a stable identity rather than a second inventory. Each rule
applies to the requested path and to its resolved repository-relative
target: a public-looking symlink cannot make a protected target public. A
new root match is protected at once, before any render completes.
Regular-file and root-confinement checks are mandatory. The same classifier
runs over every resolved file at discovery under the
[configuration contract](./mokly-configuration.md).

Public reads and the static output deny an entry source's lexical path and
its realpath aliases. An entry cannot sit inside a consumer package tree or
the static output directory. No command writes into the repository except
`build` into its output directory, which this policy excludes, so no other
file of the repository is Mokly-owned. The base-side extraction cache and the
dependency install cache live outside the repository and never enter the
inventory or the closure.

Browsers receive the catalogue index and the entry details of the
[shell delivery contract](./mokly-shell-delivery.md), never the inventory,
absolute paths, or private evidence. Authored display metadata and the
optional instance source locations of the
[instance contract](./mokly-instances.md) are repository-relative and confer
no permission to fetch a source.
[Markdown file links](./mokly-documents.md#links-and-resources) classify
their targets before inventory: a public-resource target renders as plain
text without joining the inventory, and a source target joins it without
being served. [Move evidence](./mokly-moves.md) uses confined Git reads and
never exposes source bytes.

Basenames ending in `.source.html`, `.source.htm`, `.source.ts`,
`.source.tsx`, `.source.js`, `.source.jsx`, `.source.mts`, `.source.cts`,
`.source.mjs`, or `.source.cjs`, and `_folder.json`, are reserved, matched
case-insensitively. Only the exact name `_folder.json` carries a folder
record. Their protection is independent of imports, inventory membership,
and whether an entry still uses them; this is a file-access rule in every
directory, not a discovery or navigation mechanism. For example, removing
the last import of `old-page.source.tsx` leaves the file inaccessible
through `/static` and absent from the static output. A helper that no entry
imports is protected only through a reserved basename or a root glob; a
glob-matched file is an entry source, and an entry module that exports no
definition fails under the [entry module contract](./mokly-entry-modules.md).
An ordinary public browser script is not private merely because it ends in
`.js`.

`build`, publish, and resource diagnostics report the denial cause: root
match, reserved basename, or listed input, in that lexical precedence. Alias
resolution also checks the realpath index of the inventory, including a
retargeted live alias. A stylesheet or component-resource failure keeps its
typed diagnostic and referring route even when an alias cannot be resolved.

## Referenced Public Assets

Only files reachable in the validated closure of the
[public file policy](./mokly-public-closure.md) are public. No file is
served or built because of its location;
hand-written HTML is not a route of its own, but referenced authored HTML is
a closure asset whose links are traversed. `README`, `tsconfig`, and other
unreferenced files stay private without name-based exclusions. A referenced
protected source, symlink, missing file, hidden path segment, or escape
fails the build with its referring route; a public reader returns not found
for an unlisted file. One closure governs Serve, `build`, publish, and
Changes.

Declaring a component stylesheet grants no exception: its links, transitive
imports, and assets pass the same closure. Declarations and owner claims
never decide CSS rule attribution.

## Complete Source Inventory

The inventory is the catalogue model's source set, held in memory and never
written. It is the sorted, unique union of repository-relative POSIX paths
of:

- the configuration file, and the PostCSS module with its local imports;
- every entry source and Markdown document, and for JavaScript the
  transitive module graph that the sidecar's `bundle` reports, including
  inputs that tree shaking removes;
- the renderer module and its transitive imports, including helpers that no
  root glob matches;
- repository-owned workspace package modules resolved through aliases or
  package imports; a bare package specifier alone does not make a file
  external;
- imported CSS, nested `@import`s, local `url()` assets, and the file and
  directory dependencies that PostCSS plugins report under the
  [PostCSS contract](./mokly-imported-styles-postcss.md).

Every bundler file input is a source regardless of its extension or loader,
including `file`, `dataurl`, `base64`, `binary`, `css`, and `empty`, because
an imported image or data file can change output and must be watched and
confined. Mokly's own package runtime and installed external dependencies
are excluded. Both the logical path and an in-repository realpath alias are
kept when they differ. A file that is both a source and a referenced public
file is protected; the consumer emits a separate public artifact. A runtime
read that the bundler cannot enumerate uses a protected location or a
reserved name; a dependency string alone is not a public-asset permission.
An absolute, escaping, or malformed input, a source that is not a regular
file inside the repository, and an authoring input outside the repository
fail the build, naming the input; nothing is silently omitted. A consumer
moves its authoring code inside the repository or configures a common root
that contains it.

## Watch And The Base Side

Watch consumes the same inventory. A configuration-graph change reloads the
configuration; a source change recomputes the render graph nodes whose keys
moved, and the inventory is recomputed and validated before the generation
is published to the browser. A failed candidate keeps the last good
generation. Read-time checks recheck realpath confinement and regular-file
identity; a retargeted symlink is not an accepted closure file.

The base side of a comparison classifies the base commit's sources by the
same rules over the base's own inventory, derived from the base's
configuration, roots, and bundle graph, with HTML and CSS read from Git
blobs and JavaScript from the sources extracted under the
[comparison contract](./mokly-comparison.md#sides). The base's closure is
the only public authored set of that side, and the Git reader rejects a
symbolic link rather than following it. Current-side reads always use the
current policy.

## Acceptance

Behaviour tests cover the boundary and lifecycle checks: entries beside referenced
assets, reserved basenames with and without imports, alias
and symlink denial on `GET` and `HEAD`, the inventory of each source kind,
an outside-repository input, and the base side's closure from Git.

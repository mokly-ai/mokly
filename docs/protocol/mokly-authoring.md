# Mokly Public Authoring Contract

This implemented contract expands the [package API](./mokly-package.md).
Configuration follows the [configuration contract](./mokly-configuration.md);
consumer rendering follows the [rendering contract](./mokly-rendering.md).

## Public Authoring API

The root package export supplies typed, documented authoring helpers:

- `defineConfig`;
- `defineScreen`, `definePage`, and `defineUseCase`;
- `defineRoot`, `folder`, `screen`, and `page` for nested trees;
- `defineComponent` and its schema-derived props, variants, and control types;
- `mockLink` and `MockLink` for id-addressed links;
- `ReviewIgnore`, `ReviewIgnoreScope`, and `reviewMaterialKey`.

The root also exports the authoring input/definition types, including
`PageInput`, `PageDefinition`, and `NestedPageInput`, plus configuration,
renderer, and compatibility-transformer interfaces. `ColorScheme` is exactly
`"dark" | "light"`; `Viewport` is `"desktop" | "mobile"`.

The [registered component contract](./mokly-components.md) owns the complete
`defineComponent` shape, slots, repeated-instance identity, dependencies, saved
variants, and runtime prop schema. It returns a renderable `Component` facade
and a registry `entry` with its own `navPath` like a screen.
Component pages and controls use the existing consumer renderer and providers.

A screen owns one mobile React node and one desktop React node. A use case
owns ordered references to existing screens and never defines a screen inline.
A page owns one
complete HTML document from a synchronous render callback, with no device or
color variants. The [page contract](./mokly-pages.md) defines both explicit
and nested authoring forms. Ids are explicit,
globally unique kebab-case values and remain stable across navigation changes.
A screen may also declare `variants`: each variant flattens into a complete
screen entry with its own global id, a route derived beneath the parent's,
and a `variantOf` relationship to the parent. The
[screen variants contract](./mokly-screen-variants.md) defines that implemented
field, validation, and public grouping. A variant inherits the parent's
address, color schemes, dependencies, related docs, and tags when it omits
them. Its use-case membership never inherits: `useCaseIds` defaults to an empty
list because a variant must reciprocate only the flows whose steps name that
variant. Its `navPath` is always copied from its parent, never authored on
the variant. `defineScreen` returns one `ScreenDefinition` when `variants` is absent
and a readonly parent-first array of screen definitions when it is present.
Entry-module loading flattens that array one level.

Each entry provides a title, description, related docs, and dependency paths.
A dependency may identify an existing repository file or directory; Review
matches the path itself and every descendant and reports the concrete changed
path as impact evidence. Dependency declarations and source paths alone do not
add entries to Browse Changes: that filter compares output, rendered resources,
reviewable metadata, and `navPath`, then propagates affected screens
to their flows. See [the Changes contract](./mokly-changes.md).
Screens, pages, and use cases provide a stable relative `.html` route; use cases live
under `user-flows/`. Screens may
provide an address-bar label and use-case membership. Nested definitions
inherit declared metadata, but ids never derive from tree position.

Every routed screen, page, use case, and component has `navPath: readonly
string[]`: the ordered folder labels from its section root to its parent.
Flat inputs may omit it or pass `undefined` (default `[]`, a top-level leaf); nested leaves derive
it and must not author it. The Pages section holds screens, pages, and use
cases; Components holds components. Each section builds its own folder tree
from shared path prefixes. Identical labels under one parent merge across
modules; the same path in different sections makes independent folders.
The rendered navigation omits a section with no matching current or retained
removed entries; the public tree retains both section arrays as `[]` when
they have no current entries. No empty folder is emitted. Breadcrumbs
are the `navPath` labels, followed by the parent screen title for a variant.

The common and nested-root input boundary is:

```ts
interface EntryInput {
  dependencies: readonly string[];
  description: string;
  id: string;
  navPath?: readonly string[];
  rationale?: string;
  relatedDocs: readonly string[];
  title: string;
}

interface NestedFolderInput {
  address?: string;
  children: readonly NestedChild[];
  dependencies?: readonly string[];
  relatedDocs?: readonly string[];
  segment: string;
  title: string;
}

interface RootInput {
  address?: string;
  children: readonly NestedChild[];
  dependencies?: readonly string[];
  path: string;
  relatedDocs?: readonly string[];
  title?: string;
}
```

`defineRoot({ path, title?, children, address?, dependencies?, relatedDocs? })`
flattens nested `screen()` and `page()` leaves into ordinary definitions;
`folder({ title, segment, children, address?, dependencies?, relatedDocs? })`
groups children without creating an entry or route. A leaf's `navPath` is
`[root.title?, ...ancestor folder titles]`, excluding its own title. An
omitted root title leaves direct children top-level. Root `path`, folder
`segment`s, and leaf `slug` compose routes; changing titles only moves
navigation, not routes. Ancestor dependencies and related docs inherit with
existing override behavior; address inheritance applies to screens only.
Folders have no id, description, rationale, or entry status. An authored
`navPath` key on a nested `screen()` or `page()` is an `invalid-nested-nav-path`
registry violation naming the leaf id, even when its value is `undefined`:
flattening retains the fact that it was authored rather than overwriting it.
An empty `folder().children` fails at `defineRoot` flattening with
`MoklyError("build-invalid", "folder <route directory> has no children")`,
where `<route directory>` is root `path` followed by ancestor and current
`segment`s joined by `/`. An empty titled root has no leaf to report a
per-entry issue and would silently discard a folder: `defineRoot` rejects it
with `MoklyError("build-invalid", "root <path> has no children")`. An untitled
empty root returns no definitions.

Each folder label (every path segment, root title if supplied, and folder
title) must be a string, nonempty, have no leading or trailing ECMAScript
whitespace (`/^\s|\s$/u`), and contain no `/`. Invalid segments yield a
per-entry `invalid-nav-path` registry issue naming the entry id, zero-based
offending index, and offending label (including its value for non-strings).
An explicit non-array path is `invalid-nav-path` with index `-1` and the raw
path as its offending value; `undefined` is the omitted default.
For an empty folder, the authoring error above takes precedence. Conflict
matching uses exactly
`label.normalize("NFKC").replace(/\s/gu, "").toUpperCase().toLowerCase()`.
Within the same section and parent, two folder labels with that key but
different bytes yield `nav-path-conflict`, naming both labels and their parent
path; byte-identical labels merge. A
leaf's title is its display label: a leaf sharing a conflict key with a
sibling folder is also `nav-path-conflict`, naming both labels and suggesting
appending that folder label to the leaf's `navPath`. Leaf titles are otherwise
free text; two leaves with identical titles in one folder are allowed. Order
every sibling list by folders before leaves, then
`left.label.localeCompare(right.label, "en")`, then UTF-16 code-unit comparison
of the folder path key or leaf id. Variants stay under their parent in authored
order and never join a folder as separate members. See the
[read model](./mokly-catalogue.md) for tree validation and key construction.

`defineScreen` and nested `screen` inputs may declare `colorSchemes`. When
omitted, a screen inherits the catalogue set; `colorSchemes: ["light"]` is the
supported opt-out from a dark-enabled catalogue. A declaration must be
non-empty, duplicate-free, include `"light"`, and be a subset of the config.
Nested trees do not inherit this field from their folders or root.

`defineScreen`, `definePage`, `defineUseCase`, and nested `screen` and `page`
inputs may also declare
`tags`, a classification list whose values use the same lowercase kebab-case
grammar as ids. A list must not repeat a tag, and authored order is preserved
rather than sorted. Nested trees never inherit tags from folders or roots.
Tags are optional catalogue vocabulary, not a second hierarchy: an untagged
catalogue stays valid.

Imports of `@mokly/mokly` from any repository-owned module bind the authoring
helpers to that importing module. A module is repository-owned when its real
path lies inside `repoRoot` and outside `node_modules`, `.mokly-cache/`, and
Mokly's own package runtime; installed packages receive the plain, unattributed
API and cannot self-attribute. Definitions created at module evaluation or
later through a shared helper factory therefore retain the defining module's
repo-relative source path without process-global attribution state. A
definition created in a helper beside a product component is attributed to
that helper, not to the entry module that imports it, and the helper need not
match an `entries` glob.

The configured `entries` glob itself defines which regular files Mokly
evaluates as registry modules; there is no additional filename suffix rule.
`.mockup.ts` and `.mockup.tsx` are the recommended convention because the
`entriesDir` shorthand expands to `<dir>/**/*.mockup.{ts,tsx}`, while an
explicit glob may deliberately select another shape.

Every catalogue-route segment starts with an ASCII letter or digit and then
uses only URL-unreserved ASCII letters, digits, `.`, `_`, `~`, or `-`. A
segment's filename stem must not be a Windows device name, and the complete
route must end in `.html`. Mokly percent-encodes each path segment whenever
it emits a URL in HTML or an HTTP redirect, including configured static asset
paths whose filenames contain other characters.

Logical screen and use-case routes are catalogue identifiers, not generated
documents. Fragment links must target a generated fragment or public static
asset with a relative URL; root-absolute links are rejected as non-portable.
Authors use `mockLink(id, fragment?)` or
`<MockLink to={id} fragment={fragment}>` for id-addressed catalogue navigation.
Complete raw `mock:<id>[#fragment]` values may also appear in `href` or
`data-nav-href`. The fragment is a bare HTML id without `#` or percent-encoding.
Both helpers immediately apply the registry's lowercase kebab-case id grammar
and reject fragment, percent-encoded, or `mock:` syntax in the id/`to` value;
only the separate fragment input or complete raw logical attribute form may
carry a fragment. The shared runtime predicates reject non-string values before
regular-expression evaluation, so untyped JavaScript callers cannot rely on
implicit coercion for either field. Generated documents retain a portable
relative target plus stable marker metadata on native HTML/SVG links so Browse
can open the canonical catalogue page without changing standalone or Review
behavior.
Metadata-only references use `data-nav-href`, and resource elements must keep
real resource URLs. A document with an activatable logical `href` must not
contain `<base href>`; the builder rejects that combination before and after
compatibility transformation while continuing to support `<base target>`. The
complete behavior is defined by the
[catalogue navigation contract](./mokly-navigation.md).
`MockLink asChild` explicitly adapts one consumer-styled control into that
native-link contract during static generation. Child attributes stay on the
child, inactive controls remain metadata-only, and ambiguous markup fails the
build. The complete API and rendering rules are in
[Styled catalogue link controls](./mokly-link-controls.md).
Local resource URLs in HTML source attributes, `srcset`, inline/style-block
CSS, and transitively referenced HTML/CSS must likewise resolve to public
static files beneath `mockupsDir` that remain after the pending build. An owned
generated file absent from the next output set is a pending orphan, never a
valid link or resource target merely because it still exists before commit.

All public exports ship ESM JavaScript and declarations usable by NodeNext and
bundler TypeScript resolution. The package export map and packed-tarball tests
define the public boundary; consumers must not import `dist` internals.

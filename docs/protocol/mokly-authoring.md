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
and registry entries with their own `navPath` like a screen.
Component pages and controls use the existing consumer renderer and providers.

A screen owns one mobile React node and one desktop React node. A use case
owns ordered references to existing screens and never defines a screen inline.
A page owns one
complete HTML document from a synchronous render callback, with no device or
color variants. The [page contract](./mokly-pages.md) defines both explicit
and nested authoring forms. Ids are explicit,
globally unique kebab-case values and remain stable across navigation changes.
An id whose value is a Windows device name (`aux`, `con`, `nul`, `prn`,
`com1`–`com9`, or `lpt1`–`lpt9`) is rejected with the `invalid-id` registry
violation because it would name an unwritable file; the tag and link grammar
is unchanged.
A screen or component may also declare `variants`: each variant flattens into
a complete entry of the parent's kind with its own global id, its own derived
route, and a `variantOf` relationship to the parent. The
[variant contract](./mokly-variants.md) defines that implemented
field, validation, inheritance, and public grouping. A screen variant inherits
the parent's address, color schemes, dependencies, related docs, and tags when
it omits them. Its use-case membership never inherits: `useCaseIds` defaults
to an empty list because a variant must reciprocate only the flows whose steps
name that variant. Its path follows the
[navigation path contract](./mokly-nav-paths.md).
`defineScreen` returns one `ScreenDefinition` when `variants` is
absent or definitely `undefined`, and a readonly parent-first array of screen
definitions when it is definitely an array, including an empty array. An input
whose type allows either form, such as an annotated `ScreenInput`, returns their
union. The conditional result distributes across union inputs and preserves
literal results through generic wrappers; code must narrow a broad result before
using it as one definition. Entry-module loading flattens an array result one
level.

Each entry provides a title, description, related docs, and dependency paths.
A dependency may identify an existing repository file or directory; Review
matches the path itself and every descendant and reports the concrete changed
path as impact evidence. A source path or a changed descendant matched only by
a declared directory does not list an otherwise unchanged entry in Browse
Changes. Exact declarations and component-owned paths follow the
[component path rule](./mokly-component-changes.md#dependencies-and-styles).
Changes also compares output, rendered resources, reviewable metadata, and
`navPath`, then propagates directly changed screens to their flows. See
[the Changes contract](./mokly-changes.md).
Screens may provide an address-bar label and use-case membership. Nested
definitions inherit declared metadata, but ids never derive from tree position.

The [navigation path contract](./mokly-nav-paths.md) defines section trees,
path derivation, label diagnostics, ordering, and folder keys.

## Derived Routes

Authors never write a route. Every entry's route is a pure function of its
kind and id, so nothing but the id moves it:

| Kind      | Route                  | Generated views                          |
| --------- | ---------------------- | ---------------------------------------- |
| Screen    | `screens/<id>.html`    | `screens/<id>.<viewport>[.dark].html`    |
| Page      | `pages/<id>.html`      | The route is the rendered document       |
| Use case  | `user-flows/<id>.html` | None; the route is a logical identifier  |
| Component | `components/<id>.html` | `components/<id>.<viewport>[.dark].html` |

A variant is an entry of its parent's kind and derives its own route from its
own id. `<viewport>` is `mobile` or `desktop`; the `.dark` infix is present
exactly for an effective dark color scheme. A component parent has no views of
its own: its page shows its first variant entry in authored order, and every
component view belongs to a variant entry. Screen and use-case routes are
catalogue identifiers, not generated files; a page's route is its one
generated document. Ids contain no `.`, so a view name never collides with
another entry's route. The four prefixes are reserved output directories under
`mockupsDir`, enter the build's collision inventory with every other generated
and public file, and are not folders in navigation.

One shared path module exported from `@mokly/viewer/data` owns the derivation:
`entryRoute(kind, id)`, `viewRoute(kind, id, viewport, colorScheme)`,
`viewHref(kind, id)` for the shell URL `/view/<route>`, and the parser that
turns `/view/<route>` back into kind and id. The builder, server, export,
review, and shell all use it; no other code composes route strings. Wire
formats never carry a route because every reader can derive it; see the
[manifest](./mokly-component-manifest.md) and
[public catalogue](./mokly-catalogue.md) contracts.

Every derived route segment already satisfies the portable grammar (ASCII
letters, digits, and `-`, ending in `.html`). Mokly percent-encodes each path
segment whenever it emits a URL in HTML or an HTTP redirect, including
configured static asset paths whose filenames contain other characters. A
configured static asset segment must start with an ASCII letter or digit and
then use only URL-unreserved ASCII letters, digits, `.`, `_`, `~`, or `-`, and
its filename stem must not be a Windows device name.

## Input Types And Nested Trees

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
  title: string;
}

interface RootInput {
  address?: string;
  children: readonly NestedChild[];
  dependencies?: readonly string[];
  navPath?: readonly string[];
  relatedDocs?: readonly string[];
}
```

`defineRoot({ navPath?, children, address?, dependencies?, relatedDocs? })`
flattens nested `screen()` and `page()` leaves into ordinary definitions;
`folder({ title, children, address?, dependencies?, relatedDocs? })`
groups children without creating an entry. Nested leaves carry the same fields
as their flat forms minus `navPath`, which derives from the tree; their routes
derive from their ids like every other entry. Path derivation follows the
[navigation path contract](./mokly-nav-paths.md).
An explicit non-array root `navPath` fails at `defineRoot` with
`MoklyError("build-invalid", "root navPath must be an array")`.
Ancestor dependencies and related docs inherit with
existing override behavior; address inheritance applies to screens only.
Folders have no id, description, rationale, or entry status. An authored
`navPath` key on a nested `screen()` or `page()` is an `invalid-nested-nav-path`
registry violation naming the leaf id, even when its value is `undefined`:
flattening retains the fact that it was authored rather than overwriting it.
An empty `folder().children` fails at `defineRoot` flattening with
`MoklyError("build-invalid", "folder <labels> has no children")`,
where `<labels>` joins the root `navPath`, the ancestor folder titles, and the
folder's own title with `›`, using `String(title)` for each label. A root
with non-empty `navPath` and no children has no leaf to report a per-entry
issue and would silently discard a folder: `defineRoot` rejects it with
`MoklyError("build-invalid", "root <labels> has no children")`, where
`<labels>` joins the root `navPath` with `›`. A root with omitted or empty
`navPath` and no children returns no definitions. Folder titles are validated
as navigation labels on every descendant entry under the
[label rules](./mokly-nav-paths.md#labels-and-diagnostics).
When these errors occur in an entry module, the module-bound facade prefixes
their detail with `<source module>: `; the user sees exactly one
`[mokly/build-invalid]` prefix, for example
`[mokly/build-invalid] entries/example.mockup.tsx: folder Design › Empty has no children`.
The nested authored-path violation is
`nested entry <id> cannot author navPath` under the `invalid-nested-nav-path`
code, attributed to the source module.

The [navigation path contract](./mokly-nav-paths.md#labels-and-diagnostics)
owns the exact `invalid-nav-path` and `nav-path-conflict` texts and
attribution; [ordering and keys](./mokly-nav-paths.md#order-and-keys)
are shared by authoring validation, the shell, and the public tree. See the
[read model](./mokly-catalogue.md) for tree validation; key construction is
defined by [ordering and keys](./mokly-nav-paths.md#order-and-keys).

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

The TypeScript input types are the authoring contract. A key they do not
declare, such as a former `route`, `slug`, `segment`, or root `path`, is a
type error in TypeScript and is ignored at runtime like any other unknown key;
there is no runtime migration guard. `defineComponent` keeps rejecting unknown
variant fields under the [component contract](./mokly-components.md).

## Module Attribution And Entry Discovery

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

## Links

Fragment links must target a generated fragment or public static
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
implicit coercion for either field. A link may name any entry, including a
screen or component variant. Generated documents retain a portable relative
target plus stable marker metadata on native HTML/SVG links so Browse can open
the canonical catalogue page without changing standalone or Review behavior.
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

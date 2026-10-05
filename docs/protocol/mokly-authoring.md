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
`PageInput`, `PageDefinition`, and `NestedPageInput`, plus configuration
and renderer interfaces. `ColorScheme` is exactly
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
violation because it would name an unwritable file. This restriction applies
only to entry ids; tags, logical-link ids, and `ReviewIgnore` ids use the plain
kebab-case grammar defined by their owning contracts.
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

Authors never write a route. Kind plus id determines every entry, view,
comparison, and preview path, so folder and title changes cannot move a URL.
The [identity-derived artifact path contract](./mokly-artifact-paths.md) owns
the exact tables, shared functions, URL parser, and reserved prefixes. Wire
formats carry identity and axes rather than those derivable paths.

Mokly percent-encodes every path segment it writes into a URL. A configured
static-asset segment starts with an ASCII letter or digit, then uses only
URL-unreserved ASCII letters, digits, `.`, `_`, `~`, or `-`; its filename stem
must not be a Windows device name.

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
```

The [nested authoring contract](./mokly-nested-authoring.md) owns root/folder
inputs, inheritance, flattening, and exact empty-tree and authored-`navPath`
errors. The [navigation path contract](./mokly-nav-paths.md) owns label
diagnostics, ordering, keys, and public-tree validation.

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
declare, such as `route`, `slug`, `segment`, or root `path`, is a
type error in TypeScript and is ignored at runtime like any other unknown key;
there is no runtime migration guard. `defineComponent` keeps rejecting unknown
variant fields under the [component contract](./mokly-components.md).

## Module Attribution And Entry Discovery

## Comparison Scroll Hints

A rendered inner scroll region may carry `data-mokly-scroll` to keep its
identity when a comparison edit moves the panel or rewrites its content. A
normal value uses the same id grammar, `^[a-z0-9]+(?:-[a-z0-9]+)*$`, and the
same exact value belongs on that region in both versions. The value `off` is
reserved to keep that region independent. Duplicate names in one generated
document are ambiguous; a name on a non-scrollable element is ignored. The
[comparison region pairing contract](./mokly-comparison-region-pairing.md#counterpart-algorithm)
defines fallback matching when a valid name is absent on either side.

This is consumer metadata in the rendered document, not a TypeScript authoring
field or Mokly-owned build marker. Mokly does not validate, rewrite, or remove
it; the consumer renderer owns that metadata. Viewer-owned shell elements also use the name
outside pane documents for history restoration; the separate DOM scopes keep
those meanings independent.

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
contain `<base href>`; the builder rejects that combination while continuing to support `<base target>`. The
complete behavior is defined by the
[catalogue navigation contract](./mokly-navigation.md).
`MockLink asChild` explicitly adapts one consumer-styled control into that
native-link contract during static generation. Child attributes stay on the
child, inactive controls remain metadata-only, and ambiguous markup fails the
build. The complete API and rendering rules are in
[Styled catalogue link controls](./mokly-link-controls.md).
Local resource URLs in HTML source attributes, `srcset`, inline/style-block
CSS, and transitively referenced HTML/CSS must likewise resolve to public
regular, unprotected files in the referenced closure beneath `mockupsDir`.
Generated links must target the new in-memory `mokly-generated/` tree, not a
previous build's on-disk files. Closure collection and href computation are
specified in [generated output](./mokly-generated-output.md).

All public exports ship ESM JavaScript and declarations usable by NodeNext and
bundler TypeScript resolution. The package export map and packed-tarball tests
define the public boundary; consumers must not import `dist` internals.

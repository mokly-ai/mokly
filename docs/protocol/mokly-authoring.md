# Mokly Public Authoring Contract

## Delivery Status

The path-based TypeScript API, Markdown authoring, move pairing, and their
viewer presentation are implemented.

This contract expands the [package API](./mokly-package.md). Configuration
follows the [configuration contract](./mokly-configuration.md); consumer
rendering follows the [rendering contract](./mokly-rendering.md).

## Delivery Status

CSS rule attribution and ignored stylesheet owner records are implemented in [M19](../../plans/remove-source-path-evidence.md#milestone-19-classify-css-by-where-its-rules-match).
Other behavior below remains implemented.

This contract is implemented. The [source-path removal plan](../../plans/remove-source-path-evidence.md) records its delivery history.

The configuration guard is implemented in
[M28A](../../plans/remove-source-path-evidence.md#milestone-28a-integrate-main-131-and-133).
Stronger removed-field type tests are implemented in [M30](../../plans/remove-source-path-evidence.md#milestone-30-strengthen-tests-the-docs-guard-and-removed-field-types).

## Public Authoring API

The root package export supplies typed, documented authoring helpers:

- `defineConfig`;
- `defineScreen`, `definePage`, `defineUseCase`, and `defineFolder`;
- `defineComponent` and its schema-derived props, variants, and control types;
- `componentStylesheets`, the shared configured-stylesheet position marker;
- `mockLink` and `MockLink` for path-addressed links;
- `ReviewIgnore`, `ReviewIgnoreScope`, and `reviewMaterialKey`.

The root also exports the input and definition types `EntryInput`,
`ScreenInput`, `ScreenVariantInput`, `ScreenDefinition`, `PageInput`,
`PageDefinition`, `UseCaseInput`, `UseCaseStep`, `UseCaseDefinition`,
`FolderInput`, `FolderDefinition`, and `RegistryDefinition`, plus the
configuration, renderer, and compatibility-transformer interfaces.
`ColorScheme` is exactly `"dark" | "light"`; `Viewport` is
`"desktop" | "mobile"`. There is no nested tree API: `defineRoot`, `folder`,
nested `screen`, nested `page`, and their input types do not exist. Folders
come from paths, and Markdown documents come from files under the
[document contract](./mokly-documents.md) with no helper at all.

## Identity

Every entry is identified by its path under the
[path contract](./mokly-paths.md). An entry module declares an optional
`slug`, which defaults to the module's file name; the path derives from the
root, the directories, and that slug under the
[entry module contract](./mokly-entry-modules.md). An optional complete `path`
replaces the derived path, and an optional `movedFrom` names the entry's
previous path for the [move contract](./mokly-moves.md). There is no `id` and
no `navPath`. The common input boundary is:

```ts
interface EntryInput {
  dependencies?: never;
  description: string;
  movedFrom?: string;
  path?: string;
  rationale?: string;
  relatedDocs: readonly string[];
  slug?: string;
  title: string;
}
```

Each entry provides a title, description and related docs. Changes compares
output, rendered resources and reviewable metadata, pairs moved entries, and
propagates directly changed screens to their flows under the
[Changes contract](./mokly-changes.md). Source paths supply attribution and
protection only. Components declare public CSS through
[component stylesheets](./mokly-component-stylesheets.md).

## Entry Kinds

A screen owns one mobile React node and one desktop React node and may
provide an address-bar label and flow membership. A use case owns ordered
references to existing screens and never defines a screen inline. A page owns
one complete HTML document from a synchronous render callback, with no device
or colour variants, under the [page contract](./mokly-pages.md). A document is
a Markdown file. A component registers a reusable adapter with typed props
under the [component contract](./mokly-components.md); it returns a renderable
`Component` facade beside its entries.

A screen or component may declare `variants`. Each variant declares a `slug`
and flattens into a complete entry of the parent's kind whose path is the
parent's final path plus that slug. A variant has no `path` input; the relationship is derived from the declaration
and recorded as `variantOf`, never authored. The
[variant contract](./mokly-variants.md) owns inheritance, validation, and the
return shape of `defineScreen`, which is one definition without `variants`
and a parent-first array with them. A screen variant inherits the parent's
address, colour schemes, related docs, and tags when it omits
them; its flow membership never inherits.

`defineScreen` inputs may declare `colorSchemes`. When omitted, a screen
inherits the catalogue set; `colorSchemes: ["light"]` is the supported opt-out
from a dark-enabled catalogue. A declaration must be non-empty, duplicate-free,
include `"light"`, and be a subset of the config.

`defineScreen`, `definePage`, `defineUseCase`, and `defineComponent` inputs,
and document front matter, may declare `tags`, a classification list whose
values use the lowercase kebab-case grammar `^[a-z0-9]+(?:-[a-z0-9]+)*$`. A
list must not repeat a tag, and authored order is preserved rather than
sorted. Tags are optional catalogue vocabulary, not a second hierarchy.

The TypeScript input types define the allowed fields. Unknown keys always
produce a registry `invalid-field` violation with the exact text
`unknown field <field>`, attributed to the entry's source. Generic
`defineScreen` inference can accept extra top-level keys so wrappers retain
precise return types; use an explicit `ScreenInput` annotation or
`satisfies ScreenInput` to check those keys statically. Fresh variant literals in direct calls
retain excess-key checks. Runtime validation applies to every input, including
structurally typed variables and untyped callers.
Unknown flow-step fields use the same code and the text
`step #<n>: unknown field <field>`, with one-based step numbers.
Folder inputs use `invalid-folder` with the same `unknown field <field>` reason
under the folder-record schema. Component variants use the same general
`invalid-field` rule after their parent's final path is resolved.

## Paths And URLs

Authors never write a route. The path determines every entry, view,
comparison, and preview file under the
[artifact path contract](./mokly-artifact-paths.md), and the catalogue URL is
`/view/<path>/`. Wire formats carry paths and view axes rather than file
names. Path segments satisfy the
[segment grammar](./mokly-paths.md#segment-grammar), so Mokly writes them into
URLs verbatim. A configured static-asset segment starts with an ASCII letter,
digit, underscore, or hyphen, then uses only URL-unreserved ASCII letters, digits, `.`, `_`, `~`,
or `-`; its filename stem must not be a Windows device name.

All entry, folder and variant inputs reject removed `dependencies`
values through `dependencies?: never`; component inputs also reject removed
`ownedDependencies` values through `ownedDependencies?: never`. This includes
spread objects. An explicit `undefined` is rejected only when the consumer
enables `exactOptionalPropertyTypes`. Without it, runtime collection still
warns on the present key and ignores it. No removed field inherits or supplies
evidence. See [build warnings](./mokly-build-warnings.md).

`defineScreen` inputs may declare `colorSchemes`. When
omitted, a screen inherits the catalogue set; `colorSchemes: ["light"]` is the
supported opt-out from a dark-enabled catalogue. A declaration must be
non-empty, duplicate-free, include `"light"`, and be a subset of the config.

## Module Attribution And Discovery

Imports of `@mokly/mokly` from any repository-owned module bind the authoring
helpers to that importing module. A module is repository-owned when its real
path lies inside `repoRoot` and outside `node_modules`, `.mokly-cache/`, and
Mokly's own package runtime; installed packages receive the plain, unattributed
API and cannot self-attribute. Definitions created at module evaluation or
later through a shared helper factory therefore retain the defining module's
repo-relative source path without process-global attribution state. A
definition created in a helper beside a product component is attributed to
that helper, not to the entry module that exports it, and the helper need not
match a root.

The configured [roots](./mokly-paths.md#roots) define which files Mokly
reads. A matched `.md` file is a document; every other matched file is an
entry module whose exports are collected under the
[entry module contract](./mokly-entry-modules.md). `.mockup.ts` and
`.mockup.tsx` are the recommended module names because the default root
pattern selects them; a root may select another shape.

## Comparison Scroll Hints

A rendered inner scroll region may carry `data-mokly-scroll` to keep its
identity when a comparison edit moves the panel or rewrites its content. A
normal value uses the kebab-case grammar `^[a-z0-9]+(?:-[a-z0-9]+)*$`, and the
same exact value belongs on that region in both versions. The value `off` is
reserved to keep that region independent. Duplicate names in one generated
document are ambiguous; a name on a non-scrollable element is ignored. The
[comparison region pairing contract](./mokly-comparison-region-pairing.md#counterpart-algorithm)
defines fallback matching when a valid name is absent on either side.

This is consumer metadata in the rendered document, not a TypeScript authoring
field or Mokly-owned build marker. Mokly does not validate, rewrite, or remove
it and imposes no special preservation rule on a consumer-supplied
compatibility transformer. Viewer-owned shell elements also use the name
outside pane documents for history restoration; the separate DOM scopes keep
those meanings independent.

## Links

Authors address another entry with `mockLink(to, fragment?)` or
`<MockLink to={to} fragment={fragment}>`. `to` is one of:

- a complete path such as `account/billing/invoice`;
- a path relative to the linking entry's folder, starting with `./` or
  `../`, such as `./invoice`;
- a definition reference: the imported export of another entry module, which
  Mokly resolves to that entry's path at build time. A parent-first definition
  array or a component registration refers to its parent entry.

Relative paths use one shared base rule for links and flow references. An
ordinary entry uses the parent of its path; an index entry uses its own path;
a variant uses its parent entry's base. A declared path changes the path used
by these same rules. For example, an invoice and its variants link from the
same billing folder, while a folder index links from the folder it describes.

Complete raw `mock:<path>[#fragment]` values, with the same two string forms
of `<path>`, may also appear in `href` or `data-nav-href`. The fragment is a
bare HTML id without `#` or percent-encoding. Both helpers immediately apply
the path grammar and reject fragment, percent-encoded, or `mock:` syntax in
the `to` value; only the separate fragment input or the complete raw logical
attribute form may carry a fragment. The shared runtime predicates reject
non-string, non-definition values before regular-expression evaluation, so
untyped JavaScript callers cannot rely on implicit coercion. A link may name
any entry, including a variant or a document. A link to a path that names no
entry fails the build under the
[path diagnostics](./mokly-paths.md#diagnostics), naming the new path when
the target moved.

Fragment links must target a generated fragment or public static asset with a
relative URL; root-absolute links are rejected as non-portable. Generated
documents retain a portable relative target plus stable marker metadata on
native HTML/SVG links so Browse can open the canonical catalogue page without
changing standalone or Review behavior. Metadata-only references use
`data-nav-href`, and resource elements must keep real resource URLs. A
document with an activatable logical `href` must not contain `<base href>`;
the builder rejects that combination before and after compatibility
transformation while continuing to support `<base target>`. The complete
behavior is defined by the [catalogue navigation contract](./mokly-navigation.md).
`MockLink asChild` explicitly adapts one consumer-styled control into that
native-link contract during static generation under
[Styled catalogue link controls](./mokly-link-controls.md). Local resource
URLs in HTML source attributes, `srcset`, inline/style-block CSS, and
transitively referenced HTML/CSS must likewise resolve to public static files
beneath `mockupsDir` that remain after the pending build. An owned generated
file absent from the next output set is a pending orphan, never a valid link
or resource target merely because it still exists before commit.

All public exports ship ESM JavaScript and declarations usable by NodeNext and
bundler TypeScript resolution. The package export map and packed-tarball tests
define the public boundary; consumers must not import `dist` internals.

## Removed Input Warnings

A present removed `dependencies` key emits `removed-dependencies` with an entry
subject. A present removed `ownedDependencies` key emits
`removed-owned-dependencies` with a component subject. Variants name their own
complete path. Their messages are exactly:

```text
dependencies has been removed; ignoring it. Delete the field.
ownedDependencies has been removed; ignoring it. Delete the field.
```

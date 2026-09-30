# Nested Authoring Trees

## Delivery Status

Tree authoring and root-cause diagnostic precedence are implemented.

This contract owns `defineRoot`, folder inputs, nested screen/page inputs, and
their authoring-time diagnostics. Shared entry inputs and generated paths remain
in the [public authoring contract](./mokly-authoring.md); folder labels and
ordering remain in [Navigation Paths](./mokly-nav-paths.md).

## Inputs And Flattening

```ts
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
flattens nested `screen()` and `page()` leaves into ordinary definitions.
`folder({ title, children, address?, dependencies?, relatedDocs? })` groups
children without creating an entry. A nested leaf has the same fields as its
flat form except `navPath`, which derives as
`[...(root.navPath ?? []), ...ancestor folder titles]`. Its id still determines
its generated path.

Ancestor dependencies and related docs retain their existing override
behavior. Address inheritance applies only to screens. Folders have no id,
description, rationale, status, route, or generated document. Screen color
schemes and entry tags never inherit from a root or folder.

## Authored Path And Empty-Tree Errors

An explicit non-array root `navPath` throws
`MoklyError("build-invalid", "root navPath must be an array")`.

An authored `navPath` key on a nested `screen()` or `page()` is an
`invalid-nested-nav-path` registry violation, including when its value is
`undefined`. Its exact text is `nested entry <id> cannot author navPath`,
attributed to the defining module. Flattening retains the presence of the key
instead of overwriting that evidence.

An empty folder throws
`MoklyError("build-invalid", "folder <labels> has no children")`, where
`<labels>` joins root labels, ancestor folder titles, and the current folder
title with `›`, using `String(title)` for every value. A root with a nonempty
`navPath` and no children throws
`MoklyError("build-invalid", "root <labels> has no children")`, with the same
join rule. A root with omitted or empty `navPath` and no children returns no
definitions.

When one of these errors originates while loading an entry module, the
module-bound facade prefixes the detail with `<source module>: ` and the user
sees one `[mokly/build-invalid]` prefix. For example:

```text
[mokly/build-invalid] entries/example.mockup.tsx: folder Design › Empty has no children
```

Folder titles are subsequently validated as navigation labels on every
descendant entry. Those exact label/conflict messages and source attribution
belong to the [path contract](./mokly-nav-paths.md#labels-and-diagnostics).

## Validation Boundary

The helpers validate empty structures before registry preparation, which then
validates every flattened leaf even when a consumer forges or mutates it.
Parent/variant diagnostic precedence follows the
[variant contract](./mokly-variants.md#authoring).

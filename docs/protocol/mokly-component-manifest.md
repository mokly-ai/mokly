# Catalogue Entry Records

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

## Entries, Folders, And Variants

The catalogue model lives in process memory; no manifest is written. Its
entry records are the private form of the
[catalogue read model](./mokly-catalogue.md), which is their public form. The
generated TypeScript types of the model crate are the normative shapes.

```ts
interface EntryRecordBase {
  path: string;
  kind: "screen" | "page" | "document" | "use-case" | "component";
  title: string;
  description: string;
  rationale?: string;
  movedFrom?: string;
  relatedDocs: readonly string[];
  sourcePath: string;
  tags?: readonly string[];
}

interface ScreenRecord extends EntryRecordBase {
  kind: "screen";
  address?: string;
  variantOf?: string;
  colorSchemes: readonly ColorScheme[];
  useCasePaths: readonly string[];
  propSchema: PropSchema;
  props: ComponentWireProps;
  controls: Readonly<Record<string, ComponentControl>>;
}

interface UseCaseRecord extends EntryRecordBase {
  kind: "use-case";
  steps: readonly {
    screenPath: string;
    title?: string;
    description?: string;
  }[];
}

interface PageRecord extends EntryRecordBase {
  kind: "page";
}

interface DocumentRecord extends EntryRecordBase {
  kind: "document";
  colorSchemes: readonly ColorScheme[];
  resources: readonly string[];
}

interface ComponentRecord extends EntryRecordBase {
  kind: "component";
  variantOf?: string;
  element?: string;
  colorSchemes: readonly ColorScheme[];
  propSchema: PropSchema;
  props: ComponentWireProps;
  slots: readonly string[];
  suppliedSlots: readonly string[];
  controls: Readonly<Record<string, ComponentControl>>;
}

interface FolderRecord {
  path: string;
  title?: string;
  order?: readonly string[];
  hidden?: boolean;
  exclude?: readonly string[];
  sourcePath: string;
}
```

`path` is the entry's identity under the [path contract](./mokly-paths.md).
`variantOf` is present exactly on variant entries of either kind and holds
the parent's path; a variant's path is its parent's path plus its slug, under
the [variant contract](./mokly-variants.md). A component parent and a
component variant share `kind: "component"` and are distinguished by that
field. `movedFrom` is the authored earlier path under the
[move contract](./mokly-moves.md). `sourcePath` is the repository-relative
authored file: an HTML or YAML file, a Markdown file, an entry module, or a
stories file. `propSchema`, `props`, and `controls` follow the
[entry props contract](./mokly-entry-props.md): `props` holds the entry's own
props or a variant's merged props, and `propSchema` is the declared or
inferred schema. `element` is the registry name of an HTML component or of a
JavaScript component registered with one. No record carries a route, a file
name, a rendered document, or usage: the
[render graph](../architecture/rust-core.md#render-graph) derives documents
and usage from the records.

`FolderRecord` holds every [folder record](./mokly-folders.md), from either
carrier, with its validated fields and the repository-relative source of the
record: the `_folder.json` file or the entry module that exported
`defineFolder`. A `_folder.json` at the top level of an unprefixed root is
recorded with `path: ""`. Resolved titles are not stored; readers apply the
title rule. Directory-only fields are rejected for code carriers, identified
by a source path whose final segment is not `_folder.json`.

`colorSchemes` is the effective, sorted, light-first set: a component variant
inherits its parent's set, a document uses the catalogue set, and a screen
variant may replace its parent's set under the variant contract. Variant
props contain only validated data; supplied slot names reference declared
slots and contain no React values. A document keeps its referenced
repository-relative files in `resources`.

## Validation And Ordering

One validator checks the records for Serve, `build`, and the base side of a
comparison. It rejects incorrect types, invalid paths, props the schema
rejects, duplicate records, unsafe repository paths, and broken
cross-references. Paths follow the
[segment grammar](./mokly-paths.md#segment-grammar) and are unique
case-insensitively across all entries. A `variantOf` names a current entry of
the same kind without `variantOf`, and the variant's path is that parent's
path plus exactly one segment. `useCasePaths` and `screenPath` reciprocate. A
folder path is below at least one entry path or is the top level, and folder
paths are unique. Source paths, tags, and resource confinement keep the rules
of their authoring contracts.

Entries order by kind name in UTF-16 order (`component`, `document`, `page`,
`screen`, `use-case`) and then by path in UTF-16 code units, never with a
locale-sensitive collator. The variants of one parent are the exception: they
follow their parent in authored order, before the next entry. That sibling
order is the order the navigation list, the details `Variants` row, and the
public tree's entry-node `children` present. A variant without one uniquely
valid parent stays in ordinary kind-then-path position so that relationship
validation rejects it deterministically; invalid entries never enter the
model. Folders order by path. Use-case steps and tags keep authored order;
resource, supplied-slot, and declared-slot arrays sort uniquely. The
[catalogue index](./mokly-shell-delivery.md#catalogue-index) and the entry
details project the records with these orders.

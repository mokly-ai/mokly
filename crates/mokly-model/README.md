# mokly-model

`mokly-model` owns pure data contracts for the Mokly Rust core. Use it when a
crate must encode canonical JSON, validate props, or share types with the
React viewer. Every other core crate that writes or reads a public shape
depends on it. It has no internal crate dependency and performs no file IO.

## Responsibilities

- Own the independent format numbers in `versions`. The
  [format inventory](../../docs/protocol/mokly-format-versions.md) lists them.
- Own shared output shapes and one pure marker writer for build and publish.
- Encode canonical JSON with recursive UTF-16 key order, two-space indentation,
  explicit empty values, omitted absent optionals, and a final LF.
- Validate the JSON Schema 2020-12 prop profile and complete JSON props with
  one validator on `jsonschema`.
- Own the review result and change snapshot, the in-memory comparison
  records, the removed-preview shape, and their strict readers.
- Generate TypeScript declarations for the viewer.

## What This Crate Does

`PropValidator::compile` checks keyword placement, closed objects, primitive
choices, bounds, required keys, and the draft metaschema. `validate` rejects
unknown props without coercion or defaults. Both operations enforce 64 nesting
levels and 10,000 visited values. Diagnostics keep the entry, variant, and an
exact JSON Pointer. HTML uses `html-front-matter` or `html-attribute`.
JavaScript and stories use `component-schema` or `component-props`.

`output` defines the ownership marker, upload metadata, repository identity,
and immutable file inventory. `Artifact::finalize` accepts optional upload
metadata and writes the marker last. Plain builds pass no metadata. Both
`mokly-static` and `mokly-publish` use these shapes without a dependency on
each other. The marker parser checks format shape. The publication client
separately checks complete artifact bytes and upload-only file-count limits.

Canonical encoding preserves array order. Each shape owner supplies the entry
kind/path order, authored variant order, instance/slot key order, and region
tree order. Authored tags and steps keep their order. Navigation projection
and validation use explicit work stacks. Navigation nodes clone, format for
debugging, and drop without recursive ownership operations. The HTML depth
guarantee does not extend the JSON reader or prop-schema nesting contracts.

`ts-rs` derives declarations from the Rust shapes. Its configuration maps all
large integer types to TypeScript `number`, because JSON readers use numbers. It supports recursive
schemas and Serde field names without a second hand-written type model.
`typescript::generate` returns deterministic source. `cargo xtask generate-types`
writes the schema module to `packages/viewer/src/generated/model.ts` and the
catalogue types to `packages/viewer/src/generated/catalogue/`, one declaration
per file. `catalogue::CatalogueModel` is private in-memory state. `SourceLocation`
coordinates are one-based; a zero line or column means the coordinate is
unavailable. JavaScript diagnostics can use the module and export instead. The public
roots are `CatalogueReadModel`, `EntryDetailV3`, and `LiveDescriptorV3`.
Their readers gate the version before decoding payload fields.
Entry detail carries `controlOrder` for screens and components. It lists every
editable key once, in declaration order, independently of canonical object keys.
Detail validation checks that list against the index's controls.
Index validation checks private fields, paths, variants, trees, schemas, tagged props, flow
membership, removed metadata, snapshot identities, the base commit of ready
Changes, and generation roots.
Ready component and view eligibility follows the same kind rules as the viewer,
including removed component parents.
Detail validation checks the current or historical fence, field placement
by kind, and canonical tagged props in usage and input-change records.
The optional detail-root `reasons` uses the review result's reason shape and
order. A view's `state` and `ignoredIds` travel with its `resourceEvidence`,
and `before` names the base side of a ready current screen or component.
Ready included entries carry it even when their usage workspace is unavailable.
`ReadError::Contract` carries a typed `ContractViolation`. Version failures
print the supplied integer or explain its absence.

`detail_context::read` validates a current detail against its installed index.
It checks identity, deployment, revision, kind, exact views, and reason presence
against ready included membership in the matching index record.
`usage_context::validate` checks recorded props against component schemas,
recomputes the shared props, instance, and slot keys, and checks references,
cycles, input order, locations, and physical ranges. Historical callers supply
the component schemas of the base catalogue. A structural detail read alone
cannot validate relationships that need this context.

`UsageSchemas` compiles each used component schema once per publication.
`detail_context::validate_with` shares that cache across its details and views.

`projection` selects current public fields explicitly. It builds the tree,
index, and pending details from a validated model and the graph's input keys.
`projection_usage` derives complete workspace consumers from ready usage. It
omits workspace lists while their inputs are pending or unavailable.
`namespace` owns the fixed deployed directory names and their generated
TypeScript constants. `shell::html` supplies the same data-free shell stub to
Serve and the static writer.

`review` and `review_affected` define direct reasons, view states, and complete
usage chains. A comparison keeps the review result in memory and publishes its
facts through the index and the entry details. `review_order` supplies
canonical order for producers and readers. `readers::review` gates the review
version before validating sides, membership, order, and evidence.
The reader requires current variants before base-only variants, exact
`previousPath` on moved pairs, and UTF-16 order for reason targets.
The classifier also validates source coverage and actual ownership proof.
`readers::change_snapshot` gates the snapshot version before reading
historical records. It rejects unknown flattened fields, invalid IDs, and
snapshot-local order errors.
`CatalogueChangeSnapshotV4::validate_sources` checks the full removed order
against both catalogues, including base-authored variant order.
Component identity impact can come from an included parent or variant. An
actual-instance `implementation` reason does not alter own view states.

`material` owns the catalogue, historical snapshot, props, instance, and slot digest preimages.
`routes` owns Rust artifact routes and portable relative URL operations,
including comparison generation, snapshot-side, and removed-preview paths.

`inference::infer` builds closed schemas from own and merged variant props.
`data::merge_props` replaces top-level keys only. `wire_props` and `wire_decode`
encode and decode tagged public props, including negative zero. Derived controls
use the same binary64 values as the core. Plain prop decoding rounds integers
outside JavaScript's safe integer range before validation and inference.
Catalogue and invocation boundaries report `props-unsafe-integer` warnings.
Derived controls
follow schema choices, labels, bounds, and zero-based number steps.
`controls::with_bounds` supplies the narrowed schema for temporary prop checks.
`runtime_diagnostic` carries expected runtime categories across adapters.

## Quick Start

```rust
use mokly_model::canonical;
use mokly_model::error::Result;
use serde_json::json;

fn encode() -> Result<()> {
    let value = json!({"z": [], "a": {}});
    let bytes = canonical::to_string(&value)?;
    assert_eq!(bytes, "{\n  \"a\": {},\n  \"z\": []\n}\n");
    Ok(())
}
```

## Development

```bash
cargo test -p mokly-model
cargo xtask generate-types
```

### Key Code

- [`src/versions.rs`](./src/versions.rs) holds every independent format
  number, such as `CATALOGUE_INDEX` and `ENTRY_DETAIL`.
- [`src/canonical.rs`](./src/canonical.rs) provides `to_string`, the
  canonical JSON encoder.
- [`src/validation.rs`](./src/validation.rs) defines `PropValidator`, the one
  validator for the `PropSchema` profile of
  [`src/prop_schema.rs`](./src/prop_schema.rs) and for complete props.
- [`src/catalogue.rs`](./src/catalogue.rs) defines `CatalogueModel`, the
  private in-memory catalogue that the projection reads.
- [`src/public_index.rs`](./src/public_index.rs) and
  [`src/public_detail.rs`](./src/public_detail.rs) define the public roots
  `CatalogueReadModel`, `EntryDetailV3`, and `LiveDescriptorV3`.
- [`src/projection.rs`](./src/projection.rs) provides `index` and
  `pending_details`, which project a validated model into public records.
- [`src/readers.rs`](./src/readers.rs) provides the strict readers `index`,
  `detail`, `live`, `review`, and `change_snapshot`, which gate the format
  number before they decode a payload.
- [`src/review.rs`](./src/review.rs) and [`src/snapshot.rs`](./src/snapshot.rs)
  define `ReviewResultV8` and `CatalogueChangeSnapshotV4`.
- [`src/output/mod.rs`](./src/output/mod.rs) holds the shared output shapes,
  and `Artifact::finalize` in [`src/output/artifact.rs`](./src/output/artifact.rs)
  writes the ownership marker last.
- [`src/typescript.rs`](./src/typescript.rs) provides `generate` and
  `catalogue_modules`, which return the declarations that
  `cargo xtask generate-types` writes.
- [`src/shell.rs`](./src/shell.rs) provides `html`, the data-free shell stub
  that Serve and the static writer share.

### Related Docs

- [Catalogue model and public shapes](../../docs/protocol/mokly-catalogue.md).
- [Serialization](../../docs/protocol/mokly-catalogue-serialization.md).
- [Entry props](../../docs/protocol/mokly-entry-props.md).
- [Component props](../../docs/protocol/mokly-component-props.md).
- [Format inventory](../../docs/protocol/mokly-format-versions.md).
- [Static ownership](../../docs/protocol/mokly-export-ownership.md).
- [Rust core architecture](../../docs/architecture/rust-core.md).

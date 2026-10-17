# mokly-model

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

`mokly-model` owns pure data contracts for the Mokly Rust core. Use it when a
crate must encode canonical JSON, validate props, or share types with the
React viewer. It has no internal crate dependency and performs no file IO.

## Responsibilities

- Own the independent format numbers in `versions`.
- Own shared output shapes and one pure marker writer for build and publish.
- Encode canonical JSON with recursive UTF-16 key order, two-space indentation,
  explicit empty values, omitted absent optionals, and a final LF.
- Validate the JSON Schema 2020-12 prop profile and complete JSON props with
  one validator on `jsonschema`.
- Own review v8, change snapshot v4, removed-preview v3, and their strict readers.
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
static output and publication use these shapes without a dependency on each
other. The marker parser checks format shape; the publication client separately
checks complete artifact bytes and upload-only file-count limits.

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
roots are `CatalogueReadModel` v7, `EntryDetailV1`, and `LiveDescriptorV3`.
Their readers gate the version before decoding payload fields. Index validation
checks private fields, paths, variants, trees, schemas, tagged props, flow
membership, removed metadata, snapshot identities, and generation URLs.
Ready component and view eligibility follows the same kind rules as the viewer,
including removed component parents.
Detail validation checks the current or historical fence, field placement
by kind, and canonical tagged props in usage and input-change records.
`ReadError::Contract` carries a typed `ContractViolation`. Version failures
print the supplied integer or explain its absence.

`detail_context::read` validates a current detail against its installed index.
It checks the identity, deployment, revision, kind, and exact view set.
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
usage chains. `review_order` supplies canonical order for producers and readers.
`readers::review` gates v8 before validating sides, membership, order, and evidence.
The reader requires current variants before base-only variants, exact
`previousPath` on moved pairs, and UTF-16 order for reason targets.
The classifier also validates source coverage and actual ownership proof.
`readers::change_snapshot` gates v4 before reading historical records and
rejects unknown flattened fields, invalid IDs, and snapshot-local order errors.
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
follow schema choices, labels, bounds, and zero-based number steps.
`controls::with_bounds` supplies the narrowed schema for temporary prop checks.
`runtime_diagnostic` carries expected runtime categories across adapters.

## Quick Start

```rust
use mokly_model::canonical;
use serde_json::json;

let bytes = canonical::to_string(&json!({"z": [], "a": {}}))?;
assert_eq!(bytes, "{\n  \"a\": {},\n  \"z\": []\n}\n");
# Ok::<(), mokly_model::error::ModelError>(())
```

## Development

```bash
cargo test -p mokly-model
cargo xtask generate-types
```

### Key Code

- [Shared output contracts and marker writer](./src/output/mod.rs).
- [Schema types](./src/prop_schema.rs) and [validator](./src/validation.rs).
- [Profile restrictions](./src/profile.rs) and [limits](./src/limits.rs).
- [Canonical encoding](./src/canonical.rs) and [type generation](./src/typescript.rs).
- [Catalogue model](./src/catalogue.rs), [public index](./src/public_index.rs),
  [detail and live types](./src/public_detail.rs), and [readers](./src/readers.rs).

### Related Docs

- [Serialization](../../docs/protocol/mokly-catalogue-serialization.md).
- [Entry props](../../docs/protocol/mokly-entry-props.md).
- [Component props](../../docs/protocol/mokly-component-props.md).
- [Format inventory](../../docs/protocol/mokly-format-versions.md).

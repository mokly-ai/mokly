# mokly-model

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

`mokly-model` owns pure data contracts for the Mokly Rust core. Use it when a
crate must encode canonical JSON, validate props, or share types with the
React viewer. It has no internal crate dependency and performs no file IO.

## Responsibilities

- Own the independent format numbers in `versions`.
- Encode canonical JSON with recursive UTF-16 key order, two-space indentation,
  explicit empty values, omitted absent optionals, and a final LF.
- Validate the JSON Schema 2020-12 prop profile and complete JSON props with
  one validator on `jsonschema`.
- Generate TypeScript declarations for the viewer.

## What This Crate Does

`PropValidator::compile` checks keyword placement, closed objects, primitive
choices, bounds, required keys, and the draft metaschema. `validate` rejects
unknown props without coercion or defaults. Both operations enforce 64 nesting
levels and 10,000 visited values. Diagnostics keep the entry, variant, and an
exact JSON Pointer. HTML uses `html-front-matter` or `html-attribute`.
JavaScript and stories use `component-schema` or `component-props`.

Canonical encoding preserves array order. Each shape owner supplies the entry
kind/path order, authored variant order, instance/slot key order, and region
tree order. Authored tags and steps keep their order.

`ts-rs` derives declarations from the Rust shapes. Its configuration maps all
large integer types to TypeScript `number`, because JSON readers use numbers. It supports recursive
schemas and Serde field names without a second hand-written type model.
`typescript::generate` returns deterministic source. `cargo xtask generate-types`
writes the schema module to `packages/viewer/src/generated/model.ts` and the
catalogue types to `packages/viewer/src/generated/catalogue/`, one declaration
per file. `catalogue::CatalogueModel` is private in-memory state. The public
roots are `CatalogueReadModel` v7, `EntryDetailV1`, and `LiveDescriptorV3`.
Their readers gate the version before decoding payload fields. Index validation
checks private fields, paths, variants, trees, schemas, tagged props, and flow
membership. Detail validation checks the current or historical fence.

`material` owns the shared props, instance, and slot digest preimages.
`routes` owns Rust artifact routes and portable relative URL operations.

`inference::infer` builds closed schemas from own and merged variant props.
`data::merge_props` replaces top-level keys only. `wire_props` and `wire_decode`
encode and decode tagged public props, including negative zero. Derived controls
follow schema choices, labels, bounds, and zero-based number steps.

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

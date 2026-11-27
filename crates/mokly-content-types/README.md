# mokly-content-types

`mokly-content-types` selects content types by file extension. The CSS
compiler and the render graph use it for imported assets. Serve uses it for
file responses, and Mokly Cloud uses it to record the type of each file
during publication reservation. Keep `mime_guess` as its only dependency
because the Cloud API links this crate.

## Responsibilities

- Provide the declared types of imported assets and stylesheet assets.
- Select content types for delivered files under the shared delivery rule.

## What This Crate Does

`imported_content_type` looks up the declared type of a JavaScript asset
import. `stylesheet_content_type` looks up the stylesheet asset types, and
`stylesheet_extensions` formats their accepted extensions for diagnostics.
`delivered_content_type` applies the
[content type rule](../../docs/protocol/mokly-content-types.md).

## Quick Start

```rust
use mokly_content_types::delivered_content_type;

assert_eq!(delivered_content_type("assets/photo.pjp"), "image/jpeg");
```

## Development

```bash
cargo test -p mokly-content-types
cargo clippy -p mokly-content-types --all-targets -- -D warnings
```

### Key Code

- The case-sensitive asset tables and the four public functions are in
  [`src/lib.rs`](./src/lib.rs).

### Related Docs

- [Content types](../../docs/protocol/mokly-content-types.md).
- [Rust core architecture](../../docs/architecture/rust-core.md).

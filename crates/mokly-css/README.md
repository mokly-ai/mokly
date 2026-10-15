# mokly-css

`mokly-css` prepares stylesheet delivery for Mokly. Depend on it to bundle
local CSS, scope CSS Modules, and deliver opaque CSS assets. The render graph
owns cache keys and resource routes. The sidecar supplies consumer PostCSS.

## Responsibilities

- Resolve each root's local import closure through `dyn ImportResolver`.
- Prune renderer-owned imports before consumer processing.
- Scope local CSS Module names with repository-path hashes.
- Bundle on `lightningcss` without minification or target lowering.
- Rewrite local URLs and retain exact asset bytes.
- Return protected input bytes and importing-source attribution.

## What This Crate Does

`Compiler` implements `dyn StylesheetBundler`. It receives `dyn SourceTree`,
`dyn ImportResolver`, and `dyn CssProcessor`. `IdentityProcessor` handles a
catalogue without consumer plugins. A sidecar adapter implements the same
processor boundary for PostCSS. It receives the renderer exclusion set and
returns plugin provenance and directory watch recipes beside the transformed
text. The graph protects those inputs and reports plugin-specific recovery
actions. Selected dependency roots keep their logical `node_modules` names.

Package aliases use the configuration directory's Node ancestor lookup,
then the configured package roots, as the JavaScript graph does. Imports
without an alias use the importing stylesheet's directory.

A configured root delivers `styles/{repository-path}`. A JavaScript root
delivers `styles/{module-path}.css`. Assets use `assets/{repository-path}`.
URLs keep query and fragment suffixes. Public resources never read private
CSS inputs by their authored paths.

`modules::scope` returns CSS and sorted class exports from one naming rule:
`mokly_{first-12-SHA256-path-digits}_{local}`. The map is suitable for the
sidecar's CSS Modules table. Plain CSS has no map. Declaration-list at-rules
retain their values. An independent token check rejects scoping that changes
anything beyond local names and the module scope/composition syntax.

Plugin dependency inputs use digests, separate from CSS and asset bytes.
They keep source protection and graph invalidation without retaining file bodies.

## Quick Start

```rust
use mokly_css::modules;

let (css, exports) = modules::scope("ui/card.module.css", ".card { color: red }")?;
assert!(exports["card"].starts_with("mokly_"));
assert!(css.contains(&exports["card"]));
# Ok::<(), mokly_css::error::CssError>(())
```

## Development

```bash
cargo test -p mokly-css
cargo clippy -p mokly-css --all-targets -- -D warnings
```

Tests use unimock at source, resolver, and processor boundaries. Graph
integration tests verify complete delivery with real authored fixtures.

### Key Code

- [Compiler](./src/compiler.rs) and [delivery](./src/delivery.rs).
- [CSS Modules](./src/modules.rs) and [module checks](./src/module_checks.rs).
- [CSS references](./src/syntax.rs), [paths](./src/paths.rs), and [errors](./src/error.rs).
- [Injected interfaces](./src/types.rs) and [resolver](./src/resolver.rs).

### Related Docs

- [Imported styles](../../docs/protocol/mokly-imported-styles.md).
- [CSS Modules](../../docs/protocol/mokly-imported-styles-modules.md).
- [CSS assets](../../docs/protocol/mokly-imported-styles-assets.md).
- [PostCSS boundary](../../docs/protocol/mokly-imported-styles-postcss.md).

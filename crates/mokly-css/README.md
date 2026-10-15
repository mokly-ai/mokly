# mokly-css

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

`mokly-css` prepares stylesheet delivery for Mokly. Depend on it to bundle
local CSS, scope CSS Modules, deliver opaque CSS assets, and attribute changed
public stylesheet rules. The render graph
owns cache keys and resource routes. The sidecar supplies consumer PostCSS.

## Responsibilities

- Resolve each root's local import closure through `dyn ImportResolver`.
- Prune renderer-owned imports before consumer processing.
- Scope local CSS Module names with repository-path hashes.
- Bundle on `lightningcss` without minification or target lowering.
- Rewrite local URLs and retain exact asset bytes.
- Return protected input bytes and importing-source attribution.
- Collect unoptimized rules and diff occurrences without losing declaration order.
- Match selectors on composed-document arenas with a conservative keep list.
- Join equal rule copies and filter nested own-page matches before attribution.
- Cache parsed sheets by content under an explicit retained-byte bound.

## What This Crate Does

`Compiler` implements `dyn StylesheetBundler`. It receives `dyn SourceTree`,
`dyn ImportResolver`, and `dyn CssProcessor`. `IdentityProcessor` handles a
catalogue without consumer plugins. A sidecar adapter implements the same
processor boundary for PostCSS.

A configured root delivers `styles/{repository-path}`. A JavaScript root
delivers `styles/{module-path}.css`. Assets use `assets/{repository-path}`.
URLs keep query and fragment suffixes. Public resources never read private
CSS inputs by their authored paths.

`modules::scope` returns CSS and sorted class exports from one naming rule:
`mokly_{first-12-SHA256-path-digits}_{local}`. The map is suitable for the
sidecar's CSS Modules table. Plain CSS has no map.

`rule_collection::collect` returns a complete rule list or a whole-sheet parse
failure. `rules::diff` cancels equal occurrences before pairing declaration
edits. `rule_matching::match_document` uses Servo `selectors` against both
available document arenas. It keeps every matching element until attribution.
`MatchTree` preserves parsed element relationships and component containment;
the HTML adapter omits ignored regions and inert template contents.

`attribution::attribute` first collects unfiltered own-page matches. It then
filters nested component matches and produces per-view owner records. A sheet
with no kept rule has one empty-selector `excluded` record. `MemoryParsedCss`
shares equal bytes across paths and sides. Eviction changes work only.
`inline_attribution` is the tested whole-screen style ownership seam for the
sidecar integration.

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
- [Rule collection](./src/rule_collection.rs), [diff](./src/rules.rs), and [matching](./src/rule_matching.rs).
- [Attribution](./src/attribution.rs), [document arena](./src/match_tree.rs), and [parsed cache](./src/parsed_cache.rs).
- [CSS Modules](./src/modules.rs) and [module checks](./src/module_checks.rs).
- [CSS references](./src/syntax.rs), [paths](./src/paths.rs), and [errors](./src/error.rs).
- [Injected interfaces](./src/types.rs) and [resolver](./src/resolver.rs).

### Related Docs

- [Imported styles](../../docs/protocol/mokly-imported-styles.md).
- [CSS Modules](../../docs/protocol/mokly-imported-styles-modules.md).
- [CSS assets](../../docs/protocol/mokly-imported-styles-assets.md).
- [PostCSS boundary](../../docs/protocol/mokly-imported-styles-postcss.md).
- [CSS change attribution](../../docs/protocol/mokly-css-attribution.md).

# mokly-css

`mokly-css` prepares stylesheet delivery for Mokly. Depend on it to bundle
local CSS, scope CSS Modules, deliver opaque CSS assets, and attribute changed
public stylesheet rules. `mokly-graph` owns cache keys and resource routes.
`mokly-render` supplies consumer PostCSS through the sidecar. `mokly-compare`
calls the matching and attribution functions for Changes.

## Responsibilities

- Resolve each root's local import closure through `dyn ImportResolver`.
- Prune renderer-owned imports before consumer processing.
- Scope local CSS Module names with repository-path hashes.
- Bundle on `lightningcss` without minification or target lowering.
- Rewrite local URLs and retain opaque asset identities and digests.
- Return parsed source bytes, opaque input metadata, and importing-source attribution.
- Collect unoptimized rules and diff occurrences without losing declaration order.
- Match selectors on composed-document arenas with a conservative keep list.
- Join equal rule copies and filter nested own-page matches before attribution.
- Cache parsed sheets by content under an explicit retained-byte bound.

## What This Crate Does

`Compiler` implements `dyn StylesheetBundler`. It receives `dyn SourceTree`,
`dyn ImportResolver`, and `dyn CssProcessor`. `IdentityProcessor` handles a
catalogue without consumer plugins. A sidecar adapter implements the same
processor boundary for PostCSS. It receives the renderer exclusion set and
returns plugin provenance and directory watch recipes beside the transformed
text. The graph protects those inputs and reports plugin-specific recovery
actions. Selected dependency roots keep their logical `node_modules` names.

`SourceResolver` implements `ImportResolver`. Imports share aliases, package
roots, and the other resolution settings with the JavaScript graph under the
[imported styles contract](../../docs/protocol/mokly-imported-styles.md). The
core supplies configured package roots as ordered logical dependency
directories. Imports inside a logical dependency root try package-local
`node_modules`, then siblings at that root, then the mapped authored
ancestors. This keeps package CSS and JavaScript on the same copy.

The same contract owns the `styles/` and `assets/` delivery routes. URLs keep
query and fragment suffixes. Public resources never read private CSS inputs by
their authored paths.

`modules::scope` returns CSS and sorted class exports from the one naming rule
of the [CSS Modules contract](../../docs/protocol/mokly-imported-styles-modules.md).
The map is suitable for the sidecar's CSS Modules table. Plain CSS has no map.
Declaration-list at-rules retain their values. An independent token check
rejects scoping that changes anything beyond local names and the module
scope and composition syntax. Declaration-only at-rules such as `@font-face`
end a non-custom statement at its first `{}` block, as postcss does. A nested
at-rule keeps its prelude as authored, except the keyframes name and an
`@scope` selector.

The renamer, the module check, and the token check share one statement reader.
It takes each statement's start and kind from cssparser's own rule parsers, so
all three scanners agree with `lightningcss` on each statement that
`lightningcss` keeps, except in the declaration-only at-rules above, where kept
text can read as other statements. Before each stylesheet statement, the
reader skips the HTML comment tokens `<!--` and `-->`, as cssparser does. Text
that `lightningcss` drops or rejects can read as other statements. For
example, in a rule list such as the stylesheet or a keyframes block, a `;` also
ends a statement for the reader, but cssparser ends a style rule or a keyframe
only at its `{}` block.

`rule_collection::collect` returns a complete rule list or a whole-sheet parse
failure. `rules::diff` cancels equal occurrences before pairing declaration
edits. `rule_matching::match_document` uses Servo `selectors` against both
available document arenas. It keeps every matching element until attribution.
Deep documents follow the `:has()` rule of the
[attribution rules](../../docs/protocol/mokly-css-attribution-rules.md), with
the depth bound in `rule_matching::MAX_HAS_TREE_DEPTH`. `MatchTree` preserves
parsed element relationships and component containment. The HTML adapter
omits ignored regions and inert template contents. `ContainmentPath` shares
immutable parent links between elements, copied matching trees, embedded
documents, and detached match proof. Every source keeps physical containment.
Owned proof also keeps the shared supplier path for its nested filter. Linked
and ownerless proof retain no supplier path. Callers read
`MatchProof::regions()` for physical ancestry. Physical and supplier links
share exact instance identities, so repeated component paths cannot make a
receiving copy look like the supplying instance.

`attribution::attribute` joins equal rule observations, collects unfiltered
own-page matches, and filters nested components before one record reduction.
Owned head styles, ownerless head styles, and linked CSS share that reducer.
Kept own-page source paths remain separate from published ownership records.
Callers use those paths for direct preview states and dependency reasons. A
source with no kept rule has one empty-selector `excluded` record. Unresolved
proof takes precedence for the same selector and source. `inline_attribution`
uses the linked observation boundary for ownerless head rules. `observe_owned`
retains the declared owner and supplier filter. Declared owners claim physical
instances even when their own pages have no match. Ownerless rules require
catalogue-wide own-page proof, as linked CSS does. The
[CSS change attribution contract](../../docs/protocol/mokly-css-attribution.md)
owns the published evidence.

`MemoryParsedCss` shares equal bytes across paths and sides. Its eviction
changes work only. Evidence retains each source's public route.

Opaque assets use `Bundle.assets` records with logical paths, confined source
identities, SHA-256 digests, and input aliases. `Bundle.inputs` retains parsed
CSS only. The graph checks asset streams against these digests at delivery.

`Bundle.read_evidence` retains distinct observed and late input versions.
Combining stylesheets preserves both kinds without overwriting earlier
witnesses. Plugin dependency inputs use digests, separate from parsed CSS
bytes. They keep source protection and graph invalidation without retaining
file bodies.

`lightningcss` recurses once per nesting level, so compilation, bundling, CSS
Modules scoping, and rule collection stop at its nesting limit. That limit
depends on the nesting form and the build profile. Every measured form
survives at least 32 levels on a 2 MiB worker stack, far more than authored
stylesheets nest.

## Quick Start

```rust
use mokly_css::error::Result;
use mokly_css::modules;

fn scope_card() -> Result<()> {
    let (css, exports) = modules::scope("ui/card.module.css", ".card { color: red }")?;
    assert!(exports["card"].starts_with("mokly_"));
    assert!(css.contains(&exports["card"]));
    Ok(())
}
```

## Development

```bash
cargo test -p mokly-css
cargo clippy -p mokly-css --all-targets -- -D warnings
```

Tests use unimock at source, resolver, and processor boundaries. Graph
integration tests verify complete delivery with real authored fixtures.
`tests/nesting_depth_tests.rs` re-runs its own test binary to find the deepest
CSS that each parser and pipeline survives on a 2 MiB worker stack. Run it with
`--nocapture` to print the limits, and with `--release` for release builds.

### Key Code

- [`src/compiler.rs`](./src/compiler.rs) defines `Compiler`, the
  `StylesheetBundler` that reads, transforms, scopes, and bundles one root.
- [`src/types.rs`](./src/types.rs) defines the `StylesheetBundler` and
  `CssProcessor` boundaries and the `StylesheetRoot` and `Bundle` records.
- [`src/resolver.rs`](./src/resolver.rs) defines `ImportResolver` and
  `SourceResolver`, which resolve imports through the injected source tree.
- [`src/modules.rs`](./src/modules.rs) provides `scope` and `scoped_name`, the
  CSS Modules renamer.
- [`src/rule_collection.rs`](./src/rule_collection.rs) and
  [`src/rules.rs`](./src/rules.rs) provide `collect` and `diff`, which read a
  complete rule list and pair the changed rules.
- [`src/rule_matching.rs`](./src/rule_matching.rs) provides `match_document`,
  which matches changed selectors against a `MatchTree` from
  [`src/match_tree.rs`](./src/match_tree.rs).
- [`src/attribution.rs`](./src/attribution.rs) provides `attribute`, which
  reduces page observations into an `Attribution` with rule evidence.
- [`src/parsed_cache.rs`](./src/parsed_cache.rs) defines `ParsedCssCache` and
  `MemoryParsedCss`, the byte-bounded parsed sheet cache.
- [`src/error.rs`](./src/error.rs) defines `CssError`, the typed stylesheet
  failure with authored diagnostics.

### Related Docs

- [Imported styles](../../docs/protocol/mokly-imported-styles.md).
- [CSS Modules](../../docs/protocol/mokly-imported-styles-modules.md).
- [CSS assets](../../docs/protocol/mokly-imported-styles-assets.md).
- [PostCSS boundary](../../docs/protocol/mokly-imported-styles-postcss.md).
- [CSS change attribution](../../docs/protocol/mokly-css-attribution.md).
- [CSS attribution rules](../../docs/protocol/mokly-css-attribution-rules.md).
- [Rust core architecture](../../docs/architecture/rust-core.md).

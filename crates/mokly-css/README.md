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

Package aliases use the configuration directory's Node ancestor lookup,
then the configured package roots, as the JavaScript graph does. Imports
without an alias use the importing stylesheet's directory.
The core supplies configured package roots as ordered logical dependency
directories. Ancestor aliases map each physical lookup position to its side's
selected logical dependency root. The resolver applies only one longest-key
alias substitution. Imports inside a logical dependency root try package-local
`node_modules`, then siblings at that root, then the mapped authored ancestors.
This keeps package CSS and JavaScript on the same copy.

A configured root delivers `styles/{repository-path}`. A JavaScript root
delivers `styles/{module-path}.css`. Assets use `assets/{repository-path}`.
URLs keep query and fragment suffixes. Public resources never read private
CSS inputs by their authored paths.

`modules::scope` returns CSS and sorted class exports from one naming rule:
`mokly_{first-12-SHA256-path-digits}_{local}`. The map is suitable for the
sidecar's CSS Modules table. Plain CSS has no map. Declaration-list at-rules
retain their values. An independent token check rejects scoping that changes
anything beyond local names and the module scope/composition syntax.

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
`inline_attribution` retains input-owner proof for ownerless head rules.
The comparison engine joins their rule identities with catalogue-wide own-page
matches. Slot matches follow their supplier. Body styles and owned head styles
are excluded from this collector. Evidence uses the containing public document
route. Linked selectors emit one
record per innermost changed component owner, plus outside entry evidence.

Opaque assets use `Bundle.assets` records with logical paths, confined source
identities, SHA-256 digests, and input aliases. `Bundle.inputs` retains parsed
CSS only. The graph checks asset streams against these digests at delivery.

`Bundle.read_evidence` retains distinct observed and late input versions.
Combining stylesheets preserves both kinds without overwriting earlier witnesses.
Plugin dependency inputs use digests, separate from parsed CSS bytes.
They keep source protection and graph invalidation without retaining file bodies.

Mokly's CSS scanners read a flat token arena with matched block extents. URL
references, HTML boundary stripping, CSS Modules renaming, and its token check
keep nesting on the heap; a 100,000-level stylesheet uses an ordinary worker
thread in each of them. The rule walk also keeps its frames on the heap, but
each rule copies its inherited conditions, so its work grows with the square
of the depth. Selector broadening and nesting substitution use cssparser 0.38,
whose 75-level nested-block allowance bounds their recursion. `lightningcss`
recurses once per nesting level while it parses, prints, and drops a sheet.
Compilation and bundling stop at its limit. So do CSS Modules scoping, which
parses the renamed sheet with `lightningcss`, and rule collection, which runs
`lightningcss` before the rule walk. That limit depends on the nesting form
and the build profile. Every measured form survives at least 32 levels on a
2 MiB worker stack, far more than authored stylesheets nest.

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
`tests/nesting_depth_tests.rs` re-runs its own test binary to find the deepest
CSS that each parser and pipeline survives on a 2 MiB worker stack. Run it with
`--nocapture` to print the limits, and with `--release` for release builds.

### Key Code

- [Compiler](./src/compiler.rs) and [delivery](./src/delivery.rs).
- [Rule collection](./src/rule_collection.rs), [diff](./src/rules.rs), and [matching](./src/rule_matching.rs).
- [Attribution](./src/attribution.rs), [document arena](./src/match_tree.rs), and [parsed cache](./src/parsed_cache.rs).
- [CSS Modules](./src/modules.rs) and [module checks](./src/module_checks.rs).
- [CSS references](./src/syntax.rs), [paths](./src/paths.rs), and [errors](./src/error.rs).
- [Token arena](./src/token_tree.rs) and [statement sections](./src/token_sections.rs).
- [Injected interfaces](./src/types.rs) and [resolver](./src/resolver.rs).

### Related Docs

- [Imported styles](../../docs/protocol/mokly-imported-styles.md).
- [CSS Modules](../../docs/protocol/mokly-imported-styles-modules.md).
- [CSS assets](../../docs/protocol/mokly-imported-styles-assets.md).
- [PostCSS boundary](../../docs/protocol/mokly-imported-styles-postcss.md).
- [CSS change attribution](../../docs/protocol/mokly-css-attribution.md).

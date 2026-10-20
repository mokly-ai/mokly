# mokly-catalogue

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

`mokly-catalogue` loads data-only configuration and prepares the catalogue from
an injected source tree. Depend on it to discover entries, validate authoring
inputs, or classify private sources. `mokly-model` owns the shared data shapes.
`mokly-source-interface` owns file access. Rendering belongs to the HTML and
render graph crates.

## Responsibilities

- Resolve `mokly.config.json` and config-relative input paths.
- Walk roots once per pass and preserve each matched file's root owner.
- Parse HTML front matter, YAML use cases, Markdown metadata, and folder records.
- Derive paths, flatten variants, validate schemas and props, and resolve flows.
- Keep private source membership separate from public resources.
- Report structured errors and sorted build warnings with source locations.

## What This Crate Does

Warning identities keep route and named subjects distinct, including equal
printed locations. Normalization sorts by printed location, message, code,
and subject kind before removing exact duplicates.
Unsupported extglob openings in stylesheet matchers produce one configuration
warning per matcher. Brace alternatives and literal character classes stay
warning-free. Preparation leaves the matcher's meaning unchanged.

`Loader` implements `ConfigLoader`. It searches upward or loads an explicit
JSON file. The editor schema ships in `@mokly/mokly/config.schema.json`.
Filesystem checks resolve symlinks and keep local inputs inside `repoRoot`.
The working tree uses the shared `dunce` path spelling, including Windows
repository identities, so output confinement and input rechecks use matching paths.
PostCSS path, suffix, and regular-file checks use the catalogued
`config-invalid` diagnostics before a sidecar starts.
Git root validation belongs to the Git boundary. Config-relative parent
segments are accepted when their lexical and physical targets stay inside
`repoRoot`. Alias keys and targets must be bare specifiers. Ordered module
resolution lists retain only the first occurrence of each value.

`Discoverer` implements `Discovery` over `dyn SourceTree`. It skips denied
subdirectories and symlinks. Excluded files remain protected source inputs.
The inventory stores lexical paths, physical aliases, file kinds, and root
ownership. Later stages reuse it instead of walking again.

`Builder` implements `CatalogueBuilder`. It produces `PreparedCatalogue`: a
validated in-memory model, private HTML and Markdown bodies, variant slot
fragments, the element registry, warnings, and the source inventory. It calls
`dyn DefinitionProvider` with the resolved configuration for discovered JavaScript files or a configured renderer. Renderer imports
join the private source inventory even without a JavaScript entry. The sidecar
adapter supplies definitions through that boundary. Private JavaScript
recipes retain handles separately from source attribution, saved React slots,
module edges, class-map identity, and the resolved handle table. Resolution
metadata and consumed-module directories remain private watch inputs, including
missing manifest and tsconfig candidates. An opaque
provider lease keeps the bundle alive while a prepared model or graph uses it. Declared
controls pass the Rust validator. Story control hints do not change schemas.
Declared number controls carry their effective schema bounds and step into
the read model. Authored bounds win; omitted values fall back to the schema,
including an integer step of one when no multiple is declared.
Inference exclusions become warnings only after final path derivation. Runtime
failures retain typed terminal categories across provider boundaries. JavaScript
diagnostics retain module and export attribution without invented coordinates. `DeferredDefinitions`
marks its result as deferred and leaves those files in `deferred_modules`
without evaluating them. A successful provider clears that deferred set, so a
build cannot report success after skipping JavaScript inputs.

A failed semantic definition stays in the preparation pass for path checks
and as a relationship target. Its own body, link, and flow-target checks run
once it is valid. Variant shape checks still run. Props and slots are
checked against a parent only when that parent is valid. Consumer slot
checks also wait for valid component declarations. Shared HTML bodies
are checked once, and their warnings name the parent. `Inventory::default()`
provides an empty inventory for injected adapters and tests.

HTML checks cover forbidden and unknown elements, reserved names, slots,
component cycles, template references, and unused props. Composition owns
literal attribute coercion, rendered document safety, assets, and anchors.
`SourcePolicy` classifies root matches, reserved basenames, and inventoried
inputs in that precedence order, including physical aliases.
Static input membership uses each root's matcher and the directory-name policy.

The YAML front-matter builder keeps one heap frame per open sequence or
mapping. Source locations live in a tree of JSON-pointer segments, so memory
grows with the node count, not with the square of the depth. Building,
copying, validating, and releasing a front matter field that validation
rejects uses no native stack per nesting level; a 100,000-level field uses an
ordinary worker thread. Accepted `props`, `propSchema`, and `variants` values
still recurse once per level in serde-derived deserialization and schema
inference before the 64-level prop and schema bound applies. The YAML parser
rejects flow nesting deeper than 255 levels with `html-front-matter`.

Private JavaScript generation metadata carries the sidecar module digest map.
Static builds compare it with captured sources before document callbacks.
It never enters the public catalogue model.

## Quick Start

Inject a source tree and the JavaScript definition provider:

```rust
use std::path::Path;
use std::sync::Arc;
use mokly_catalogue::config::{ConfigLoader, Loader};
use mokly_catalogue::definition_provider::DefinitionProvider;
use mokly_catalogue::discovery::Discoverer;
use mokly_catalogue::preparation::{Builder, CatalogueBuilder, PreparedCatalogue};
use mokly_source_interface::tree::SourceTree;

fn prepare(
    tree: Arc<dyn SourceTree>,
    definitions: Arc<dyn DefinitionProvider>,
    cwd: &Path,
) -> mokly_catalogue::error::Result<PreparedCatalogue> {
    let loader: &dyn ConfigLoader = &Loader { tree: tree.clone() };
    let config = loader.load(cwd, None)?;
    let builder: &dyn CatalogueBuilder = &Builder {
        discovery: Arc::new(Discoverer { tree: tree.clone() }),
        tree,
        definitions,
    };
    builder.prepare(&config, None)
}
```

## Development

```bash
cargo test -p mokly-catalogue
cargo clippy -p mokly-catalogue --all-targets -- -D warnings
```

Unit tests use unimock at source and description boundaries. Behavior fixtures use an in-memory source-tree adapter. Integration tests use
isolated working trees for aliases and races. They assert paths, exact diagnostics,
source locations, source protection, aliases, and filesystem races.
Consumers enable the `mock` feature for the public unimock boundaries.
`tests/nesting_depth_tests.rs` re-runs its own test binary to find the deepest
YAML that each path survives on a 2 MiB worker stack. Run it with
`--nocapture` to print the limits, and with `--release` for release builds.

### Key Code

- [Configuration](./src/config.rs) and [schema validation](./src/config_validation.rs).
- [Discovery](./src/discovery.rs) and [source protection](./src/protection.rs).
- [Preparation](./src/preparation.rs) and [path identity](./src/identity.rs).
- [HTML checks](./src/templates.rs) and [definition provider](./src/definition_provider.rs).
- [YAML front matter](./src/yaml.rs) and its [source positions](./src/yaml_positions.rs).

### Related Docs

- [Root discovery](../../docs/protocol/mokly-root-discovery.md).
- [Configuration](../../docs/protocol/mokly-configuration.md).
- [HTML screens](../../docs/protocol/mokly-html-screens.md).
- [Entry props](../../docs/protocol/mokly-entry-props.md).
- [Catalogue model and public shapes](../../docs/protocol/mokly-catalogue.md).

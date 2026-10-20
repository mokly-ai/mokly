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
Declared steps must be schema multiples and integral for integer props.
Saved props outside the effective control bounds produce `props-control-bounds`
warnings. This includes merged variants and Storybook args after control hints.
Live edits still validate the complete merged props against those bounds.
Unsafe integers in YAML round to binary64 before inference and validation.
This includes schema keywords. Each unsafe keyword produces one
`props-unsafe-integer` warning for its parent entry, with its schema pointer.
Shared schema preparation also normalizes numbers received through JSON, so
JavaScript's decimal spelling retains its binary64 identity in the core.
Declared controls and story hints retain the same normalized bounds, lengths,
and choices for build validation and later live edits.
Their authored unsafe numbers also emit `props-unsafe-integer`, with JSON pointers
relative to `controls`. Explicit declarations report once for the parent.
Applied story hints report for their entry. Schema-derived limits keep their
schema warnings. All numeric warnings use one message formatter and the shared
code, subject, and message duplicate rule.
Preparation captures explicit control order, schema property order, or first-seen
inferred prop order before it creates canonical lookup maps. Variants retain it.
Each affected saved entry reports `props-unsafe-integer`, including nested values
and complete merged variants. Strict builds fail on these warnings.
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
component cycles, template references, and unused props. Unknown ignore-wrapper
attributes warn once per shared body and attribute. Their values are ignored.
They do not validate logical links or select component slots.
The shared token boundary removes these attributes before validation, link
checks, or source-location collection. It retains their names for warnings
and preserves reserved-navigation evidence and duplicate-attribute errors.
Opaque wrapper signatures retain source identity without exposing discarded values.
Composition owns
literal attribute coercion, rendered document safety, assets, and anchors.
`SourcePolicy` classifies root matches, reserved basenames, and inventoried
inputs in that precedence order, including physical aliases.
Static input membership uses each root's matcher and the directory-name policy.

The YAML front-matter builder keeps one heap frame per open sequence or
mapping. Source locations live in a tree of JSON-pointer segments, so memory
grows with the node count, not with the square of the depth.

The builder rejects a value more than 128 levels below the root,
`yaml_limits::MAX_DEPTH`, with `html-front-matter` where the value starts. An
alias counts at the depth of the deepest value in its copy. Deeper input stops
at that level, so a 100,000-level field uses an ordinary worker thread.
Accepted `props`, `propSchema`, and `variants` values recurse once per level
in serde-derived deserialization and schema inference before the 64-level prop
and schema bound applies. At 128 levels, that recursion fits a 2 MiB worker
stack. The YAML parser reads flow nesting ahead, so flow nesting deeper than
255 levels fails with the parser's own `html-front-matter` message.

Before the build, one scan of the parser events counts the nodes that each
alias expands to, without copying a value. A file whose aliases expand to more
than 1,000,000 nodes, `yaml_limits::MAX_ALIAS_NODES`, fails with
`html-front-matter` at the alias that passes the bound. The builder keeps a
copy of only the anchors that an alias refers to.

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
- [HTML token boundary](./src/html_tokens.rs) filters ignore-wrapper attributes before token consumers run.
- [Numeric warnings](./src/numeric_warnings.rs) share one formatter for props, schemas, and authored controls.
- [YAML front matter](./src/yaml.rs), its [limits](./src/yaml_limits.rs), its [alias scan](./src/yaml_aliases.rs), and its [source positions](./src/yaml_positions.rs).

### Related Docs

- [Root discovery](../../docs/protocol/mokly-root-discovery.md).
- [Configuration](../../docs/protocol/mokly-configuration.md).
- [HTML screens](../../docs/protocol/mokly-html-screens.md).
- [Front matter YAML](../../docs/protocol/mokly-front-matter-yaml.md).
- [Entry props](../../docs/protocol/mokly-entry-props.md).
- [Catalogue model and public shapes](../../docs/protocol/mokly-catalogue.md).

# mokly-catalogue

`mokly-catalogue` loads data-only configuration and prepares the catalogue from
an injected source tree. Depend on it to discover entries, validate authoring
inputs, or classify private sources. `mokly-model` owns the shared data shapes.
`mokly-source-interface` owns file access. Rendering belongs to `mokly-html`
and `mokly-graph`. `mokly-render` supplies JavaScript definitions through the
definition provider boundary.

## Responsibilities

- Resolve `mokly.config.json` and config-relative input paths.
- Walk roots once per pass and preserve each matched file's root owner.
- Parse HTML front matter, YAML use cases, Markdown metadata, and folder records.
- Derive paths, flatten variants, validate schemas and props, and resolve flows.
- Keep private source membership separate from public resources.
- Report structured errors and sorted build warnings with source locations.

## What This Crate Does

`Loader` implements `ConfigLoader`. It searches upward or loads an explicit
JSON file. The editor schema ships in `@mokly/mokly/config.schema.json`.
Filesystem checks resolve symlinks and keep local inputs inside `repoRoot`.
Config-relative parent segments are accepted when their lexical and physical
targets stay inside `repoRoot`. PostCSS path, suffix, and regular-file checks
use the catalogued `config-invalid` diagnostics before a sidecar starts. Git
root validation belongs to the Git boundary. The [configuration contract](../../docs/protocol/mokly-configuration.md)
owns the accepted fields, the path rules, and the stylesheet matcher warnings.

`ResolvedConfig::repository_path` returns the repository-relative POSIX path
that a config-relative value names, without `.`, `..`, or empty segments. The
repository root is empty. `ResolvedConfig::renderer`,
`ResolvedConfig::postcss`, and `ResolvedConfig::package_roots` give that form
for their fields. The file policy, the static output boundary, the sidecar
settings, and base dependency selection read package roots in this form, so a
working tree and a Git tree name the same package root. A symbolic link
before `..` does not change that root, and the manifest check reads only it.

`mokly-render` and `mokly-graph` read the renderer, the PostCSS module, and
stylesheets in the same form. Bundle requests, render input keys, stylesheet
roots and links, the declared stylesheet check, and every PostCSS request use
that form.

`WorkingTree` is the working-tree `SourceTree` adapter. It uses the shared
`dunce` path spelling, so output confinement and input rechecks use matching
paths on Windows too. Its file-object metadata lets static builds detect
equal-byte replacements and symlink retargets after consumer reads.
Configuration aliases retain both private source names when a repository's
parent path is a symbolic link. Discovery compares output and root identities,
so an aliased output directory stays outside the entry inventory.

`Discoverer` implements `Discovery` over `dyn SourceTree`. It skips denied
subdirectories and symlinks. Excluded files remain protected source inputs.
The inventory stores lexical paths, physical aliases, file kinds, and root
ownership. Later stages reuse it instead of walking again.

`Builder` implements `CatalogueBuilder`. It produces `PreparedCatalogue`: a
validated in-memory model, private HTML and Markdown bodies, variant slot
fragments, the element registry, warnings, and the source inventory. The graph
fills its private dependency-directory set from completed bundles. Each
prepared generation owns that set. Cache validation adds no entries.

The builder calls `dyn DefinitionProvider` with the resolved configuration for
discovered JavaScript files or a configured renderer. Renderer imports join
the private source inventory even without a JavaScript entry. Private
JavaScript recipes retain handles separately from source attribution, saved
React slots, module edges, class-map identity, and the resolved handle table.
Resolution metadata and consumed-module directories remain private watch
inputs, including missing manifest and tsconfig candidates. An opaque provider lease keeps the bundle alive while a prepared model
or graph uses it. `DeferredDefinitions` marks its result as deferred and
leaves those files in `deferred_modules` without evaluating them. A successful
provider clears that deferred set, so a build cannot report success after
skipping JavaScript inputs. JavaScript diagnostics retain module and export
attribution without invented coordinates.

Declared controls pass the Rust validator. Story control hints do not change
schemas. The [component controls contract](../../docs/protocol/mokly-component-controls.md)
owns control bounds, steps, and the `props-control-bounds` warning. The
[entry props contract](../../docs/protocol/mokly-entry-props.md) owns
binary64 rounding and the `props-unsafe-integer` warning for props, schemas,
and controls. For a component invocation, `mokly-html` reports this warning
during composition, and its message names the component path and the instance
id. Shared schema preparation also normalizes numbers received
through JSON, so JavaScript's decimal spelling keeps its binary64 identity in
the core. Preparation captures explicit control order, schema property order,
or first-seen inferred prop order before it creates canonical lookup maps.
Variants retain that order. Inference exclusions become warnings only after
final path derivation. Runtime failures retain typed terminal categories
across provider boundaries.

A failed semantic definition stays in the preparation pass for path checks
and as a relationship target. Its own body, link, and flow-target checks run
once it is valid. Variant shape checks still run. Props and slots are checked
against a parent only when that parent is valid. Consumer slot checks also
wait for valid component declarations. Shared HTML bodies are checked once,
and their warnings name the parent.

HTML checks cover forbidden and unknown elements, reserved names, slots,
component cycles, template references, and unused props. Saved variant slot
fragments use the same checks as entry bodies, except the forbidden and
unknown element checks. Unknown ignore-wrapper attributes warn once per shared
body and attribute, and their values are ignored. They do not validate
logical links or select component slots. Every consumer of authored-HTML
tokens must call `html_tokens::parse`, which removes these attributes before
validation or link checks. The authored tree parse removes them too. The token
boundary retains the attribute names for warnings and preserves
reserved-navigation evidence and duplicate-attribute errors. Token checks read
each body in the text modes that the HTML tree builder chooses, with scripting
disabled, so the checks and the tree agree on which text is markup.
Typed HTML inputs name each parse purpose. Templates and saved slots create
`AuthoredHtml`, so a caller that holds one of them gets the authored parse.
All other HTML is `DeliveredHtml`. The HTML token boundary returns Mokly-owned
token and span types, and it is the only html5gum user: other code must not
construct an `html5gum::Tokenizer`. `html_driver::drive` runs html5gum under
the html5ever tree builder for any `DriverSink`: the token checks pass a sink
that records tokens, and `mokly-html` passes its tree arena.
Each text token and each attribute value is a `Spanned` with a `SourceMap`.
The map gives the source byte of each decoded byte, and its `span` is the
source interval that the tokenizer consumed for the value. The map anchors at
html5gum's own chunk ends, so Mokly has no second character-reference decoder.
In a chunk that does not align with its source bytes, such as a character
reference, each decoded byte maps to the first source byte of the chunk. The
token's own `span` stays html5gum's compatibility span, and the other checks
keep using it. In a body, catalogue validation maps each `{{...}}` failure
through `Spanned::source_offset` to its own `{{`, also inside an attribute
value, after a character reference, and after CRLF or CR line ends. A saved
slot failure keeps the location of its front matter field.
Composition owns literal attribute coercion, rendered document safety, assets,
and anchors. `SourcePolicy` classifies root matches, reserved basenames, and
inventoried inputs in that precedence order, including physical aliases.
Static input membership uses each root's matcher and the directory-name policy.

YAML front matter follows the
[front matter limits](../../docs/protocol/mokly-front-matter-yaml.md).
`yaml_limits::MAX_DEPTH` and `yaml_limits::MAX_ALIAS_NODES` hold the bounds.
The YAML parser reads flow nesting ahead, so flow nesting deeper than 255
levels fails with the parser's own `html-front-matter` message.

Private JavaScript generation metadata carries the sidecar module digest map.
Static builds compare it with captured sources before document callbacks. It
never enters the public catalogue model. Warnings follow the order and
duplicate rules of the [build warnings contract](../../docs/protocol/mokly-build-warnings.md).

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

Unit tests use unimock at source and description boundaries. Behavior fixtures
use an in-memory source-tree adapter. Integration tests use isolated working
trees for aliases and races. They assert paths, exact diagnostics, source
locations, source protection, aliases, and filesystem races. Consumers enable
the `mock` feature for the public unimock boundaries.
`tests/nesting_depth_tests.rs` re-runs its own test binary to find the deepest
YAML that each path survives on a 2 MiB worker stack. Run it with
`--nocapture` to print the limits, and with `--release` for release builds.

The property test of the source maps over the vendored HTML corpus lives in
[`mokly-html`](../mokly-html/README.md#development) and runs with
`cargo test -p mokly-html --test source_map_corpus_tests`.

### Key Code

- [`src/config.rs`](./src/config.rs) defines `ConfigLoader` and `Loader`,
  which find and load the configuration into a `ResolvedConfig`.
- [`src/config_types.rs`](./src/config_types.rs) defines the authored `Config`
  shape and the `ResolvedConfig` that later stages read.
- [`src/config_paths.rs`](./src/config_paths.rs) confines local inputs and
  gives `ResolvedConfig::repository_path`, the one resolver of
  config-relative paths, with `renderer`, `postcss`, and `package_roots`.
- [`src/discovery.rs`](./src/discovery.rs) defines `Discovery` and
  `Discoverer`, which walk the roots once and return the source `Inventory`.
- [`src/preparation.rs`](./src/preparation.rs) defines `CatalogueBuilder` and
  `Builder`, which prepare one validated `PreparedCatalogue` per pass.
- [`src/definition_provider.rs`](./src/definition_provider.rs) defines
  `DefinitionProvider`, the boundary that describes JavaScript definitions.
- [`src/working_tree.rs`](./src/working_tree.rs) defines `WorkingTree`, the
  working-tree `SourceTree` adapter.
- [`src/protection.rs`](./src/protection.rs) defines `SourcePolicy`, which
  classifies private sources and their physical aliases.
- [`src/html_input.rs`](./src/html_input.rs) defines `AuthoredHtml` and
  `DeliveredHtml`, the typed parse inputs. `Template::html`,
  `Template::located_html`, and `SavedSlot::html` create authored inputs.
- [`src/html_tokens.rs`](./src/html_tokens.rs) provides `parse`, the one token
  boundary for authored and delivered HTML.
- [`src/html_driver.rs`](./src/html_driver.rs) provides `drive` and
  `DriverSink`, which run html5gum under the html5ever tree builder for the
  checks and for the tree.
- [`src/html_driver_emitter.rs`](./src/html_driver_emitter.rs) defines
  `DriverEmitter`, which forwards the html5gum emitter calls to the driver and
  records the source position of each emitted chunk.
- [`src/html_source_map.rs`](./src/html_source_map.rs) defines `SourceMap`,
  which maps each decoded byte of a text token or an attribute value to its
  source byte and holds the value's consumed source interval.
- [`src/numeric_warnings.rs`](./src/numeric_warnings.rs) provides
  `for_invocation`, which reports each unsafe integer in the props of one
  component invocation, with the component path and the instance id.
- [`src/diagnostic.rs`](./src/diagnostic.rs) and
  [`src/error.rs`](./src/error.rs) define the `Code`, `Issue`, and `Warning`
  records and `CatalogueError`. `diagnostic::json_quoted` is the one JSON
  quoting helper for catalogue warning messages, with the escapes of the build
  warnings contract.

### Related Docs

- [Root discovery](../../docs/protocol/mokly-root-discovery.md).
- [Configuration](../../docs/protocol/mokly-configuration.md).
- [HTML screens](../../docs/protocol/mokly-html-screens.md).
- [Front matter YAML](../../docs/protocol/mokly-front-matter-yaml.md).
- [Entry props](../../docs/protocol/mokly-entry-props.md).
- [Component controls](../../docs/protocol/mokly-component-controls.md).
- [Build warnings](../../docs/protocol/mokly-build-warnings.md).
- [Catalogue model and public shapes](../../docs/protocol/mokly-catalogue.md).
- [Rust core architecture](../../docs/architecture/rust-core.md).

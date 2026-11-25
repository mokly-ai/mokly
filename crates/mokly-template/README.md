# mokly-template

`mokly-template` compiles and renders the HTML bodies of Mokly screens,
components, and pages. It turns a body and its props into text for the HTML
parser. Catalogue discovery can use the compile result to check authored
markup and prop references.

## Responsibilities

- Keep one MiniJinja environment with compiled bodies keyed by source identity.
- Prepare the template context from `mokly-model` props and their schema.
- Return source evidence for discovery, rendered HTML, and diagnostics.

## What This Crate Does

Compile a body with `Engine::compile`. The result includes source with template
tags blanked, free references with authored byte ranges, and the declared
top-level props that the expressions read. `FreeName::schema_at` follows
declared property keys. Compilation reports forbidden constructs with their
authored ranges. The caller runs the schema checks and supplies validated
props to `Engine::render`.

The environment uses MiniJinja 3.1.0 with HTML auto-escaping and no template
loader. The `safe` filter and auto-escape control blocks are forbidden.
A missing optional prop acts as an empty value. It remains absent when an
expression reads a child or item. `defined`, `undefined`, and `default`
recognize it. Whole-value expressions can omit HTML attributes or write an
empty attribute. Numbers use Mokly's spelling. A direct print of an array or
map gives a props error.

Each render gets 250,000 fuel units. This budget allows large lists of props
and bounds the work of nested loops. MiniJinja also charges fuel for output
bytes and allocations. The recursion limit is 128 units of MiniJinja runtime
nesting cost. This leaves stack space for the caller and permits 21 consecutive
macro calls on a 2 MiB thread stack in the recursion test.

Output spans refer to byte ranges in the authored body. Literal bytes map
individually. Output from an expression maps to the expression or the
attribute it writes. Output from a macro maps to its call site. Template
errors expose an authored byte offset when a source position is available.

## Quick Start

```rust
use mokly_model::data::{DataValue, Props};
use mokly_model::prop_schema::PropSchema;
use mokly_template::engine::Engine;
use mokly_template::error::TemplateError;

fn greeting() -> Result<String, TemplateError> {
    let mut engine = Engine::new();
    engine.compile("home", "<p>Hello, {{ name }}</p>", &PropSchema::default())?;
    let props = Props::from([("name".into(), DataValue::String("Ada & Lin".into()))]);
    Ok(engine.render("home", &props)?.text)
}

assert_eq!(greeting().unwrap(), "<p>Hello, Ada &amp; Lin</p>");
```

## Development

```bash
cargo test -p mokly-template
cargo clippy -p mokly-template --all-targets -- -D warnings
npm run dependencies:check:rust
```

### Key Code

- [`src/engine.rs`](./src/engine.rs) defines `Engine` and the compile and render entry points.
- [`src/analysis.rs`](./src/analysis.rs) defines the discovery evidence and walks template scopes.
- [`src/lowering.rs`](./src/lowering.rs) rewrites existing prop and attribute forms.
- [`src/rendered.rs`](./src/rendered.rs) defines `RenderedBody` and the output spans.
- [`src/error.rs`](./src/error.rs) defines `TemplateError` and forbidden construct records.

### Related Docs

- [HTML screens and pages](../../docs/protocol/mokly-html-screens.md).
- [Entry props](../../docs/protocol/mokly-entry-props.md).
- [Rust core architecture](../../docs/architecture/rust-core.md).

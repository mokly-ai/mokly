# mokly-html

`mokly-html` composes HTML screens, components, and pages for the Mokly Rust
core. Depend on it for HTML5 trees, template rendering, Markdown documents,
and the JavaScript fragment boundary. `mokly-catalogue` prepares definitions.
`mokly-graph` schedules renders and validates their asset closures.

## Responsibilities

- Parse HTML through a package-owned HTML5 arena and keep owned, thread-safe trees.
- Coerce component attributes with the shared prop schemas.
- Apply substitutions, conditions, viewports, slots, and ignore scopes.
- Attach instance, slot, root, and ignore regions as tree nodes.
- Adapt catalogue controls and rewrite logical links to portable URLs.
- Render Markdown and apply its independent final safety allowlist.

## What This Crate Does

`HtmlComposer` implements `dyn Composer` over a prepared catalogue and an
injected `dyn FragmentRenderer`. Screen and component bodies use one render
path and the [shared template grammar](../../docs/protocol/mokly-html-screens.md#screen-body).
Literal integer component attributes use the same binary64 rounding and
`props-unsafe-integer` warnings as saved props.
Numeric `enum`, `const`, and `oneOf` coercion returns the same rounded values.
Authenticated JavaScript component instances report the same warning for
unsafe integer props, including nested React invocations.
Named slots retain their supplier's props and owner. A repeated slot
has one logical input and multiple physical ranges. A component's own page
has the root range `r-0` and no root marker.

`parse::html` reads HTML through the catalogue's shared HTML driver with
scripting disabled, the same driver that the catalogue checks use. The input type chooses the parse. Catalogue templates and saved slots
give `AuthoredHtml`, and all other HTML is `DeliveredHtml`. Authored parses
remove unknown ignore-wrapper attributes, and a located template also gets
source locations. Delivered parses keep every authored attribute. Composition
re-parses its output as delivered HTML. Usage and comparison use that
browser tree. Split instance, slot, and ignore regions lose their regions.
A re-owned instance with a colliding identity also loses its region. The
`html-foster-parented` warning names the component element and parent; shared
body warnings use the parent entry once across its variants.

Tree conversion, composition, serialization, metadata repair, cloning,
structural equality, debugging, and destruction use explicit work stacks.
A 100,000-level document uses an ordinary caller or worker thread. Prop data
and schemas retain their separate bounded validation contract.
Link-control adaptation keeps one stack of ancestor features. It copies no
ancestor lists or child subtrees while it walks the document.

The serializer preserves the leading newline in `pre`, `textarea`, and
`listing`. `plaintext` consumes the rest of the bytes. It has no synthetic end
tag, and its ancestors have no end tags after it. Parsing applies one extra
browser repair to documents with `plaintext`, including composed content that
already carries private metadata. Formatting clones and later foster-parented
nodes become stable literal text. While plaintext mode is active, serialization
omits private normalization attributes from cloned tags and private markers.
It writes all text raw, including text inside formatting clones and later
nodes, so authored ampersands, markup, and entity spellings stay literal.
Inside HTML `noscript`, raw text instead writes `</noscript` as `&lt;/noscript`,
with case preserved, so scripting-enabled browsers cannot expose its payload.
The shared writer checks adjacent text writes and keeps foreign `noscript`
elements under their ordinary escaping rules.
Serialization and metadata repair share the parser-context state. Foreign
`plaintext` elements keep escaped text unless an HTML integration point or
foreign-content repair puts the element in HTML parsing mode.
End tags close the surviving matching parser ancestor after foreign-content
repair. This keeps later text in the correct mode when a nested tag was popped.
Normalization checks the predicted plaintext start against its reparsed repair
identity in both the full document and the prefix through that start tag.
Later literal text cannot provide a replacement identity. If the parser did
not create an HTML `plaintext` element at the predicted point, normalization
retries with every text node escaped before restoring metadata.
Confirmed plaintext keeps the component's own-page root when it consumes the
trailing repair marker. Root recovery changes no served bytes and keeps Usage
ready. Split instance, slot, and ignore regions retain their existing policy.
Every raw-text tag uses the namespace returned by the parser-context helper.
An HTML tag grafted into foreign content therefore keeps its text escaped.

`tree::Node` has explicit region nodes. Comparison consumes those nodes.
Sidecar style elements carry typed per-rule owner annotations through HTML
reparsing. Assembly retains the original style text and delivery grouping;
comparison reads the separate metadata.
Authored attributes cannot create these trusted records. The public annotation
types have no serde decoding implementation; private comparison codecs own
their in-process mirror records.
`serialize::html` writes instance and slot comments for the inspector.
The authored HTML sink removes ordinary unknown ignore-wrapper attributes when
it creates elements. The delivered sink keeps those attributes until
composition filters them, with the same rule, directly after it parses callback
HTML and before any other step reads them. Callback documents
use the delivered parser, but the browser does not receive the wrapper nodes.
The shared driver gives authored elements their source locations before HTML
table repair. Diagnostic identities do not expose discarded values.
Catalogue preparation reports `html-ignore-attribute` once per shared body
and attribute. Unknown attribute values are not evaluated. Strict builds fail
on these warnings. Reserved navigation names are not unknown attributes:
composition keeps them, as the authored parse does, and reserved navigation
metadata and duplicate-navigation failures retain their existing checks.
Ignore scopes resolve during composition. Ignore and link comments do not
reach the output. Fragment markers require authenticated input and placement records. The
provider returns those records separately from consumer HTML. The core
checks exact payloads, parent relationships, complete consumption, and returned
instance props against each component schema in Rust. A private
adapter-output placement lets the core attach the component root inside
consumer renderer wrappers. Only instance and slot markers reach served bytes.

`markdown::LinkResolver` classifies source-relative links before rendering.
`links::rewrite` returns logical references for cross-view anchor validation
by the graph. The crate performs no direct filesystem access or writes.

## Quick Start

```rust
use mokly_catalogue::html_input::DeliveredHtml;
use mokly_catalogue::template_types::Template;
use mokly_html::{parse, serialize};

let tree = parse::html(DeliveredHtml::fragment("<main><p>Hello &amp; welcome</p></main>"));
assert_eq!(serialize::html(&tree), "<main><p>Hello &amp; welcome</p></main>");

let template = Template {
    source_path: "specs/home.screen.html".into(),
    source: "<main>Hello</main>".into(),
    body: "<main>Hello</main>".into(),
    body_offset: 0,
    page: false,
};
let authored = parse::html(template.located_html());
assert_eq!(serialize::html(&authored), "<main>Hello</main>");
```

## Development

```bash
cargo test -p mokly-html
cargo test -p mokly-graph --test render_tests
cargo clippy -p mokly-html --all-targets -- -D warnings
```

Enable `mock` for the unimock fragment and composer boundaries. Unit tests
mock impure boundaries. Graph integration fixtures exercise complete rendered
document snapshots, assets, and eviction.
The native HTML sweep fixture covers front matter, template spacing, variants,
named and repeated slots, ignore scopes, link controls, and resource closure.
The link-control tests cover the ancestor and descendant placement matrix.

### Key Code

- [`src/composition.rs`](./src/composition.rs) defines `Composer` and
  `HtmlComposer`, which compose a screen, component, or page from a
  `ComposeRequest` into a `Composed` document.
- [`src/fragment.rs`](./src/fragment.rs) defines `FragmentRenderer`, the
  JavaScript fragment boundary, with its `FragmentRequest` and `Fragment`
  records.
- [`src/tree.rs`](./src/tree.rs) defines `Node`, `Element`, and `Region`, the
  owned HTML5 tree with explicit composition regions.
- [`src/parse.rs`](./src/parse.rs) provides `html`, which parses authored or
  delivered HTML through the catalogue's shared driver with scripting disabled.
  The input type chooses the parse.
- [`src/pipeline/runner.rs`](./src/pipeline/runner.rs) runs that driver with
  the tree arena and applies the plaintext repair.
- [`src/html_sink.rs`](./src/html_sink.rs) implements the html5ever
  `TreeSink` and the `DriverSink` hooks for the tree arena.
- [`src/serialize.rs`](./src/serialize.rs) provides `html`, which writes
  deterministic document bytes with the inspector markers.
- [`src/props.rs`](./src/props.rs) provides `coerce`, `substitute`, and
  `validate`, the shared attribute coercion and template substitution.
- [`src/links.rs`](./src/links.rs) provides `rewrite` and `references`, which
  turn logical links into portable URLs and anchor records.
- [`src/controls.rs`](./src/controls.rs) provides `adapt`, which validates and
  adapts link-control roots.
- [`src/markdown.rs`](./src/markdown.rs) defines `LinkResolver` and `render`,
  the Markdown renderer with injected link resolution.
- [`src/safety.rs`](./src/safety.rs) and [`src/url_safety.rs`](./src/url_safety.rs)
  hold the final Markdown allowlist and the URL policy of composed documents.
- [`src/error.rs`](./src/error.rs) defines `HtmlError`, the typed composition
  failure with its authoring diagnostics.

### Related Docs

- [HTML screens](../../docs/protocol/mokly-html-screens.md).
- [HTML components](../../docs/protocol/mokly-html-components.md).
- [Markdown documents](../../docs/protocol/mokly-documents.md).
- [Link controls](../../docs/protocol/mokly-link-controls.md).
- [Comparison tree](../../docs/protocol/mokly-comparison.md).
- [Document safety](../../docs/protocol/mokly-document-safety.md).
- [Rust core architecture](../../docs/architecture/rust-core.md).

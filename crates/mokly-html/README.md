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

The authored parser and delivered-document parser use one token-driven HTML5
pipeline with scripting disabled. Authored parses remove unknown ignore-wrapper attributes and attach
source locations. Delivered parses keep every authored attribute. Composition
re-parses its output with the delivered parser. Usage and comparison use that
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
it creates elements. The delivered sink keeps those attributes so resource
closure and callback documents see the same bytes as the browser. The token
pipeline gives authored elements their source locations before HTML table
repair. Diagnostic identities do not expose discarded values.
Catalogue preparation reports `html-ignore-attribute` once per shared body
and attribute. Their values are not evaluated. Strict builds fail on these
warnings. Reserved navigation metadata and duplicate-navigation failures
retain their existing checks.
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
use mokly_html::{parse, serialize};

let tree = parse::delivered_fragment("<main><p>Hello &amp; welcome</p></main>");
assert_eq!(serialize::html(&tree), "<main><p>Hello &amp; welcome</p></main>");

let authored = parse::authored_fragment("<main>Hello</main>", "screen.html");
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
The link-control tests retain the former ancestor and descendant tier matrix.

### Key Code

- [Annotated tree](./src/tree.rs), [authored and delivered parsers](./src/parse.rs),
  the [token pipeline](./src/pipeline/mod.rs), and [tree sink](./src/html_sink.rs).
- [Text context](./src/text_mode.rs) and [serialization](./src/serialize.rs)
  share plaintext activation. The [noscript guard](./src/noscript_text.rs)
  escapes raw HTML `noscript` closing text.
- [Composition](./src/composition.rs), [props](./src/props.rs), and [slots](./src/slots.rs).
- [Fragment boundary](./src/fragment.rs) and [marker validation](./src/markers.rs).
- [Links](./src/links.rs), [controls](./src/controls.rs), and [Markdown safety](./src/safety.rs).

### Related Docs

- [HTML screens](../../docs/protocol/mokly-html-screens.md).
- [HTML components](../../docs/protocol/mokly-html-components.md).
- [Comparison tree](../../docs/protocol/mokly-comparison.md).
- [Document safety](../../docs/protocol/mokly-document-safety.md).

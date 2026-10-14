# Final Logical Link Validation

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

The [navigation contract](./mokly-navigation.md) owns logical links, markers
and Browse behaviour. Serve, `build`, and on-demand rendering apply the same
final checks to every composed document before it enters the render cache,
and both sides of a comparison pass them.

## Reference Records

After link-control adaptation and logical-link rewriting, the core keeps each
reference's source route, target entry path and optional fragment. It indexes
anchors from the composed documents of the destination: every view of a
screen, or the one document of a page or document entry. Each fragment is
checked across every required destination view under the cross-view rule of
the navigation contract. A missing or renamed anchor fails `build-invalid`
with the referring route. A target that names no entry fails under the
[path diagnostics](./mokly-paths.md#diagnostics), naming the new path when the
[move contract](./mokly-moves.md) knows it.

## Document Checks

An authored reserved marker and a duplicate navigation attribute fail
validation. A document with an activatable logical link cannot contain
`<base href>`; `<base target>` is supported. Markers never grant source or
resource access: a rewritten target is a document route of the
[shell delivery contract](./mokly-shell-delivery.md#routes) or a file of the
checked [public closure](./mokly-public-closure.md), and nothing else.

No consumer transformer runs between rewriting and final validation. Pages
supply complete documents, from a `.page.html` file or through the sidecar's
`renderPage`; the core assembles screen and component documents from the
HTML bodies and the fragments the sidecar returns for React entries. A composed
document carries the `data-mokly-link` marker attribute of an activatable link
and no comment marker. [Markdown documents](./mokly-documents.md) also pass
the element, attribute and URL allowlist of
[Document Rendering Safety](./mokly-document-safety.md) after link rewriting;
that check keeps the owned document template and rejects unsafe body markup.

A base commit whose documents fail these checks makes Changes unavailable with
those diagnostics under the [comparison contract](./mokly-comparison.md#sides).

# Final Logical Link Validation

The [navigation contract](./mokly-navigation.md) owns logical links and Browse
behaviour, and the [composition contract](./mokly-logical-links.md) owns the
markers. Serve, `build`, and on-demand rendering apply the same final checks
to every composed document before it is served or written, and both sides of
a comparison pass them.

## Reference Records

The checks run on the documents after link-control adaptation and logical-link
rewriting. A logical reference's fragment must name an anchor in every
required destination view: every view of a screen, or the one document of a
page or document entry, under the cross-view rule of the
[logical link contract](./mokly-navigation.md#fragments). A missing or
renamed anchor fails `build-invalid` with the referring route. A target that names no entry fails under the
[path diagnostics](./mokly-paths.md#diagnostics), naming the new path when the
[move contract](./mokly-moves.md) knows it.

## Document Checks

An authored reserved marker and a duplicate navigation attribute fail
validation. Callback output, the HTML that a JavaScript render returns, fails
on every duplicate attribute on one element, although HTML parsing would keep
only the first value. A document with an activatable logical link cannot contain
`<base href>`; `<base target>` is supported. Markers never grant source or
resource access: a rewritten target is a document route of the
[shell delivery contract](./mokly-shell-delivery.md#routes) or a file of the
checked [public closure](./mokly-public-closure.md), and nothing else.

No consumer transformer runs between rewriting and final validation. Pages
supply complete documents, from a `.page.html` file or through the sidecar's
`renderPage`; the core assembles screen and component documents from the
HTML bodies and the fragments the sidecar returns for React entries. A composed
document carries the `data-mokly-link` marker attribute of an activatable link
and the instance and slot comment markers of the comparison contract.
[Markdown documents](./mokly-documents.md) also pass
the element, attribute and URL allowlist of
[Document Rendering Safety](./mokly-document-safety.md) after link rewriting;
that check keeps the owned document template and rejects unsafe body markup.

A base commit whose documents fail these checks makes Changes unavailable with
those diagnostics under the [comparison contract](./mokly-comparison.md#sides).

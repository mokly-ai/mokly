# Logical Link Transformer Validation

## Delivery Status

Implemented by the
[in-frame navigation plan](../../plans/in-frame-catalogue-link-navigation.md).
This document owns the build-time check that a compatibility transformer
preserves every logical catalogue link and ownership header; the
[catalogue navigation contract](./mokly-navigation.md) owns the links, markers,
and Browse behavior it protects, and the
[document contract](./mokly-documents.md) adds Markdown documents to the
documents it covers.

## Record Multiset

Before invoking a compatibility transformer, the builder records a multiset of
complete logical-reference records: expected marker presence and value, the
native-link class (`html-a`, `html-area`, `svg-a`, or metadata-only), which of
`href` and `data-nav-href` carried the logical destination, and each such
attribute's resolved portable value. It reparses the transformed document and
requires the same multiset. Adding or removing a marker, preserving a marker
while changing its portable destination, element kind, or namespace, changing
a metadata-only reference into an activatable link, or moving logical identity
between navigation attributes fails the build. Unrelated attributes remain
consumer-owned. Duplicate reserved attributes are detected from the raw start
tag rather than the parser-normalized attribute map, so a transformer cannot
hide a second marker or target through HTML's first-attribute-wins parsing. A
transformer that adds `<base href>` to a document retaining an activatable
record also fails the build. After every document has been transformed, the
builder indexes anchors from the final documents and repeats cross-view
fragment validation for every retained logical-reference record. A transformer
that removes or renames an anchor in any destination viewport or scheme
therefore fails the build even when the source link record itself is unchanged.
The builder also requires every transformed screen fragment, page, and
Markdown document to retain a generated ownership header that decodes to its
expected source path. The versioned header encodes that identity with canonical
base64 so no source filename can alter HTML comment parsing. Header parsing
accepts LF and CRLF line endings. Final transformed output must retain the
[current encoded form](./mokly-rendering-generated.md#ownership); earlier headers
prove no ownership. A missing, malformed, downgraded or changed source identity
fails before any output is written.

## Related Docs

- [Catalogue navigation contract](./mokly-navigation.md)
- [Markdown documents](./mokly-documents.md)
- [Rendering and generated output](./mokly-rendering.md)

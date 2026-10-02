# Page Source Provenance

## Delivery Status

Implemented by [M7 page analysis](./mokly-page-analysis.md). Adopted attributes
and formatting-clone rules clarify its existing complete-inventory requirement;
they are documentation-gap clarifications, not new behavior or permission to
parse rewritten view materials.

## Reference Inventory

Records retain the extractor's decoded raw value **before route resolution**,
its kind, complete containing attribute/style-text span, and source spelling.
Keep original extraction visibility: inert template descendants are inventoried
for copies but do not seed the original document. Several records may share
one attribute/text span. Entity spellings and resolved paths are not raw values.
Spans are half-open UTF-16 offsets into the original text.

Cover everything `extractHtmlReferences` reads:

- `id` anchors on any element; navigation `href` unless it is a resource
  source attribute; `data-nav-href` on any element.
- Resource attributes: `src` on audio, embed, iframe, img, input, script,
  source and track; `href`/`xlink:href` on any element named `image` or `use`,
  regardless of namespace; link `href`; object `data`; video `poster` and `src`.
- `srcset` on any element, one raw URL per candidate, using the delivered
  comma/descriptor tokenizer, including trailing-comma removal.
- `style` attributes, one record per tokenized CSS reference.
- Style-element text, including non-eligible elements ordinary discovery reads,
  one record per URL/import reference. Across split text nodes, the shared span
  starts at the first contributing text node and ends at the last. Ignored
  intersection with a later part drops the whole record, not only that URL.

Preserve `resourceHints`: preload, modulepreload, prefetch, preconnect and
dns-prefetch may be disabled unless the link also has `stylesheet`. Preserve
traversal/namespaces and inert templates. The inventory never fabricates values
from arbitrary strings resembling attributes. CSS lexing and route-relative
transitive resolution remain with the shared detector and resource readers.

## Parser-supplied Provenance

Never drop an extracted visible value because its element/attribute lacks a
parse5 location. A later `html` or `body` start tag may supply attributes adopted
onto an existing explicit or implied root. Those attribute records use the
complete source attribute span of the supplying start tag, not the root's old
tag or a lookalike in a comment, attribute, inert template, ignored body token
inside `select`, raw/RCDATA text, or foreign CDATA. Detect missing provenance first; rare
targeted location-aware tokenization of candidate original start tags is
allowed. It creates no second tree or rewritten-material parse and leaves
native attribute spans unchanged.

Adoption-agency/reconstructed formatting clones inherit the original element's
attribute records and source provenance, even when the original node leaves
the final tree. Record token/original identity during the one default-tree
parse; do not infer a clone's origin from its first descendant. They also use
the original element's subject status under
[original-page matching](./mokly-page-analysis.md#original-page-matching).
Apply these rules to page analyses and original embedded-resource reader trees.

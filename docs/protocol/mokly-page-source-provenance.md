# Page Source Provenance

## Delivery Status

Implemented by [M7 page analysis](./mokly-page-analysis.md). Adopted attributes
and formatting-clone rules clarify its existing complete-inventory requirement;
they are documentation-gap clarifications, not new behavior or permission to
parse rewritten view materials. The second supervisor round clarifies direct
token capture and creation offsets under the same rules, not new behavior.

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
tag or a lookalike in an end-tag/ignored-start-tag/adopted-tag attribute, doctype,
comment, inert HTML template, raw/RCDATA text or foreign CDATA. HTML `select`
discards `body` tags but may adopt `html` attributes. SVG/MathML elements named
`template` or `select` do not block real tags at HTML integration points.

Capture provenance from the parser's own tokens during its one parse. Record
each start token's attribute-array identity, start offset and complete decoded
attribute spans before the tree builder processes it. The adapter's attribute
adoption uses that supplying token's own array; no text search or subsequent
tokenization may guess a donor. Store only positions/identities, not token text.

Adoption-agency/reconstructed formatting clones inherit the original element's
attribute records and source provenance, even when the original node leaves
the final tree. Record token/original identity during the one default-tree
parse; do not infer a clone's origin from its first descendant. Clones use the
original element's subject status under
[original-page matching](./mokly-page-analysis.md#original-page-matching).
Elements created without a start token record the creating token's start offset,
including fake `p` from `</p>` and `br` from `</br>`;
[original-page matching](./mokly-page-analysis.md#original-page-matching) owns their status.
Apply these rules to page analyses and original embedded-resource reader trees.

Trees without provenance registration fail with a typed internal review
diagnostic, never a guessed span or silent reference drop. The implementation
uses parse5 8.0.1's exported, internal `Parser` subclass/token callbacks and the
default adapter; it does not patch the tokenizer or change recovery behavior.
Guard parser upgrades with the whole extractor-equivalence corpus through this
production boundary, requiring exact provenance for every visible value,
adopted attribute and parser-created subject. The corpus checks each record's
attribute name/decoded producer value or full contributing style-text spelling,
every source-less element's creation offset, and located originals for shared-
token clones. A separate clone-identity case pins the exact original object.
Validate source-less creation and clone provenance once per registered document
in the existing reference traversal during analysis construction, before any
selector query: failures raise typed diagnostics and cannot become unresolved
matching results. Successful repeat inventories reuse that validation.
The single-parse counting
test intercepts both parse5 `parse` and `Parser.parse` entrypoints.

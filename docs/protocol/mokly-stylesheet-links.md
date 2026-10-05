# Stylesheet Link Discovery

## Delivery Status

The shared finder, configured-only anchors, body-link reuse and inserted-link
Review-ignore exception are implemented in
[M28](../../plans/remove-source-path-evidence.md#milestone-28-fix-component-stylesheet-links).

## Shared Finder

Placement, renderer-link reuse, final-link provenance and resource discovery
use one shared HTML link finder. Parse HTML with source locations and scripting
enabled. Return actual link elements in document order, with their decoded
attributes, logical head/body location and original UTF-16 spans. Do not use
separate regular-expression or head-only scans for the same link decision.
Comments and text that resemble tags are not elements. With scripting enabled,
`noscript` text does not supply links. Content inside `<template>` is inert:
it supplies no placement anchor, reused link, inserted-link span or resource
starting point. Do not descend into its content when finding active links.

A stylesheet link has an ASCII-case-insensitive `stylesheet` token in its
ASCII-whitespace-delimited `rel` value. Other tokens, such as `alternate`, do
not disqualify it. Resolve local hrefs relative to the document route. Apply
the existing public-file confinement and alias checks. Query and fragment
suffixes stay in HTML but do not change the public resource path or real-file
identity. Resource hints alone do not load a stylesheet for Changes.

## Scope At Each Step

| Step                | Document and scope                                                                                                                                                                                                                                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Placement anchors   | Renderer output before insertion and compatibility transformation. Only active stylesheet links in the logical head whose hrefs match configured hrefs qualify. Review-ignore markers do not change placement. Generated renderer/entry links never qualify merely because the renderer receives them. |
| Renderer-link reuse | The same renderer output, across the active head and body, before Review-ignore normalization. Reuse every link to a declared real file that resource discovery can find. Do not move, remove or duplicate it.                                                                                         |
| Provenance          | Final output after compatibility transformation, across the active head and body, before Review-ignore normalization. Only retained, valid transient tokens on active stylesheet links produce inserted-link spans.                                                                                    |
| Resource discovery  | Final output across the active head and body. Build, delivery and watch use the actual linked document. Review applies paired Review-ignore to authored content, then also includes the links proved by final-document `insertedStylesheets` spans.                                                    |

The [placement contract](./mokly-component-stylesheets.md#document-linking)
owns the nearest configured link, tie, repeated href and logical-head fallback
rules. The [renderer contract](./mokly-rendering.md#renderer-stylesheets) owns
the complete input list. These lists serve different purposes.

For reuse, a declared file linked in the body prevents another Mokly link in
the head. A link only inside a template does not prevent insertion. When
several authored links name one real file, keep all of them and insert none.
Prefer the first present href in configured order when choosing its public
alias; otherwise use the first document occurrence. Reuse gives no provenance
span and does not exempt the author's link from Review-ignore.

## Token Validation

The [provenance contract](./mokly-component-stylesheet-ownership.md#provenance-and-comparison-material)
owns issued-token identity, original real-file matching, offset rebasing and
the root-component exception. Validate reserved attributes across all parsed
elements, including template content. Renderer-authored attributes, unknown
tokens, duplicate tokens, tokens on non-stylesheet elements and reassignment
to another real file still fail. This attribute validation is distinct from
finding active links and must not make inert content a resource.

If a transformer moves a valid marked link into a template, remove its token
but record no span. If it removes the active link and leaves only an unmarked
template link, that file has no active resource starting point. A retained
active body link keeps its provenance. Strip validated transient attributes
from final HTML, including inert content, without reserializing other bytes.

## Review Resource And Rule Scope

On each comparison side, validate recorded spans against the original final
HTML before removing links or normalizing ignored regions. Read the inserted
links from those spans even if paired Review-ignore surrounds them. Combine
them with non-ignored authored resource references by the usual resource
identity rules. Follow CSS imports and referenced public resources normally.
Do not infer extra starting points from declarations or from matching href text.

Use this same resource set for complete comparison, the unchanged-view fast
path and CSS rule analysis. An edit to inserted CSS can therefore change its
component and affect consumers even when its head anchor was ignored. Selector
matching still uses the Review-ignore-normalized document: the exception does
not restore ignored authored markup, styles or links. Page material separately
removes the recorded links under the provenance contract. Template content and
unmarked replacements receive no exception. Complete and selected artifacts
retain the same private spans until snapshot-resource validation finishes.
This proof is not written into public comparison JSON or snapshot files.

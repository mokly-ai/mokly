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
the [shared public-file policy](./mokly-public-closure.md#one-policy-per-compilation).
A symbolic link at any public path component is invalid, including a renderer
link to declared CSS. Query and fragment
suffixes stay in HTML but do not change the public resource path or real-file
identity. Resource hints alone do not load a stylesheet for Changes.

## Scope At Each Step

| Step                | Document and scope                                                                                                                                                                                                                                                                                    |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Placement anchors   | Renderer output before insertion and ordinary package link edits. Only active stylesheet links in the logical head whose hrefs match configured hrefs qualify. Review-ignore markers do not change placement. Generated renderer/entry links never qualify merely because the renderer receives them. |
| Renderer-link reuse | The same renderer output, across the active head and body, before Review-ignore normalization. Reuse every link to a declared real file that resource discovery can find. Do not move, remove or duplicate it.                                                                                        |
| Provenance          | Final output after ordinary package link edits, across the active head and body, before Review-ignore normalization. Only links issued by the insertion pass produce recorded full-link spans.                                                                                                        |
| Resource discovery  | Final output across the active head and body. Build, delivery and watch use the actual linked document. Review applies paired Review-ignore to authored content, then also includes the links proved by final-document `insertedStylesheets` spans.                                                   |

The [placement contract](./mokly-component-stylesheets.md#document-linking)
owns the nearest configured link, tie, repeated href and logical-head fallback
rules. The [renderer contract](./mokly-rendering.md#renderer-stylesheets) owns
the complete input list. These lists serve different purposes.

For reuse, a declared file linked in the body prevents another Mokly link in
the head. A link only inside a template does not prevent insertion. When
several authored links name one real file, keep all of them and insert none.
Prefer the first valid present href in configured order; otherwise use the
first valid document occurrence. Reuse gives no provenance
span and does not exempt the author's link from Review-ignore.

## Final Inserted Links

The [provenance contract](./mokly-component-stylesheet-ownership.md#provenance-and-comparison-material)
owns real-file matching, final full-link spans, offset rebasing and the
root-component exception. No transient token is used. Match issued insertions
against active final links. Inert template content supplies no span or resource
starting point. A reused active renderer link remains authored content.

## Review Resource And Rule Scope

On each comparison side, validate recorded spans against the original final
HTML before removing links or normalizing ignored regions. Read the inserted
links from those spans even if paired Review-ignore surrounds them. Resolve
each side's links against that side's original document route, including for
moved entries. A current route must not replace the baseline route. Combine
them with non-ignored authored resource references by the usual resource
identity rules. Follow CSS imports and referenced public resources normally.
Do not infer extra starting points from declarations or from matching href text.

Use this same resource set for complete comparison, the unchanged-view fast
path and CSS rule analysis. An edit to inserted CSS can therefore change its
component and affect consumers even when its head anchor was ignored. Selector
matching uses original trees and ranges, with ignored subjects excluded.
Ignored nodes remain structural selector context; their resource references
stay ignored unless a validated inserted span supplies the resource. Page material separately
removes the recorded links under the provenance contract. Template content and
reused renderer links receive no exception. Complete and selected artifacts
retain the same private spans until snapshot-resource validation finishes.
This proof is not written into public comparison JSON or snapshot files.

# Static Export Browser And Identity

This document supplements [Static Export Delivery](./mokly-export-delivery.md)
with the standalone browser inventory and deployment identity algorithm.

## Browser Modules

The standalone browser inventory under `mokly-viewer/client/` is the hydrated shell:
the documented standalone hydration entry, which bundles React and React DOM
with the shell tree, plus the transport, geometry and protocol modules it
imports (frame adapters, message transport, geometry, catalogue revision
adoption). Export delivers the viewer-owned inventory from the generated manifest
of the completed package build outputs; Serve also delivers the CLI-owned live
host modules. Each manifest must match its directory files exactly. Static mode
never activates live host capabilities or starts update requests. Its separate
static evidence reader can issue only the same-origin destination-shell read
defined by the delivery contract and receives no host token or behavior.
`navigation-resize.js` retains its delivery name as the pre-hydration script
that synchronously captures early native disclosure choices without mutating
React-owned DOM. The hydrated shell reads those choices for its initial render
so they win over stored preferences and the reload snapshot; capture listeners
and transient out-of-tree state are removed on load or page exit. The inspector
remains `client/inspector.js`, React-free, at the 9,216-byte cap; it runs inside
consumer documents and shares nothing with the shell bundle.

The removed-content request lifecycle is part of `react-shell.js`; it reuses the
same typed review and removed-page validators as the rest of the viewer. Static
requests are limited to preview descriptors in the accepted public catalogue
and the selected preview or pane documents beneath that advertised generation's
permitted snapshot sides; live requests use the selected on-demand route and
its resulting generation. There is no parallel vanilla Browse or preview runtime.

The Node-only server renderer and the embedding-only scoped stylesheet are
excluded from the standalone browser inventory. Standalone `shell.css` and font
bytes are unchanged by hydration. Module changes alter deployment identity as
required below, so the transition to the hydrated shell changes the identity
of every export exactly once. An export from a changed workspace also records
its new `changedPaths` in `review.json`, which changes that generation's hash;
snapshot and comparison resource bytes remain unchanged. The
[React Browse shell plan](../../plans/react-browse-shell.md) records the runtime
replacement and its compatibility checks.

## Deployment Identity

Comparison generations identify only their comparison JSON and snapshot
inventory. The separate `deploymentId` identifies every alias-to-file mapping
and every installed file except the ownership marker and publication metadata
paths explicitly declared by the provider adapter. Identity-participating files
include shell pages, navigation metadata, public files, CSS,
client/navigation modules, fonts and ordinary provider files. Publish declares
only `mokly-upload.json` as publication metadata.

The marker is excluded because it is derived from finalized paths and bytes.
Publication metadata is excluded because commit, branch and export-time fields
describe delivery rather than browser content. Both remain owned files and are
hashed by the marker. Changing only publication metadata can therefore change
the marker without changing `deploymentId`; unchanged identity-participating
content and aliases retain the same identity independently of insertion order
or output directory.

Finalize identity after the provider adapter, its publication-metadata
declaration and the complete non-marker inventory are fixed. Only exporter-owned
shell roots may carry the stamped descriptor. Require every such shell page to
retain its original canonical path, comparison URL, and one valid root
descriptor; adapters cannot remove or rewrite that contract. Normalize each
owned root descriptor to its canonical JSON serialization with `deploymentId`
set to 64 zeroes. Hash each resulting file's exact bytes, sort the
`[path, contentHash]` pairs by JavaScript string order, sort alias pairs by alias
path, and SHA-256 the JSON encoding of `[filePairs, aliasPairs]`.

Do not normalize lookalike metadata inside consumer documents, scripts, or
other non-shell files. Their bytes participate unchanged unless their exact
path was declared as publication metadata, except for the explicitly owned
catalogue field below.

Finalization includes the exporter-owned `mokly-viewer/catalogue.json`: canonicalize
its JSON with only its top-level `deploymentId` set to 64 zeroes for the file
hash, then stamp the same resulting artifact identity there and in every owned
shell descriptor. Its other bytes, the inspector script and inert per-document
maps participate normally. Validate the catalogue's owned identity field before
finalization and replace its staging placeholder before installation. This
prevents self-reference without changing delivery descriptor v4, ownership v3,
upload v2 or review result v4.

Stamp the resulting identity into those owned root descriptors and the owned
catalogue field, changing no other non-marker bytes. Then compute the ownership
entries from the exact finalized bytes and add the marker through the same
collision-checked inventory. No adapter, publication-metadata declaration or
non-marker byte may change after identity finalization. Every owned root's
staging placeholder is replaced before the marker is built and before
installation. This avoids identity and marker self-reference: the identity
determines finalized browser content, while the marker is a pure function of
all final paths and bytes, including publication metadata. The comparison
generation keeps its separate URL/hash.

In-shell navigation requires both deployment identity and comparison URL to
match; otherwise it performs a full document load before adopting any new view.
Old descriptor versions also trigger that fallback. Within one deployment,
ordinary in-shell navigation and browser state preservation remain unchanged.

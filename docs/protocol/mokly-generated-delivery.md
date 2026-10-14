# Identity-Derived Document Delivery

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

## Routes And Layout Signal

Entry identity is its path under [paths](./mokly-paths.md). Every document
and resource route derives from it under the
[artifact path contract](./mokly-artifact-paths.md), which owns the layout;
this page states only what readers and frames derive from it. The catalogue
index and the entry details carry paths and view axes and no route,
`documentPath`, `fragmentPath`, or layout-prefix field. A reader derives
every current URL from the path and the fixed `static/mokly-generated/`
namespace through the shared functions; disk existence, host settings, and
payload metadata select no other layout. A reader rejects another
`schemaVersion` before it derives a URL, under the
[format inventory](./mokly-format-versions.md).

## Public Paths And References

The current document URL is `/static/mokly-generated/<route>`; `build`
writes it at `static/mokly-generated/<route>`. Bundled stylesheets and
assets use the same prefix with their resource routes. Authored closure
resources live under `static/<repository-relative path>`. Shell frames,
component stages, geometry, inspection, and navigation derive paths from the
same shared functions and construct no second route map: validated segments
are encoded once, a query and a fragment are kept under the
[navigation contract](./mokly-navigation.md), and an artifact-relative path
resolves at the source origin root, not at the JSON directory or an
embedding application's URL.

Comparison snapshots and removed previews resolve from the immutable
`mokly-viewer/diffs/generations/<generation>/review.json` that the index's
`comparisonUrl` names. Their generation-local `snapshots/before/` and
`snapshots/after/` paths are identity-derived, are not current `/static/`
paths, and never acquire another prefix. Transient component renders keep
the `mokly-viewer/components/renders/` capability of the
[component controls contract](./mokly-component-controls.md). The static
output contains none of the live endpoints.

## Frames And Reverse Mapping

The shell derives the mounted entry or view URL through the shared functions
and keeps the origin, pathname, encoding, traversal, and authentication
checks of the [frame adapter](./mokly-frame-adapter.md). An adapter
validates a current document's path under `/static/mokly-generated/`, strips
that fixed prefix once, and resolves the logical route through the path
functions; it keeps a valid fragment separately. Authored closure URLs are
resources, not entry routes. Historical snapshots and transient renders use
their own adapters. A provider-normalized extensionless URL identifies the
same derived document through `providerNormalizedHtmlPath`. No absent field
permits another layout.

# Shell Destination Queries

## Delivery Status

Implemented in Serve, export, and embedded hosts. This contract holds the
destination query rules that the
[navigation contract](./mokly-navigation.md#active-catalogue-visibility)
applies after every route change.

## View Axes

Shell destinations may explicitly request `viewport=mobile|desktop|both` and
`scheme=light|dark`. The parser treats the axes independently and recognizes an
axis only when exactly one supported value is present. A valid value applies in
the same atomic route or controlled-selection update while an omitted, invalid,
or repeated axis retains its sticky selection. This also applies when only an
axis changes on the current destination. In Changes, at least one valid
explicit axis suppresses first-changed-view landing; invalid or repeated values
do not. Embedded and standalone shells use this one parser, so controlled hosts
receive the complete proposal and commit nothing until they supply it back.

## Removed-Entry Snapshots

A removed-entry destination also carries its public `snapshot` identity. Route
parsing accepts exactly one lowercase 64-hex value and requires it to match that
removed entry's path. The query survives same-entry axis and filter changes,
Back/Forward and hydration. Unknown, stale, repeated, or mismatched snapshots
are unavailable through the Viewer error state rather than retargeted.
Snapshot queries are supported only on the removed entry's canonical
`/view/<path>/` URL or the other accepted forms of the
[path contract](./mokly-paths.md#urls). Without the query, a path-only removed
selection normalizes to its published identity when present.

## Related Docs

- [Catalogue navigation](./mokly-navigation.md)
- [Paths, roots, and identity](./mokly-paths.md)
- [Changes and screen comparisons](./mokly-changes.md)
- [Removed content previews](./mokly-removed-previews.md)

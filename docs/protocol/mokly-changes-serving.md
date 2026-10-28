# Changes Serving And Comparison

Continuation of [Changes And Screen Comparisons](./mokly-changes.md).

## Generation and serving

The [comparison serving contract](./mokly-comparison-serving.md) owns the
comparison routes under `mokly-viewer/diffs/` that the
[shell delivery contract](./mokly-shell-delivery.md#routes) lists: generation
lifetimes, on-demand requests in Serve, and the generation that `build`
writes.

## Design references

`design/changes/*` and the stacked [component designs](./mokly-component-design.md)
depict this behaviour. The [pane](./mokly-comparison-panes.md#design-references)
and [shell](./mokly-shell-design.md) contracts own each state.

## Comparison engine

One engine serves Serve's background classification, the on-demand comparison
of a selected entry, and the complete comparison that `build` and `publish`
write. It is the [comparison contract](./mokly-comparison.md). The base is the
merge base of `HEAD` and the configured `review.base`, which defaults to
`origin/main`; `--base` on `serve`, `build`, and `publish` overrides it. The
head side renders from the working tree and the base side from the base
commit's Git tree through the same render graph, with the current Mokly
version on both sides, under [Sides](./mokly-comparison.md#sides). Commits
reachable only from the base ref do not enter the comparison. No command
checks the base commit out over the working tree, and nothing is written into
the repository.

The engine compares every view of every entry, regardless of source edits,
because a changed component, stylesheet, or resource reaches views
whose own sources did not change. Git blob and tree reads are bounded in count
and bytes, and a file's mode is checked before its blob is accepted, so a
symlink or a non-regular file is rejected. A read that cannot complete makes
Changes unavailable with its diagnostic.

Entry pairing, view pairing, and view states follow
[Changes and screen comparisons](./mokly-changes.md#entries-and-views). The
output directory of `build`, with its symlink-resolved in-repository target,
is excluded from source capture and resource comparison, so a build never affects
its own Changes.

A complete comparison is one generation: the entry detail v3 of every
removed entry, the removed previews, and the snapshots of both sides with
their transitive resources. The review result v8 of the
[comparison contract](./mokly-comparison.md#review-result-v8-and-snapshot-v4)
stays in memory, and the index and the entry details carry its public facts.
No HTML report, no summary file, and no navigation payload is written; the terminal reports the counts and the
diagnostics. The [catalogue change contract](./mokly-catalogue-changes.md#changes-count)
defines the Changes count; the terminal reports it with the moved count and
the ignored-only diagnostic count beside it.

Base and head panes live under separate snapshot roots named by
`snapshotViewPath` in the [artifact path contract](./mokly-artifact-paths.md),
with `previousPath` for the before side of a paired entry. A side that a
view's state lacks has no document: `added` has no before side, and `removed`
has no after side. Local resources that a pane's HTML or CSS references are
copied transitively, binary fonts and images included; explicit HTTP(S) and
`data:` resources stay external. Snapshot bytes are the composed documents of
each side, byte for byte, even when ignore normalization changes a
classification. No timestamp and no absolute path enters the JSON. The
[review validation contract](./mokly-component-review-validation.md) owns
every array order of the result and the details' evidence.

## Resource URL Classification

HTTP(S) and `data:` resource URLs are external. CSS protocol-relative `//`
URLs are external too: they stay unchanged and are never fetched or
inventoried. HTML protocol-relative URLs, root-absolute URLs, and other
unsupported schemes are not portable in an isolated snapshot; they fail the
comparison instead of being omitted silently. The static build and the
removed previews use the same classification. Every current resource and
every base pane dependency must be a regular public file, never a protected
authoring input. Pane bytes stay unchanged in the generation; the viewer's
script-disabled [presentation](./mokly-comparison-panes.md#presentation)
applies only in memory.

## Review Ignore

A Review-ignore region marks repeated shell chrome: `ReviewIgnore` in a React
render, `<mokly-ignore>` in an HTML body, under the
[markers](./mokly-comparison.md#markers) of the comparison contract. Its id is
plain lowercase kebab-case and may equal a Windows device name, because only
path segments carry that restriction. The id is unique per document and
stable across renders of the same inputs; two regions with one id in one
document fail closed with the entry and view named, as does a start marker
without its end. Regions pair by id across the sides. A region whose id exists
on one side only is ordinary content and compares as such. The region adds no
layout wrapper; its markers are comments.

Stateful repeated chrome supplies a deterministic material key derived from
the complete typed props used to render it. The key stays outside the ignored
content and inside classification: a changed key on a paired region is a
material change.

Ignoring changes classification only. Snapshots and comparison panes keep the
real content. Each view records its paired ignored ids in `ignoredIds`, and a
view whose only differences lie inside paired ignored regions is
`ignored-only`. Primary screen content must never be ignored.

## Screen controls

Screen controls follow the [controls contract](./mokly-changes-controls.md).

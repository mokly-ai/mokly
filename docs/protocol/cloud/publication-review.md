# Publication Index And Changes

This is the catalogue index sub-contract of
[upload validation](./publication-upload-validation.md). The published 0.19.0
`mokly-catalogue.md`, `mokly-catalogue-changes.md`,
`mokly-catalogue-serialization.md`, `mokly-moves.md` and `mokly-shell-delivery.md`
own the index format, together with the generated declarations of
`@mokly/viewer`. The receiver reads the catalogue index
`mokly-viewer/index.json` that the Plan archive carries. It
parses no entry detail, no deployment file and no comparison file.
No review file exists, because Mokly keeps its review result in memory.
The
[validation quotas](./publication-upload-validation.md#plan-archive-and-limits)
and the JSON preflight apply to the index.

The plan stores the index bytes. Completion, check delivery,
rerequests and the screens list read that stored index, so each of them reads
the same Changes.

## Versions And Entry Paths

Probe `schemaVersion` before any other field. Accept the integer 9 only.
Any present value other than the integer 9, including 8 or the
string `"9"`, returns HTTP 426 `upload-unsupported-version`. The
internal error records the index artifact kind, and the response uses the
fixed [REST copy](./rest-api-surface.md#implemented-surface). A
missing version and a malformed body return 400 `upload-invalid-bundle`.
Quota excess returns 413 `upload-too-large`.

An entry path has one or more `/`-joined segments. Each segment matches
`^[A-Za-z0-9_-]+$`. Preserve authored case. Reject empty, leading or trailing
segments, dots, spaces, escapes and separators inside a segment. Reject
Windows device names without case sensitivity: `aux`, `con`, `nul`, `prn`,
`com1`–`com9` and `lpt1`–`lpt9`. The first segment cannot equal
`mokly-generated`, without case sensitivity. Later segments may use that
name.

The receiver limits every entry path that it reads to 1,024 UTF-8 bytes and
64 segments.

## Fields The Receiver Reads

The receiver reads these index fields and no others:

- The root `schemaVersion`, `base`, `baseCommit`, `changesStatus` and
  `comparisonUrl`.
- The `path`, `title`, `previousPath` and `changes` of each current record in
  `screens`, `pages`, `documents`, `useCases` and `components`.
- The `viewport` and `colorScheme` of each view of a current screen record.
- The `entry.path`, `entry.title` and `entry.changes` of each record in
  `removedEntries`.

Each read field follows these rules:

- A title is a nonempty string.
- A `path` or `previousPath` follows the entry-path grammar above.
- A `changes` object has a `status` of `preparing`, `pending`, `ready`,
  `unavailable` or `disabled`. A `ready` status also carries a `kind` of
  `added`, `changed`, `removed` or `unmodified` and a boolean `included`.
- A view has a `viewport` of `mobile` or `desktop` and a `colorScheme` of
  `light` or `dark`.
- Every current and removed path is unique without ASCII case sensitivity.
- A current record never carries the kind `removed`.

A read field that is missing, has the wrong type or breaks these rules returns
400 `upload-invalid-bundle`. The receiver does not validate the
other index fields. The app reads the index under the
[released reader contract](./mokly-artifact-compatibility.md#release-019-frame-boundary).
An index read that fails shows the failed-index card of
[Viewer host](./viewer-host.md#sources).

## Changes Count

The receiver counts Changes under the
[Changes count](../mokly-catalogue-changes.md#changes-count)
of the released `mokly-catalogue-changes.md`, so the check and the viewer's
Changes list agree. A record counts when its `changes.status` is `ready` and its
`changes.included` is true. Current screens, pages, documents,
use cases, components and variants count as their own entries, and so does
each removed record. A counted record counts once.

| Counted record                      | Bucket  |
| ----------------------------------- | ------- |
| Kind `added`                        | added   |
| Kind `removed`                      | removed |
| Kind `changed` or kind `unmodified` | changed |

The total is the number of counted records. A paired pure move
has the kind `unmodified`, so it counts as changed. A counted
current record with `previousPath` also counts as moved. Moved
is a subset of the total, not an addition to it. Pairing is producer-owned:
the receiver never infers a move from titles, paths or content. Affected
consumers, instances, ignored-only entries and source-only edits never count,
because the index never marks their records as included.

An upload without a comparison has no counts, and admission stores the
explicit `no-comparison` observation. This includes an index that reports its
Changes as `unavailable`.

## Screens And Observations

The current screens of a publication are the current records of the index's
`screens` array, including screen variants. Each current screen
has its path, its title and the axes of its views. Removed
screens, components, pages, documents and use-case steps are not current
screens.

For a publication with a comparison, the ready transaction stores the path and
the view axes of each current screen for sharing. The screens
list reads the stored index with the same projection and the same bounds.
A publication without a comparison stores no screen selections.
[Viewer read model](./viewer-read-model.md#screens--listscreens) defines the
listing, its order, its bounds and its availability.

## Reader Conformance And Cloud Checks

An authored index Changes-count corpus beside the contract fixtures runs
through the cloud reader and through the public `readCatalogueIndex` of
`@mokly/viewer`, on the same exact bytes. The
[fixture guide](../../../crates/mkc-mokly-contract/fixtures/README.md) describes
the corpus. Each case that the cloud accepts must also pass
`readCatalogueIndex`. Both harnesses must derive the changed,
added, removed and moved counts that the case records. A case
that the cloud refuses names its rejection kind. The public
reader receives parsed objects and cannot detect duplicate keys, so
duplicate-key rejection is always a cloud-only verdict. In 0.19.0 the
public reader checks the index version and copies content without validation.
The corpus records its version-only verdict separately from each cloud
content rejection.

The received index cannot prove source authenticity. The receiver retains its
exact bytes and serves them under the ordinary hosting, authorization and
confinement rules.

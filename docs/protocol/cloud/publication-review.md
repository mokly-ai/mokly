# Publication Index And Changes

Status: The receiver does not run the content check yet. It checks only the index fields that its own features read, and it reads no entry detail. The [receiver read-model validation item](../../../plans/follow-ups/receiver-read-model-validation.md) adds the check.

This is the catalogue index sub-contract of
[upload validation](./publication-upload-validation.md). Mokly's
[catalogue](../mokly-catalogue.md), [catalogue changes](../mokly-catalogue-changes.md),
[catalogue serialization](../mokly-catalogue-serialization.md),
[moves](../mokly-moves.md) and [shell delivery](../mokly-shell-delivery.md) docs
own the index format, together with the generated declarations of
`@mokly/viewer`. The receiver reads the catalogue index
`mokly-viewer/index.json` that the Plan archive carries, and the
[content check](#content-check) reads every entry detail. The receiver parses
no deployment file and no other comparison file.
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

Every entry path follows the
[segment grammar](../mokly-paths.md#segment-grammar) of Mokly paths. The
receiver limits every entry path that it reads to 1,024 UTF-8 bytes and 64
segments.

## Content Check

Before it completes an upload, the receiver checks the index and every entry
detail with the core readers, as
[Catalogue Content](../mokly-upload-validation.md#catalogue-content) requires.
The receiver also applies one rule that the core readers do not apply: every
current and removed path is unique without ASCII case sensitivity. A check
that fails returns 400 `upload-invalid-bundle`.

The app reads the index under the
[reader contract](./mokly-artifact-compatibility.md#frame-boundary).
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
duplicate-key rejection is always a cloud-only verdict. The
public reader checks the index version and copies content without validation.
The corpus records its version-only verdict separately from each cloud
content rejection.

The received index cannot prove source authenticity. The receiver retains its
exact bytes and serves them under the ordinary hosting, authorization and
confinement rules.

# Changes and screen comparisons

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

A base commit without the selected configuration file has an empty catalogue.
Every current entry is added. A malformed configuration or a failed Git read
keeps its validation or Git failure. A comparison size or command budget
makes Changes unavailable with a diagnostic naming the path and limit. The
current build remains usable. Runtime failure outcomes follow
[base preparation](./mokly-base-preparation.md#shared-render-runtime).

## Changes membership

The [comparison contract](./mokly-comparison.md#changes-membership) owns the
membership list: added, removed, and moved screens, pages, and documents;
views with a material change; entries whose reviewable metadata changed; and
use cases whose steps name a changed screen. This page states the rules that
project that list onto entries, variants, views, and resources. Every rule
reads the composed trees of the two [sides](./mokly-comparison.md#sides). No
rule reads a source file or a repository path on its own.

- A source edit alone never lists an entry. An unreferenced public file alone
  never lists an entry and never supplies evidence. A changed Git path is
  candidate evidence, not a reason.
- Reviewable metadata is the address, the titles, the descriptions, the
  rationale, the tags, the related-document links, the use case steps and
  memberships, and the view structure: the set of viewports and colour
  schemes. It excludes folder titles, source locations, and declared
  dependencies.
- A changed component lists its consumers as affected, not as changes, under
  the [component attribution contract](./mokly-component-changes.md). An
  affected-only screen does not make its use cases changed.
- A use case is listed when a step's `screenPath` names the exact changed
  screen, including a variant, or when its own metadata or steps changed.
- A variant of either kind is projected independently. Its metadata
  projection contains `variantOf` and its parent's title, so a changed parent
  title marks the variant, while a change confined to the variant never adds
  the parent. A parent that moves carries its variants with it under the
  [move contract](./mokly-moves.md).
- Pages and documents use the same material and resource rules on their
  documents: one per colour scheme for a document, one for a page. They have
  no viewport views and no comparison controls.

## Entries and views

Entries pair by kind and case-folded path. The [move contract](./mokly-moves.md)
then pairs the remaining removed and added entries of one kind and records
`previousPath`; a paired entry compares with its paired base entry. A base
entry whose path now belongs to a current entry of another kind, and that the
move contract pairs with nothing, is discarded: the current entry is `added`,
and no removed record exists for that path. The
[catalogue change metadata contract](./mokly-catalogue-changes.md) owns the
removed set.

Within a paired entry, views pair by viewport and colour scheme. Each side's
view set is its entry's effective `colorSchemes`, so a dark view present only
on the head side is `added` and one present only on the base side is
`removed`. Mobile and desktop classify separately from their own documents.
Every view of every current and base entry participates.

A view's state follows the [materiality rule](./mokly-comparison.md#materiality):
`unchanged`, `changed`, `added`, `removed`, or `ignored-only`. The canonical
form decides equality only; a comparison pane shows the real bytes of both
sides. Ignored regions pair by id, a changed material key is material, a
region present on one side only is ordinary content, and a view whose only
differences lie inside paired ignored regions is `ignored-only`, which never
lists the entry.

Head `<style>` elements never enter the canonical form. A changed style rule
reaches a view only as rule evidence under
[style ownership](./mokly-comparison.md#style-ownership) and
[CSS change attribution](./mokly-css-attribution.md): a rule attributed to the
entry makes the view `changed`, a rule attributed to a component keeps the
entry affected, a rule that matches nothing leaves no rule record, and a
stylesheet whose changed rules all match nothing is recorded once as
excluded.

## Resources

Resource evidence follows the [resource rule](./mokly-comparison.md#resources)
of the comparison contract: references are read from the composed tree with
the owner of the referencing element, followed through stylesheet `url()`
and `@import` chains and embedded documents, and compared as bytes between
the working tree and the base commit's blobs. A changed referenced resource is
conservative evidence of a rendering change for every view that reaches it.
It is a reason to review, never a pixel measurement.

- Only references outside ignored regions participate. Speculative `preload`
  and `prefetch` hints alone do not establish rendered impact.
- A changed stylesheet is narrowed to its matching rules under
  [CSS change attribution](./mokly-css-attribution.md). A stylesheet whose
  changed rules match nothing on a view supplies no reason for that view. A
  newline-only edit has no changed rules and lists nothing. Fonts, images,
  and embedded documents keep file-level attribution.
- A referenced resource missing from either side fails that side's closure
  validation. A missing head target is `build-invalid`; the comparison never
  substitutes historical bytes into current output. An absent unreferenced
  counterpart can participate as an addition or removal.
- Resource references compare by their resolved route. An accepted move maps
  the moved entry's resources under the
  [move normalisation rule](./mokly-moves.md#normalisation); equal mapped
  bytes add no reason, and a real edit keeps its evidence.
- Every reachable resource is validated on both sides, images and fonts
  included. Finding one changed resource does not skip the references after
  it. A dangling or escaping symlink, a path outside the public closure, or a
  missing referenced resource fails validation with that diagnostic.

## Changes in Serve

Serve classifies Changes in the background after it listens, never during a
request, and publishes each status move as one state under
[updates in Serve](./mokly-shell-delivery.md#updates-in-serve): each
publication replaces the index and the details together and raises
`revision` by one. The index's `changesStatus` is `preparing` while the base
side's sources are extracted and its dependencies install, when the base side
needs them; `pending` while the base side renders and the comparison runs;
then `ready` or `unavailable`. `disabled` means the catalogue was built with `--no-changes`; Serve never
publishes it, because the configuration always has a base. A
content change clears the result, publishes `pending`, and publishes a
terminal status only for the latest generation; a result from a superseded
generation is discarded. A change to the base ref alone reclassifies the
current trees without rendering the head side again. An unavailable or invalid base input makes Changes `unavailable` while
All stays browsable, and a classifier failure is reported through the
ordinary diagnostic path. The [on-demand Serve contract](./mokly-on-demand.md)
owns the shell's presentation of each status.

`build` and `publish` compute the same membership once, from the same trees,
and write it into the comparison generation under the
[comparison serving contract](./mokly-comparison-serving.md). A newline-only
or source-only edit lists nothing on any path.

## Screen controls

Screen controls and change-view selection follow the
[Changes screen controls](./mokly-changes-controls.md) contract.

## Related Docs

- [Tree comparison and Changes](./mokly-comparison.md)
- [Changes serving and comparison](./mokly-changes-serving.md)
- [Component change attribution](./mokly-component-changes.md)
- [CSS change attribution](./mokly-css-attribution.md)
- [Moves](./mokly-moves.md)

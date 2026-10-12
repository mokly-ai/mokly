# Tree Comparison And Changes

## Delivery Status

Approved target of the [Rust rebuild plan](../../plans/rust-rebuild.md); not
implemented. The frozen TypeScript backend compares normalized text with
recorded offsets instead; its rules live in
[Changes and screen comparisons](./mokly-changes.md) and the component
attribution contracts until the rebuild replaces them.

## Purpose And Inputs

Comparison decides, for every entry and view, whether the base and the head
differ in a way a reviewer should see, and who owns each difference. Its
inputs are the head generation in memory, the base documents from a
[baseline](#baselines), the Git changed paths, and the configured review
settings. It works on parsed trees. It never reads recorded text offsets, and
it never splices document text.

## Markers

Mokly writes its ownership and review markers as HTML comments while it
composes a document. They survive every build, export, and baseline, and they
are the only ownership information comparison needs.

| Marker                                                                 | Meaning                                                              |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `<!--mokly-instance:start id="r-3" path="…" instance="…" props="…"-->` | a rendered component instance; `props` is the canonical props digest |
| `<!--mokly-slot:start id="r-3" name="children"-->`                     | slot content supplied to instance `r-3` by its enclosing owner       |
| `<!--mokly-root:start id="r-0" path="…"-->`                            | the root component of a component page                               |
| `<!--mokly-ignore:start id="hero" key="…"-->`                          | a Review-ignore region with its optional material key                |
| `<!--mokly-ignore-scope enabled="false"-->`                            | an ignore scope switch for the subtree that follows                  |
| `<!--mokly-<kind>:end id="…"-->`                                       | closes the region with that id                                       |

A region is the sequence of sibling nodes between its start and end markers,
which share one parent. Regions nest. Ids are unique within a document and
stable across renders of the same inputs. A marker inside raw text (`script`,
`style`, `textarea`, `title`) is text, not a marker; the build reports it as
the `marker-in-raw-text` warning and comparison ignores it.

## Tree Model

Both sides of a view are parsed by a spec-compliant HTML parser into trees in
which the markers are comment nodes. An element's owner is the innermost
instance, slot, or root region that contains it; slot content belongs to the
region that supplied it. The implied `html`, `head`, and `body` elements and
every element outside any region belong to the entry. An element whose
nearest enclosing ignore region is active is ignored, and an ignore scope
switch applies to the subtree after it, as the frozen backend's `ReviewIgnore`
and `ReviewIgnoreScope` define.

Formatting clones that the adoption agency algorithm creates and elements that
the parser implies take their position in the tree; nothing refers to the
token that created them.

## Materiality

A view is compared through its canonical form: the tree after ignored regions
are removed, with element and attribute names lowercased, attributes sorted by
name, attribute values and text decoded, runs of ASCII whitespace in text
collapsed to one space except inside `pre`, `textarea`, `script`, and `style`,
and non-marker comments kept. Two views with equal canonical forms are not
material changes, so attribute order, entity spelling, and formatting do not
count. Markers themselves are excluded from the form.

Ignored regions pair by id across sides. A region whose id exists on one side
only is ordinary content. A changed material key on a paired region is a
material change even when the region's content is ignored. A view whose only
differences lie inside paired ignored regions is `ignored-only`.

View states are `unchanged`, `changed`, `added`, `removed`, and
`ignored-only`. Snapshots served to the viewer keep the real bytes of both
sides; the canonical form exists only to decide equality.

## Style Ownership

Styles a [sidecar](./mokly-sidecar.md) render returned are written into the
head as `<style data-mokly-owners="<component paths>">` elements, one rule
list per owner set, deduplicated by rule identity. Every rule inside such an
element belongs to those components. Linked stylesheets keep the
[CSS attribution](./mokly-css-attribution.md) rules.

Head `<style>` elements without owners, which a whole-screen render or a
renderer wrote, follow the inline rule: diff their rules between the sides
with the stylesheet rule diff, match each changed rule's selectors against
both trees, and attribute it to the one component whose regions contain every
matched element, to the entry when a matched element lies outside every
region or the matches span several components, to nobody when it matches no
element on either side, and to the entry as `unresolved` when the keep list
applies. An excluded rule never makes a view material; a rule attributed to a
component is that component's change and keeps the screen listed as affected.

## Resources

References are read from the tree with the owner of the referencing element:
`src`, `href`, `srcset`, `poster`, inline style `url()`, and stylesheet
`url()` and `@import` chains. The closure follows them through the
[public closure policy](./mokly-public-closure.md) and embedded documents, with
the same confinement, verified-deletion, and byte-comparison rules as today.
A changed referenced resource is conservative evidence of a rendering change
for every view that reaches it, attributed to the owner of the reference. A
resource is never discovered by joining text across a removed region.

## Changes Membership

Changes lists added, removed, and moved screens, pages, and documents; views
with a material change; entries whose reviewable metadata changed; and use
cases whose steps name a changed screen. A source edit alone never lists an
entry. Affected consumers of a changed component are linked from the component
and listed as affected, not as changes. Variants are projected independently
and move with their parent. The metadata set, flow propagation, and the
removed-entry presentation keep the rules of the frozen contracts.

## Baselines

The base is the merge base of the configured `review.base` and `HEAD`. When
the base commit tracks `mokly-generated/`, its documents come from Git blobs.
Otherwise the base is rebuilt by its own configured commands into the cache,
under the storage contract's locks, limits, and process scopes, and the
completion marker is v3, which requires manifest 11 and the `generated-v11`
layout. A base whose manifest carries another number makes Changes
unavailable with the message that the base must be rebuilt by the current
version.

## Review Result v8 And Snapshot v4

```ts
interface ReviewResultV8 {
  schemaVersion: 8;
  baseCommit: string;
  entries: readonly ReviewEntry[];
  affected: readonly AffectedConsumer[];
  diagnostics: readonly ReviewDiagnostic[];
}
interface ReviewView {
  viewport: "mobile" | "desktop";
  colorScheme: "light" | "dark";
  state: "unchanged" | "changed" | "added" | "removed" | "ignored-only";
  ignoredIds: readonly string[];
  rules?: readonly RuleEvidence[];
  resources?: readonly ResourceEvidence[];
}
interface RuleEvidence {
  stylesheet: string;
  selector: string;
  status: "matched" | "excluded" | "unresolved";
  owner: { kind: "entry" } | { kind: "component"; path: string };
}
```

Entries keep the path-keyed shape of review v7: kind, path, `previousPath` on
moved pairs, metadata reasons, views, and component variants grouped under
their parent. Per-rule evidence replaces the offset-bearing inline evidence,
and every record names its owner. The catalogue change snapshot v4 pairs
review v8 with manifest v11 for Serve, export, and publication. The generated
TypeScript types are the normative shapes.

## Related Docs

- [CSS change attribution](./mokly-css-attribution.md)
- [Moves](./mokly-moves.md)
- [Baseline storage and execution](./mokly-baseline-storage.md)
- [Rust core architecture](../architecture/rust-core.md)

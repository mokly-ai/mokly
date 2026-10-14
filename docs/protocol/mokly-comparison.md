# Tree Comparison And Changes

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

## Purpose And Inputs

Comparison decides, for every entry and view, whether the base and the head
differ in a way a reviewer should see, and who owns each difference. Its
inputs are the head side rendered from the working tree, the base side
rendered from the base commit under [Sides](#sides), the Git changed paths,
and the configured review settings. It works on parsed trees. It never reads recorded text offsets, and
it never splices document text.

## Markers

The core attaches ownership and ignore regions to tree nodes while it
composes a document. The one place that information crosses a process
boundary is the HTML fragment a sidecar returns: the fragment carries it as
the comment markers below, and the core reads them into node annotations and
drops them when it grafts the fragment. Served and exported documents carry no
markers. Every comment name with the `mokly-` prefix is reserved for markers.

| Marker                                                                 | Meaning                                                              |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `<!--mokly-instance:start id="r-3" path="…" instance="…" props="…"-->` | a rendered component instance; `props` is the canonical props digest |
| `<!--mokly-slot:start id="r-3" name="children"-->`                     | slot content supplied to instance `r-3` by its enclosing owner       |
| `<!--mokly-ignore:start id="hero" key="…"-->`                          | a Review-ignore region with its optional material key                |
| `<!--mokly-<kind>:end id="…"-->`                                       | closes the region with that id                                       |

A region is the sequence of sibling nodes between its start and end markers,
which share one parent. Regions nest. Ids are unique within a document and
stable across renders of the same inputs. A marker inside raw text (`script`,
`style`, `textarea`, `title`) is text, not a marker; the build reports it as
the `marker-in-raw-text` warning and comparison ignores it.

## Tree Model

Both sides of a view are the trees the core composed; a sidecar fragment is
parsed by a spec-compliant HTML parser, with its markers as comment nodes,
before it is grafted in. An element's owner is the innermost instance, slot,
or root region that contains it; slot content belongs to the region that
supplied it. The implied `html`, `head`, and `body` elements and every element
outside any region belong to the entry. On a component page the core attaches
the root region, id `r-0`, to the root component itself, with no marker. An
element inside an ignore region is
ignored. An ignore scope is resolved while the document is composed: a
disabled scope suppresses the ignore regions inside it, the innermost scope
wins, and no scope reaches comparison, as `ReviewIgnoreScope` defines. The core sends the enclosing scope state with each
component render, the sidecar resolves nesting from it, and the core applies no
outer scope to a fragment; slot content takes the state its placeholder reports
as its innermost scope.

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
count. Inside a component instance region the canonical form keeps the
instance identity, the component path, the instance id, and the props digest,
in place of the component's rendered subtree, so a change inside a component
is the component's change and keeps its consumers affected, not changed. Head
`<style>` elements, owned and unowned, are excluded too; their rules enter the comparison only
through the rule evidence of [Style Ownership](#style-ownership): a changed
rule attributed to the entry makes the view `changed`, a rule attributed to a
component keeps the view affected, and an excluded rule changes nothing.

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
region or the matches span several components, and to the entry as `unresolved` when the keep list applies. A rule that
matches no element on either side produces no evidence record. An excluded rule never makes a view material; a rule attributed to a
component is that component's change and keeps the screen listed as affected.

## Resources

References are read from the tree with the owner of the referencing element:
`src`, `href`, `srcset`, `poster`, inline style `url()`, and stylesheet
`url()` and `@import` chains. The closure follows them through the
[public closure policy](./mokly-public-closure.md) and embedded documents; the
head side reads files from the working tree, the base side from Git blobs, and
bytes are compared as today.
A changed referenced resource is conservative evidence of a rendering change
for every view that reaches it, attributed to the owner of the reference. A
resource is never discovered by joining text across a removed region.

## Changes Membership

Changes lists added, removed, and moved screens, pages, and documents; views
with a material change; entries whose reviewable metadata changed; and use
cases whose steps name a changed screen. A source edit alone never lists an
entry. Affected consumers of a changed component are linked from the component
and listed as affected, not as changes. Variants are projected independently
and move with their parent. The [Changes contract](./mokly-changes.md) owns the metadata set and flow
propagation, and the [catalogue change contract](./mokly-catalogue-changes.md)
owns the removed-entry presentation.

## Sides

The base is the merge base of the configured `review.base` and `HEAD`. The
head side renders from the working tree. The base side renders from the base
commit's Git tree through the same render graph, with sources read from blobs;
HTML screens, components, and documents need no checkout. Both sides render
with the current Mokly version, so a Mokly upgrade alone lists no change, and
the render cache keeps a side's views until their inputs change.

React and Storybook components, React screens, the consumer renderer module,
and consumer PostCSS at the base need the base's JavaScript on disk. The base
commit's sources are extracted on demand into the bounded cache outside the
repository that the [architecture page](../architecture/rust-core.md#render-graph)
names, keyed by the commit, and the sidecar bundles from that directory. Its dependencies follow
three tiers:

1. The base's lockfile and package manifests equal the working tree's: the
   bundle resolves dependencies from the working tree's `node_modules`
   through the module resolution settings.
2. They differ: the base's dependencies are installed, with lifecycle scripts
   disabled and under a time limit, into a bounded cache keyed by the
   lockfile hash and the package manager version, and the bundle resolves
   them from there.
3. The install cannot run, because the machine is offline, the package
   manager is unsupported, or the time limit passes: tier 1 applies and the
   `base-dependencies` warning names the differing lockfile.

A base whose sources fail the current validation makes Changes unavailable
with those diagnostics.

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

The [component comparison records](./mokly-component-comparison-records.md)
page defines `ReviewEntry`, `AffectedConsumer`, and `ReviewDiagnostic`.
Entries keep the path-keyed shape of review v7: kind, path, `previousPath` on
moved pairs, metadata reasons, views, and component variants grouped under
their parent. Per-rule evidence replaces the offset-bearing inline evidence,
and every record names its owner. The catalogue change snapshot v4 pairs
review v8 with the base commit for Serve, the static build, and publication. The generated
TypeScript types are the normative shapes.

## Related Docs

- [CSS change attribution](./mokly-css-attribution.md)
- [Moves](./mokly-moves.md)
- [Render sidecar](./mokly-sidecar.md)
- [Rust core architecture](../architecture/rust-core.md)

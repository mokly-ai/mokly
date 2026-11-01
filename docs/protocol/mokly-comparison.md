# Tree Comparison And Changes

## Purpose And Inputs

Comparison decides, for every entry and view, whether the base and the head
differ in a way a reviewer should see, and who owns each difference. Its
inputs are the head side rendered from the working tree, the base side
rendered from the base commit under [Sides](#sides), and the configured review
settings. It works on parsed trees.

## Markers

The core attaches ownership and ignore regions to tree nodes while it composes a
document. A fragment a sidecar returns carries its regions as the comment
markers below, and the core reads them into node annotations when it grafts the
fragment. Served and built documents keep the `mokly-instance` and `mokly-slot`
markers of every region the core composed, whatever rendered the instance, so
the [published inspector](./mokly-published-inspector.md) resolves each `r-n`
region in the live page. Ignore regions resolve at composition. Private
`mokly-output` pairs mark adapter output inside renderer wrappers; the core
consumes them when it attaches a component root. `mokly-link` pairs are consumed
by [link adaptation](./mokly-link-controls.md); these private pairs are not
written. The canonical form below removes every marker before comparison. Every
comment name with the `mokly-` prefix is reserved for markers.

| Marker                                                                 | Meaning                                                                         |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `<!--mokly-instance:start id="r-3" path="…" instance="…" props="…"-->` | a rendered component instance; `props` is the canonical props digest            |
| `<!--mokly-slot:start id="r-4" instance="r-3" name="children"-->`      | slot region `r-4` supplied to instance `r-3` by its input owner                 |
| `<!--mokly-ignore:start id="hero" key="…"-->`                          | a Review-ignore region with its optional material key                           |
| `<!--mokly-link:start id="…" to="…"-->`                                | a `MockLink asChild` control in a sidecar fragment; consumed by link adaptation |
| `<!--mokly-output:start id="r-1"-->`                                   | private adapter-output placement; consumed before served bytes                  |
| `<!--mokly-<kind>:end id="…"-->`                                       | closes the region with that id                                                  |

A region is the sequence of sibling nodes between its start and end markers,
which share one parent. Regions nest. Ids are unique within a document and
stable across renders of the same inputs. A marker inside raw text (`script`,
`style`, `textarea`, `title`) is text, not a marker; the build reports it as
the `marker-in-raw-text` warning and comparison ignores it.

## Tree Model

Both comparison sides use the [composed-tree contract](./mokly-comparison-tree.md)
for regions, input ownership, ignore scopes, and browser repair.

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
differences lie inside paired ignored regions is `ignored-only`. View states are
`unchanged`, `changed`, `added`, `removed`, and `ignored-only`. Snapshots served
to the viewer keep the real bytes of both sides; the canonical form exists only
to decide equality.

## Style Ownership

Registry ownership follows the [sidecar rule records](./mokly-sidecar-render-records.md#results).
Trusted annotations survive normalization and caching on both sides.
Authored owner attributes grant no ownership. Compare normalized rules per
owner; formatting and duplicate copies do not change material.
Owned, ownerless head, and linked CSS use one
[catalogue-wide proof and evidence reduction](./mokly-css-attribution.md).
Equal rule identities join across documents, even with different owner sets.
Physical instance containment decides who claims a match for all three sources.
For component X, drop a match inside a different nested component Y only when
the same rule matches on Y's own pages before nested filtering. A self-nested
copy of X never takes X's match. For a declared owner's rule, use supplier
input ancestry only for that nested test. A receiving component cannot take
the supplier's own rule for content the supplier passed into it.

Owned rules retain their declared owner as exact-instance evidence when no
own-page proof applies, including matches on supplied content inside that
owner's physical region. That proof requires a paired instance with unchanged
caller inputs and a kept match under the nested test. It can change the
component's implementation without changing its own views.
Unresolved rules use the conservative entry record and supply no instance proof.

Head styles without trusted owners and linked styles use physical containment
and catalogue-wide own-page proof to assign component records. A receiving
component claims supplied content only when its own pages prove that rule.
Without that proof, a match outside every changed component belongs to the entry.
Authored body styles do not enter this analysis. Linked styles keep their reachability.
The [membership contract](./mokly-css-attribution-membership.md) defines the records and their effects.

When a source has no kept changed rule on a view, emit one `excluded` record
with an empty selector and the entry owner. Owned and ownerless head styles use the containing
public document route. Omit its excluded record when that route has any kept
rule. Excluded evidence changes no view. Consumer document routes add no
own-page reason to a component.

## Resources

References are read from the tree with the owner of the referencing element:
`src`, `href`, `srcset`, `poster`, inline style `url()`, and stylesheet `url()`
and `@import` chains. The closure follows them through the [public closure
policy](./mokly-public-closure.md) and embedded documents; the head side reads
files from the working tree, the base side from checkout-converted Git blobs,
and bytes are compared. A changed referenced resource is conservative evidence
of a rendering change for every view that reaches it, attributed to the owner of
the reference. A resource is never discovered by joining text across a removed
region.

A base resource that cannot complete checkout conversion is unavailable with
one `base-conversion` warning. Failed filters, timeouts, and converted-byte
limits have this outcome. Its unknown bytes prove neither equality nor a
change. Other resource and document comparisons continue. Working-side
resources keep the validation failures of the
[Changes resource rules](./mokly-changes.md#resources).

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

Base conversion applies the base commit's attributes and the user's Git
configuration. It includes line endings, custom filters, and Git LFS downloads.
Network access is allowed within the preparation bounds. Base reads fetch the
missing objects of a partial clone from its promisor remote. A failed fetch
names a recovery command. The
[base preparation contract](./mokly-base-preparation.md) defines those bounds.
The [dependency contract](./mokly-base-dependencies.md#dependency-identity)
defines the matching Git clean rule for dependency identities.

The base is the merge base of the configured `review.base` and `HEAD`. The
head side renders from the working tree. The base side renders from the base
commit's Git tree through the same render graph, with checkout-converted sources;
HTML screens, components, and documents need no checkout. Both sides render
with the current Mokly version, so a Mokly upgrade alone lists no change.

React and Storybook components, React screens, the consumer renderer module,
and consumer PostCSS at the base need the base's JavaScript on disk. The base
commit's sources are extracted on demand into the
[base preparation cache](./mokly-base-cache.md), outside the repository. The
sidecar bundles the base side from those extracted sources.

### HTML Package Styles

An HTML-only catalogue without a renderer or PostCSS uses working-tree
dependencies for package stylesheets on both sides. It needs no extraction,
Node process, or package installation. Compare Git clean identities only for
manifests and lockfiles beside each `node_modules` directory used by the head,
and its repository ancestors.
Without a used dependency directory, read no dependency inputs and emit no warning.
When these identities differ, emit a configuration-subject `base-dependencies`
warning, including when both sides render the same installed CSS. Equal
identities stay silent. The warning prints in every command, but it does not
fail a `--strict` build ([strict mode](./mokly-build-warnings.md#strict-mode)).
Its message is:

```text
Base dependencies differ. HTML comparison uses working-tree dependencies.
```

### JavaScript Package Selection

The [package selection contract](./mokly-comparison-packages.md) defines how
each side resolves repository-owned packages and selects third-party
dependencies in three tiers, including the supported base installs.

A base whose sources fail the current validation makes Changes unavailable
with those diagnostics.
The [dependency contract](./mokly-base-dependencies.md) defines input
identity, dependency installation, and bundle settings. The
[base cache contract](./mokly-base-cache.md) defines cache leases.

## Review Result v8 And Snapshot v4

The comparison classifies every entry and view into one review result v8 and
pairs it with the base commit in the catalogue change snapshot v4. Both stay
in memory: no host writes, serves, or uploads them. The
[catalogue index](./mokly-catalogue.md) and the
[entry details](./mokly-shell-delivery.md#entry-detail) are the only public
comparison records. A catalogue-wide comparison file is rejected: it would
repeat the details' evidence and outgrow the per-file limits of static hosts.

The model crate's `ReviewResultV8` type and the types that it uses define the
shape of the review result. The
[component comparison records](./mokly-component-comparison-records.md) page
states the rules of `ReviewEntry`, `AffectedConsumer`, and `ReviewDiagnostic`.
Entries are path-keyed: kind, path, `previousPath` on moved pairs, metadata
reasons, views, and component variants grouped under their parent. Every
evidence record names its owner. Serve, the static build, and publication
project the same snapshot. The generated
[`CatalogueReadModel`](../../packages/viewer/src/generated/catalogue/CatalogueReadModel.ts)
and [`EntryDetailV4`](../../packages/viewer/src/generated/catalogue/EntryDetailV4.ts)
types define the index and the detail.

`ignoredIds` lists the sorted unique ids of paired ignore regions removed for
canonical equality, including equal regions in an `unchanged` view. Git
subprocess environment, bounds, and cancellation follow the [Git command
runtime](./mokly-git.md).

## Related Docs

- [CSS change attribution](./mokly-css-attribution.md)
- [Moves](./mokly-moves.md)
- [Render sidecar](./mokly-sidecar.md)
- [Rust core architecture](../architecture/rust-core.md)

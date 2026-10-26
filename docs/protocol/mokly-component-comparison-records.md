# Component Comparison Records

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

## Normative Result

The [comparison contract](./mokly-comparison.md#review-result-v8-and-snapshot-v4)
owns the in-memory review result v8 envelope, its view record, and its rule
evidence. This page defines the entry records, the affected-consumer records,
and the diagnostics inside that envelope. The model crate's types are the
normative shapes. The [entry detail](./mokly-shell-delivery.md#entry-detail)
publishes a screen or component entry's `before` address and each view's
`state`, `ignoredIds`, and evidence.

```ts
interface ReviewEntryAddress {
  path: string;
  title: string;
  props?: ComponentWireProps; // screens and components: the merged props
  suppliedSlots?: readonly string[]; // components only
}

interface ReviewEntrySides {
  before?: ReviewEntryAddress;
  after?: ReviewEntryAddress;
  previousPath?: string;
}

type ReviewState =
  "unchanged" | "changed" | "added" | "removed" | "ignored-only";

type EntryChangeReason =
  | {
      kind:
        | "added"
        | "removed"
        | "metadata"
        | "material"
        | "implementation"
        | "inputs"
        | "structure";
    }
  | { kind: "dependency"; path: string }
  | { kind: "screen"; screenPath: string };

interface ReviewEntry extends ReviewEntrySides {
  kind: "screen" | "component" | "use-case";
  path: string;
  title: string;
  state: ReviewState;
  included: boolean;
  reasons: readonly EntryChangeReason[];
  views: readonly ReviewView[];
  variants?: readonly ReviewEntry[]; // component parents: their variants
}

interface ComponentUsageContext {
  kind: "screen" | "component";
  entry: ReviewEntryAddress;
  viewport: Viewport;
  colorScheme: ColorScheme;
}

interface AffectedUsageEvidence {
  side: "before" | "after";
  context: ComponentUsageContext;
  via: readonly { componentId: string; instanceKey: string }[];
}

interface AffectedConsumer {
  changedComponentId: string;
  consumer: { kind: "screen" | "component"; path: string };
  evidence: readonly AffectedUsageEvidence[];
}

interface ReviewDiagnostic {
  message: string;
}
```

`ReviewView`, `RuleEvidence`, and `ResourceEvidence` are the view shapes of
the comparison contract. `ComponentWireProps` is the props codec of the
[catalogue read model](./mokly-catalogue.md).

## Sides And Pairing

Every side-bearing record has at least one side, copied from the catalogue
model of that side: the head from the working tree, the base from the base
commit under [Sides](./mokly-comparison.md#sides). Top-level `path` and
`title` equal `after ?? before`. Screens, components, variants, and use cases
pair by kind and case-folded path; the [move contract](./mokly-moves.md) then
pairs the remaining removed and added entries of one kind. `previousPath` is
the paired base entry's path, present exactly on such records, which carry
both sides. `componentId` and `changedComponentId` hold the parent
component's path, the only identity a component has. A title edit is a
metadata change; a removed entry keeps its former title.

A component parent is one `ReviewEntry` with its own views, rendered from its
own props, and with its variants grouped in `variants`, each a complete entry
with its own sides, state, reasons, and views. A variant has no `variants`,
and the field is absent on screens and use cases. A use case has no views.

## Views

Each entry's `views` is the union of its available before and after views. A
view is addressed by `viewport` and `colorScheme`; the result stores no
document address. The viewer derives each side's document address from the
entry path, `previousPath` for the before side of a paired entry, and the
view axes, under the [comparison pane contract](./mokly-comparison-panes.md).
An `added` view has no before side and a `removed` view no after side; those
states are the only record of a missing side. The entry `state` takes the
precedence changed, added, removed, ignored-only, unchanged over its views. A
metadata-only, actual-instance implementation, or dependency-only entry can
have unchanged views. Reasons never override the view aggregate. An entry
with no views is unchanged when both entry sides exist; a missing entry
side gives added or removed.

A view state follows the [materiality](./mokly-comparison.md#materiality) and
[style ownership](./mokly-comparison.md#style-ownership) rules: the canonical
trees of both sides, the per-rule evidence with its owner, and the resource
evidence. Component ownership controls direct reasons separately; it never
invents an `ignored-only` state for a component-only edit. An affected-only
screen or component therefore keeps `unchanged` views, which can carry
component-owned records, and is not included; the `affected` records list it.
A caller input change can have unchanged views when the render does not
display that prop.

## Membership

Every current and base screen, component, variant, and use case appears in
`entries`, including unchanged and affected-only ones; the array is not the
Changes filter. `included` is the membership flag of a review entry under the
[Changes membership](./mokly-comparison.md#changes-membership) rules. The
[catalogue change contract](./mokly-catalogue-changes.md#changes-count)
defines the Changes count over index records of every kind, because pages and
documents have no review entry. A changed variant is included as its own entry of kind
`component`, exactly as a screen variant is its own screen entry. A pure move
is included with an empty `reasons` list. Usages and ancestor folders add no
entries. The [component comparison schema](./mokly-component-review.md) owns
the reason semantics and the affected-consumer proof; the
[validation contract](./mokly-component-review-validation.md) owns ordering
and admission.

`diagnostics` holds the comparison diagnostics, such as the pairing
diagnostics of the move contract, each with the exact text that the terminal
reports.

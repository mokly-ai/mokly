# Entry Modules

## Delivery Status

Approved contract. Current builds read a `mockups` export and require authored
ids; the [path identity plan](../../plans/path-identity.md) delivers this
contract.

An entry module is a TypeScript or JavaScript file matched by a
[root](./mokly-paths.md#roots). This contract owns how Mokly collects
definitions from its exports and how each definition gets its slug. Paths,
grammar, and collisions live in the [path contract](./mokly-paths.md).

## Export Collection

Mokly evaluates the module in the consumer bundle and inspects every export,
the default export included. An export contributes definitions when it is:

- one definition returned by `defineScreen`, `definePage`, `defineUseCase`,
  or `defineFolder`;
- an array of such definitions, flattened one level, which is how
  `defineScreen` with `variants` and `defineComponent(...).entries` are
  exported; or
- the object returned by `defineComponent`, which contributes its `entries`.

Each contributed value must carry the private definition brand that the
authoring helpers attach; a forged object fails registry validation with the
same source attribution as today. Every other export is ignored, so helper
functions, fixtures, shared metadata, and React components may live in the
same file. A nested array is not a definition and fails the build. A module
that contributes no definition fails the build. The export name is never
used: `mockups` is an ordinary name with no special meaning, and a default
export is collected exactly like a named one.

```tsx
// specs/account/billing/invoice.mockup.tsx
import { defineScreen } from "@mokly/mokly";
import { InvoiceView } from "@app/account/billing/InvoiceView";

export default defineScreen({
  title: "Invoice",
  description: "A paid invoice.",
  mobile: <InvoiceView device="mobile" />,
  desktop: <InvoiceView device="desktop" />,
  variants: [
    {
      slug: "overdue",
      title: "Overdue",
      description: "An invoice past its due date.",
      mobile: <InvoiceView device="mobile" state="overdue" />,
      desktop: <InvoiceView device="desktop" state="overdue" />,
    },
  ],
});
```

Collection happens once per compilation after discovery, in the sorted order
of module paths, and export order within a module. Order never affects
identity; it only decides which location a diagnostic lists first.

## Slugs

Every entry definition accepts an optional `slug`. The slug is the last
segment of the derived path and must satisfy the
[segment grammar](./mokly-paths.md#segment-grammar). When `slug` is omitted,
the slug is the module's file name up to its first `.`: `invoice.mockup.tsx`
and `invoice.tsx` both give `invoice`, and `Button.stories.tsx` gives
`Button`. The rule reads only the file's own name. Two slug-less entries in one
module derive the same path and fail as a [duplicate path](./mokly-paths.md#diagnostics)
that lists both exports; the first entry never moves because a second was
added.

The slug `index`, from the file name `index.mockup.tsx` or the field
`slug: "index"`, makes the entry its folder's own page under the
[index rule](./mokly-paths.md#derivation). A module named `index.mockup.tsx`
may therefore export the folder page without a slug beside other entries that
declare slugs.

A variant declares `slug` and has no file-name default, because several
variants share one module. A component parent follows the entry rule and its
variants follow the variant rule:

```tsx
// packages/ui/src/button/index.mockup.tsx
import { defineComponent } from "@mokly/mokly";
import { Button } from "./button";

export default defineComponent({
  title: "Button",
  description: "The primary control.",
  dependencies: ["packages/ui/src/button/button.tsx"],
  relatedDocs: [],
  propSchema: {
    kind: "object",
    properties: { label: { schema: { kind: "string" } } },
  },
  render: (props) => <Button>{props.label}</Button>,
  variants: [
    { slug: "primary", title: "Primary", props: { label: "Continue" } },
  ],
});
```

With the root `{ dir: "packages/ui/src", path: "components" }`, the component
is `components/button` and its variant is `components/button/primary`.

## Declared Paths

`path` replaces the derived path with a complete path, validated as a path.
It is allowed on every entry definition, including variants, and is the
escape hatch when a file cannot sit where its path should be. `movedFrom`
names the entry's previous complete path for the
[move contract](./mokly-moves.md); it is validated as a path, may not equal
the entry's own path, and may not name another current entry. Neither field
exists on `defineFolder`, which declares `path` as its key.

## Flows And Links

A use case step names a screen by `screenPath`, and a screen lists the flows it
belongs to in `useCasePaths`; both lists reciprocate as today. A path in these
fields is complete, or relative to the declaring entry's folder when it starts
with `./` or `../`. `MockLink` and `mockLink` accept the same two string forms
and additionally a definition reference, which is the imported value of
another entry module's export; Mokly resolves the reference to that entry's
path at build time. The [authoring contract](./mokly-authoring.md#links)
defines the complete link surface.

## Diagnostics

| Code                   | Exact text                                                         |
| ---------------------- | ------------------------------------------------------------------ |
| `empty-module`         | `<location> exports no Mokly definition`                           |
| `nested-array`         | `<location>: nested arrays are not definitions`                    |
| `invalid-definition`   | `<location>: export <name> is not a Mokly definition`              |
| `invalid-moved-from`   | `<location>: movedFrom <path> equals the entry's own path`         |
| `moved-from-current`   | `<location>: movedFrom <path> names a current entry`               |
| `duplicate-moved-from` | `movedFrom <path> is declared twice:` then one `  <location>` line |

`invalid-definition` is reported only for an export whose value carries a
Mokly brand but fails validation; unbranded exports are ignored silently.
Slug and path grammar failures use the [path diagnostics](./mokly-paths.md#diagnostics).

## Verification

Coverage must prove collection from default and named exports, arrays and
`defineComponent` objects, ignored helper exports, the empty-module and
nested-array failures, the file-name slug rule including multi-dot names, the
duplicate-path failure for two slug-less entries, `index` from both sources,
declared `path` and `movedFrom` validation, and the exact text of every
diagnostic.

## Related Docs

- [Paths, roots, and identity](./mokly-paths.md)
- [Public authoring API](./mokly-authoring.md)
- [Variants](./mokly-variants.md)
- [Registered components](./mokly-components.md)
- [Moves](./mokly-moves.md)

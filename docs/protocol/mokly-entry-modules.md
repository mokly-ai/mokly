# Entry Modules

## Delivery Status

Default and named exports, branded definitions, slug derivation and relative
references are implemented.

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

Each contributed value must be the exact object returned by its authoring
helper. A forged brand or spread copy fails `invalid-definition`; copying a
brand cannot copy a definition's identity. Every other export is ignored, so helper
functions, fixtures, shared metadata, and React components may live in the
same file. Nested helper arrays are ignored. A nested array containing a
definition or component registration fails `nested-array`. A module
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

A definition's identity derives from the discovered entry module that exports
it, never from a helper module that created it. Its defining module remains
`sourcePath` for ownership and Changes evidence. The same definition object
exported more than once by one entry module is collected once, using its first
export location. Exporting one definition object from two distinct entry modules
fails with `duplicate-export`, naming both export locations.

Collection happens once per compilation after discovery, in the sorted order
of module paths, and export order within a module. Order never affects
identity; it only decides which location a diagnostic lists first.

## Slugs

Every entry definition accepts an optional `slug`. The slug is the last
segment of the derived path and must satisfy the
[segment grammar](./mokly-paths.md#segment-grammar). When `slug` is omitted,
the slug is the exporting entry module's file name up to its first `.`: `invoice.mockup.tsx`
and `invoice.tsx` both give `invoice`, and `Button.stories.tsx` gives
`Button`. The rule reads only the file's own name. Two slug-less entries in one
module derive the same path and fail as a [duplicate path](./mokly-paths.md#diagnostics)
that lists both exports; the first entry never moves because a second was
added.

A complete declared `path` bypasses file and directory derivation, so their names
need not satisfy the segment grammar for that entry. Other slug-less entries in
the same module still derive and validate normally. An explicitly supplied `slug`
is always validated, even beside `path`. A slug or file-name `index` retains its
own-page meaning at the declared path, and relative links resolve from that path.

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
It is allowed on non-variant entry definitions and is the
escape hatch when a file cannot sit where its path should be. Variants accept no
`path`: they take the parent's final path plus their own slug. `movedFrom`
names the entry's previous complete path for the
[move contract](./mokly-moves.md); it is validated as a path, may not equal
the entry's own path, and may not name another current entry. Neither field
exists on `defineFolder`, which declares `path` as its key.

## Flows And Links

A use case step names a screen by `screenPath`, and a screen lists the flows it
belongs to in `useCasePaths`; both lists reciprocate as today. A path in these
fields is complete, or relative when it starts with `./` or `../`.
One base-folder rule applies to links and both flow fields: an ordinary entry
uses the parent of its path; an index entry uses its own collapsed path; a
variant uses its parent entry's base folder. Declared paths use the same rules
on the declared path. Thus `./payment-methods` from an invoice and its variants
at `account/billing/invoice` names `account/billing/payment-methods`, while
`./invoice` from an index at `account` names `account/invoice`. `MockLink` and `mockLink` accept the same two string forms
and additionally a definition reference, which is the imported value of
another entry module's export; Mokly resolves the reference to that entry's
path at build time. The [authoring contract](./mokly-authoring.md#links)
defines the complete link surface.

## Diagnostics

| Code                   | Exact text                                                                                                             |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `duplicate-export`     | `definition <title> is exported by two entry modules:` then one `  <location>` line per export, sorted in UTF-16 order |
| `empty-module`         | `<location> exports no Mokly definition`                                                                               |
| `nested-array`         | `<location>: nested arrays are not definitions`                                                                        |
| `unknown-link-target`  | `<location>: referenced definition <title> from <definedIn> is not exported by an entry module`                        |
| `invalid-definition`   | `<location>: export <name> is not a Mokly definition`                                                                  |
| `invalid-moved-from`   | `<location>: movedFrom <path> equals the entry's own path`                                                             |
| `moved-from-current`   | `<location>: movedFrom <path> names a current entry`                                                                   |
| `duplicate-moved-from` | `movedFrom <path> is declared twice:` then one `  <location>` line                                                     |

Definition references use graph-scoped helper capabilities; a hand-written
internal token is not a link path. Diagnostics for unexported definitions name
the title and defining module and never expose the private token.

`invalid-definition` is reported only for an export whose value carries a
Mokly brand but fails validation; unbranded exports are ignored silently.
Slug and path grammar failures use the [path diagnostics](./mokly-paths.md#diagnostics).

## Verification

Coverage must prove alias deduplication within one module, rejection across
modules, helper attribution independent of exporting-module path derivation,
ordinary/index/variant/declared-path link bases, and collection from default and named exports, arrays and
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

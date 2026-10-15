# Entry Modules

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

## Export Collection

An entry module is a JavaScript or TypeScript file that a root matches and
that is not a stories file. The
[render sidecar](./mokly-sidecar.md#definitions) bundles every entry module
of a source tree into one generation, and its `describe` call evaluates each
module and inspects every export, the default export included. An export
contributes exactly one definition when it is the object returned by
`defineScreen`, `defineComponent`, `definePage`, `defineUseCase`, or
`defineFolder`. The value must be the exact object the helper returned: a
forged brand or a spread copy fails `invalid-definition`, because copying a
brand cannot copy a definition's identity. Every other export is ignored, so
helper functions, fixtures, shared metadata, and React components may live in
the same file. An exported array that contains a Mokly definition fails `array-export`,
naming the export. Plain-data arrays remain allowed as fixtures. No
helper returns an array, because a variant is a props set under the
[entry props contract](./mokly-entry-props.md) and not a definition of its
own. A module that contributes no definition fails `empty-module`.

The export name enters the definition's handle, the file path, `#`, and the
export name, which render requests use under the sidecar contract. It plays
no other part: it never affects the path, `mockups` is an ordinary name, and
a default export is collected like a named one, with the handle `#default`.

A stories file matched by a root is not an entry module. The sidecar reads
its stories under its [Storybook rules](./mokly-sidecar.md#storybook), and
the file becomes one component entry whose stories are variants.

```tsx
// specs/account/billing/invoice.mockup.tsx
import { defineScreen } from "@mokly/mokly";
import { InvoiceView } from "@app/account/billing/InvoiceView";

export default defineScreen({
  title: "Invoice",
  description: "A paid invoice.",
  relatedDocs: [],
  props: { state: "paid" },
  render: (props) => <InvoiceView state={props.state} />,
  variants: [
    {
      slug: "overdue",
      title: "Overdue",
      description: "An invoice past its due date.",
      props: { state: "overdue" },
    },
  ],
});
```

A definition's identity derives from the discovered entry module that
exports it, never from a helper module that created it. The defining module
is its `sourcePath` for attribution and source protection. The same
definition object exported more than once by one entry module is collected
once, at its first export location. Exporting one definition object from two
distinct entry modules fails with `duplicate-export`, naming both export
locations.

Collection happens once per bundle generation after discovery, in the sorted
order of module paths and export order within a module. Order never affects
identity; it only decides which location a diagnostic lists first.

## Slugs

Every entry definition accepts an optional `slug`. The slug is the last
segment of the derived path and must satisfy the
[segment grammar](./mokly-paths.md#segment-grammar). When `slug` is omitted,
the slug is the exporting entry module's file name up to its first `.`:
`invoice.mockup.tsx` and `invoice.tsx` both give `invoice`, and the stories
file `Button.stories.tsx` gives `Button`. The rule reads only the file's own
name. Two slug-less entries in one module derive the same path and fail as a
[duplicate path](./mokly-paths.md#diagnostics) that lists both exports; the
first entry never moves because a second was added.

A complete declared `path` bypasses file and directory derivation, so their
names need not satisfy the segment grammar for that entry. Other slug-less
entries in the same module still derive and validate normally. An explicitly
supplied `slug` is always validated, even beside `path`. A slug or file-name
`index` keeps its own-page meaning at the declared path, and relative links
resolve from that path.

The slug `index`, from the file name `index.mockup.tsx` or the field
`slug: "index"`, makes the entry its folder's own page under the
[index rule](./mokly-paths.md#derivation). A module named `index.mockup.tsx`
may therefore export the folder page without a slug beside other entries that
declare slugs.

A variant declares `slug` and has no file-name default, because several
variants share one definition. A component parent follows the entry rule and
its variants follow the variant rule:

```tsx
// packages/ui/src/button/index.mockup.tsx
import { defineComponent } from "@mokly/mokly";
import { Button } from "./button";

export default defineComponent({
  element: "ui-button",
  title: "Button",
  description: "The primary control.",
  relatedDocs: [],
  propSchema: {
    type: "object",
    additionalProperties: false,
    required: ["label"],
    properties: { label: { type: "string" } },
  } as const,
  props: { label: "Save" },
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
It is allowed on non-variant entry definitions and is the escape hatch when a
file cannot sit where its path should be. Variants accept no `path`: they
take the parent's final path plus their own slug. `movedFrom` names the
entry's previous complete path for the [move contract](./mokly-moves.md); it
is validated as a path, may not equal the entry's own path, and may not name
another current entry. Neither field exists on `defineFolder`, which declares
`path` as its key.

## Flows And Links

A use case step names a screen by `screenPath`, and a screen lists the flows
it belongs to in `useCasePaths`; both lists reciprocate. A path in these
fields is complete, or relative when it starts with `./` or `../`. One
base-folder rule applies to links and both flow fields: an ordinary entry
uses the parent of its path; an index entry uses its own collapsed path; a
variant uses its parent entry's base folder. Declared paths use the same
rules on the declared path. Thus `./payment-methods` from an invoice and its
variants at `account/billing/invoice` names `account/billing/payment-methods`,
while `./invoice` from an index at `account` names `account/invoice`.
`MockLink` and `mockLink` accept the same two string forms and additionally a
definition reference, which is the imported value of another entry module's
export; Mokly resolves the reference to that entry's path when it renders.
The [authoring contract](./mokly-authoring.md#links) defines the complete
link surface.

## Shared Metadata Diagnostics

Flow relationship failures use `invalid-metadata` with these exact texts:

- `<location>: <entryPath> target <target> does not name a current <kind>`,
  where the kind is `screen` or `use-case`;
- `screen <screenPath> lists use case <flowPath>, but its steps do not name the screen`;
- `use case <flowPath> steps through screen <screenPath>, but the screen does not list the use case`.

Attribution failures from the definition provider use the same code with
`definition is not exported by a resolved entry module` or
`definition source is not inventoried`. Invalid definitions stay present as
relationship targets after their metadata and paths are resolved. Their own
body, link, and flow-target checks run once the definitions are valid. A
failed flow or screen does not cause a reciprocal-membership error in its peers.

## Diagnostics

| Code                      | Exact text                                                                                                             |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `duplicate-export`        | `definition <title> is exported by two entry modules:` then one `  <location>` line per export, sorted in UTF-16 order |
| `empty-module`            | `<location> exports no Mokly definition`                                                                               |
| `array-export`            | `<location>: export <name> is an array; export one definition per export`                                              |
| `unknown-link-definition` | `<location>: referenced definition <title> from <definedIn> is not exported by an entry module`                        |
| `invalid-definition`      | `<location>: export <name> is not a Mokly definition`, followed by `: <reason>` for a field-shape failure              |
| `invalid-moved-from`      | `<location>: movedFrom <path> equals the entry's own path`                                                             |
| `moved-from-current`      | `<location>: movedFrom <path> names a current entry`                                                                   |
| `duplicate-moved-from`    | `movedFrom <path> is declared twice:` then one `  <location>` line                                                     |

A location is the repository-relative module path followed by
` export <name>`. Every code is a `build-invalid` failure. A definition
reference is the imported value itself; a hand-written string that imitates
one is a path and follows the path grammar. Diagnostics for unexported
definitions name the title and the defining module.

`invalid-definition` is reported only for an export whose value carries a
Mokly brand but fails validation; unbranded exports are ignored silently. Slug
and path grammar failures use the
[path diagnostics](./mokly-paths.md#diagnostics).

## Related Docs

- [Paths, roots, and identity](./mokly-paths.md)
- [Public authoring API](./mokly-authoring.md)
- [Entry props and variants](./mokly-entry-props.md)
- [HTML screens, pages, and use cases](./mokly-html-screens.md) for the
  JavaScript-free form
- [Registered components](./mokly-components.md)
- [Render sidecar](./mokly-sidecar.md)
- [Moves](./mokly-moves.md)

# Sidecar Definition Transport

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

The [render sidecar](./mokly-sidecar.md) evaluates the entry modules and
stories of one bundle generation. Its `describe` result has `screens`,
`pages`, `useCases`, `folders`, `components`, `stories`, and `diagnostics`.
Each definition has a `handle`: the repository-relative file path, `#`, and
export name. Its optional `sourcePath` is the defining helper module, distinct
from the exporting module in the handle. Installed packages have no attributed
source path. The generated TypeScript modules under
`packages/mokly/src/generated/sidecar/` define the wire fields.

## Schema Boundary

A definition's `propSchema` is authored JSON, including an invalid schema.
The transport does not decode it into a validated profile type. The core
passes it to `mokly-model`'s `PropValidator::compile` with the definition's
module and export attribution. Unsupported keywords, wrong schema types, and
missing component schemas therefore fail `component-schema`. They do not
fail `sidecar-protocol`, and they do not replace a healthy sidecar.

The core owns the one schema validator on `jsonschema`. The sidecar does not
run a second schema validator. The [component diagnostics](./mokly-components.md#diagnostics)
and [entry props](./mokly-entry-props.md#validation) contracts own the codes.

## Authoring Diagnostics

`diagnostics` is an ordered list of
`{ code, module, exportName?, message }` records. A module is repository-relative.
An export name is present when the diagnostic concerns one export. The message
follows the owning authoring contract and keeps its source detail.

The list accepts the codes of the
[entry module contract](./mokly-entry-modules.md#diagnostics):
`duplicate-export`, `empty-module`, `array-export`, `unknown-link-definition`,
`invalid-definition`, `invalid-moved-from`, `moved-from-current`, and
`duplicate-moved-from`. It also carries `invalid-field`, `invalid-variants`,
`invalid-folder`, and the component diagnostic codes when applicable.

An array export adds `array-export`, naming the module and export. A module
with no definition adds `empty-module`. The sidecar continues collecting
other module diagnostics. Any nonempty list fails the catalogue attempt as
`build-invalid` before a render or write, with each original code intact.
A direct error reply may carry the same typed authoring codes. Such a reply
leaves the session usable. A malformed frame or a `sidecar-protocol` reply
closes the session. A module evaluation failure keeps `bundle-failed` with
the module and diagnostic text.

## Declarative Metadata

Each record has typed entry metadata, controls, variants, and Storybook
control hints. The transport has no catch-all metadata map. Imported
entry references use `{ handle }`, distinct from authored path strings.
Saved React slot values remain inside the loaded generation and serialize
as slot-name to opaque handle records. Functions and React elements never
serialize as data props. The core builds the catalogue and component registry
from these definitions and the HTML definitions.

The component metadata includes its `element`, authored schema, own props,
slots, control overrides, and saved variants. Screen variants carry their
metadata overrides in authored order. Story control hints affect derived
controls, never schema validation, under the
[Storybook rules](./mokly-sidecar.md#storybook).
The component parent's `argTypes` carries the meta's hints. Each story carries
its merged hints separately, so a story override does not replace the parent's
own labels and choices.

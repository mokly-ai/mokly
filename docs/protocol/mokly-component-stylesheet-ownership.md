# Component Stylesheet Ownership And Comparison

## Delivery Status

Removal of baseline compatibility is implemented in
[M23B](../../plans/remove-source-path-evidence.md#milestone-23b-remove-baseline-compatibility).

Link provenance and comparison exclusion are implemented. Removing derived
CSS owners and ignoring all renderer CSS owner records are implemented in [M19](../../plans/remove-source-path-evidence.md#milestone-19-classify-css-by-where-its-rules-match) of the [source-path removal plan](../../plans/remove-source-path-evidence.md).
The page evidence display is implemented in [M20](../../plans/remove-source-path-evidence.md#milestone-20-show-the-outside-component-evidence).

Shared link discovery and the inserted-link exception to Review-ignore are
implemented in [M28](../../plans/remove-source-path-evidence.md#milestone-28-fix-component-stylesheet-links).

The [declaration and linking contract](./mokly-component-stylesheets.md) defines the stylesheet inputs and placement.

## Provenance And Comparison Material

Mokly distinguishes only the links it inserts from renderer-authored links,
including renderer links reused for declarations. The linking pass retains
each inserted link's public path, real file and rendered declaring component
paths until ordinary package link edits finish. Use the
[shared active link finder](./mokly-stylesheet-links.md) on that final document.
Match each insertion to its real file and record the active full-link UTF-16
span, public path and declaring `componentPaths` in the private v9 view's
`insertedStylesheets` array. A reused renderer or configured link receives no
inserted-link span. No reserved token, transient attribute or wrapper is used.

Offsets refer to the final HTML, including the current plain generated notice.
Validate each span against those exact bytes. Rebase component ranges and
document-style offsets through ordinary package edits. Each persisted v9 usage
record contains `insertedStylesheets`, including an empty array when no link was
inserted. Missing provenance is invalid; never infer it or replace a missing
array with an empty one.

For page comparison material, remove recorded full-link spans from both
documents **before** component projection and paired or single Review-ignore
normalization. Rebase a comparison-only copy of range/style offsets through
that removal; never change the stored final-document offsets. Do this on the
complete path and before the unchanged-view fast decision's equality checks.
On a component page, retain a recorded link when its declaring paths include that
page's root component path, even if a child also declares it; remove child-only
inserted links. A screen has no root exception. Renderer-authored links stay page content, even when their files are also
declared. Public output and snapshots keep the final documents.
Resource discovery uses the final documents before comparison-only link removal.
It finds Mokly-inserted links from validated `insertedStylesheets` spans, even
inside paired Review-ignore regions. Include those links and their transitive
resources in the CSS rule scope on both the complete and fast comparison paths.
The author's own ignored links, styles and markup stay ignored under the usual
paired Review-ignore rule. Do not restore the surrounding ignored region or
use its elements as selector matches. A reused authored link gets no inserted-link exception. Provenance supplies resource
starting points; the ordinary rule-matching contract still decides attribution.

## Derived Ownership And Conflicts

Mokly stops deriving stylesheet `ComponentViewRecord.resources` records.
No remaining use requires them. Keep rendered declarations temporarily while
linking, grouped by real file with sorted declaring component paths. Use that
linking data directly to make each final `insertedStylesheets` record.
Its `componentPaths` are provenance for the root-link exception, not CSS owners.
A reused renderer link gets no inserted-link record and stays authored page
material.

The audit of existing uses requires these changes:

| Existing use                                                                                  | Required behavior                                                                                                                      |
| --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `render.tsx` derives resource records during link insertion/reuse.                            | Keep link order, deduplication and declarer data in the linking pass; write no CSS resource records.                                   |
| `stylesheet_provenance.ts` finalizes inserted links from the linking pass.                    | Resolve final active links against issued linking data. Preserve spans, validated public paths, final-link checks and offset rebasing. |
| Manifest serialization and resource validation carry the records.                             | Current v9 writes only non-stylesheet resource owners. Validate public CSS through declarations and the resource graph.                |
| `component_projection_resources.ts` suppresses owned CSS in consumers.                        | Never suppress a stylesheet through resource ownership. Match rules against actual normalized documents.                               |
| `component_view.ts` treats root resource-owner changes as material.                           | Retain that check only for non-CSS owners. An added/removed declaration with no link, byte or other rendered change gives no reason.   |
| `component_resource_attribution.ts` promotes invocation CSS to component reasons.             | Keep invocation attribution only for non-CSS resources. CSS requires own-page rule matches.                                            |
| Fast-path usage equality, source validation and affected-consumer assembly use those records. | Require valid v9 records without CSS owners, validate frozen per-rule proof and preserve complete/fast equivalence.                    |
| Public catalogue/inspection projection strips resource ownership.                             | Keep it private; expose rule evidence instead. No export, watch or publication file list depends on derived owners.                    |

Current and baseline v9 usage records reject CSS resource entries. A current record that retains them is invalid data. Readers never
drop those records or reconstruct them from declarations. The renderer filter
below acts on authoring output before manifest validation.

Ignore only the ownership claim of a renderer `resources` record naming any
stylesheet, whether configured,
declared, imported by CSS, generated from JavaScript, or not linked on that
page, including a catalogue with no registered components. Filter before any
empty-registry ownership rejection. Apply the public path grammar and confinement checks first, including
the [shared public-file policy](./mokly-public-closure.md#one-policy-per-compilation)
and protected-source checks. Symbolic links at any public path component fail
before a record can be ignored. A case-insensitive `.css` suffix
on either the public path or its confined real target identifies CSS. Pending
generated CSS uses its validated generated route; do not fall back to disk.
Missing or unsafe files still fail normal validation. Do not validate ignored
component paths, merge their owners, or grant ownership any effect. Retain the
validated public path as a private closure seed, even when no document links
the stylesheet. The shared closure builder follows its transitive references
and supplies checked Watch/Serve membership. A seed creates no stored CSS owner
or inserted-link span. CSS attribution still requires actual linked rule proof.

Full, requested and nested generated-target compilation retain the private
seed and its declaring route. Transient Props capture retains it too. No seed
field is added to public inspection, snapshots or the manifest usage schema.

Emit the single `ignored-stylesheet-resource-owner` warning for each route/file
identity under [Build Warnings](#ignored-owner-warning). This
replaces `ignored-declared-resource-owner`, with no duplicate old-code warning.
It applies even if no declaring or asserted component renders. This follows
[graceful handling](./README.md#graceful-handling): the unnecessary ownership
input can be discarded while keeping safe output.

Renderer `resources` for non-stylesheets retain their existing ownership,
public-root validation, conflicting-owner checks and actual-invocation rules.
Renderer `styles` records retain ownership of exact document material ranges,
including style-element text. They are not stylesheet-file ownership.

## Changes

Every stylesheet uses [rule membership](./mokly-css-attribution-rules.md).
Only a kept own-page match under the nested-component test proves that the
rule changes a component. Matches outside components changed by that rule,
and unresolved rules, give the page its own row. Imports, generated copies,
configuration and declarations follow the same rule. No CSS owner record can
suppress a page reason or grant a component reason. Unlinked files add nothing.
Declared links and `insertedStylesheets` keep the comparison exclusion above.

## Ignored Owner Warning

`ignored-stylesheet-resource-owner` names the generated route and says exactly
`Stylesheet ownership for <path> is ignored. Changes follow the elements that each changed rule matches.`
`<path>` is the JSON-quoted first renderer-record public path for that file in
authored order. Repeated records for that validated file warn once per
route/render. Generated CSS uses
its canonical public route, whether pending or written. Safety checks precede
this warning, including unlinked CSS and pages without registered components.
Across renders, equal records use the [warning channel](./mokly-build-warnings.md).
Non-CSS owners and document `styles` retain their behavior.

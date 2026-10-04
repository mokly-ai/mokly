# Component Stylesheet Ownership And Comparison

## Delivery Status

Removal of baseline compatibility is implemented in
[M23B](../../plans/remove-source-path-evidence.md#milestone-23b-remove-baseline-compatibility).

Link provenance and comparison exclusion are implemented. Removing derived
CSS owners and ignoring all renderer CSS owner records are implemented in [M19](../../plans/remove-source-path-evidence.md#milestone-19-classify-css-by-where-its-rules-match) of the [source-path removal plan](../../plans/remove-source-path-evidence.md).
The page evidence display is implemented in [M20](../../plans/remove-source-path-evidence.md#milestone-20-show-the-outside-component-evidence).

The [declaration and linking contract](./mokly-component-stylesheets.md) defines the stylesheet inputs and placement.

## Provenance And Comparison Material

Mokly must distinguish only the links it inserts from renderer-authored links,
including renderer links reused for declarations. Give each inserted link a
unique transient `data-mokly-component-stylesheet` token before the optional
compatibility transform. The attribute is reserved: a renderer-authored
occurrence fails `build-invalid` because provenance would be ambiguous. The
token is the zero-based decimal ordinal of an inserted link in that document.
A transformer retaining an inserted link retains its token; removing or
replacing the link may remove the token. An unmarked replacement, including
the same href with its token stripped, is authored page content. Each token
may survive exactly once, on a stylesheet link to its original real file;
duplicates or reassignment fail `build-invalid`. After transformation, scan
the final document, resolve marked links to declared real files, remove the
transient attribute, and store their full-link UTF-16 spans, public paths and
rendered declaring component ids in the private v8 view's
`insertedStylesheets` record. Final HTML has no token or wrapper, so the
rendered page is unchanged. Offsets refer to final HTML including its generated
header. Validate spans against those bytes and rebase range/style offsets
through attribute removal. Remove the attribute and its leading space without
reserializing the link. A removed link produces no span. Every persisted v8
usage record contains the array, including an empty array when no link survives.
A baseline without it is invalid data. Never guess provenance or convert a
missing array into an empty one.

For page comparison material, remove recorded full-link spans from both
documents **before** component projection and paired or single Review-ignore
normalization. Rebase a comparison-only copy of range/style offsets through
that removal; never change the stored final-document offsets. Do this on the
complete path and before the unchanged-view fast decision's equality checks.
On a component page, retain a recorded link when its declaring ids include that
page's root component id, even if a child also declares it; remove child-only
inserted links. A screen has no root exception. Renderer-authored and
compatibility-authored links stay page content, even when their files are
also declared. Public output and snapshots keep the final documents.
Resource discovery and CSS rule matching use those final documents with their
normal Review-ignore policy, **without** stripping inserted links. Thus
provenance affects page material only, not CSS rule attribution.

## Derived Ownership And Conflicts

Mokly stops deriving stylesheet `ComponentViewRecord.resources` records.
No remaining use requires them. Keep rendered declarations temporarily while
linking, grouped by real file with sorted declaring component ids. Use that
linking data directly to make each surviving `insertedStylesheets` record.
Its `componentIds` are provenance for the root-link exception, not CSS owners.
A reused renderer link gets no inserted-link record. A removed inserted link
gets no span; an unmarked replacement stays authored page material.

The audit of existing uses requires these changes:

| Existing use                                                                                  | Required behavior                                                                                                                       |
| --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `render.tsx` derives resource records during link insertion/reuse.                            | Keep link order, deduplication and declarer data in the linking pass; write no CSS resource records.                                    |
| `stylesheet_provenance.ts` prunes owners and obtains ids from those records.                  | Resolve final tokens against the issued linking data directly. Preserve spans, ids, aliases, final-link validation and offset rebasing. |
| Manifest serialization and resource validation carry the records.                             | Current v8 writes only non-stylesheet resource owners. Validate public CSS through declarations and the resource graph.                 |
| `component_projection_resources.ts` suppresses owned CSS in consumers.                        | Never suppress a stylesheet through resource ownership. Match rules against actual normalized documents.                                |
| `component_view.ts` treats root resource-owner changes as material.                           | Retain that check only for non-CSS owners. An added/removed declaration with no link, byte or other rendered change gives no reason.    |
| `component_resource_attribution.ts` promotes invocation CSS to component reasons.             | Keep invocation attribution only for non-CSS resources. CSS requires own-page rule matches.                                             |
| Fast-path usage equality, source validation and affected-consumer assembly use those records. | Require valid v8 records without CSS owners, validate frozen per-rule proof and preserve complete/fast equivalence.                     |
| Public catalogue/inspection projection strips resource ownership.                             | Keep it private; expose rule evidence instead. No export, watch or publication file list depends on derived owners.                     |

Current and baseline v8 usage records reject CSS resource entries. Earlier
branch output that claims v8 and retains them is invalid data. Readers never
drop those records or reconstruct them from declarations. The renderer filter
below acts on authoring output before manifest validation.

Ignore a renderer `resources` record naming any stylesheet, whether configured,
declared, imported by CSS, generated from JavaScript, or not linked on that
page, including a catalogue with no registered components. Filter before any
empty-registry ownership rejection. Apply the public path grammar and confinement checks first, including
realpath aliases and protected-source checks. A case-insensitive `.css` suffix
on either the public path or its confined real target identifies CSS. Pending
generated CSS uses its validated generated route; do not fall back to disk.
Missing or unsafe files still fail normal validation. Do not validate ignored
component ids, merge their owners, or grant them any effect.

Emit the single `ignored-stylesheet-resource-owner` warning for each route/file
identity under [Build Warnings](./mokly-build-warnings.md#exact-messages). This
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

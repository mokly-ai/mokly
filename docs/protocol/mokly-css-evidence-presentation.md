# CSS Evidence Presentation

## Delivery Status

Existing stylesheet details are implemented. Rule and page evidence delivery
is implemented in [M19](../../plans/remove-source-path-evidence.md#milestone-19-classify-css-by-where-its-rules-match) of the [source-path removal plan](../../plans/remove-source-path-evidence.md).
The grouping and exact outside-component copy below are planned for [M20](../../plans/remove-source-path-evidence.md#milestone-20-show-the-outside-component-evidence),
as the [M18](../../plans/remove-source-path-evidence.md#milestone-18-depict-the-outside-component-evidence) mockups depict them.

This contract owns how the shell derives and presents the rule-aware evidence
defined by [CSS Change Attribution](./mokly-css-attribution.md). The compact
visual rules remain in [CSS Evidence In The Shell](./mokly-css-evidence-shell.md).

## Shell Derivation

Live classification retains resource evidence for every entry kind, including
screen-only `screenEvidence`, with per-view axes, optional reasons and optional
excluded resources. Catalogue v4 exposes it as `resourceEvidence` on views and
single-document pages under the [evidence schema](./mokly-css-attribution-membership.md). Paths remain repository-relative. The workspace projects the
selected screen's views as optional `resourceEvidence`; it does not invent
component reasons, component results, or comparison states. Static exports
project the same slice from review result v5. A new classification generation
replaces the slice and clears stale evidence while Changes is pending or
unavailable.

One inspector renderer merges classification evidence with a loaded selected
comparison. Dependency reasons merge by path and rule key, with sorted selector unions
and unresolved precedence. Keep each rule's changed components and page evidence. Retained paths suppress exclusions across all selected
views; rendered-resource and ignored-content details remain available. Loaded
evidence is selection-scoped and clears on classification invalidation.
Component change facts come from the complete own-page rule analysis and
entry reasons. Do not infer them from a consumer's matches, file owners or the
loaded comparison subset. A page-only component-view reason adds no Affected
screens. Pending or unavailable generations clear all page evidence.

`ReviewState` has no resource-only variant. A view says “Styles this screen uses
changed” when its state is `changed`, `material` is absent, it retains at least
one reason, and every retained reason is an analysed stylesheet dependency. A
component variant says “Styles this variant uses changed”. Any material change,
font/image reason, or reason without analysis keeps the ordinary changed label.

## Details Copy

For a component entry, the shared wording helper selects:

| Evidence                     | Sentence                                                                              |
| ---------------------------- | ------------------------------------------------------------------------------------- |
| File list                    | “Changes to these files may affect this component:”                                   |
| Matched styles               | “Changed styles that apply to this component:”                                        |
| Unresolved with selectors    | “This change can apply anywhere on the component, so the component stays in Changes:” |
| Unresolved without selectors | “This change can apply anywhere on the component, so the component stays in Changes.” |
| One excluded stylesheet      | “This stylesheet changed, but none of the changed styles apply to this variant.”      |
| Several excluded stylesheets | “These stylesheets changed, but none of the changed styles apply to this variant.”    |

Screen Details lists only sorted retained rendered-resource reasons beneath “Changes to these files may affect this screen:”. The removed entry `sharedImpact` field supplies no paths. Excluded stylesheet evidence remains available for unchanged entries in All.

## Page Evidence Copy And Grouping

For each stylesheet with `analysis.pageEvidence`, show its path once in the
secondary comparison details. Under that path, list only its proven page
selectors as outside-component matches. The path is the file's one item in the
files list, and its sentences and selector lists nest in that item, as the
[shell layout](./mokly-css-evidence-shell.md#shell-presentation) fixes. Use the serialized strings from the
result, sorted and duplicate-free. Do not replace the path with a declaring
component file, an importing stylesheet or a private source path. Keep emitted
bundle paths as the real public evidence. Escape paths and selectors as text.

Use these exact sentences when the page selector list is nonempty:

| Page                 | At least one component changed by these rules                                        | No component changed by these rules             |
| -------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------- |
| Screen               | “These changed styles also apply outside the changed components on this screen:”     | “Changed styles that apply to this screen:”     |
| Component saved view | “These changed styles also apply outside the changed components in this saved view:” | “Changed styles that apply to this saved view:” |
| Whole-document page  | “These changed styles also apply outside the changed components on this page:”       | “Changed styles that apply to this page:”       |

Choose the column using the union of changed component ids for rules that
supply the displayed page selectors. The technical details stay in this
secondary list. Keep the existing comparison-stage heading and catalogue row
labels; do not expose rule keys, owner records, schema fields or internal status
names in product copy. A whole-document page still has no comparison controls.

When `pageEvidence.unresolved` is true, show a separate paragraph under that
same path. Use the existing unresolved screen/component sentences, with
“saved view” in place of “component” for a component page reason, and “page” in
place of “screen” for a whole-document page. The exact base sentences are:

- With selectors: “This change can apply anywhere on the screen, so the screen stays in Changes:”
- Without selectors: “This change can apply anywhere on the screen, so the screen stays in Changes.”

List only selectors of unresolved rule records after the colon. An empty list
uses the full-stop form and no list. Do not call these outside matches: none
were proved. A file with both proven outside matches and unresolved evidence
gets both paragraphs. Do not hide the proven list because the file's summary
status is unresolved.

For example, a declared stylesheet that styles a screen heading shows
`action.css`, “Changed styles that apply to this screen:”, and
`.checkout-heading`. If another rule in that file also changes Action on its
own pages, its component-only selectors are not added to this page list.
A screen-only `.checkout .action` rule shows that selector even though its
matches are inside an unchanged component invocation.

Component-only rules keep the existing matched-component copy and affected
consumer links. They do not get an outside-component paragraph. An affected-only
screen can retain its full matched-style evidence without a direct page reason.
A component saved view with only a wrapper/page reason gets the saved-view
copy above and no Affected screens from that rule.

Across all compared views of the selected entry, merge records by stylesheet
path and rule key. Union page selectors separately from component-only and
unresolved selectors. Never merge away the stylesheet-to-selector relationship.
Exclusions are the sorted path union minus any retained path. Use singular or
plural excluded copy by file count. Viewport and scheme controls do not change
Details; desktop and mobile present the same facts. Loaded comparisons and
classification evidence merge once, without duplicate paragraphs or files.

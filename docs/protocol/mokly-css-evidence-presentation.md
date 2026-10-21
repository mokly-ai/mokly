# CSS Evidence Presentation

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

## Shell Derivation

The entry detail v2 of the [shell delivery contract](./mokly-shell-delivery.md)
carries one `resourceEvidence` record per view and per whole-document page,
typed `ViewEvidence`: `rules`, the review v8 rule records with `stylesheet`,
`selector`, `status`, and `owner`, and `resources`, the rendered-resource
records with `path` and `owner`, under the
[evidence schema](./mokly-css-attribution-membership.md). This page reads only
those records, and the static build reads the same records from review result
v8. In this page, a file is a rule's `stylesheet` or a resource's `path`; a
matched, unresolved, or excluded file is a file with a rule of that `status`;
a page selector is the `selector` of a rule whose owner is the entry; a
component selector is the `selector` of a rule whose owner is a component, and
that owner's `path` names the changed component; the retained files are the
resource paths plus the stylesheets of `matched` and `unresolved` rules; the
excluded files are the stylesheets whose rules are all `excluded`. Paths are
artifact-root relative. The workspace projects the selected screen's views, or
the shown component entry's views on a component route: the routed variant, or
the parent's own views on a parent route. It does not invent component
reasons, component results, or comparison states. A new classification
generation replaces the projection and clears stale evidence while Changes is
pending or unavailable.

One inspector renderer merges classification evidence with a loaded selected
comparison. Classification evidence is the review entry's `reasons`, the
projected records, and the live comparison's views of the selected screen or
saved view, so Current shows the same files and sentences as a loaded
comparison. Records merge by stylesheet and selector, with sorted selector
unions and unresolved precedence. Keep each rule's owner. A retained file
suppresses its exclusion across all selected views; rendered-resource and
ignored-content details remain available. Loaded evidence is selection-scoped
and clears on classification invalidation. Component change facts come from
the review entries of the components and the rules they own. Do not infer them
from a consumer's matches, file owners or the loaded comparison subset. A
component-owned rule on a page adds no Affected screens on its own. Pending or unavailable generations clear all page evidence.

A whole-document page has no workspace and no views. Its Details read the
page's `resourceEvidence` from its entry detail in every delivery: Serve, the
static build and hosts alike. That one record holds the page's files and
excluded files, so no view merge applies. The grouping is
the screen's, with the page wording. A removed page, and Changes that are not
ready, have no page status and no page evidence.

Each viewport section of a loaded comparison has one stage heading: “Mobile”
or “Desktop”, then “ · ” and the view's label, for example “Desktop · Screen
changed”. A Light view that stands in for a Dark selection adds “ · Light
only”.

`ReviewState` has no resource-only variant. A view says “Styles this screen uses
changed” when its state is `changed`, its review entry has a reason, every
reason is a `dependency` reason, each named path has a rule of any status on
this view, and at least one named path has a `matched` or `unresolved` rule on
this view. An `excluded` record keeps the heading while another named
stylesheet applies to the view, so a stylesheet whose changes apply to dark
views only leaves the light and dark views of one entry with the same heading.
A component variant says “Styles this variant uses changed”. Any other reason
kind, a font or image resource, a dependency without a rule on the view, or a
view whose named stylesheets are all `excluded` keeps the ordinary changed
label.

A view says “Components this screen uses changed”, or “Components this variant
uses changed” for a component variant, when its state is `unchanged` and
changed components affect it: the view keeps a `matched` or `unresolved` rule
or a resource that a component owns, its usage holds an instance of a changed
component that the entry detail's `relatedComponents` names, or an `affected`
evidence item of the loaded review names it by side, entry path, viewport, and
colour scheme, so a moved entry's before side matches its previous path. A
selected comparison in Serve carries no `affected` records, so a component's
markup change reaches the heading through usage there. Every other `unchanged`
view keeps the ordinary label below.

| View state     | Screen                          | Component                       |
| -------------- | ------------------------------- | ------------------------------- |
| `changed`      | “Screen changed”                | “Variant changed”               |
| `unchanged`    | “No changes to this screen”     | “No changes to this variant”    |
| `added`        | “New screen”                    | “New variant”                   |
| `removed`      | “Screen removed”                | “Variant removed”               |
| `ignored-only` | “Only excluded content changed” | “Only excluded content changed” |

## Details Copy

Screens, component saved views and whole-document pages use one shared
comparison heading in Details. Show “Compared with the branch point on
\<name\>.” only when the name is known. The name is the `base` ref of the
catalogue index; an empty or blank name is unknown, and an index without
`base` shows no sentence.
Keep the “Comparison details” heading and the rest of Details, including its
metadata, evidence, exclusions and status lines. An index with `base` shows
the sentence in every delivery.

During navigation, the temporary workspace built from the index uses the
`base` ref the index already carries. Show the same sentence while the
destination's detail loads and after it loads. Pass the known name to that
fallback; do not infer it from a route or invent a default. An index without
`base` still shows no sentence and keeps its other Details.

For a component entry, the shared wording helper selects:

| Evidence                     | Sentence                                                                              |
| ---------------------------- | ------------------------------------------------------------------------------------- |
| File list                    | “Changes to these files may affect this component:”                                   |
| Matched styles               | “Changed styles that apply to this component:”                                        |
| Unresolved with selectors    | “This change can apply anywhere on the component, so the component stays in Changes:” |
| Unresolved without selectors | “This change can apply anywhere on the component, so the component stays in Changes.” |
| One excluded stylesheet      | “This stylesheet changed, but none of the changed styles apply to this variant.”      |
| Several excluded stylesheets | “These stylesheets changed, but none of the changed styles apply to this variant.”    |

Screen Details lists only the sorted retained files beneath “Changes to these files may affect this screen:”. Excluded stylesheet evidence remains available for unchanged entries in All.

A whole-document page uses the screen sentences with “page” in place of
“screen”. Its files list follows “Changes to these files may affect this
page:”. One excluded stylesheet reads “This stylesheet changed, but none of the
changed styles apply to this page.”, and several read “These stylesheets
changed, but none of the changed styles apply to this page.”. The page
sentences below complete its copy.

## Page Evidence Copy And Grouping

For each stylesheet with a `matched` rule owned by the entry, show its path
once in the secondary comparison details. Under that path, list only its page
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

Choose the column by whether any record with one of the displayed selectors
has a component owner. The technical details stay in this
secondary list. Keep the comparison-stage heading and catalogue row
labels; do not expose owner records, schema fields or internal status names in
product copy. A whole-document page still has no comparison controls.

When the stylesheet has an `unresolved` rule owned by the entry, show a
separate paragraph under that same path. Use the unresolved screen and component sentences of the Details Copy table,
with
“saved view” in place of “component” for a component page reason, and “page” in
place of “screen” for a whole-document page. A component page reason is an
unresolved rule whose owner is not the workspace's component; one owned by it
keeps the component sentence. The exact base sentences are:

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

Component-only rules keep the matched-component copy and affected consumer
links. They do not get an outside-component paragraph. An affected-only
screen can retain its full matched-style evidence without an entry-owned rule.
A component saved view whose rules are all owned by the entry gets the
saved-view copy above and no Affected screens from those rules.

Across all compared views of the selected entry, merge records by stylesheet
and selector. Union page selectors separately from component-only and
unresolved selectors. Never merge away the stylesheet-to-selector relationship.
The excluded files are the sorted union of excluded files minus any retained
file. Use singular or
plural excluded copy by file count. Viewport and scheme controls do not change
Details; desktop and mobile present the same facts. Loaded comparisons and
classification evidence merge once, without duplicate paragraphs or files.

## File Outcomes

Each retained path is one item of the files list, sorted by path and named
once. After its records merge by selector, the item lists these outcomes in
this order. Each outcome is its sentence and its sorted, unique selectors; an
empty selector list uses the full-stop form and no list.

1. Own component rules, only in a component workspace. The workspace's
   component is the parent of the routed component or variant. Matched rules that it
   owns read “Changed styles that apply to this component:”. Unresolved rules
   that it owns read the component unresolved sentence.
2. Page selectors from every rule, in the column chosen above.
3. Other unresolved rules, with the screen or saved-view unresolved sentence.
4. Only if none of these apply, every rule is `matched` and owned by changed
   components on this page. The item keeps its full matched evidence: the
   screen or component matched sentence with every selector of its rules.

So an affected-only screen or a consuming component keeps its styles, while a
file with page or unresolved outcomes never lists the selectors of its other
component-only rules. A file with resource records only, such as a font or image, is its
path alone. No outcome shows owner records.

## Status Lines

Each changed component that the entry consumes is linked as “Changed
component: Title”. The shared-component sentence, “Shared component changes
affect this preview. This page has no independent entry in Changes.”, appears
when the routed entry's index record is ready and not `included` and changed
components affect it: its detail's `relatedComponents` names a changed
component, which the review's `affected` records give, a shown view keeps a
`matched` or `unresolved` rule or a resource that a component owns, or the
loaded review's `affected` evidence names the entry. It shows in Current and
in a loaded comparison alike. A saved view whose rules are all owned by the
entry gains no sentence from those rules.

A whole-document page may use component elements
under the [pages contract](./mokly-pages.md#authoring), but only screens and
components have [usage records](./mokly-component-usage-records.md#validation).
A page is therefore no consumer: its Details never link a changed component
or say that sentence, and no component's Usage lists it.

The terminal line, “No changes to this screen.”, “No changes to this page.” or
“No changes to this saved view.”, appears only when the routed entry is
unmodified and the shared-component sentence does not apply; that sentence
takes its place. In a component workspace, the selected saved view must also
be unmodified.

A current whole-document page shows Added, Changed or Unmodified beside its
title once its Changes are ready, from the catalogue change kind: Added when
the base side lacks the page, Changed when Changes names it, and otherwise
Unmodified. A removed page keeps its Removed badge. The page's
Details show the comparison details whenever its status is known.

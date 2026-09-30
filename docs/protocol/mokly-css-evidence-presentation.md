# CSS Evidence Presentation

## Delivery Status

Implemented; this split records the existing shell projection and corrected
field names, including inferred inline-style evidence.

This contract owns how the shell derives and presents the rule-aware evidence
defined by [CSS Change Attribution](./mokly-css-attribution.md). The compact
visual rules remain in [CSS Evidence In The Shell](./mokly-css-evidence-shell.md).

## Shell Derivation

Live classification retains screen-only `screenEvidence` keyed by entry id,
with per-view viewport, color scheme, optional reasons, and optional excluded
resources. Component-aware classification retains its full v4 result, including
`inlineStyles`, instead of projecting it into the screen-only slice. Paths remain repository-relative. The workspace projects the
selected screen's views as optional `resourceEvidence`; it does not invent
component reasons, component results, or comparison states. Static exports
project the same slice from review result v4. A new classification generation
replaces the slice and clears stale evidence while Changes is pending or
unavailable.

One inspector renderer merges classification evidence with a loaded selected
comparison. Dependency reasons merge by path with sorted selector unions and
unresolved precedence. Retained paths suppress exclusions across all selected
views; shared-impact and ignored-content details remain available. Loaded
evidence is selection-scoped and clears on classification invalidation.
Component ownership facts continue to come from entry reasons and complete
classification; screen-only evidence never implies a changed shared component.

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

Screen Details lists the sorted union of retained dependency-reason paths and
entry `sharedImpact` beneath “Changes to these files may affect this screen:”.
This can show path evidence for an unchanged screen opened from All without
adding a Changes row. The
[membership rule](./mokly-component-changes.md#dependencies-and-styles) owns
when a path becomes a reason.

Group analysed selectors by outcome so one entry shows at most one matched list
and one unresolved list. Union, deduplicate, and sort selectors. An unresolved
outcome with no serialized selector ends with a full stop and no list. Excluded
stylesheets are the sorted union from the selected entry's compared views and
never include a path any selected view retains. Use singular or plural lead
copy from the number of excluded files. Viewport and scheme controls do not
change this evidence; desktop and mobile Details present the same facts.

## Inline Evidence

Merge selected views' matched and unresolved inline selectors into the same
outcome lists as linked stylesheets; union, deduplicate and sort them. Inline
selectors belong in Details, never as a synthetic dependency path or file list.
Their views carry material changes, so they retain ordinary changed-stage copy.

Excluded inline evidence leads with “Styles on this page changed, but none of
the changed styles apply to this screen.” For a saved component variant the
shared wording helper uses “variant” instead of “screen”. Follow directly with the
entry's terminal no-changes line. It supplies no “Examined and excluded” file
list, Changes row, comparison control or stage heading. Shared-impact files
and linked evidence remain available independently. Show the shared-component
affecting note only when affected-consumer evidence names the selected entry,
never solely because inline rules were excluded.

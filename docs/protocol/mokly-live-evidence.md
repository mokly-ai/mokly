# Live catalogue evidence updates

## Delivery Status

Live evidence updates and bounded affected-usage deduplication are implemented.
Deduplication verification is recorded in Milestone 2 of the
[dependency patch upstreaming plan](../../plans/mokabook-dependency-patch-upstreaming.md).

## Revisions and publication

Live Serve distinguishes authored content changes from background evidence.
The existing monotonically increasing numeric `ready`/`update` event versions
remain unchanged. Every live shell also includes a positive
`data-mokly-content-version`, captured with its update version, catalogue,
Changes status and workspace evidence from one request snapshot.

Content version starts at the server's initial update version. A content update
advances both versions; an evidence update advances only the update version.
An omitted update kind means content, including legacy parent/child messages.
Explicit kinds are `content` and `evidence`; invalid IPC kinds are rejected.
Child restarts retain the supervisor's monotonically increasing version boundary.

Exhaustive catalogue/Usage completion and Changes completion publish evidence
updates, with the same generation and cancellation checks as their computation.
Git-only reference changes also clear and replace evidence without advancing
content version. Source/config replacement, resource edits and explicit reload
rules remain content changes. An evidence event never claims that actual content
edits can be ignored.

## Browser adoption

For a newer update or reconnect `ready`, the browser requests its current durable
shell URL without caching. This reuses the existing public shell projection;
it introduces no manifest endpoint and does not transfer the internal catalogue
or baseline inventories. It does not request comparison snapshots or replace
the current iframe documents.

If the fetched content version matches the mounted page, apply its evidence
in place. Its update version must be at least the triggering event version and
the mounted page's version. A later response can catch up beyond its triggering
event. Superseded requests are aborted and cannot apply data or cause a reload.
Page shutdown cancels pending fetches and navigation waits.

The browser retains the navigation tree, All/Changes buttons, current preview
frames, user filter, search, section and folder disclosure, focus, drawer and
scroll state.
Update the count/status, changed-route attributes and baseline-only rows from
the same snapshot. Retained removed rows keep their identity; additions/removals
follow the canonical server order after the current tree. Existing rules for
removed screens/components in All and removed pages only in Changes still apply.
Changes preparing, loading and empty/unavailable states use the existing
sidebar design; `preparing` precedes loading only in
[derived mode](./mokly-derived-baselines.md). A status-only evidence update
carries no routes or snapshot, so entering and leaving `preparing` replaces the
count slot and the selected-Changes sidebar without touching the tree, the
current documents, or the focused control. The tree stays `aria-busy` while
either working state is selected.

Background adoption never runs destination-reveal recovery. A search may
intentionally hide the currently displayed page, and its parent section or
folder may be intentionally collapsed. Evidence completion cannot clear that
search, open the disclosure or scroll the current route into view. Explicit
navigation still reveals its destination using the normal constraint rules.

If the response changes content version, lacks a valid live stamp, cannot be
read, or no longer describes the same workspace, use the existing durable
reload and one-shot recovery. Historical views carry a digest of their removed
entry and ancestor evidence. A changed digest, or a historical view that is no
longer available in the refreshed baseline, also requires reload so its title,
details and previous views stay coherent. Static delivery continues to use its
deployment descriptor and does not start the live update client.

## Navigation races

Progressive navigation announces its pending/settled state. Evidence refresh
waits for pending navigation; a response captured for an old URL or replaced
main view is discarded and retried for the current destination. Navigation
adopts the destination's navigation evidence and update stamp with its main
view. If that response predates already adopted evidence, fetch the destination
again; if content changed, use durable navigation instead. A same-document
history action or saved-variant selection cancels obsolete navigation and
releases evidence waiting for it. Only the current navigation may commit.

## Workspace evidence

Update entry/variant statuses, comparison eligibility, baseline variants,
Details evidence and complete Used by/Affected usage without reinstalling the
workspace. Keep temporary props, current variant/instance selection, inspector
disclosure, highlight state and authenticated preview documents intact. Usage
updates retain matching link elements while adding, removing or changing only
the affected sections and rows, so background completion cannot interrupt a
keyboard interaction with an unchanged link.
Background evidence never calls the preview-source swapping path for a retained
saved variant. Evidence changes invalidate loaded/pending comparisons and return
an active comparison to Current; another explicit selection requests comparison
work. Current browsing makes no comparison request.

On-demand rendering remains authoritative for the usage records associated with
its actual displayed documents, even after exhaustive Usage becomes available.
Retain its preview generation and already loaded per-view usage. Unloaded live
views still request their own records when displayed; exhaustive render-order
records cannot substitute for those documents. Exhaustive catalogue records
supply the complete Used by list.

### Affected-Usage Identity And Ordering

The shared served/published workspace deduplicates Affected usage links after
projecting the selected component's affected-consumer evidence. Two links are
duplicates exactly when `JSON.stringify` of each complete link produces the same
string: every serialized field must match. The fields are `title`, `route`,
optional `variantId`, `viewport`, `colorScheme`, `instanceKey`, `direct`, `removed`,
and `comparisonEligible`; future serialized fields also participate. Preserve
normal JSON field order and omission semantics; do not replace this identity with
route-only, instance-only, or a sorted/subset key.

Keep the first occurrence in evidence order: affected-consumer record order,
then each record's evidence order. Do not sort the result or merge distinct
viewport, color scheme, saved variant, instance, ownership (`direct`), removal,
or comparison-eligibility contexts. Deduplication performs at most one
serialization per input usage link and tracks previously seen keys in one pass;
it must not rescan or reserialize prior links. This changes neither Changes
membership nor comparison eligibility and does not rewrite upstream evidence.

## Acceptance

Desktop/mobile browser regressions assert retained document, navigation-row and
iframe identity, row positions, scroll, focused search/control fields and folder
choices through preparing, pending, ready-zero, ready-nonzero and unavailable
evidence.
Cover Changed selection while its current preview is unchanged, actual Usage
completion during a temporary prop edit, later variant/scheme switches, removed
row membership/order, superseded responses, navigation races, reconnect catch-up
and content updates followed immediately by evidence updates. Genuine source
and resource edits must still refresh the rendered content.
Test affected-link duplicates across evidence records, first-occurrence order,
and distinct fields/contexts; assert at most one serialization per input link,
including duplicates, with the same projection for served and published shells.

# Live catalogue evidence updates

## Revisions and publication

Serve has one update model: the publications and the event stream of the
[Serve update rules](./mokly-shell-delivery.md#updates-in-serve). There is no
separate content or evidence version: a source edit and a usage completion
publish the same way, and the shell decides per frame through each view's
`documentKey` in the index.

Evidence travels only in the index and in the entry details. The index
carries `changesStatus`, each entry's `changes`, each view's `comparison`,
and `removedEntries`; a detail carries one entry's per-view usage, resource
evidence, direct reasons, and workspace lists. There is no evidence route per view or per
navigation state, and a shell page is never fetched as evidence: the stub
holds no data. A completed on-demand render reaches the shell as a
publication whose refreshed detail carries that view's usage as `ready`. A
temporary prop preview of the component controls contract uses the usage
records of its own render response and never enters a detail.
An included entry's detail carries direct `reasons` in the review v8 shape while Changes is ready, independently of workspace readiness.

Document responses do not wait for evidence publication. Completed routes
coalesce into publications of ready or unavailable usage, and a route with no
detail views publishes nothing. Closing Serve stops new publications. A page
or Markdown render does not raise the revision only because its document
completed.
A completion that changes no detail publishes nothing, but its route still
counts as completed. Its current revision and live render validity stay intact.
After a rebuild, ready usage reused for an equal `documentKey` is already
recorded as complete. Its later completion publishes no revision.

A reconnecting shell catches up at once through the message that the event
stream writes on every new connection. The stream exists only in Serve.

## Browser adoption

The shell adopts a publication under the
[Serve update rules](./mokly-shell-delivery.md#updates-in-serve); the page
never reloads for it. During and after adoption the shell keeps the navigation tree, the
All/Changes buttons, the mounted preview frames, the filter, search text,
section and folder disclosure, focus, the drawer, and scroll positions. It
updates the Changes count and status, the changed-entry marks, and the
removed rows from the same state: retained removed rows keep their identity,
and additions and removals follow the canonical server order after the
current tree. Removed screens and components stay in All, and removed pages
and documents appear only in Changes.

A frame whose `documentKey` is unchanged keeps its document, scroll, and
selection. A removed entry's detail is fetched from the generation the
refreshed index names; a record absent from the refreshed index shows the
missing state.

Changes `preparing`, loading, and empty or unavailable states use the sidebar
design of the [on-demand contract](./mokly-on-demand.md); `preparing`
precedes loading only in a per-commit rebuild. A status-only publication
replaces the count slot and the selected-Changes sidebar without touching the
tree, the current documents, or the focused control; the tree stays
`aria-busy` while a working state is selected. Adoption never runs
destination-reveal recovery: a search may hide the current entry and its
folder may be collapsed on purpose, and an update cannot clear that search,
open the disclosure, or scroll the route into view. Explicit navigation still
reveals its destination under the normal rules.

The shell opens one `EventSource` on `/mokly-viewer/events` when the index
carries `live`. Abort and page exit close it and any refresh in flight. `EventSource` is
an optional browser facility: when it is missing, denied, or throws, the shell
still renders the catalogue, reports the transport failure as a browser
warning, and leaves only live updates unavailable; a page load fetches the
current state.

## Navigation races

In-shell navigation commits the route from the installed index at once and
fetches the destination's details, including a current component variant's
parent detail. It announces its pending and settled state. A refresh waits for
pending navigation. It discards detail responses that the current route does
not need and fetches the current destination's details. A refresh and a
navigation adopt the same index and route details, so no detail can disagree
with the index. A same-document history action or a sibling-variant navigation
cancels only obsolete requests and releases a refresh waiting on them. Sibling
variants reuse their parent's held or pending detail at the same revision.
Only the current navigation commits.

## Workspace evidence

Screen and component details omit `workspace` until every input of their lists
is proven. Pending or unavailable consumer usage cannot prove a complete
Used by list. An absent workspace shows "Usage is unavailable until the
catalogue has been checked." and never shows a zero-consumer result.
One unavailable view keeps every Used by list unavailable until the next
render generation.

The route details' workspaces update comparison eligibility, Details evidence,
and the complete Used by and Affected lists in place. A current component
variant reads both lists from its parent's workspace. Only that workspace
proves that its lists are complete. While any route detail is in flight the
Usage panel shows `Loading usage…` of the
[component pages contract](./mokly-component-explorer.md#catalogue-and-component-pages)
without counts,
an empty state, or rows. A failed or rejected read shows its failure copy with
retry after all route details settle. The shell never derives a list from an
incomplete record or shows a zero-consumer result it has not received.
Temporary props, the current instance selection, inspector
disclosure, highlight state, and authenticated preview documents stay intact
across an update. Usage updates keep matching link elements and change only
the affected sections and rows, so an update cannot interrupt a keyboard
interaction with an unchanged link. An update invalidates loaded and pending
comparisons and returns an active comparison to Current; the next explicit
selection requests comparison work against the new state, and browsing
Current makes no comparison request.

### Affected-Usage Identity And Ordering

Serve and `build` deduplicate the `affected` links of a component's detail
after projecting its affected-consumer evidence. Two links are duplicates
exactly when their canonical JSON is equal: every field participates,
`entryPath`, `entryKind`, `title`, `viewport`, `colorScheme`, `instanceKey`,
`direct`, `removed`, and `comparisonEligible`, and so does every field added
later. A component variant uses its own `entryPath`; no route or
saved-variant field exists. Keep the first occurrence in evidence order:
affected-consumer record order, then each record's evidence order. Do not
sort the result or merge distinct entry, view, instance, ownership, removal,
or eligibility contexts. Deduplication changes neither Changes membership nor comparison
eligibility and rewrites no upstream evidence.

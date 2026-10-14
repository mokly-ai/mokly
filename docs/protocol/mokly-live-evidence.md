# Live catalogue evidence updates

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

## Revisions and publication

Serve has one update model: one integer `revision` in the catalogue index,
raised by one per publication, under the
[shell delivery contract](./mokly-shell-delivery.md#updates-in-serve). A
publication is one completed action: a rebuild after a source change, a
Changes completion or status move, a bundle change, or a completed on-demand
render; the server may combine several completions into one publication.
There is no separate content or evidence version: a source edit and a usage
completion publish the same way, and the shell decides per frame through each
view's `documentKey` in the index.

Evidence travels only in the index and in the entry details. The index
carries `changesStatus`, each entry's `changes`, each view's `comparison`,
and `removedEntries`; a detail carries one entry's per-view usage, resource
evidence, and workspace lists. There is no evidence route per view or per
navigation state, and a shell page is never fetched as evidence: the stub
holds no data. A completed on-demand render reaches the shell as a
publication whose refreshed detail carries that view's usage as `ready`. A
temporary prop preview of the component controls contract uses the usage
records of its own render response and never enters a detail.

The event stream at `/mokly-viewer/events` writes one message per
publication whose `id` is the new revision and whose `data` is the server's
`deploymentId`, and one message with the current values on every new
connection, so a reconnecting shell catches up at once and a shell that
reconnects to another server process performs a full page load. The stream
exists only in Serve.

## Browser adoption

On a message whose `data` differs from the installed `deploymentId` the
standalone shell performs a full page load. On a message above the installed
revision the shell cancels a refresh still in flight, fetches the index and the current entry's detail, and adopts them
in one store commit under the shell delivery fences; the page never reloads.
During and after adoption the shell keeps the navigation tree, the
All/Changes buttons, the mounted preview frames, the filter, search text,
section and folder disclosure, focus, the drawer, and scroll positions. It
updates the Changes count and status, the changed-entry marks, and the
removed rows from the same state: retained removed rows keep their identity,
and additions and removals follow the canonical server order after the
current tree. Removed screens and components stay in All, and removed pages
and documents appear only in Changes.

The shell reloads only the mounted frames whose `documentKey` in the
refreshed index changed, whether the frame shows a screen or component view,
a page, a document, or a use-case step; a frame whose key is unchanged keeps
its document, scroll, and selection. When the refreshed index does not list the current entry, the route shows the
missing state and keeps the URL. A removed entry's detail is fetched from the
generation the refreshed index names; a record absent from the refreshed index shows the missing state. When a fetch fails or the pair disagrees after
one more index fetch, the shell keeps its installed state and shows the entry
as unavailable with retry, and the next message starts a fresh refresh.

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

## Navigation races

In-shell navigation commits the route from the installed index at once and
fetches the destination's detail; it announces its pending and settled state.
A refresh waits for pending navigation, and a detail response for a route other than the current one is discarded and
repeated for the current destination. A refresh and a navigation adopt the same pair of index and
detail, so neither can install a detail that disagrees with the index. A
same-document history action or a sibling-variant navigation cancels obsolete
requests and releases a refresh waiting on them. Only the current navigation
commits.

## Workspace evidence

The detail's `workspace` updates entry statuses, comparison eligibility,
Details evidence, and the complete Used by and Affected lists in place. While
the detail is in flight the Usage panel shows the loading copy of the
on-demand contract without counts, an empty state, or rows; a failed or
rejected read shows its failure copy with retry; the shell never derives a
list from an incomplete record or shows a zero-consumer result it has not
received. Temporary props, the current instance selection, inspector
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
or eligibility contexts. Deduplication serializes each link once and tracks
seen keys in one pass. It changes neither Changes membership nor comparison
eligibility and rewrites no upstream evidence.

## Acceptance

Desktop and mobile browser coverage asserts retained document, navigation
row, and frame identity, row positions, scroll, the focused search or control
field, and folder choices across `preparing`, `pending`, ready with zero,
ready with changes, and `unavailable` states. Cover a Changed selection while
its preview is unchanged, a usage completion during a temporary prop edit,
later variant and scheme switches, removed row membership and order,
superseded responses, navigation races, reconnect catch-up, and two
publications in quick succession. Cover the loading, failed, and retry
presentation without a partial or zero list, and a refresh that reloads only
the frames whose key changed. A source or resource edit must still refresh
the rendered content. Test affected-link duplicates across evidence records,
first-occurrence order, and distinct contexts, with one serialization per
link and the same projection in Serve and the static output.

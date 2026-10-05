# Standalone Shell Bootstrap

## Delivery Status

Implemented: Serve uses a serialize-once scoped model and strict reader; static
delivery validates captured pages and keeps the public catalogue v4 and
application-owned `MoklyViewer` sources complete.

## Purpose And Boundary

Every standalone shell page contains one
`<script type="application/json" data-mokly-shell-bootstrap>`. The bootstrap
recreates the exact inputs used for server rendering so the browser can hydrate
the existing React tree. It contains public display data only. Private
workspace evidence, renderer capabilities, tokens, Git evidence, and source
inventories never enter it; see [Live capabilities](./mokly-live-capabilities.md).

- **Live Serve** embeds an entry-scoped projection of the accepted public read
  model together with the page view and shell context.
- **Static export and repository preview** embed the existing compact external
  reference: `kind: "external"`, the fixed `/__mokly/catalogue.json` path, and
  its identity and revision. The browser resolves it against the one complete,
  finalized deployment catalogue before hydration.

Both forms retain the existing view discriminants: home, missing, or target. A
target records its `entryPath` and kind plus an optional opaque snapshot identity.
Resolving that identity against the bootstrap catalogue binds it to the exact
current or historical record; any selected snapshot must match that record.
Context retains the base, revisions, comparison and preview state, optional
fragment, appearance, and static delivery descriptor. The resolved view and
context determine scope; no serialized list of permitted usage is trusted.

## Entry-Scoped Live Catalogue

The live projection retains the complete catalogue index needed to render the
shell: identity, deployment and revision fields, Changes state, comparison URL,
folder trees, entries, removed records, folder paths, controls, props,
comparison selections, and every view axis. Component variants remain flat
entries with `variantOf`. The projection changes only each view's `usage` value.

The public `CatalogueUsage` union remains `ready | pending | unavailable`.
`@mokly/viewer/runtime` additionally types this bootstrap-only state:

```ts
type ShellCatalogueUsage = CatalogueUsage | { status: "omitted" };
```

`omitted` means that valid usage may exist but is outside this page's entry
scope. It never means empty, unavailable, or unrecorded. An omitted view keeps
its axes and comparison state; its document path remains derivable from path, viewport, and scheme. No instances, slots, or ranges are serialized with it.

Derive the exact retained scope from the bootstrap's own resolved view:

| Bootstrap view                                | Usage that must be retained                                     |
| --------------------------------------------- | --------------------------------------------------------------- |
| Current screen, including a screen variant    | Every view of that selected screen                              |
| Current component parent or component variant | Every variant view belonging to that component parent           |
| Current use case                              | Every view of each screen named by its steps                    |
| Selected removed screen                       | Every view on that exact historical record                      |
| Selected removed component parent or variant  | Every retained variant view belonging to that historical parent |
| Selected removed page or use case             | None; those records own no view usage                           |
| Current page, home, or missing entry          | None                                                            |

Duplicate use-case steps do not duplicate data. In-scope views preserve their
real `ready`, `pending`, or `unavailable` value byte-for-byte. Every other
screen view and component-variant view is present with exactly
`{ "status": "omitted" }`.

Changing usage on an out-of-scope entry must not change this page's serialized
bootstrap. Changing index data, entry-owned usage, view/context state, or an
in-scope use-case step may change it.

## Readers And Validation

The public `readCatalogue` boundary accepts only complete catalogue v4. It
rejects `omitted` at any current or historical screen/component view. The
public types, schema version, canonical serializer, and
`docs/protocol/fixtures/catalogue-v4.json` bytes do not change.

The live reader validates context and view fields, parses the shell catalogue
with ordinary value, hierarchy, snapshot, and reference checks, resolves entry
path and validates kind and any snapshot, then derives scope from that record. Every in-scope
view must carry real usage and every other view exactly `omitted`; retained
ready records still receive full instance, slot, range, props, key, and
ownership validation.

The reader rejects malformed usage and any entry/snapshot scope with missing,
leaked, misplaced, or dangling records.

`readLiveShellBootstrap` accepts only an exactly scoped bootstrap that passes
every strict scope rule above. Browser hydration, route evidence and live
refresh all use that boundary; complete live bootstraps and partial or leaked
hybrids are rejected. The companion state reader additionally accepts the
unchanged compact static external form. Static external bootstraps and
`readCatalogue` otherwise keep their existing readers.

The external bootstrap reader validates the compact reference as today. After
the complete deployment catalogue is fetched, identity, content revision,
evidence revision, deployment identity, entry identity, and snapshot must all match
before hydration. That complete catalogue remains suitable for the public
reader and contains no `omitted` state.

## Private Workspace And Usage Presentation

Cross-entry Usage is private shell evidence, not a value reconstructed from a
partial public projection. Serve computes the initial `WorkspaceData` from the
complete private catalogue. Its capability descriptor supplies complete
entry workspace, including complete `Used by` and `Affected` lists for a
selected component. Entry and live evidence responses pair that private
workspace with the destination's entry-scoped public bootstrap.

A workspace derived from a complete public catalogue, including a resolved
static deployment or application-owned viewer source, keeps the existing
fallback behavior. A workspace derived from an entry-scoped live catalogue must
not scan omitted usage, publish a partial list, or infer zero consumers.

The routed workspace has three delivery states:

- **Loading:** private evidence for the current entry has not been adopted.
  Usage shows `Loading usage…`; it shows no counts, empty state, `Used by`, or
  `Affected` rows.
- **Ready:** matching private workspace evidence was adopted atomically. Real
  lists render, including the existing explicit zero-consumer state.
- **Failed:** the current entry-evidence read failed or its candidate was
  rejected. Usage shows `Usage couldn’t be loaded.` and a `Try again` button.
  Retry repeats the evidence read without remounting the workspace.

An ordinary real `unavailable` usage record remains distinct from delivery
failure and keeps its existing catalogue-checking copy. A matching initial
descriptor may begin Ready on direct load; the shell must not insert a Loading
flash before adopting that descriptor.

Ready in a live shell always means private evidence bound to the current
request: the same entry path and the same source revision. The initial descriptor
workspace seeds only the first request's binding. After the entry or source
changes, the shell never falls back to that page-lifetime copy. Returning to
the first entry after visiting another one is therefore Loading, then Ready or
Failed, like any other navigation. Static and application-owned shells have no
live request and keep their inert initial and destination evidence.

Displayed frames treat `omitted` as pending. Inspection uses the existing
`Waiting for the component preview.` state until matching entry evidence
commits real usage. The commit updates mounted frame usage in place: it does
not replace the iframe, reset selection, lose focus, or clear valid local
workspace state. A failed read moves Usage to Failed while inspection remains
unavailable; it never presents omitted usage as a real empty view.

## Atomic Entry And Evidence Adoption

In-shell navigation commits the destination entry immediately, then reads its
shell page as evidence. The fetched scoped catalogue, source descriptor, and
private workspace when that entry owns one are a single candidate. Accept all
of them or retain the installed candidate; never accumulate retained usage from
previously visited entries.

Every committed live target entry performs that evidence read, including use
cases and pages that own no private workspace. This keeps the installed scope
aligned with the destination: a use case adopts its step screens' usage, while
a page adopts the zero-usage scope. While either read is pending, and if it
fails, complete index data still lets those frames load and navigate normally;
any usage left omitted is treated as pending and cannot enable inspection or
produce a partial cross-route list.

The candidate must pass the live-capability entry path, location, base, catalogue
identity, content/evidence revision, update version, preview/renderer
generation, token, snapshot, and cancellation fences. Its private workspace
must identify the current entry's exact screen or component. On acceptance,
replace the installed scoped catalogue and workspace in one store commit.

Live evidence refresh follows the same rule for the current entry. Complete
`Used by` and `Affected` data comes from its paired private workspace. Per-view
usage loaded on demand for an actual displayed document remains authoritative
under the existing generation rules; the scoped bootstrap does not weaken or
replace it.

## Serialize Once

The server serializes the shell bootstrap and, when present, the private
capability descriptor once per page. The document component receives those
serialized strings and inserts them unchanged. Server rendering must not invoke
either serializer a second time.

The browser retains the exact script text it parsed and passes that text into
the hydration tree. Drawer changes, route announcements, evidence adoption,
and any other React render keep the original script bytes and invoke no
bootstrap or descriptor serializer.

Canonical reproduction remains an invariant: parsing and validating either
embedded state, then serializing it once with the canonical serializer and
inline-script escaping, must reproduce the original script text exactly. Tests
enforce that invariant for live and captured example pages; repeated runtime
serialization is not a correctness mechanism.

## Capture And Static Delivery

Export and repository preview validate the complete published catalogue once
per build. Each captured Serve page must pass the scoped reader and exactly
match the projection derived from that catalogue and view, apart from the
existing deployment, revision, comparison-path, and finalized-preview
normalizations. Capture then installs the compact external reference.

Comparison is exact for all data the captured page carries. It cannot compare a
scoped model directly with the complete published model, ignore extra retained
usage, or accept missing entry-owned usage.

For identical catalogue, consumer, and comparison inputs,
`__mokly/catalogue.json`, canonical shell HTML, workspace JSON,
ownership inventory, and comparison files remain byte-identical to the
pre-scope export after replacing each tree's deployment identity with 64
zeroes. Files under `__mokly/client/` may change when checked, type-checked
viewer source changes. Across the route-scoping switch, the final deployment
identity may therefore change only because those client bytes changed; all
other identity inputs must match after normalization. Static pages still
resolve and validate the one complete catalogue and retain their current
fallback Usage behavior.

## Size And Regression Guardrails

Measure the UTF-8 bytes inside `data-mokly-shell-bootstrap` after canonical
serialization and script escaping.
Every Serve entry in the real example catalogue must stay below 1 MiB
(1,048,576 bytes). Raising that limit requires a protocol update with new
measurements and rationale.

Regression tests must also prove that changing only an out-of-scope entry's
usage leaves the selected page's bootstrap bytes identical. This invariant is
required for screen, component, use-case, historical, and zero-usage-scope
entries.

## Acceptance

Acceptance requires:

- scope coverage for current screen/variant, component, use case, page, home,
  missing, and every selected removed entry kind;
- rejection of leaked, missing, misplaced, malformed, and public-catalogue
  `omitted` usage;
- canonical scoped-bootstrap round trips and unchanged public v4 fixture bytes;
- server/hydration serializer call counts of one/zero after initial creation;
- no hydration mismatch in development React and no iframe remount on usage
  adoption;
- Loading → Ready, Loading → Failed, retry, no false-zero flash, and instance
  deep-link coverage with delayed entry evidence, including a return to the
  first-loaded entry;
- atomic entry and live-evidence adoption with stale, mixed, rejected, aborted,
  and historical candidates;
- scoped capture drift rejection plus normalized static-content invariance,
  with any client and deployment-identity changes accounted for; and
- the out-of-scope invariance and real-example 1 MiB limits above.

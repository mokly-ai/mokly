# Standalone Shell Bootstrap

## Delivery Status

The serialize-once embedded-state boundary is implemented by Milestone 3 of the
[route-scoped shell bootstrap plan](../../plans/route-scoped-shell-bootstrap.md).
Milestone 4 implements the runtime-only scoped model, shared route resolver,
pure projection and strict scoped reader as isolated data-layer entry points.
Milestone 5 implements scoped shell hydration, frame and Usage presentation,
route/live evidence adoption and retry. Milestone 6 implements scoped Serve
emission, strict live reading and captured-page validation. The public
catalogue v1 format, static artifact bytes, and application-owned `MoklyViewer`
sources remain unchanged.

## Purpose And Boundary

Every standalone shell page contains one
`<script type="application/json" data-mokly-shell-bootstrap>`. The bootstrap
recreates the exact inputs used for server rendering so the browser can hydrate
the existing React tree. It contains public display data only. Private
workspace evidence, renderer capabilities, tokens, Git evidence, and source
inventories never enter it.

There are two serialized forms:

- **Live Serve** embeds a route-scoped projection of the accepted public read
  model together with the page view and shell context.
- **Static export and repository preview** embed the existing compact external
  reference: `kind: "external"`, the fixed `/__mokly/catalogue.json` path, and
  its identity and revision. The browser resolves it against the one complete,
  finalized deployment catalogue before hydration.

Both forms retain the existing view discriminants: home, missing, or target. A
target records its canonical route. Resolving that route against the bootstrap
catalogue binds it to the exact current or historical record and its opaque
snapshot identity; any selected snapshot query must match that record. Context
retains the base, revisions, comparison and preview state, optional fragment,
appearance, and static delivery descriptor. The resolved view and context
determine scope; no serialized list of permitted usage is trusted.

## Route-Scoped Live Catalogue

The live projection retains the complete catalogue index needed to render the
shell: identity, deployment and revision fields, Changes state, comparison URL,
collections and trees, routed entries, removed records and ancestor labels,
details, tags, paths, saved variants, controls, props, comparison selections,
and every view axis. It changes only each view's `usage` value.

The public `CatalogueUsage` union remains `ready | pending | unavailable`.
`@mokly/viewer/runtime` additionally types this bootstrap-only state:

```ts
type ShellCatalogueUsage = CatalogueUsage | { status: "omitted" };
```

`omitted` means that valid usage may exist but is outside this page's route
scope. It never means empty, unavailable, or unrecorded. An omitted view keeps
its fragment path and comparison state. No instances, slots, or ranges are
serialized with it.

Derive the exact retained scope from the bootstrap's own resolved view:

| Bootstrap view                             | Usage that must be retained                         |
| ------------------------------------------ | --------------------------------------------------- |
| Current screen, including a screen variant | Every view of that selected screen                  |
| Current component                          | Every view of every saved variant on that component |
| Current use case                           | Every view of each screen named by its steps        |
| Selected removed screen or component       | Every view on that exact historical record          |
| Selected removed page or use case          | None; those records own no view usage               |
| Current page, home, or missing route       | None                                                |

Duplicate use-case steps do not duplicate data. In-scope views preserve their
real `ready`, `pending`, or `unavailable` value byte-for-byte. Every other
screen view and component-variant view is present with exactly
`{ "status": "omitted" }`.

Changing usage on an out-of-scope entry must not change this page's serialized
bootstrap. Changing index data, route-owned usage, view/context state, or an
in-scope use-case step may change it.

## Readers And Validation

The public `readCatalogue` boundary accepts only complete catalogue v1. It
rejects `omitted` at any current or historical screen/component view. The
public types, schema version, canonical serializer, and
`docs/protocol/fixtures/catalogue-v1.json` bytes do not change.

The live bootstrap reader performs these steps as one validation boundary:

1. Parse and validate the known context and view fields.
2. Parse the shell catalogue with the bootstrap-only usage union while keeping
   all ordinary value, path, hierarchy, snapshot, and reference checks.
3. Resolve the view, including its historical snapshot when present.
4. Derive the permitted usage scope from that resolved view.
5. Require every in-scope view to contain real usage and every out-of-scope
   view to contain `omitted`.
6. Fully validate ready instance, slot, range, props, key, and ownership
   records only for retained views. Omitted views carry no such records to
   validate.

The reader rejects leaked out-of-scope usage, omitted in-scope usage, a scope
that does not match the route/snapshot, dangling references, and all malformed
real usage. It does not accept a producer-declared scope as evidence.

`readLiveShellBootstrap` accepts only an exactly scoped bootstrap that passes
every strict scope rule above. Browser hydration, route evidence and live
refresh all use that boundary; complete live bootstraps and partial or leaked
hybrids are rejected. The companion state reader additionally accepts the
unchanged compact static external form. Static external bootstraps and
`readCatalogue` otherwise keep their existing readers.

The external bootstrap reader validates the compact reference as today. After
the complete deployment catalogue is fetched, identity, content revision,
evidence revision, deployment identity, route, and snapshot must all match
before hydration. That complete catalogue remains suitable for the public
reader and contains no `omitted` state.

## Private Workspace And Usage Presentation

Cross-route Usage is private shell evidence, not a value reconstructed from a
partial public projection. Serve computes the initial `WorkspaceData` from the
complete private catalogue. Its capability descriptor supplies complete
route workspace, including complete `Used by` and `Affected` lists for a
selected component. Route and live evidence responses pair that private
workspace with the destination's route-scoped public bootstrap.

A workspace derived from a complete public catalogue, including a resolved
static deployment or application-owned viewer source, keeps the existing
fallback behavior. A workspace derived from a route-scoped live catalogue must
not scan omitted usage, publish a partial list, or infer zero consumers.

The routed workspace has three delivery states:

- **Loading:** private evidence for the current route has not been adopted.
  Usage shows `Loading usage…`; it shows no counts, empty state, `Used by`, or
  `Affected` rows.
- **Ready:** matching private workspace evidence was adopted atomically. Real
  lists render, including the existing explicit zero-consumer state.
- **Failed:** the current route-evidence read failed or its candidate was
  rejected. Usage shows `Usage couldn’t be loaded.` and a `Try again` button.
  Retry repeats the evidence read without remounting the workspace.

An ordinary real `unavailable` usage record remains distinct from delivery
failure and keeps its existing catalogue-checking copy. A matching initial
descriptor may begin Ready on direct load; the shell must not insert a Loading
flash before adopting that descriptor.

Displayed frames treat `omitted` as pending. Inspection uses the existing
`Waiting for the component preview.` state until matching route evidence
commits real usage. The commit updates mounted frame usage in place: it does
not replace the iframe, reset selection, lose focus, or clear valid local
workspace state. A failed read moves Usage to Failed while inspection remains
unavailable; it never presents omitted usage as a real empty view.

## Atomic Route And Evidence Adoption

In-shell navigation commits the destination route immediately, then reads its
shell page as evidence. The fetched scoped catalogue, source descriptor, and
private workspace are one candidate. Accept all of them or retain the installed
candidate; never accumulate retained usage from previously visited routes.

Every committed live target route performs that evidence read, including use
cases and pages that own no private workspace. This keeps the installed scope
aligned with the destination: a use case adopts its step screens' usage, while
a page adopts the zero-usage scope. While either read is pending, and if it
fails, complete index data still lets those frames load and navigate normally;
any usage left omitted is treated as pending and cannot enable inspection or
produce a partial cross-route list.

The candidate must pass the live-capability route, location, base, catalogue
identity, content/evidence revision, update version, preview/renderer
generation, token, snapshot, and cancellation fences. Its private workspace
must identify the current route's exact screen or component. On acceptance,
replace the installed scoped catalogue and workspace in one store commit.

Live evidence refresh follows the same rule for the current route. Complete
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
per build. For every captured Serve page they then:

1. parse and validate its route-scoped live bootstrap;
2. project the complete published catalogue with the same bootstrap view and
   scope resolver;
3. compare the captured scoped model with that expected scoped projection,
   applying only the existing deployment, revision, comparison-path, and
   finalized-preview normalizations; and
4. replace the inline model with the existing compact external reference.

Comparison is exact for all data the captured page carries. It cannot compare a
scoped model directly with the complete published model, ignore extra retained
usage, or accept missing route-owned usage.

For identical inputs, `__mokly/catalogue.json`, canonical and alias shell HTML,
workspace JSON, ownership inventory, comparison files, and deployment identity
remain byte-identical to the pre-scope export. Static pages still resolve and
validate the one complete catalogue and retain their current fallback Usage
behavior.

## Size And Regression Guardrails

Measure bootstrap size as the UTF-8 byte length of the text inside
`data-mokly-shell-bootstrap`, after canonical serialization and script escaping.
Every Serve route in the real example catalogue must stay below 1 MiB
(1,048,576 bytes). Raising that limit requires a protocol update with new
measurements and rationale.

Regression tests must also prove that changing only an out-of-scope entry's
usage leaves the selected page's bootstrap bytes identical. This invariant is
required for screen, component, use-case, historical, and zero-usage-scope
routes.

## Acceptance

Acceptance requires:

- scope coverage for current screen/variant, component, use case, page, home,
  missing, and every selected removed entry kind;
- rejection of leaked, missing, misplaced, malformed, and public-catalogue
  `omitted` usage;
- canonical scoped-bootstrap round trips and unchanged public v1 fixture bytes;
- server/hydration serializer call counts of one/zero after initial creation;
- no hydration mismatch in development React and no iframe remount on usage
  adoption;
- Loading → Ready, Loading → Failed, retry, no false-zero flash, and instance
  deep-link coverage with delayed route evidence;
- atomic route and live-evidence adoption with stale, mixed, rejected, aborted,
  and historical candidates;
- scoped capture drift rejection plus byte-identical export and repository
  preview artifacts for identical inputs; and
- the out-of-scope invariance and real-example 1 MiB limits above.

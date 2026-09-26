# Route-Scoped Shell Bootstrap

Make every `mokly serve` page carry the catalogue index plus only the component
usage its own route renders, instead of every screen's usage, and stop
re-serialising that embedded state on every render. The public
`__mokly/catalogue.json` stays unchanged. Static content stays byte-identical
after deployment-identity normalization; viewer client files and the identity
derived from them may change.

## Problem

Each Serve page embeds `<script data-mokly-shell-bootstrap>`, built by
`shellBootstrap` in
[`bootstrap.ts`](../packages/viewer/src/standalone/bootstrap.ts) from the
complete public read model. For the example catalogue this is 3.5 MB of a
3.8 MB page, and 3.2 MB of it is per-view component usage (instances, slots
and ranges): 238 screen views and 3,234 instance records. The embedded model
is identical on every route.

Parsing is cheap (19 ms); reading is not. `readCatalogue` fully re-validates
every usage record: `validateViews` in
[`references.ts`](../packages/viewer/src/catalogue/references.ts) calls
`validateComponentViewRecord` in
[`view_validation.ts`](../packages/viewer/src/components/view_validation.ts),
which re-decodes and validates props, re-encodes canonical JSON and recomputes
SHA-256 material keys and instance/slot keys. It takes 573 ms in Node 24, and a
Chrome profile showed the same cost on the main thread.
`StandaloneDocumentContents` in
[`document.tsx`](../packages/viewer/src/standalone/document.tsx) also calls
`serializeShellBootstrap` inline in its JSX, so every document re-render
re-serialises the bootstrap (65 ms; 51 of the 146 ms spent by a
development-mode drawer toggle).

That cost is paid:

1. on every Serve page load, when
   [`browser.tsx`](../packages/viewer/src/browser.tsx) hydrates;
2. on every in-shell navigation, because `loadRouteEvidence` in
   [`react_capabilities.ts`](../src/client/react_capabilities.ts) fetches the
   destination's whole shell page and `readViewerRouteEvidenceRevision` in
   [`host_capabilities.ts`](../packages/viewer/src/client/host_capabilities.ts)
   re-reads the entire catalogue;
3. on every live evidence refresh, because `refreshEvidence` fetches the
   current shell URL and then fetches the complete `__mokly/catalogue.json`;
   and
4. for every page captured by export and repository preview builds, because
   `externalizeCapturedShell` in
   [`captured_shell.ts`](../src/export/captured_shell.ts) parses, validates,
   deep-compares and re-serialises each captured bootstrap.

The effect on verification is large. The CI ordinary-preview fixture build took
18 s before [#95](https://github.com/mokly-ai/mokly/pull/95) (the hydrated
shell), 77 s at #95 and 97 s after
[#96](https://github.com/mokly-ai/mokly/pull/96) added dark views. Locally,
`tests/preview.test.ts` takes 6m42s and the four browser setup builds take
11m21s. Each `react_shell_hydration_routes` test spends roughly 0.6–0.8 s of its
2.9 s median on this data. Page cost grows with screens × views × component
instances, independently of the route being viewed.

A prototype that keeps only the current route's usage measured 360–445 KB and
23–39 ms of `readCatalogue` across six representative routes.

## Decisions

1. **Public catalogue v1 is unchanged.** `__mokly/catalogue.json` stays
   complete. Embedded viewers, upload and ownership inventories, the v1 fixture
   and the conformance tests keep their bytes. Static exports keep their compact
   external bootstraps that reference the shared catalogue.
2. **Serve bootstraps are route-scoped.** A live bootstrap embeds every entry's
   index data (identity, details, tags, Changes, tree, fragment paths and
   comparison selections) but real usage only for the views its route renders:

   | Route                         | Usage kept                                           |
   | ----------------------------- | ---------------------------------------------------- |
   | Screen, including a variant   | That screen's own views                              |
   | Component                     | Every saved-variant view the component page can show |
   | Use case                      | Each step screen's views                             |
   | Selected removed entry        | The selected historical record's views               |
   | Page, home and missing routes | None                                                 |

   Every other view carries a new `{ status: "omitted" }` usage state.
   `omitted` exists only in shell bootstraps and is typed in the
   `@mokly/viewer/runtime` subpath; the public `CatalogueUsage` union and the v1
   schema are unchanged. In-scope views keep their real `ready`, `pending` or
   `unavailable` state.

3. **Scope is derived and enforced, not declared.** The bootstrap reader derives
   the scope from the bootstrap's own `view` (route and snapshot). It rejects
   out-of-scope usage that is not `omitted` and in-scope usage that is. The
   `catalogue.json` reader rejects `omitted` anywhere.
4. **Cross-route data comes only from the private workspace.** `Used by` and
   `Affected` lists are computed on the server from the complete private
   catalogue and delivered with the initial capability descriptor, route
   evidence and live evidence. A fallback workspace computed from a
   route-scoped catalogue never derives those lists from partial data. It
   reports usage as loading until private evidence is adopted, and as failed
   when that read fails or is rejected. Complete catalogues (static export and
   embedded viewers) keep today's fallback behavior.
5. **Displayed frames treat omitted usage as pending.** Inspection shows its
   existing waiting state until the route-evidence commit supplies the route's
   usage in place, without remounting frames or replacing previews.
6. **Serialise once.** The server serialises each bootstrap and capability
   descriptor once per page. The browser hydrates with the exact embedded text
   and never re-serialises on later renders. The existing rule that validating
   then serialising hydration state reproduces the embedded bytes stays
   enforced by tests instead of by per-render work.
7. **Capture compares scoped projections.** Export and repository preview
   capture validate each captured route-scoped bootstrap and compare it with the
   route-scoped projection of the published model for that page. For the same
   catalogue, consumer and comparison inputs, the catalogue, canonical and
   alias shells, workspace JSON, ownership inventory and comparison files stay
   byte-identical after replacing each tree's deployment identity with zeroes.
   Files under `__mokly/client/` may change with viewer source; across this
   switch, only those client changes may cause the deployment identity to
   change. The supervisor corrected the earlier whole-artifact byte-identity
   requirement after Milestone 6 exposed that it required unreviewed build-time
   source rewriting.
8. **Guard the class of regression.** Tests assert that a page's bootstrap
   bytes do not change when another entry's usage changes, and that the example
   catalogue's largest Serve bootstrap stays under 1 MiB, more than twice the
   prototype's 445 KB maximum. Raising that budget requires updating the
   protocol.

## Non-Goals

- Static-export page loads still fetch and validate the complete
  `catalogue.json` once per full page load (about 0.5 s of script time for the
  example). A lean deployment index or a validated-catalogue cache is a
  separate follow-up.
- No change to embedded `MoklyViewer` sources, catalogue v1, upload v1,
  ownership v1, review v2/v3 or delivery descriptor v2.
- No change to test sharding or to the routes the hydration spec covers.

## Milestone 1: Protocol And Documentation Contract

Summary: define the route-scoped bootstrap, its reader rules and its UI states
completely before any code changes.

- [x] Add `docs/protocol/mokly-shell-bootstrap.md`, kept near 250 lines,
      defining: the live route-scoped and static external bootstrap forms; the
      usage-scope table and the bootstrap-only `omitted` state; reader rules for
      bootstraps versus `catalogue.json`; ownership of cross-route `Used by` and
      `Affected` data; the loading and failed usage presentation; the
      serialise-once rule and its tested byte-reproduction invariant; capture
      comparison rules; the size guardrails; and acceptance tests. Link it from
      [`docs/protocol/README.md`](../docs/protocol/README.md).
- [x] Update the hydration section and acceptance list of
      [`mokly-viewer.md`](../docs/protocol/mokly-viewer.md): Serve embeds the
      route-scoped projection of the read model rather than the model itself.
- [x] Update [`mokly-catalogue.md`](../docs/protocol/mokly-catalogue.md):
      `catalogue.json` stays complete and never contains `omitted`; shell
      bootstraps use the route-scoped projection.
- [x] Update
      [`mokly-live-capabilities.md`](../docs/protocol/mokly-live-capabilities.md):
      route evidence adopts the destination's scoped catalogue atomically with
      its private workspace; the fallback workspace reports loading or failed
      usage and never a partial `Used by` list.
- [x] Update [`mokly-live-evidence.md`](../docs/protocol/mokly-live-evidence.md):
      complete `Used by` and `Affected` usage comes from the private workspace;
      evidence refresh adopts the current route's scoped bootstrap; retained
      per-view usage rules are unchanged.
- [x] Update
      [`mokly-export-delivery.md`](../docs/protocol/mokly-export-delivery.md):
      Serve's inline read model is route-scoped, captured-shell externalisation
      compares scoped projections, and exported artifacts are unchanged.
- [x] Update [`mokly-on-demand.md`](../docs/protocol/mokly-on-demand.md) and
      [`mokly-component-explorer.md`](../docs/protocol/mokly-component-explorer.md)
      with the loading and failed Usage states and their product copy.
- [x] Define the Loading and recovery gallery, its collection, screen ids,
      routes and copy in prose in
      [`mokly-component-design.md`](../docs/protocol/mokly-component-design.md),
      while leaving its canonical inventory table and counts aligned with the
      32 screens that currently exist.
- [x] Update the bootstrap, reader and adoption descriptions wherever they
      appear in
      [`packages/viewer/README.md`](../packages/viewer/README.md),
      [`packages/viewer/src/shell/README.md`](../packages/viewer/src/shell/README.md),
      [`packages/viewer/src/client/README.md`](../packages/viewer/src/client/README.md),
      [`src/catalogue/README.md`](../src/catalogue/README.md),
      [`src/client/README.md`](../src/client/README.md),
      [`src/server/README.md`](../src/server/README.md) and
      [`src/export/README.md`](../src/export/README.md).
- [x] Add this plan to the active list in [`plans/README.md`](./README.md).
- [x] Validate the changed Markdown with `npm run format:check`, run
      `npm run prepare:verification` and the complete `npm run test:prepared`
      unit suite, and review the diff. Documentation-only work does not require
      `cargo xtask check`, but docs, READMEs, plans and fixtures are unit-test
      inputs, so every later documentation-only change under this plan must
      repeat the prepared unit suite.
- [x] `git add -A`, commit with Conventional Commits, and push the branch.
- [x] After the push, use
      [the implementation review prompt](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main`; report
      numbered, severity-rated findings with options and recommendations
      without changing the implementation.

## Milestone 2: Usage Loading Mockups

Tags: mockup

Summary: design the transient and failed usage states in Mokly's design
catalogue before any UI implementation.

- [x] Add `examples/basic/entries/design/components/states/loading/screens.tsx`
      exporting a loading-states collection nested under
      `design-component-states`, following the existing `additions` child
      collection, because the States page already renders five screens. Add
      mobile and desktop screen components for:
  - [x] a component page just opened from navigation, with Usage showing the
        loading state instead of `Used by` and `Affected`;
  - [x] screen inspection while the displayed preview's usage is still loading,
        reusing the existing "Waiting for the component preview." state unless
        Milestone 1 defined replacement copy; and
  - [x] usage that could not load, with the product copy and recovery action
        defined in Milestone 1.
- [x] Extend `ComponentPage`, `ScreenPage`, `screen_details.tsx` and
      `component_usage.tsx` under
      `examples/basic/entries/design/components/parts/` with the new states,
      reusing the existing inspector parts. Keep implementation notes outside
      the rendered screens and use product language only.
- [x] Extend the reusable design `ViewControls` unavailable-reason contract
      with the loading state so the disabled Highlight control uses the exact
      `Waiting for the component preview.` copy.
- [x] Link the new collection from the States collection so every new screen is
      reachable, and keep each page at five screens or fewer.
- [x] After the screens exist in the example registry, add their three rows to
      the canonical inventory table in `mokly-component-design.md` and update
      both component-route counts from thirty-two to thirty-five.
- [x] Update `examples/basic/README.md` from 92 to 95 total design screens,
      from 32 to 35 component-design routes, and from 71 to 74 Light-only
      screens, and document the new Loading and recovery gallery.
- [x] Update the design inventory tests (`tests/design_*.test.ts`) for the
      added routes.
- [x] Run `npm run build`, `npm run example:build` and `npm run example:check`,
      then visually smoke-test the new pages at both viewports through
      `npm run dev`.
- [x] Run the complete `cargo xtask check` gate with no failures or skips.
- [x] After checks pass, `git add -A`, commit with Conventional Commits, and
      push the branch.
- [x] After the push, use
      [the implementation review prompt](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main`; report
      numbered, severity-rated findings with options and recommendations
      without changing the implementation.

## Milestone 3: Serialise The Bootstrap Once

Tags: ui

Summary: remove per-render re-serialisation independently of the payload
change, so current Serve pages benefit immediately. This changes only the
viewer's document rendering and browser entry, not the CLI server.

- [x] Add failing tests first proving that server rendering serialises each
      embedded script exactly once, and that hydration plus later shell
      re-renders (drawer toggle and route announcement) serialise nothing.
- [x] Pass pre-serialised JSON into `StandaloneShellDocument`:
      `renderHydratedShellPage` in
      [`shell/document.tsx`](../packages/viewer/src/shell/document.tsx)
      computes it once, `hydrateMoklyShell` passes the text it already read from
      the DOM, and `StandaloneDocumentContents` renders the given strings for
      the bootstrap and capability-descriptor scripts.
- [x] Keep the byte-reproduction invariant as a test over served and captured
      example pages.
- [x] Update the bootstrap and viewer protocol delivery status for the
      implemented serialize-once boundary.
- [x] Run the development-hydration specs (`react_shell_hydration*.spec.ts`
      and `react_shell_static_hydration.spec.ts`) plus the static delivery and
      capture tests, and record drawer-toggle main-thread time before and after.
  - Interaction profile on 2026-09-25, using
    `.context/test-timings/interaction-profile.mjs` for both bundles:
    - Development before: 215 ms wall, 156 ms JavaScript busy, 55 ms attributed
      to bootstrap serialization.
    - Development after: 159 ms wall, 100 ms JavaScript busy, 1 ms attributed
      to bootstrap serialization.
    - Production before: 170 ms wall, 114 ms JavaScript busy, 0 ms attributed
      by the minified-bundle profiler.
    - Production after: 100 ms wall, 43 ms JavaScript busy, 0 ms attributed by
      the minified-bundle profiler.
- [x] Run the complete `cargo xtask check` gate with no failures or skips.
- [x] After checks pass, `git add -A`, commit with Conventional Commits, and
      push the branch.
- [x] After the push, use
      [the implementation review prompt](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main`; report
      numbered, severity-rated findings with options and recommendations
      without changing the implementation.

## Milestone 4: Route-Scoped Catalogue Model And Reader

Summary: add the scope resolver, projection and validation in the viewer data
layer without emitting scoped bootstraps yet, so product behavior is unchanged.

- [x] Add pure, documented modules under `packages/viewer/src/catalogue/`: one
      resolving the usage scope for a bootstrap view, and one projecting a
      complete read model to its route-scoped form.
- [x] Type the bootstrap-only `omitted` usage state in the runtime subpath and
      keep the public `CatalogueUsage` type unchanged.
- [x] Make the `catalogue.json` reader reject `omitted`, make the bootstrap
      reader enforce the exact derived scope, and make reference validation
      skip omitted views without weakening historical or snapshot rules.
- [x] Keep that strict scoped-bootstrap reader as a separate entry point in
      this milestone. Existing browser hydration, route evidence and capture
      continue to use the complete-bootstrap reader until Milestones 5 and 6;
      Milestone 6 switches live reading and scoped emission together so no
      complete Serve page is rejected in between.
- [x] Test the scope for every route kind: screen, variant screen, component
      with saved variants, use case, removed-entry snapshot, page, home and
      missing.
- [x] Test projection invariance: changing another entry's usage leaves the
      scoped bytes unchanged.
- [x] Test that the reader rejects leaked, missing and misplaced `omitted`
      usage, that the public v1 fixture and conformance tests are unchanged,
      and that scoped bootstraps round-trip to identical canonical bytes.
- [x] On the real example catalogue, find the largest route-scoped bootstrap,
      measure its strict scoped reader against the complete reader for the
      equivalent complete bootstrap, and record both costs here.
  - Measurement on 2026-09-25 with Node 24.21.0 used three warmups and 15
    samples per reader over pre-parsed objects, excluding JSON parsing and
    serialization. The largest scoped route was
    `design/review/outcomes/changed.html`: 428,379 bytes and a 37.4 ms median
    strict read (36.4–38.7 ms), compared with the equivalent 3,623,388-byte
    complete bootstrap and a 605.6 ms median complete read (597.3–761.6 ms).
- [x] Run the complete `cargo xtask check` gate with no failures or skips.
  - Complete gate on 2026-09-25: unit 2,439 passed; browser 781 passed;
    zero failures, skips or cancellations in either suite.
- [x] After checks pass, `git add -A`, commit with Conventional Commits, and
      push the branch.
- [x] After the push, use
      [the implementation review prompt](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main`; report
      numbered, severity-rated findings with options and recommendations
      without changing the implementation.

## Milestone 5: Shell Support For Omitted Usage

Tags: ui

Summary: make the shell correct for route-scoped catalogues before the server
emits them, while complete catalogues keep today's behavior.

- [x] In `workspace_data.ts` and `use_workspace_data.ts`, expose usage as
      loading instead of deriving `Used by` whenever out-of-scope usage is
      `omitted`, and as failed after a rejected or failed route-evidence read.
- [x] Render the Milestone 2 loading and failed states in `WorkspaceUsage`, and
      never show "No recorded consumers." before complete data arrives.
- [x] Treat omitted usage as pending in `workspace_inspection_runtime.ts` and
      the frame mount path, then adopt the committed route usage without
      remounting frames.
- [x] Accept destination-scoped catalogues in the route- and live-evidence
      adoption paths (`capability_store.ts` and `host_capabilities.ts`),
      replacing the installed catalogue atomically so out-of-scope usage never
      accumulates. Audit `catalogue_updates.ts` separately and keep its unused
      public-catalogue boundary strict. `?instance=` selections from `Used by`
      links must resolve after adoption.
- [x] Add one live-bootstrap reader with an explicit transitional mode for the
      Milestone 5 rollout. It accepted either an ordinary complete bootstrap or
      an exactly scoped one while static external bootstraps and `readCatalogue`
      stayed strict and unchanged. Milestone 6 has now removed this completed
      transition and accepts only exact live scope.
- [x] Change `refreshEvidence` in `src/client/react_capability_updates.ts` to
      read the public bootstrap from the same fetched shell page as its private
      descriptor and remove the second `__mokly/catalogue.json` request. Before
      Milestone 6 that bootstrap still carries the complete projection; after
      Milestone 6 the same path adopts the scoped projection. Test mixed
      descriptor/bootstrap revisions, stale sources and updates, rejected
      candidates, and the absence of the second request. Milestone 6 now emits
      the scoped projection on this path.
  - [x] Update the existing reload-recovery browser regression to preserve its
        no-extra-fetch intent with zero `catalogue.json` requests after an
        evidence update; it previously expected the removed second request.
- [x] Audit every consumer of catalogue view usage, including
      `changes_activation.ts`, `stage_frame.tsx`, `workspace_instances.tsx`,
      `frame_instances.ts` and `component_geometry.ts`.
  - [x] Apply the chosen route-scope decision: extend `useRouteEvidence` to
        every resolved target entry, including use cases and pages, while
        continuing to require private workspace data only for screens and
        components. A use case must adopt its step-screen usage and a page its
        zero-usage scope instead of retaining the previous route's scope.
  - [x] Hold and fail those use-case/page evidence responses in tests to prove
        their frames still load and navigate normally while omitted usage is
        pending, without enabling inspection or deriving partial Usage.
  - [x] Record the completed consumer audit and any additional dependency found
        in this plan before closing the milestone.
  - `changes_activation.ts` reads comparison state, not usage. `stage_frame.tsx`
    now normalizes `omitted` to pending; `workspace_instances.tsx` and
    `workspace_props.tsx` render the mockup's waiting copy. `frame_instances.ts`,
    `component_geometry.ts`, markers and both adapters already require ready
    validated usage before inspection or geometry. `viewer/projection.ts`
    intentionally omits non-ready records, while `public_workspace.ts` now
    records selected-view pending state and disables every cross-route scan if
    any omission exists. Private-only `workspace_input_changes.ts` remains
    unchanged. `adoptCatalogueRevision` has no in-repository production caller
    and stays on the complete public reader.
- [x] Add viewer tests with synthetic scoped bootstraps, including
      development-React hydration of scoped server output without mismatches.
- [x] Add browser tests through a fixture that serves scoped pages and holds the
      route-evidence response: loading then the list, failure then the failed
      state, no zero-consumer flash, and an instance deep link that resolves.
- [x] Run the complete `cargo xtask check` gate with no failures or skips.
  - Complete gate on 2026-09-25: unit 2,449 passed; browser 788 passed;
    zero failures, skips or cancellations in either suite.
- [x] After checks pass, `git add -A`, commit with Conventional Commits, and
      push the branch.
- [x] After the push, use
      [the implementation review prompt](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main`; report
      numbered, severity-rated findings with options and recommendations
      without changing the implementation.

## Milestone 6: Emit Route-Scoped Bootstraps

Summary: switch Serve and export/preview capture to route-scoped bootstraps.

- [x] Build the scoped bootstrap in `renderHydratedShellPage` from
      `context.readModel` and the page view, derive the server-rendering props
      from that same scoped model, and keep computing the initial private
      workspace from the complete private catalogue.
- [x] Confirm that route-evidence and live-evidence responses, which are
      ordinary shell pages, are scoped to their own route, and that Serve's
      `catalogue.json` stays complete.
- [x] In `externalizeCapturedShell` and
      [`scripts/preview/catalogue.mjs`](../scripts/preview/catalogue.mjs),
      validate the published model once per build, validate each captured
      scoped bootstrap, and compare it with the scoped projection of the
      published model so drift is still rejected for everything a page carries.
  - [x] Add a regression that leaks one out-of-scope usage record into a
        captured page and requires capture to reject it.
- [x] Recompare the saved `214fffa` consumer export and both repository
      previews with the corrected invariant: replace each tree's deployment
      identity with 64 zeroes, exclude `__mokly/client/**`, and require every
      remaining file to be byte-identical. Record file counts, old/new
      identities, differing client files, and normalized diff results.
  - Manual comparison on 2026-09-26 used the saved `214fffa` artifacts and the
    same captured 96-path Git evidence. There were no added or removed paths.
    Every tree differed in only `__mokly/client/react-shell.js` plus 239 files
    carrying its resulting deployment identity. The client changed from
    461,979 bytes / SHA-256
    `391560c509ed65e7e0c613d3d7582c50d1167848292cdd665817002ff6d1f11c`
    to 461,804 bytes /
    `02a813c54f365d10ff17ac8e5ea8100477aca8081f7736e764f8d38a2f536119`.
    - Consumer export: 1,587 files; 28 client files excluded; all 1,559
      remaining files matched. Identity changed from
      `792625935ae40a322f43bb0ebaaae1c90e1c351ee72f469861839b07d6da9d3f`
      to
      `2e912e4512027d4c734096e1f4c0d1b5d1599029ec22404ba6a2f5ad87011e08`;
      both normalized manifests digest to
      `71a23b2aba4ab39c1eea29e8a16dfdb42a9f0ad65ff46a8a15989a8c17c87137`.
    - Ordinary repository preview: 716 files; 28 client files excluded; all
      688 remaining files matched. Identity changed from
      `a38d753df656c832a5ef517b32af1af2ac82800c17fcbc0738b10678e8e7e839`
      to
      `009565bb2576598bf30a2155f980cb78e8e9f8abde866a1b48f08a686bb9ea17`;
      both normalized manifests digest to
      `f2e7426dda9bd499d7b69dbe84fbd7134a2c82c063308936e0d8f28ab5027da1`.
    - Repository preview with Changes: 1,590 files; 28 client files excluded;
      all 1,562 remaining files matched. Identity changed from
      `57c8a7c80a1f0ecc5e9022a478f3ba45e62243c8fd40b961896ea8d185710bad`
      to
      `3ac503e36f3294073091e04b708954f0ef8090962713b2bf312baa05918cde8d`;
      both normalized manifests digest to
      `66f87cb6fdc1d8b4a530f2b4af5924bfa819acd5e337e8bdc722819ff45f8044`.
  - Automatic coverage changes one finalized viewer client, proves deployment
    identity changes, then excludes `__mokly/client/**`, normalizes each tree's
    identity, and compares every remaining artifact byte.
- [x] Build every browser asset from checked source, restore the single shared
      `react-shell.js` hydration bundle imported by `react-host.js`, remove the
      build-time compatibility transform and global hydration registry, and
      restore one-bundle package, graph, and browser-test assertions.
- [x] Add the guardrail tests on real Serve pages: bootstrap invariance when
      another entry's usage changes, and the 1 MiB budget for the example's
      largest bootstrap.
  - All 120 current example routes were measured from real Serve output. The
    largest was `design/review/outcomes/changed.html` at 450,045 bytes, below
    the 1,048,576-byte limit. The automated inventory also covers missing and
    synthetic historical routes.
- [x] Update existing tests that assert complete Serve bootstraps, and exercise
      navigation, loading and usage flows against the real Serve.
  - The unchanged development hydration inventory passed all 118 catalogue
    routes plus its three shell routes on native scoped pages. The focused
    hydration, static and evidence run passed 136 of 136 browser tests.
  - Updated tests retaining their prior intent:
    `packages/viewer/tests/boundary.test.ts`,
    `packages/viewer/tests/host_capabilities.test.tsx`,
    `packages/viewer/tests/scoped_bootstrap.test.ts`,
    `tests/client_catalogue_refresh.test.ts`,
    `tests/client_react_capabilities.test.ts`,
    `tests/client_route_evidence.test.ts`, `tests/server_live_updates.test.ts`,
    `tests/browser/route_scoped_shell_routes.spec.ts`, and
    `tests/browser/scoped_shell_fixture.ts`. The shared development hydration
    fixture and its two explicit delay cases in
    `tests/browser/react_shell_hydration_helpers.ts` and
    `tests/browser/react_shell_hydration.spec.ts` retain the same
    pre-hydration assertions against the one shared hydration bundle.
    `scripts/package/fixture.mjs` requires the packed live host to import that
    shared bundle.
  - New capture and real-Serve guardrails live in
    `tests/captured_shell_scope.test.ts` and
    `tests/server_route_scoped_bootstrap.test.ts`.
- [x] Record one ordinary preview sanity timing with the same command before
      and after the switch.
  - `node scripts/preview/build.mjs --out …` took 174.886 seconds for the first
    baseline run and 33.737 seconds for the first post-switch run. The latter
    reused the derived baseline prepared by the former, so this is a sanity
    result rather than the controlled performance comparison owned by
    Milestone 7; a repeat during the now-removed static-client split took
    34.231 seconds.
- [x] Run the complete `cargo xtask check` gate with no failures or skips.
  - Complete gate on 2026-09-26: unit 2,455 passed; browser 789 passed;
    zero failures, skips or cancellations in either suite. Repository, package,
    Rust, typecheck, example and five packed-consumer smoke stages also passed.
  - Supervisor-correction gate on 2026-09-26: unit 2,454 passed; browser 789
    passed; zero failures, skips or cancellations in either suite. The unit
    count decreased by one because the invalid fixed client-hash test was
    deleted; the normalized non-client invariant runs inside the deployment
    client-change test. Repository, package, Rust, typecheck, example and all
    five packed-consumer smoke stages also passed.
- [x] After checks pass, `git add -A`, commit with Conventional Commits, and
      push the branch.
- [x] After the push, use
      [the implementation review prompt](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main`; report
      numbered, severity-rated findings with options and recommendations
      without changing the implementation.
  - [x] Restate prominently in the Milestone 6 review record and checkpoint
        report that the deferred Medium A → B → A initial-workspace finding is
        now visible with native scoped emission. Keep it open for the user's
        decision unless they separately authorize a fix.

## Milestone 7: Measure And Close Out

Summary: record the result against the baseline below and align the docs with
the delivered behavior.

- [x] Repeat the baseline measurements on comparable hardware: median Serve
      page and bootstrap bytes, browser `readCatalogue` time, one in-shell
      navigation's transfer and script time, `npm run preview:build` with and
      without `--include-changes`, `tests/preview.test.ts`, the four browser
      setup builds and `react_shell_hydration_routes.spec.ts`. Record the
      results in a review record in this plan.
- [x] Re-read every protocol document and README changed in Milestone 1
      against the implementation and fix any drift.
- [x] Run the complete `cargo xtask check` gate with no failures or skips.
  - Complete closeout gate on 2026-09-26: unit 2,454 passed; browser 789
    passed; zero failures, skips or cancellations in either suite. Repository,
    package, Rust, typecheck, example and all five packed-consumer smoke stages
    also passed.
- [ ] After checks pass, `git add -A`, commit with Conventional Commits, and
      push the branch.
- [ ] After the push, use
      [the implementation review prompt](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main`; report
      numbered, severity-rated findings with options and recommendations
      without changing the implementation.

## Post-merge follow-up (non-blocking)

- Compare the first `main` CI runs after merge with the CI baseline below,
  especially the preview and export fixture phases and browser shard 2.
- Decide whether static-export page loads need a lean deployment index or a
  validated-catalogue cache.

## Baseline

Local measurements used an 8-vCPU Linux sandbox with Node 24.21.0 and
Chrome 153.

At `2ec4d83` (current `main` when this plan was written):

- The Serve page for `screens/welcome.html` is 3.8 MB, of which the bootstrap
  is 3.5 MB and usage 3.2 MB.
- `JSON.parse` takes 19 ms, `readCatalogue` 573 ms and canonical
  serialisation 65 ms, in Node.
- The route-scoped prototype is 360–445 KB, with 23–39 ms of `readCatalogue`.

At `d4228f9`, one commit earlier:

- One development-mode page load keeps Chrome's main thread busy for 1.4 s.
- `react_shell_hydration_routes.spec.ts` runs 115 tests in 5m12s, with a
  2.9 s median.
- An ordinary `scripts/preview/build.mjs` run takes 2m40s–2m52s, and
  `tests/preview.test.ts` takes 6m42s.
- The browser setup builds take 2m45s (static-example export), 2m38s
  (design-library export), 3m02s (cold preview) and 2m56s (ordinary preview).

CI measurements used Blacksmith 2-vCPU runners with Node 22.14. The
ordinary-preview fixture took:

- 17.9–18.7 s at #94;
- 75.6–77.2 s at #95; and
- 96.7 s at #96.

At #96, the browser shard 2 job took 897 s.

## Review record

### Milestone 1 — 2026-09-25

- Reviewed the complete pushed `origin/main...b18ac46` diff using
  [`docs/implementation-review-prompt.md`](../docs/implementation-review-prompt.md).
- Initial self-review findings: none.
- Residual test risk: this milestone defines the documentation contract only.
  Historical-route scope resolution, loading/failed retry transitions,
  serialize-once call counts, scoped capture comparison, and static artifact
  byte identity remain unimplemented until their owning later milestones and
  therefore are not yet covered by executable regression tests.

### Milestone 1 supervisor correction — 2026-09-25

1. **High — Future screens were added to the canonical design inventory before
   they existed.** The supervisor's prepared unit check found that
   `tests/design_links.test.ts` treated the three target rows as current screens
   and failed its exact manifest comparison. Leaving the rows in place would
   keep the branch's unit suite red and make the design protocol disagree with
   the generated registry.
   - **Option A:** keep the collection, ids, routes and copy in prose, then add
     the canonical rows and raise the counts with the Milestone 2 screens.
   - **Option B:** create the screens during Milestone 1, collapsing the required
     docs-before-mockups milestone boundary.
   - **Recommendation:** Option A. It preserves the milestone ordering and the
     exact-inventory test. Applied by correction commit `778182c`
     (`fix(docs): defer future design inventory`).

Plan amendments from that check also require the prepared unit suite for later
documentation-only edits, replace live refresh's second catalogue request with
the fetched page bootstrap in Milestone 5, and extend route-evidence adoption to
use-case and page targets so their installed scope matches their route.

### Milestone 2 — 2026-09-25

- Reviewed the complete pushed `origin/main...d1ef60b` diff using
  [`docs/implementation-review-prompt.md`](../docs/implementation-review-prompt.md).
- Findings: none.
- Residual test risk: these are static design states. The runtime transitions,
  retry behavior and in-place usage adoption remain intentionally deferred to
  Milestone 5, where browser tests will exercise delayed and failed route
  evidence against the implemented shell.

### Milestone 2 supervisor correction — 2026-09-25

1. **Low — The failed-delivery screen reused unavailable-state wording.** The
   screen title `Usage unavailable` blurred the protocol's distinction between
   a failed evidence delivery and genuinely unavailable usage, and sat beside
   the separate `Inspection unavailable` screen.
   - **Option A:** retitle only this screen to `Usage failed to load`, retaining
     its id, route and rendered state.
   - **Option B:** keep the ambiguous title and rely on the panel copy to explain
     the distinction.
   - **Recommendation:** Option A. It makes the catalogue label match the
     contract without changing the screen flow. Applied by the
     `fix(mockups): distinguish usage load failure` correction commit.

### Milestone 3 — 2026-09-25

- Reviewed the complete pushed `origin/main...3a4fda8` diff using
  [`docs/implementation-review-prompt.md`](../docs/implementation-review-prompt.md).
- Findings: none.
- Residual test risk: the before/after interaction timings are single profiles
  and therefore include ordinary scheduling noise. Structural serializer
  ownership, exact call counts and embedded-byte stability are independently
  enforced by unit, browser, served-page and captured-page regressions.

### Milestone 4 — 2026-09-25

- Reviewed the complete pushed `origin/main...378f9a1` diff using
  [`docs/implementation-review-prompt.md`](../docs/implementation-review-prompt.md).

1. **Low — The capability descriptor value and its serialized text can
   disagree.** `StandaloneShellDocument` accepts both `capabilityDescriptor`
   and `capabilityDescriptorJson` independently. The object supplies the
   server-rendered workspace and source, while the string controls the embedded
   descriptor script and live-host bundle. Current server and browser callers
   derive the pair from the same accepted value, but a future direct caller can
   pass mismatched props. Doing nothing leaves that caller able to render one
   private workspace while hydrating or refreshing against another descriptor,
   producing a difficult-to-diagnose state or hydration mismatch.
   - **Option A:** introduce one paired serialized-descriptor value, created by
     a focused factory from the accepted descriptor, and pass that single value
     through the document boundary; add a regression showing that independent
     values cannot be supplied.
   - **Option B:** pass only the serialized string and parse it once inside the
     document to recover the server value, trading an extra parse for one source
     of truth.
   - **Option C:** retain the two independent props and rely on every caller to
     keep them synchronized.
   - **Recommendation:** Option A. A cohesive boundary type and factory prevent
     this class of mismatch for every future caller without restoring render-time
     serialization; a caller-specific assertion would be less durable. No
     implementation change was made during this read-only review.

- No other findings. Residual test risk is intentionally limited to later
  integration: Milestone 4 keeps the strict scoped reader isolated, so live
  hydration, route evidence and capture still exercise complete bootstraps.
  Milestones 5 and 6 own those adoption and coordinated-emission paths.

### Milestone 5 — 2026-09-25

- Reviewed the complete pushed `origin/main...d25df6d` diff using
  [`docs/implementation-review-prompt.md`](../docs/implementation-review-prompt.md).

1. **Medium — Returning to the initial route can reuse private workspace data
   before route evidence is adopted.** `useWorkspaceData` accepts
   `useViewerInitialWorkspace()` whenever its entry matches the current route,
   even after the capability store has adopted another route and no longer owns
   that initial workspace request. In a scoped A → B → A navigation, the
   installed B catalogue still omits A's view usage while the unbound initial A
   workspace makes Usage report Ready. Doing nothing can expose old `Used by`,
   `Affected`, counts or instance details during a held or failed return read,
   instead of the required Loading/Failed state paired atomically with A's
   scoped catalogue.
   - **Option A:** when a live request exists, select private workspace only
     from the capability store's request-bound `live.workspace`; retain the
     direct initial fallback only for static/non-live shells. Add an A → B → A
     browser regression that holds and fails the return response.
   - **Option B:** consume or clear the initial workspace context after the
     first route/source transition, then keep the current selection precedence.
   - **Option C:** retain the route-only initial-workspace match and accept the
     temporary cross-revision presentation.
   - **Recommendation:** Option A. The capability store already binds its
     initial workspace to the exact source and route, so making that the sole
     live authority removes the invalid state at the ownership boundary. The
     round-trip regression should be added because a local copy change alone
     would not prevent future unbound fallback paths.

- The previously recorded low-severity descriptor value/JSON pairing finding
  remains unchanged and deferred by supervisor direction; this review made no
  implementation change for it.
- No other findings. Residual test risk: scoped browser coverage rewrites real
  Serve responses at the test boundary because Milestone 6 still owns native
  scoped emission and capture comparison.

#### Supervisor corrections — 2026-09-25

- The supervisor found that static-export hydration validated its already-read
  complete catalogue a second time. Commit `e9e1dea` now carries resolved live
  and validated static bootstraps through distinct typed hydration paths. A V8
  precise-coverage regression first observed two `readCatalogue` calls and now
  proves exactly one call for a finalized static page.
- The supervisor also reproduced a cold-server race where a canceled route
  evidence request reached `route.fulfill` after Playwright had handled it.
  Commit `e9e1dea` moves the behavior into the shared scoped-shell fixture: only
  an exact already-handled failure for a non-document request is settled, while
  document and unrelated failures still surface. The route-specific catch was
  removed, and `route_scoped_shell_usage.spec.ts` was audited to use the same
  shared boundary without another exception path.
- Verification after the final fix: three independent build-first focused runs
  passed 18 of 18 browser tests each; both scoped spec files passed 35 of 35
  with `--repeat-each=5`; static hydration passed 4 of 4; formatting, lint and
  TypeScript typechecks passed. The complete gate passed 2,449 unit and 789
  browser tests, with zero failures, skips or cancellations.
- Re-reviewed the complete pushed `origin/main...e9e1dea` diff using
  [`docs/implementation-review-prompt.md`](../docs/implementation-review-prompt.md).
  No additional findings were identified by the correction review.
- **Still deferred — Medium:** the numbered A → B → A initial-workspace finding
  above was not fixed. Milestone 6 must restate it prominently in its review
  record and checkpoint report because native scoped emission makes the stale
  workspace state visible. The low-severity descriptor value/JSON pairing
  finding also remains deferred and unchanged.

### Milestone 6 — 2026-09-26

- Reviewed the complete pushed `origin/main...b386d76` diff using
  [`docs/implementation-review-prompt.md`](../docs/implementation-review-prompt.md).
- The review was read-only; none of the findings below changed the
  implementation.

1. **Medium — Returning A → B → A can now expose A's stale initial private
   workspace while its scoped catalogue is still B's.** At
   `packages/viewer/src/shell/use_workspace_data.ts:49`, `useWorkspaceData`
   still falls back to `useViewerInitialWorkspace()` whenever only the route
   entry matches. After native scoped emission, returning to the initial route
   before its held or failed evidence response can therefore pair old complete
   `Used by`, `Affected`, counts and instance details with the prior route's
   scoped catalogue. Doing nothing makes this previously deferred state
   user-visible: Usage can report Ready instead of Loading or Failed during an
   A → B → A round trip.
   - **Option A:** for a live request, select private workspace only from the
     capability store's source-and-route-bound `live.workspace`; retain the
     initial fallback only for static or otherwise non-live shells. Add a
     browser regression that holds and then fails the return-to-A response.
   - **Option B:** consume or clear initial workspace context after the first
     live route/source transition, then retain the current precedence rules.
   - **Option C:** keep route-only initial matching and accept the temporary
     cross-revision presentation.
   - **Recommendation:** Option A. The live capability store already owns the
     exact request identity, so using it as the sole live authority fixes the
     ownership boundary rather than one presentation symptom. The A → B → A
     regression is required to prevent another unbound fallback from
     reintroducing the same class of bug. This remains deferred by explicit
     supervisor direction.

2. **Low — The server-rendered capability object and its embedded JSON can
   still disagree.** At
   `packages/viewer/src/standalone/document.tsx:30`,
   `StandaloneShellDocument` accepts `capabilityDescriptor` and
   `capabilityDescriptorJson` as independent props. Current callers build both
   from one descriptor, but a future caller can render one private workspace
   while the browser hydrates against another serialized source. Doing nothing
   leaves a difficult-to-diagnose hydration mismatch and cross-revision state
   available at this component boundary.
   - **Option A:** introduce one paired descriptor value created by a factory
     from the validated object, and pass that value through the document
     boundary. Add a type/runtime regression proving independent values cannot
     be supplied.
   - **Option B:** pass only serialized JSON and parse it once inside the
     document to recover the server value, accepting another parse.
   - **Option C:** keep both props and rely on callers to synchronize them.
   - **Recommendation:** Option A. A cohesive boundary type prevents the whole
     mismatch class without restoring render-time serialization. This remains
     deferred by explicit supervisor direction.

3. **Low — Repository preview validates the same complete catalogue twice per
   build.** `scripts/preview/catalogue.mjs:157` calls
   `readCapturedShellCatalogue` before per-page comparison, then
   `scripts/preview/artifact.mjs:124` reaches `finalizeDeployment`, whose
   `src/export/deployment.ts:28` calls `readCatalogue` again on the same
   complete model. Doing nothing preserves correct output, but repeats the
   largest complete-model read, contradicts the once-per-build capture
   contract, and adds avoidable build time as catalogues grow.
   - **Option A:** carry the validated catalogue proof and canonical bytes into
     preview staging/finalization. Finalization can compare the staged bytes
     with that proof before stamping deployment identity instead of decoding
     the model again; direct exports can retain their post-adapter validation.
     Add a real-behavior call-count regression for one preview build.
   - **Option B:** delay the only validation until finalization and let capture
     compare unvalidated data, weakening the capture boundary.
   - **Option C:** keep both validations and accept the extra complete-model
     cost.
   - **Recommendation:** Option A. Passing one validated proof through the
     complete preview pipeline preserves final-byte tamper protection and
     prevents duplicate reads structurally. A local cache or caller-specific
     skip would be less durable.

- No other findings. Residual risk is limited to the deliberately deferred
  A → B → A and descriptor-pair decisions plus the new duplicate build-time
  validation finding. The complete gate, native scoped hydration inventory,
  capture rejection tests and 1 MiB guardrail all passed. The original
  post-commit whole-artifact comparison relied on a contract later corrected by
  the supervisor; the normalized static-content comparison supersedes it.

### Milestone 6 supervisor correction — 2026-09-26

1. **High — The original byte-identity requirement forced unreviewed source
   rewriting into the static client build.** The supervisor identified that
   `staticHydrationCompatibility` patched two TypeScript modules with string
   replacements so `react-shell.js` kept its old hash. The shipped client then
   ran a transitional reader and hydration registry that no checked source file
   contained, ordinary viewer edits failed with a source-drift error, and a
   fixed SHA-256 test prevented legitimate client changes. Doing nothing would
   leave delivered behavior outside typechecking and code review and make the
   viewer bundle structurally brittle.
   - **Option A:** correct the invariant, build the shared hydration bundle from
     checked source, allow client bytes and their derived deployment identity to
     change, and compare every remaining artifact after identity normalization.
   - **Option B:** keep separate static/live source entry points checked into the
     repository, accepting two React bundles and duplicated runtime behavior.
   - **Option C:** retain build-time source rewriting and its pinned output hash.
   - **Recommendation:** Option A. It restores one source of truth and one React
     hydration bundle while preserving the static content that route scoping
     does not need to change. Applied by the supervisor-correction commit. The
     global `__moklyViewerHydrationStateV1` registry had no independent purpose
     once `react-host.js` returned to importing `react-shell.js`, so it was
     removed.

- The corrected manual comparison found only
  `__mokly/client/react-shell.js` and the resulting deployment identities
  changed; after excluding client files and zeroing each identity, all 1,559
  export files, 688 ordinary-preview files and 1,562 Changes-preview files
  matched their saved `214fffa` baselines.
- The three existing review findings remain deferred for the user's decision:
  the Medium A → B → A initial-workspace authority issue, the Low independent
  descriptor object/JSON boundary, and the Low duplicate complete-catalogue
  preview validation.

### Milestone 6 correction review — 2026-09-26

- Reviewed the complete pushed `origin/main...b5e9e37` diff using
  [`docs/implementation-review-prompt.md`](../docs/implementation-review-prompt.md).
  The review was read-only; no implementation was changed.
- No new findings. The correction removes the unreviewed build transform,
  restores one checked hydration implementation, and tests the corrected
  deployment invariant without weakening strict live reading or static
  complete-catalogue validation.
- The complete review continues to report the three numbered findings above,
  with their impact, options and recommendations unchanged:
  1. **Medium:** A → B → A can pair the stale initial private workspace with
     the previous route's scoped catalogue. Recommendation: make the
     request-bound live workspace the sole live authority and add held/failed
     round-trip coverage.
  2. **Low:** `StandaloneShellDocument` accepts an independently supplied
     capability descriptor object and JSON string. Recommendation: introduce a
     paired serialized-descriptor boundary and regression.
  3. **Low:** repository preview validates the same complete catalogue before
     capture and again during deployment finalization. Recommendation: carry a
     validated proof/canonical bytes into finalization and add a real call-count
     regression.
- Residual risk is limited to those explicitly deferred decisions. The
  correction itself is covered by the complete 2,454-unit/789-browser gate,
  the 131-test focused development hydration run, packed-consumer smoke and the
  three normalized `214fffa` artifact comparisons.

### Milestone 7 measurements — 2026-09-26

The controlled comparison used this 8-vCPU Linux VM, Node 24.21.0, npm 11.7.0
and Chrome 153.0.8010.52 in one session. `origin/main` at `2ec4d83` lived in the
separate `.context/m7-main` worktree with its own `npm ci` and
`prepare:verification`; the branch was `5dbdba1`. Heavy measurements ran one at
a time.

- Serve sizes enumerate every non-collection route in each real generated
  manifest (115 main, 118 branch), fetch its live page after Changes settles,
  and count UTF-8 HTML and embedded-bootstrap bytes.
- Browser timings use `design/review/outcomes/changed.html`, a development
  `react-shell.js`, one warm-up and five fresh-context samples. CDP
  `ScriptDuration` supplies main-thread script time; a 100 µs V8 CPU profile
  supplies inclusive reader time. Main calls public `readCatalogue`; the branch
  intentionally does not and instead reports its strict live-bootstrap reader.
- Navigation timings use one warm-up and five fresh-context
  `screens/welcome.html` → `screens/details.html` transitions. CDP sums encoded
  bytes for requests begun by the transition and measures the script-duration
  delta after destination evidence and frames settle.

| Serve/browser metric                   |   `2ec4d83` |            Branch | Change |
| -------------------------------------- | ----------: | ----------------: | -----: |
| Median Serve page                      | 3,820,481 B |         662,615 B | −82.7% |
| Largest Serve page                     | 4,381,225 B |       1,215,866 B | −72.2% |
| Median bootstrap                       | 3,554,709 B |       390,412.5 B | −89.0% |
| Largest bootstrap                      | 3,554,729 B |         450,045 B | −87.3% |
| Development-load script time           |  1,063.9 ms |          311.2 ms | −70.7% |
| Public `readCatalogue` inclusive time  |    511.6 ms | 0 ms (not called) |      — |
| Active bootstrap-reader inclusive time |    511.6 ms |           60.3 ms | −88.2% |
| Development-load wall time             |  1,467.5 ms |          551.0 ms | −62.5% |
| Navigation encoded transfer            | 3,840,741 B |         665,228 B | −82.7% |
| Navigation script time                 |    331.8 ms |          118.0 ms | −64.5% |
| Navigation wall time                   |  1,698.6 ms |          399.2 ms | −76.5% |

The largest page is `design/library/inspector/metadata-row.html` in both trees.
Main's largest bootstrap is
`design/review/outcomes/previous-version/no-captured-view.html`; the branch's is
`design/review/outcomes/changed.html`.

Direct preview commands started with absent output and `.mokly-cache` paths.
`tests/preview.test.ts` likewise began cold and retained its own second warm
build. The setup comparison ran the same four Playwright specs together and
uses their `[mokly:fixture-timing]` operation durations.

| Build/test metric                 |           `2ec4d83` |              Branch | Change |
| --------------------------------- | ------------------: | ------------------: | -----: |
| Cold preview, no Changes          |             159.5 s |              34.7 s | −78.2% |
| Cold preview, `--include-changes` |             214.6 s |              86.8 s | −59.6% |
| `tests/preview.test.ts`           |             409.6 s |             144.0 s | −64.9% |
| Static-example setup export       |             156.3 s |             157.8 s |  +1.0% |
| Design-library setup export       |             156.4 s |             159.1 s |  +1.7% |
| Cold-preview browser setup        |             167.6 s |              48.2 s | −71.2% |
| Ordinary-preview browser setup    |             151.8 s |              31.6 s | −79.2% |
| Four-setup Playwright command     |             726.1 s |             485.8 s | −33.1% |
| Hydration-route command           | 338.8 s / 118 tests | 247.3 s / 121 tests | −27.0% |
| Median hydration-route test       |             2.726 s |             1.925 s | −29.4% |

Both full comparison-export setups remain effectively flat while processing
three additional branch routes; their baseline installation, build and Review
work dominates capture. The capture-heavy preview paths, page loads,
navigations and hydration inventory show the intended reduction. Every measured
test command passed without retries or skips. Raw JSON, timing events and logs
are retained under `.context/test-timings/m7/`.

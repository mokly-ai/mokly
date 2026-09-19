# Unified Catalogue Pages

## Status And Outcome

Implementation, consumer rehearsal, validation, commit, push, and review are
complete. Authorized follow-up fixes are recorded in the
[review record](../docs/reviews/catalogue-pages-and-publication.md). The user approved a mandatory
breaking upgrade after a downstream inspection found a second App root, and
subsequently requested fixes for the contract reviews.

Deliver first-class whole-document pages with explicit IDs and ordinary
collection membership. Preserve existing document rendering, routes, anchors,
and resources, and make navigation, breadcrumbs, links, search, Changes, and
publication consume one hierarchy. Do not merge collections by display name.

## Contracts And Scope

- [Pages in the catalogue](../docs/protocol/mokly-pages.md) owns the API,
  schema-v4 entry model, output, Browse, links, impact, and publication contract.
- [Breaking page migration](../docs/protocol/mokly-page-migration.md)
  owns generic consumer updates, safe regeneration, and historical readers.
- [Source protection](../docs/protocol/mokly-source-protection.md) and
  [catalogue changes](../docs/protocol/mokly-catalogue-changes.md) own shared
  source classification, change metadata, and removed-page presentation.
- [Shell design](../docs/protocol/mokly-shell-design.md) owns reusable design
  components and responsive presentation. Its example catalogue is the
  established Mokabook mockup source of truth.

Scope: Mokabook, generic packed consumers, and an isolated external-consumer rehearsal.
Publication, deployment, and durable consumer adoption are separate follow-ups;
the synced inspection checkout remains read-only.

Use `definePage` and nested `page` for complete documents. Remove legacy config,
discovery, and rendering adapters without a registration shim. Consumers import
render helpers, preserve routes, and rebuild v4 without `legacyPages`; v2/v3
readers remain only for historical comparisons. Pages use Current and Changes;
whole-document comparisons and page-valued use-case steps stay outside scope.

[Optional Published Changes](./optional-published-changes.md) independently owns
the publication opt-in and workflow defaults. Integrate pages with that
[contract](../docs/protocol/mokly-publication.md): ordinary publication shows
current entries; review publication additionally includes Changes and removals.
Complete that option before page publication acceptance; page authoring/compiler
work can proceed independently.

## Working Rules

Each milestone must leave the existing product and its applicable checks
functional. Complete mockups before UI changes. Prepare backend readers and
page support before switching consumers to v4; do not activate a breaking cutover
while any active compiler, server, publisher, or fixture still expects only v3.
Update affected fixtures with the API changes instead of preserving a parallel
legacy authoring path. No environment or migration flags appear in product views.

Add regression tests before changing each failing behavior. Preserve unrelated
mainline features and all five consumer documents. Recheck source inventory
and IDs when implementation starts; the inspected remote sync may advance.
New tasks go into the relevant unfinished milestone. Backend gaps discovered
during a tagged milestone require a new backend milestone immediately after
it, followed by a new tagged milestone containing the blocked tasks.

## Milestone 1: Establish the target contract — completed

Define the complete target before scheduling implementation, and keep current
shipping behavior distinguishable from the approved future contract.

- [x] Inspect the duplicate roots, source registrations, catalogue types,
      collection ownership, build pipeline, links, baseline readers, and shell.
- [x] Write the page and migration protocols with explicit delivery status,
      compatibility failures, security boundaries, and acceptance requirements.
- [x] Cross-link the target from the existing protocol documents and README.
- [x] Create this plan and add it to the active plans index.

The planning-only snapshot passed Prettier, 82 local links, milestone/tag/index,
length, and whitespace checks; `cargo xtask check` was exempt. Commit `9370a26`
was pushed and its review found no actionable issues. Implementation verification
and the required commit/push/review gate remain in the final milestone.

## Milestone 2: Require a breaking consumer upgrade — completed

The user accepted forcing consumers to update. Simplify the target before
implementation by removing the proposed source-registration compatibility layer.

- [x] Require normal page definitions and reject the obsolete `legacy` config;
      retain historical readers solely for comparisons with old Git baselines.
- [x] Specify source-preserving consumer updates, guarded artifact regeneration,
      and release notes identifying the intentional breaking API removal.
- [x] Revise unfinished milestones and cross-links; keep implementation unstarted.

Commit `75180d8` passed Markdown/link and milestone checks and was pushed.
Its review found three contract gaps: shared change metadata, source inventory,
and the consumer snapshot. Milestone 3 resolved them; the full gate remains below.

## Milestone 3: Resolve contract reviews — completed

The user requested fixes for the reviews of `75180d8` and `dc44b02`.

- [x] Specify complete source inventory, stale-source protection, and one typed
      change snapshot with flat removed pages and baseline-only breadcrumbs.
- [x] Move concrete mappings into consumer documentation and record a freshly
      verified consumer revision, manifest hash, and source/artifact checks.
- [x] Add regression work to unfinished milestones; preserve completed work.

Commit `f7a1a36` passed Prettier, 130 local links, milestone and inventory checks
and was pushed. Its review found ambiguous route-change wording and missing
completed-review records. Both findings were verified and corrected on the
user's instruction; explicit-route stability also receives implementation tests.

## Milestone 4: Record unified page designs — completed

Tags: mockup

Extend the existing neutral shell design catalogue with the page states needed
to review the new presentation before changing the real UI.

- [x] Inspect and reuse `examples/basic/entries/design/parts/` and existing
      Browse screen components, tokens, navigation, frames, and details.
- [x] Add linked mobile/desktop page-view/details and removed-page screens.
      Show a flat Changes row and baseline breadcrumbs after deleting its parents.
- [x] Author the reusable synthetic whole-document sample used by those designs
      and the later basic-example registration; complete its markup in this milestone.
- [x] Show a page beside a screen/use case under one existing collection,
      correct ancestry and ID/tag search, page metadata, and a narrow navigation
      drawer. Hide unsupported page variant/comparison controls.
- [x] Keep synthetic document content confined to the approved example design
      fixture. No engineering/migration annotations appear inside rendered screens.
- [x] Link new screens from the owning design catalogue; keep each owning
      screen-spec page at five or fewer screen mockups and split linked pages when
      needed. Reuse owning screen components in any flow.
- [x] Update the shell design protocol and example README; run
      `npm run example:build`, `npm run example:check`, relevant example tests, and
      typechecking. Commit generated HTML from source; open every changed mobile
      and desktop artifact directly from disk for visual inspection.

The functioning design catalogue specifies the page UI before implementation.

## Milestone 5: Implement page definitions and source migration — completed

Add the backend authoring, compilation, schema, and historical compatibility
boundaries while preserving existing complete-document rendering.

- [x] Add failure-first tests for flat/nested pages, callback attribution and
      validation, tag/inheritance rules, mixed children, invalid page-valued
      use-case steps, duplicate IDs/routes, missing/multiple parents, and cycles.
- [x] Extend `src/authoring/` and exports with typed page inputs/definitions,
      `definePage`, and nested `page`; update entry preparation and validation.
- [x] Remove legacy config/types, automatic discovery, and `src/legacy/pages.ts`.
      Add rejection tests for obsolete configuration, including `undefined`, and
      prove unimported `.source` modules are not catalogue entries. Migrate
      affected fixtures alongside these changes; add no registration shim.
- [x] Add tests before changing rendering: synchronous complete HTML, one
      render/output, imported existing render helpers, exception and
      promise rejection, global dark configuration, and unchanged source content.
- [x] Implement the shared page output path without invoking the screen
      renderer. Preserve the complete validation/transform pipeline and consumer
      module/React resolution. Keep artifacts and declarations fully typed.
- [x] Add generated-ownership, source-root, output collision, deterministic
      build/check, orphan, rollback, path traversal, symlink, and foreign-file
      tests, including page routes that overlap another entry's fragments.
- [x] Test that old artifacts outside the new owner roots still reject
      overwrite, and that verified consumer regeneration succeeds without
      broadening ownership. Keep imported render helpers protected source inputs.
- [x] Implement schema-v4 serialization/strict validation and dedicated
      v2/v3 historical readers. Test stale current output, invalid canonical input,
      gated v2 fallback, exact-route legacy baseline matching, unmatched historical
      documents, and unchanged screen comparisons across schema versions.
- [x] Implement the source-protection contract: both authoring graphs, asset
      classification, freshness, reserved names, and logical/realpath checks.
      Test stale unimported sources, all import roles, public assets, and output
      collisions before sharing the guard across runtime/resource consumers.
- [x] Prepare common catalogue indexes and route/artifact lookups for pages;
      eliminate assumptions that every routed non-use-case entry is a screen.
      Update active runtime readers and fixtures coherently with the schema switch.
- [x] Run `npm run build`, typechecking, lint, and focused authoring, config,
      registry, manifest, build, compatibility, and baseline/safety tests.

The functioning compiler supplies a tested page model and safe migration boundary.

## Milestone 6: Complete runtime links, impact, and publication — completed

Make every non-visual consumer understand the same page model before the shell
and consumer fixtures switch to it.

- [x] Add a mixed-tree regression reproducing the two App groups and assert
      one explicit App/Book ancestry after registration. Retain coverage proving
      unrelated same-title collections stay distinct and unclaimed pages are leaves.
- [x] Update catalogue/hierarchy and route-target models, page artifact lookup,
      GET/HEAD handlers, `/view`, `/id`, `/static`, and validated fragment transport.
- [x] Replace route-derived legacy tree/Overview model builders with the common
      collection tree; keep all runtime models ready before shell presentation changes.
- [x] Add page-to-screen, screen-to-page, page-to-page, use-case-to-page-link,
      anchor, and `MockLink asChild` tests for served and portable output. Preserve
      final-transform validation, authenticated link ownership, and sandbox limits.
- [x] Implement `CatalogueChangeSnapshot` and page impact, sharing it across
      server/watch/publication. Test deleted ancestors, baseline breadcrumbs,
      reparenting, title/module edits, route/ID reuse, historical baselines, and
      screen-only comparisons; never derive page removals from screen results.
- [x] Update watcher inputs, reload attribution, and published catalogue
      assembly, including page resources, ID redirects, anchors, and removed-page
      states only when publication includes Changes. Honor the optional-publication
      contract and preserve transactional/screen-comparison behavior. Test that
      imported and stale source files stay private through GET/HEAD, Review,
      and both exports, while graph changes update watcher inputs.
- [x] Update focused fixtures at each boundary, run relevant server, navigation,
      watch, review, preview, safety, and packed-API tests, and run the build.

Page routes and publication work through one model; screen comparisons still work.

## Milestone 7: Use one hierarchy throughout Browse — completed

Tags: ui

Apply the completed designs to the real package shell using the page-aware
runtime. This milestone contains presentation and client work only.

- [x] Add shell/browser regressions before replacing the legacy navigation and
      route-target presentation. Verify one row per ID and one declared App group.
- [x] Render all collection children from the completed common tree and remove
      obsolete legacy presentation branches. Preserve page icons and independent
      stable collection identities.
- [x] Reuse the full-document frame and add authored title, ID, breadcrumbs,
      tags, details, home counts, and flat Changes-only removed-page rows with
      baseline details. Preserve screen controls and removed-screen visibility.
- [x] Exercise ID/title/route/tag search, All/Changes, active-row reveal,
      disclosures, scroll restoration, direct/in-frame links, Back/Forward, watch
      reparenting, and static fragment restoration at mobile and desktop widths.
- [x] Verify pages honor both publication capabilities: ordinary exports contain
      current pages only; opted-in exports retain page Changes and removal states.
- [x] Ignore old `legacy:` disclosure keys without resetting existing
      `collection:` state or applying saved state by title. Verify this on reload.
- [x] Start the real server and compare screen, page, use-case, and missing-page
      views with their designs. Run focused shell/client tests, Chromium tests,
      accessibility assertions, and visual smoke tests.

Browse renders one hierarchy with complete page metadata and working screen views.

## Milestone 8: Prove the required consumer upgrade — completed

Activate the final v4 contract across examples, packed consumers, and migration
guidance, and rehearse a large external-consumer inventory before release.

- [x] Register the already-designed synthetic document as a page in the basic
      example and use `definePage` in the themed packed fixture. Convert raw
      HTML comment components into consumer composition, make aliases explicit
      routes, and preserve applicable lint rules in consumer source-policy tests.
      Update ESM/NodeNext/npx/Juno checks for the new API/schema.
- [x] Verify current readers/outputs require v4 and no legacy discovery/config
      adapters remain. Keep historical v2/v3 readers at the comparison boundary
      and retain their regression fixtures and ownership-header parsing.
- [x] Update the package/runtime/navigation/Changes/watch/architecture docs,
      README, and example guidance to describe implemented behavior. Change the
      target protocols' delivery status only when their required behavior passes.
- [x] Build and pack the candidate. In a disposable external-consumer checkout,
      apply the five definitions and memberships,
      remove `legacy` config, update consumer policy tests/docs, and perform the
      verified old-artifact regeneration. Do not alter the synced inspection workspace.
- [x] Validate complete pre/post source, route, anchor, and artifact inventories;
      preserve all product screens, links, resources, and four real root collections.
      Keep the consumer patch and exact tarball identity under `.context`.
- [x] Run the consumer's mockup build/check/test/typecheck, relevant browser
      tests, required repository gate, and real-server mobile/desktop smoke tests of
      all five pages, incoming links, search, ancestry, and exactly one App group.

The package has a verified migration and rehearsal; durable adoption follows separately.

## Milestone 9: Verify, commit, push, and review — completed

Finish implementation delivery only after all required checks pass; keep the
complete new source, tests, docs, and generated artifacts in the reviewed diff.

- [x] Integrate main commit `93ac778` from captured source tip `57eb59a` without
      removing its linked design catalogue. Reconcile shared controls, preserve
      every existing destination, extend the canonical inventory and semantic
      tests for page/publication states, regenerate outputs, visually inspect
      the integrated designs, and rerun the full gate before commit/push/review.

- [x] Make comparison browser tests await the real generation response before
      checking the resulting UI; retain immediate loading/error assertions and
      give publication setup its explicit build timeout and an ephemeral inspector
      port so concurrent workspaces cannot race for Wrangler's default port.
      Recheck the full gate.
- [x] Run all relevant tests with a 100% pass rate, `npm run build`, lint,
      typechecking, example build/check, packed consumers, and browser tests. Run
      `cargo xtask check` as the authoritative full gate; fix failures before
      claiming completion. Avoid repeating passed checks without a new concern.
- [x] If Rust changes, run `cargo fmt --all -- --check`, clippy, relevant Rust
      tests, and the required file-length audit; fix any formatting/build errors.
- [x] Fetch/audit main from the captured source tip before integration; preserve
      its additions. Inspect the diff and deletions against `origin/main` and stop
      for any unapproved feature removal. Validate Markdown links and generated
      output and record verification results in this plan.
- [x] Run `git add -A`, commit the completed implementation using Conventional
      Commits with a title of at most 50 characters and an explanatory body, push
      the branch, and inspect the committed diff/deletions against `origin/main`.
      Use breaking-change notation and record the authorized removal of legacy
      configuration/discovery/rendering, related cleanup, and consumer upgrade
      requirements in the implementation commit and release notes.
- [x] After the push, run `cargo xtask review` against `origin/main`. Do not
      automatically fix its findings. Report every item with severity, feature
      context, impact, lettered options, and a clear recommendation that evaluates
      whether a broader rule/test/abstraction would prevent recurrence.
- [x] Record the review outcome and unresolved decisions; mark only finished
      milestones complete and move this plan to Completed when all required work
      is done. Validate and commit/push final documentation bookkeeping if needed.

## Implementation Verification

The pre-integration `cargo xtask check` passed on 2026-09-09: 425 Node tests, 82 Chromium tests,
packed ESM/NodeNext/npx/Juno/themed consumers, example freshness, formatting,
lint, typechecking, Rust fmt/clippy, three Rust tests, and file-length checks.
No Mokabook Rust implementation changed. Regression tests also preserve the
post-screen render context of complete documents and their ReviewIgnore
serialization. All eight new page design artifacts were opened directly from
disk and visually inspected; the four publication designs passed the same check.

The external-consumer rehearsal used the exact candidate tarball recorded with
the review evidence. Inventory comparison preserved all existing entries and
roots. Of 3775 HTML artifacts, 3770 are byte-identical; the five documents change only
their verified ownership header, with bodies, anchors, resources, and links
unchanged. All 929 existing source files remain; only the two collection
registrations and two consumer policy/test files change, plus one new page
registration module. All five document routes, IDs, metadata, search, ancestry,
source GET/HEAD protection, and catalogue links passed real-server smoke tests
at 390px and 1280px. The four existing incoming artifact links also passed;
header/selection previously had none and is now reached through its collection.

The initial main audit retained source tip `f7a1a36`; refreshed `origin/main` remained
`e47524b`. The three removed files are the authorized legacy renderer and raw
HTML fixture plus the removed-screen helper superseded by shared entry metadata.
No unrelated mainline feature was removed. The full consumer gate passed,
including Rust and TypeScript tests, lint, typechecking, infrastructure checks,
and supplemental mockup browser cases. An installed-Chrome stall required
rerunning the eight layout cases with
Playwright Chromium 1228. The real CLI smoke passed. The rehearsal patch includes
a behavior-preserving fix for a pre-existing Clippy warning in the disposable
consumer. No consumer branch was committed or pushed.

Sixteen live/published screen, page, flow, and missing-route views were also
visually inspected at mobile/desktop sizes.

Main advanced to `93ac778` after the first implementation push (`57eb59a`).
The path-by-path integration preserves all 24 existing design destinations and
adds six page/publication states to the typed link inventory. All 60 resulting
design artifacts were opened directly from disk and visually inspected.
The final integrated `cargo xtask check` passed with 453 Node tests, 102
Chromium tests, packed consumers, all three Rust tests, fmt/clippy, and the
file-length audit. All 151 local Markdown targets resolve. Test failures under
concurrent load led to explicit waits for completed comparison responses and
ephemeral Wrangler inspector ports; loading/error assertions remain immediate.
All 583 compiled package files are byte-identical to the rehearsed candidate,
so the verified consumer rehearsal covers the final runtime. No further files
were removed. The final push and post-push review are recorded below.

## Delivery Review

Implementation commit `57eb59a` and integration commit `709151a` were pushed
to `calummoore/same-name-roots`. The final `cargo xtask review` completed against
`93ac778` after the integration push (invocation 2 of 10; the first was
interrupted when main advanced, without final findings). All new implementation,
test, and design files were tracked and included in that review. The final
preservation audit found only the three explicitly authorized removals.

All four new findings were checked independently. Outside-root source imports
(high), an escaping context-root symlink (medium), and screen-only common shell
copy (low) were initially left for user selection and have since received
authorized fixes. Stale documentation labels (low) were resolved in final
bookkeeping. The [complete review record](../docs/reviews/catalogue-pages-and-publication.md)
contains reproduction evidence, impact, lettered options, and recommendations.
Required delivery tasks are complete; this is not a claim of a clean review.
Final documentation bookkeeping is validated and committed/pushed separately.

## Consumer Follow-Up (Outside Package Completion)

After a suitable package version is available, deliver the rehearsed consumer
page definitions, collection memberships, source-policy updates, docs, and
generated output on a consumer branch. Run that repository's full required
checks and commit/push/review workflow and repeat the five-page smoke test.
Coordinate npm publication and consumer adoption separately; do not add tasks
that require an already-merged package PR to a required milestone here.

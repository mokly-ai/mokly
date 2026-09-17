# Mokly Design MockLinks

## Outcome And Status

Make Mokly's own design catalogue navigable through its pictured links,
rows, and supported state controls, in both mobile and desktop variants.
The basic example's prominent buttons also demonstrate `MockLink asChild`.

Status: complete. All milestones are delivered; implementation `9fbbc17` is
pushed and reviewed against integrated main `e47524b`. The complete contract is
[Design mockup links](../docs/protocol/mokly-design-links.md), which builds
on the implemented [navigation](../docs/protocol/mokly-navigation.md) and
[child controls](../docs/protocol/mokly-link-controls.md) contracts.

## Baseline And Boundaries

- At plan creation, nineteen design screens produced 38 light-only files.
  All 38 contained zero native links and zero mock-link markers.
- `entries/catalogue.mockup.tsx` originally had three working text links, but
  its two Firna buttons used only no-op handlers. The package already implements and
  tests `MockLink`, `asChild`, portable hrefs, and Browse enhancement.
- Shared adoption points are the `nav`, `shell`, `stage`, `details`, `compare`,
  `review`, and `tag_filter` components under `entries/design/parts/`.
  `design.mockup.tsx` owns the catalogue; existing screen modules own each
  standalone artboard.
- Five new standalone states are required: normal light Details, an unfiltered
  open tag picker, closed forms/onboarding filters, and an open onboarding
  picker. Preserve every existing id and route, including the forms-open
  `design-browse-tag-filter` and inspector `design-browse-details` screens.
- Use the contract's explicit destination tables. Design navigation targets
  design ids; real example navigation targets example ids. Never route by
  visible labels or invent a live `example-farewell` entry.
- Links use canonical depicted states; local copy/resize/refresh/viewport
  controls remain visual depictions. The actual outer shell retains its
  runtime behavior. The contract lists unsupported state combinations
  explicitly so a shared control cannot silently switch subjects.
- No new package dependency, API, server, adapter, or application UI work is
  required. This is consumer/mockup adoption. Runtime defects discovered during
  implementation need regression tests and a new backend milestone immediately
  after the active milestone. Follow it with a new tagged mockup milestone and
  move blocked tasks there, preserving their incomplete status.

## Milestone 1: Define the adoption contract — completed

Outcome: an indexed plan with explicit scope, targets, unavailable controls,
and verification requirements, without implying the implementation has shipped.

- [x] Inspect all design screen/component families, generated HTML, example
      links, related READMEs, navigation contracts, and existing browser tests.
- [x] Fetch `origin/main` and audit from source tip
      `bb3a22facae6b98355c4e20effdfd47676f8fdb6`; main is the same commit, with
      no divergent mainline additions or existing workspace changes.
- [x] Define the complete target protocol before creating this plan.
- [x] Create this change-specific plan and add it to `plans/README.md` Active.
- [x] Link the pending adoption from the protocol index, shell contract, and
      example documentation while retaining the current implementation status.

## Milestone 2: Complete the owning design screens — completed

Tags: mockup

Outcome: every required destination renders independently in the catalogue,
with a coherent mobile/desktop depiction and reusable screen components.

- [x] Add and run failing registry/rendering assertions for the five new
      destination ids, both viewport variants, and their specified states.
- [x] Add `design-browse-details-screen` at the contracted route. Reuse
      `MiniDetails`; keep it distinct from Welcome's expanded inspector and
      the existing dark-selected light-only Details artboard.
- [x] Add the four tag states under matching nested source/output directories.
      Reuse shared tag/screen components and retain the current forms-open
      page's id, route, and subject. Each screen has its own mobile and desktop
      component; flows must import those owning components.
- [x] Represent the contracted query, selected chip, tree rows, picker
      visibility, and light/dark state consistently. Add the scheme control
      to each endpoint of the three specified scheme pairs.
- [x] Give Details its own depicted metadata; make shared inspector data typed
      by subject so Details and removed comparisons cannot show Welcome paths,
      descriptions, tags, or live-use-case links accidentally.
- [x] Register the new entries beneath the existing design hierarchy without
      renaming/moving existing entries. Keep each generated screen-spec page
      within five screens and any new nested pages in matching directories.
- [x] Reuse existing mockup CSS and components; split touched modules that
      exceed 300 lines into coherent siblings rather than compacting markup.
- [x] Update the shell design route inventory and example documentation for
      the added states. Describe link adoption as pending until it is wired.
- [x] Run `npm run build`, `npm run example:build`, `npm run example:check`,
      relevant rendering tests, and `npm run typecheck`. Open all added pages
      directly from disk and inspect both variants before starting link wiring.

## Milestone 3: Wire shared design navigation — completed

Tags: mockup

Outcome: the design catalogue supports the specified navigation journeys using
the existing public authoring API and shared components.

- [x] Create `tests/design_links.test.ts` with failing semantic assertions for
      the existing home action, nav leaves, miniature screen links, flow
      references, inspector action, and comparison control destinations. Run
      them against the built real example before adding those links.
- [x] Add a typed destination map and navigation context in small modules
      under `entries/design/parts/`; separate depicted subjects from catalogue
      targets and provide explicit inactive states. Validate targets against
      the real manifest, not a second hardcoded registry.
- [x] Adopt `MockLink`/`asChild` in the brand, home/recovery actions, navigable
      crumbs, catalogue leaves, drawer entry/exit, and All/Changes choices.
      Keep collection ids out of link destinations and avoid anchors wrapping
      disclosures or child rows.
- [x] Wire `MiniWelcome`, `MiniDetails`, and `MiniFarewell`, preserving the
      specified scheme pair where it exists. Wire both use-case step references
      to their owning standalone design screens; keep the visible reference
      consistent with the destination rather than printing another entry's id.
- [x] Wire Welcome inspector open/close and the subject-appropriate Example
      tour link. Give any inactive inspector action an explicit non-link state
      rather than defaulting all subjects to Welcome's expanded inspector.
- [x] Wire the three scheme pairs and supported comparison modes. Test
      Added/Removed, dark, shared-impact, ignored-only, and empty Changes
      separately so shared controls cannot route them to unrelated scenarios.
- [x] Wire tag picker open/close, both tag choices, active-tag clearing, and
      supported inspector chips exactly as the protocol table specifies.
- [x] Preserve full clickable areas, color inheritance, icon sizing, wrapping,
      and focus outlines after adaptation. Links use link semantics; inactive
      depictions have no href, marker, or misleading tab stop.
- [x] Rebuild and validate the example, run focused tests and typechecking,
      then smoke-test Home → Welcome → Details → Welcome and the use-case,
      drawer, scheme, tag, and comparison journeys in both variants.

## Milestone 4: Demonstrate styled example navigation — completed

Tags: mockup

Outcome: the real Firna example demonstrates styled links through the same
renderer and generated-output pipeline as consumers.

- [x] Add and run failing assertions for the two styled fixture buttons in
      all four viewport/scheme combinations, including the Details fragment.
- [x] Change the primary button to `View details`, wrap it with
      `MockLink asChild` targeting `example-details` and fragment `details`.
- [x] Change the secondary button to `Return to welcome`, targeting
      `example-welcome`. Keep the component's required no-op handler and all
      existing text links; static anchors perform navigation.
- [x] Rebuild the example and test the buttons within their standalone screen
      and the real `example-tour` frames using pointer and keyboard activation.
- [x] Update the root/example READMEs and example notes with navigation usage
      and the precise distinction between linked design states and depicted
      runtime controls. Update obsolete statements that every design link is
      styled text, and keep engineering notes outside rendered artboards.

## Milestone 5: Verify every output surface — completed

Tags: mockup

Outcome: source, committed HTML, actual Browse behavior, portable navigation,
and published-preview behavior agree with the adoption contract.

- [x] Add `tests/browser/design_links.spec.ts` using the actual example
      catalogue. Cover pointer and Tab/Enter navigation from both design-frame
      variants, expected outer URLs, active rows, Back/Forward, and preserved
      outer viewport selection. Keep the consumer-script denial assertion.
- [x] Extend the existing direct-file design tests with representative round
      trips, flow references, button focus, and inactive-control checks.
- [x] Validate every generated design link against manifest destinations in
      both variants. Check every new state's incoming and return navigation;
      assert label/subject/query/picker agreement, not merely a link count.
- [x] Check the canonical existing-design inventory against the complete
      manifest id/route set; keep pending additions in the feature contract
      until their standalone screens ship.
- [x] Exercise real example buttons in light/dark output and actual Review
      snapshot fallback. Keep Review's frame-owned links distinct from a
      design artboard that merely depicts a comparison.
- [x] Run `npm run preview:build` and test the new links with the existing
      preview browser helpers; inspect current/portable files to confirm
      preview adaptation did not mutate committed output.
- [x] Open every changed generated design/example page directly from disk.
      Inspect both variants, keyboard focus, row hit areas, dark colors,
      toolbar layout, and narrow drawer/picker overlap; save screenshots under
      `.context/` and correct any implementation regressions before delivery.
- [x] Stabilize keyboard probes after fragment navigation by waiting for
      visible controls to finish layout before focusing; retain focus assertions.
- [x] Run the focused build/link/browser suites, `npm run example:check`, and
      `cargo xtask check` with a 100% pass rate. The full gate includes format,
      lint, typecheck, unit/integration tests, packed consumers, browser tests,
      Rust formatting, clippy, and Rust tests. Resolve failures and rerun the
      relevant gate before proceeding.
- [x] Review the source/generated diff, update all affected contract delivery
      statuses and screen counts, and confirm the five new screens and every
      generated HTML/manifest update will be tracked in the delivery commit.

## Milestone 6: Commit, push, and review — completed

Outcome: the validated implementation is committed, pushed, and independently
reviewed, with findings left for the user's decision.

- [x] Before any merge/rebase, fetch main, capture the current source tip,
      and audit main's additions from that tip's merge base. Preserve every
      mainline feature; resolve conflicts path by path if integration is needed.
- [x] After tests and `cargo xtask check` pass, inspect
      `git diff --name-status origin/main`, deletions against main, and the
      complete diff. Stop for any unapproved removal or feature reduction.
- [x] Run `git add -A`; inspect the staged diff including new source, test,
      generated, and documentation files. Commit with a Conventional Commits
      title of at most 50 characters and an explanatory body.
- [x] Inspect `git diff --name-status origin/main..HEAD`, then push the current
      branch without renaming it.
- [x] Run `cargo xtask review` after the push so it reviews the complete
      committed branch diff against `origin/main`.
- [x] Report every finding with a number, severity, context, impact of doing
      nothing, lettered solution options, and a recommended option. Evaluate
      whether a shared rule/test/abstraction prevents recurrence. Do not
      automatically fix findings from this review.
- [x] Record the review result and completed milestones, move this plan to
      Completed only when its required tasks are done, and validate/commit/push
      any final documentation record separately if needed.

## Planning Delivery Record

The planning commit `cde0932` was pushed and reviewed on 2026-09-09.
Markdown, local links, and the documentation-only check exemption were applied.
The user then authorized valid review fixes, recorded in Milestone 7.

1. **Medium — incomplete route inventory (fixed).** Current/Overlay routes and
   all ids were missing from the older inventory, risking duplicate/moved
   destinations. A. Maintain one complete inventory with a manifest check
   (recommended, implemented). B. Narrow the new contract's wording only.
2. **Medium — ambiguous historical note (fixed).** “No new design screens”
   described earlier runtime work but could be read as this adoption's scope,
   risking omitted states. A. Identify its completed scope and link the new
   contract (recommended, implemented). B. Move the note to an archive.

## Milestone 7: Address approved planning review findings — completed

Outcome: the existing route inventory and historical notes agree with the
planned adoption before feature implementation began.

- [x] Verify the findings independently: the manifest then had 19 design screens,
      the old inventory omits Current/Overlay and all entry ids, and the old
      notes refer to the completed in-frame navigation work.
- [x] Complete one canonical id/route inventory, cross-reference it from the
      adoption contract and example README, and require manifest comparison
      during future implementation verification.
- [x] Identify the historical note's completed scope and link to the five
      planned additions in the adoption contract.
- [x] Validate Markdown, local links/anchors, exact manifest inventory parity,
      and the diff. Apply the documentation-only full-check exemption.
- [x] Preserve the audited mainline logo update, then `git add -A`, commit the
      fixes using Conventional Commits, and push the branch.
- [x] Run `cargo xtask review` after the push and record/report new findings
      without automatically fixing them; commit/push the final review record.

Validation: the inventory probe first failed for two missing routes and all
19 missing ids, then passed with exact manifest parity. All 58 local links
(including three heading anchors), Markdown formatting, and diff checks pass.
Source tip `ef2bfd1` integrated `815405e` (screen-stack logo) without conflicts;
the code and generated files matched that main snapshot. The documentation-only
`cargo xtask check` exemption applies to this change.

Post-push review of `d491e16` completed against the subsequently advanced main
`e47524b`. Source tip `d491e16` then integrated that audited development-command
commit cleanly; package code, tests, generated output, and watch protocol match
`e47524b`. The original two findings are fixed. Follow-up dispositions:

1. **Medium — newer main absent from the reviewed tip: integration completed.**
   The reviewer compared two diverged tips; a verified clean merge preserved
   the dev command and docs, with no branch deletion proposed. A. Refresh the
   branch (recommended, completed). B. Rely on target-branch integration, leaving
   the local audit stale. The refreshed branch removes that audit ambiguity.
2. **Low — pending delivery checkboxes: scheduled bookkeeping completed.**
   Review was pending in the commit it reviewed; an unchanged record would
   obscure delivery status. A. Record completion and the audited SHA
   (recommended, completed here). B. Leave a dated pending-status note.
3. **Low — duplicate example README phrase: resolved in Milestone 4.**
   Repetition obscured the screen inventory. A. Remove the duplicate.
   B. Use the canonical inventory link (recommended, implemented during the
   authorized README update), avoiding another list that can drift.

## Implementation Verification Record

Source tip `d1e0963` fetched and audited `origin/main` at `e47524b` before the
requested merge; `git merge origin/main` reported already up to date.
Seven destination/metadata tests and five navigation tests failed before their
fixes; all four styled-button variants also failed before adoption. The focused
suite now passes 24 tests, plus 18 browser journeys across served Browse,
direct files, real use-case frames, Pages preview, and actual Review snapshots.
Preview generation preserves every committed-output byte. All 56 screen files
were opened from disk and visually inspected; captures are under
`.context/mocklinks-visual/`. The shared focus helper waits for fragment layout
to settle; all 27 repeated keyboard cases pass. `cargo xtask check` passed with
426 TypeScript tests, 94 browser tests, three Rust tests, formatting, linting,
typechecking, generated-output checks, packed consumers, clippy, and the Rust
file-length audit. All 33 original entries and their routes are preserved;
there are no deleted files. All 60 local Markdown file links also pass.

Implementation `9fbbc17` was committed, pushed, and reviewed against `e47524b`
on 2026-09-09. No actionable code, behavior, security, or generated-output issues
were found. The reviewer's read-only sandbox blocked its independent fixture
check from creating a temporary directory; the full gate above passed outside
that sandbox. Final documentation uses the documentation-only check exemption.

1. **Low — pending plan delivery status: scheduled closeout completed.**
   The reviewed commit still listed delivery tasks as pending. Leaving them
   unchanged would mislead future agents into repeating completed work.
   A. Record the review and move the plan to Completed (recommended, completed
   by the already-authorized final milestone). B. Leave it Active with only
   final disposition pending. The existing post-review record step prevents
   stale status; no broader code or test change is warranted.

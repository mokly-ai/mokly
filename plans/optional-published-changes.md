# Optional Published Changes

## Status And Outcome

Implementation, validation, commit, push, and review are complete. Authorized
follow-up fixes are recorded in the [review record](../docs/reviews/catalogue-pages-and-publication.md).
The user requested an option after reviewing whether Changes belongs
in a published catalogue.

Publish the current catalogue by default. Authors can explicitly include
Changes and comparisons against a baseline fixed during publication. PR
previews enable that option; the main reference catalogue uses the default.

[Optional Changes In Published Catalogues](../docs/protocol/mokly-publication.md)
owns the complete target, commands, failure behavior, and acceptance criteria.
The package and runtime protocols now describe the implemented behavior.
This applies to all entry kinds and can ship independently of
[Unified Catalogue Pages](./unified-catalogue-pages.md). That plan supplies the implemented page impact and removed-page metadata.

This plan changes export behavior and its workflow invocations. Actual site
deployment and npm publication are outside the implementation delivery gate.

## Milestone 1: Define optional publication — completed

Record the chosen default and opt-in behavior before implementation.

- [x] Inspect the existing static exporter, review pipeline, and preview jobs.
- [x] Define the option, fixed baseline, omitted capabilities, failure behavior,
      and PR/main workflow selection in a target protocol.
- [x] Update the page contract and plan so removed pages are required only in
      publications that include Changes; index and cross-link this plan.

Planning validation passed: Prettier, 101 local Markdown link targets, both plans'
milestone/checklist/index structure, and whitespace checks. The integration audit
preserved all 51 paths changed on main from the recorded source tip; the complete
branch diff against main was documentation only. Commit `dc44b02` was pushed;
review found stale-source exposure, removed-parent placement, live updates in
exports, and consumer-specific documentation. Commit `f7a1a36` resolved these
contracts. Documentation-only work was exempt from `cargo xtask check`.

## Milestone 2: Resolve publication review — completed

Make the static-export invariant explicit after the user's review decision.

- [x] Require both export options to omit live updates and events endpoints.
- [x] Specify tests for watch scripts, EventSource/polling, and all captured routes.
- [x] Link page publication to the shared removed-entry metadata contract.

Commit `f7a1a36` passed Prettier, 130 local links, milestone and inventory checks
and was pushed. Review found ambiguous page-route wording and absent completed
review records. Both were verified and corrected on the user's instruction;
implementation and its full checks remain below.

## Milestone 3: Design both publication states — completed

Tags: mockup

Define the visible capability difference using existing shell designs.

- [x] Read the shell design protocol and example README; reuse the existing
      Browse and review components under `examples/basic/entries/design/`.
- [x] Create linked standalone mobile/desktop screens for the current catalogue
      with review omitted and included. Hide Changes/counts and diff controls
      when omitted; retain search, tags, navigation, viewport, and color choices.
- [x] Keep each screen in its own component, reuse it in flows, and keep owning
      screen-spec pages within the five-screen limit. Avoid environment labels.
- [x] Update design docs, build/check generated examples, run relevant tests
      and typechecking, and visually inspect each changed artifact from disk.

The functioning design catalogue specifies both publication states before UI
implementation begins.

## Milestone 4: Implement publication options and capture — completed

Add the option and export capability boundaries with the existing product
functional throughout. Keep the script explicitly including review until the
shell is ready and the final milestone switches its public default.

- [x] Add failure-first tests for argument validation and the internal typed
      option contract; prepare the parser and `buildPreview` option plumbing.
      Keep public script invocation on the existing review-enabled path.
- [x] Add an explicit review capability to capture/server context. Implement
      default publication with no Git/change/history/provider work, current-only
      route capture, and absent comparison endpoints and generated artifacts.
- [x] Test and implement explicit review capture with one pinned merge base,
      consistent current inputs, immutable packaged comparisons, and actionable
      failure without fallback when the base or comparison is unavailable.
- [x] Preserve removal of the live-update entrypoint, watch-only assets, and
      events routes/redirects in both options. Test every captured route class.
- [x] Exclude existing review artifacts from public copying in both options.
      Test review-to-default replacement, ID/route precedence, source/resource
      safeguards, rollback, and isolation from a running development server.
- [x] Update internal comparison fixtures to opt in. Run build, lint,
      typechecking, and relevant preview, review, server, and safety tests.

Both backend capabilities are tested and ready for the shell and workflow switch.

## Milestone 5: Activate optional review in publication — completed

Tags: ui

Apply the completed designs using the established backend capabilities. Keep
this milestone limited to shell/client presentation and browser validation.

- [x] Add shell/browser regressions before enabling the new presentation. Use
      the explicit capability to omit Changes/counts/diff controls by default
      and retain the existing comparison experience when included.
- [x] Normalize stored review preferences and direct review links to All/Current
      when review is unavailable; preserve route, scheme, viewport, and anchor.
- [x] Verify zero-change review, removed entries when supported, search/tags,
      navigation, Back/Forward, and absence of comparison requests by default.
      Assert no EventSource or development polling in either export option,
      including startup, navigation, and refresh after selecting comparisons.
- [x] Run focused shell/client and Chromium tests. Start the real server and
      serve both generated artifacts for mobile/desktop visual smoke tests.

The shell presents both completed options without altering local development.

## Milestone 6: Switch workflows, verify, commit, push, review — completed

Deliver the completed behavior with documented commands and explicit workflow
selection after the UI is ready.

- [x] Preserve the newly merged design-link feature from main during final
      integration; retain optional publication controls and explicitly opt the
      imported comparison browser fixture into Changes. Recheck both exports.

- [x] Activate the documented CLI options and default after the shell is ready.
      Set the main workflow to the default command and PR previews to
      `--include-changes --base origin/main`; preserve deployment safeguards.
      Update workflow assertions and comparison build invocations.
- [x] Update README, Changes/runtime, release, and example documentation to
      implemented behavior. Update the page plan's publication integration;
      do not imply that its separate page API is already implemented.
- [x] Run all relevant tests with a 100% pass rate, build, lint, typechecking,
      example build/check, preview builds in both options, packed-consumer and
      browser checks. Run `cargo xtask check` and fix failures before completion.
      If Rust changes, run fmt, clippy, tests, and the required file-length lint.
- [x] Fetch main and audit its additions from the captured pre-integration tip;
      preserve all unrelated features. Inspect the diff and deletions against
      `origin/main`, validate Markdown/links, and record verification results.
- [x] Run `git add -A`, commit all completed work with a Conventional Commit
      title of at most 50 characters and an explanatory body, then push. Record
      the authorized change to default publication and retained opt-in review.
      Inspect the committed diff and deletions against `origin/main`.
- [x] After the push, run `cargo xtask review`. Do not automatically fix its
      findings; report numbered items with severity, context, impact, lettered
      options, and a recommendation considering broader prevention.
- [x] Record unresolved findings, complete only finished milestones, and move
      this plan to Completed in the index when all required work is done.
      Validate and commit/push final documentation bookkeeping if needed.

## Implementation Verification

The pre-integration `cargo xtask check` passed on 2026-09-09: formatting, lint, TypeScript, 425
Node tests, example freshness, package contents, packed ESM/NodeNext/npx/Juno/
themed consumers, 82 Chromium tests, Rust fmt/clippy, three Rust tests, and
the Rust file-length audit. Both publication options were built and served.
Tests cover a ref advancing during capture, input-mutation rollback, replacement
of review output with an ordinary export, removed pages, fragments, preserved
screen comparisons, and absent live updates. All four publication design
artifacts were opened from disk and visually inspected at mobile/desktop sizes. Live and exported views were also visually inspected
with each publication capability.

The initial main audit retained source tip `f7a1a36`; refreshed `origin/main` remained
`e47524b`. Main subsequently advanced to `93ac778` after the implementation
push (`57eb59a`). The integration retains every existing design destination,
extends the canonical page/publication links, and opts the imported comparison
fixture into Changes. All 60 integrated design artifacts were visually inspected.
The final integrated `cargo xtask check` passed: 453 Node tests, 102 Chromium
tests, packed consumers, all three Rust tests, fmt/clippy, and file-length checks.
The browser suite now waits for completed comparison responses and uses
independent Wrangler inspector ports when workspaces run concurrently. All 151
local Markdown targets resolve. Logs and visual evidence are under `.context`;
final commit/push/review records follow below.

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

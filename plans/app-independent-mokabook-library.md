# App-Independent Mokabook Npm Library

<!-- markdownlint-disable MD013 -->

## Status

Active. All branch-local work in milestones 2–9 is implemented: the complete
framework, neutral design and UI, packed-consumer and external-consumer parity,
and CI/release automation. Milestone 10 verification completed and its
post-push review fixes are implemented in milestones 10A–10D; milestone 10E is
running the required commit, push, and repeated-review workflow.
The milestone-2 GitHub repository rename to `futex-ai/mokabook` is complete.
Milestones 11–13 require a merged release, explicit approval for the first npm
publish, and work in a separate consumer workspace, so they cannot be closed
from this feature branch.

## Summary

Build the reusable Mokabook framework in this repository, remove assumptions
about any product or consumer filesystem, publish it as `mokabook`, and prove
it through neutral fixture catalogues. The
package will own structured registry definitions, static build/check, the
watched Browse server, Git-based Review artifacts, and public authoring helpers.

A downstream consumer retains its screens, use cases, page components, renderer
theme adapter, product styles/assets, generated HTML, and any temporary
consumer-only compatibility rules. After the first public package release, a
separate consumer workspace can replace copied framework code with the npm
dependency and delete only the superseded generic code. Juno migration is a
future change, but a Juno-shaped fixture must prove that the package boundary is
application-independent.

The target contracts are:

- [Package and authoring contract](../docs/protocol/mokly-package.md)
- [Build, Browse, and Review runtime](../docs/protocol/mokly-runtime.md)
- [CI and npm release contract](../docs/protocol/npm-release.md)

## Investigation Baseline

The plan was prepared on 19 July 2026 from these clean `main` snapshots:

| Repository          | Commit                                     | Purpose                               |
| ------------------- | ------------------------------------------ | ------------------------------------- |
| `futex-ai/mockbook` | `896a6ecfd26236b1695c7683e7acac73dc4efbc9` | Empty target before planned rename    |
| Reference consumer  | `50e422e442a6819f1aae0fbd038d99b519b72a72` | Framework source and current behavior |
| Juno                | `e41d1832dd1109b4d454c77507e2de867b084849` | Future-consumer layout check          |
| Firna UI            | `d36889be243a24f862d5d02539f15eca80e3fb7a` | Npm/CI/release convention reference   |

The reference framework candidate is approximately 71 source/style files and
9,571 lines, plus 18 focused framework/review test files and 4,314 test lines.
The candidate is broader than `docs/mockups/src/mockbook/**`: registry,
generation, bundling, loading, lints, id links, public Review-ignore helpers,
review summary generation, shell CSS, and frame assets are required for a
complete extraction.

The source cannot be copied unchanged:

- `core.ts`, registry discovery, manifests, and generated headers hard-code
  `docs/mockups` and include consumer-only legacy route repair.
- `render.tsx` imports `@firna/ui`, React Native Web, and product theme
  tokens.
- stylesheet selection recognizes product-specific `marketing/` and `email/`
  route families.
- watched Serve knows about `emails/src/templates.json` and watches framework
  source because the framework currently lives inside the consumer.
- Review shared-impact rules enumerate product component, Firna-token, and
  generator paths.
- the server derives the repository root by assuming `docs/mockups` is exactly
  two levels below it.
- large modules such as the 902-line `core.ts` and 484-line Review artifact
  renderer should be decomposed instead of transplanted.

### Implementation Re-Audit

Immediately before milestone implementation on 19 July 2026, `origin/main` in
this repository remained at `896a6ecfd26236b1695c7683e7acac73dc4efbc9`.
The reference consumer's `origin/main` had advanced from the investigation baseline to
`fdd0049a6fb195d4ac59250c0df797302565e58f`. The intervening mockup diff added
one product entry module and generated assistant-reply fragments, and changed
product pages, a product test, `app.css`, and the generated v2 manifest. No
framework, registry, renderer, server, watch, Review, authoring-helper, lint, or
bundler candidate changed. The extraction baseline therefore remains valid;
the new product screens and generated HTML remain excluded.

Juno already uses React-backed `.source.tsx` files and committed HTML under
`docs/mockups`, but its component registry, stylesheets, workspace package, and
directory hierarchy differ. This confirms that renderer, paths, legacy policy,
watch inputs, and shared-impact rules must be host configuration.

Npm availability was rechecked after the name was confirmed: on 19 July 2026,
`npm view mokabook` returned `E404`, so the unscoped name appeared unclaimed.
Unscoped `mockbook@0.0.1` existed under another owner. Recheck `mokabook`
immediately before the bootstrap publish because availability is not reserved
by this plan.

## Ownership Boundary

| Move into `mokabook`                             | Keep in the consumer                      | Make configurable                           |
| ------------------------------------------------ | ----------------------------------------- | ------------------------------------------- |
| Registry types/helpers and tree flattening       | `src/entries/**` definitions              | Mockups, entries, legacy, and repo roots    |
| Manifest, fragments, discovery, validation       | `src/pages/**` and generated product HTML | Renderer module and stylesheet rules        |
| Generic legacy generation and lints              | Product components and fixture data       | Legacy aliases, allowlists, and lint policy |
| `mock:` links and link/anchor validation         | `@firna/ui` theme/token adapter           | Additional watch inputs and action          |
| Browse server, shell, client, and nav tree       | App/marketing/email CSS and assets        | Review base/output and shared-impact globs  |
| Watch/rebuild/reload lifecycle                   | Email template source                     | Shell accent variables                      |
| Review compare/artifact/JSON/summary             | Product protocol and mockup docs          | Consumer CI path filters/artifact name      |
| Review-ignore helpers/material hashing           | Product-specific Review-ignore wrappers   | Optional version 2 manifest compatibility   |
| Neutral shell/frame CSS and licensed font assets | Consumer-only route repair                | Legacy component-expansion adapter          |

Every candidate file and behavior will receive one recorded disposition before
the consumer deletes anything. “Rewritten as configuration” counts as extracted;
silently dropping behavior does not.

## Decisions

- Publish one public ESM package, `mokabook`, with one `mokabook` bin.
- Use the intentional Mokabook spelling for package, executable, configuration,
  manifest, shell, and new documentation. Do not publish `mockbook` aliases.
- Document `npx mokabook` for both zero-install and local dependency use.
- No-argument CLI behavior is watched `serve`; explicit `build`, `check`, and
  `review` subcommands preserve the current complete workflow.
- Discover a typed `mokabook.config.*` from the working directory. All consumer
  paths resolve from that file.
- Emit manifest schema version 3 with repo-relative paths. Read version 2 only
  during the consumer transition.
- Provide a plain React renderer and a consumer renderer hook; do not depend on
  `@firna/ui` or React Native Web.
- Keep static fragments and manifests committed in consumer repositories.
- Use synthetic mobile/desktop screens in examples and tests; publish no real
  consumer or Juno screen code or output.
- Follow Firna UI's release-please plus npm trusted-publishing model, updated to
  current npm/action requirements and adapted for a CLI package.
- Deliver in two product commits/PRs: the library/release work in this repo,
  then the dependency cutover and generic-code deletion in the consumer.

## Goals

- Preserve all reusable Build, Check, Browse, watched-development, Review, and
  Review-ignore behavior from the audited consumer snapshot.
- Make repository shape, renderer, styles, and app compatibility explicit.
- Support a clean `npx mokabook` path and deterministic local dependency
  use in CI.
- Provide fully typed public APIs, actionable errors, complete docs, and packed
  package tests.
- Release through a reviewed release PR and tokenless OIDC publishing.
- Leave the consumer with screens and adapters only, not a second framework fork.

## Non-Goals

- Moving consumer or Juno screens, product use cases, generated HTML, product
  CSS, theme tokens, email data, or application components into this repo.
- Migrating Juno to Mokabook in this change.
- Hosting Mokabook as a deployed service or adding cloud visual-diff storage.
- Making product fragments interactive or replacing consumer component tests.
- Preserving undocumented consumer path-repair behavior as a global default.
- Publishing the package before a packed-tarball consumer compatibility run.

## Milestone 1: Contract And Extraction Baseline

Summary: establish a complete, reviewable target contract before implementation.

- [x] Audit this repository, a reference consumer's current framework, Juno's future
      consumer shape, and Firna UI's npm/release conventions.
- [x] Record immutable source snapshots and quantify the candidate framework and
      test surface.
- [x] Define package identity, CLI behavior, config discovery, registry/output,
      renderer, legacy, Browse, Review, watch, CI, and release contracts under
      `docs/protocol`.
- [x] Record the move/keep/configure boundary and explicitly exclude real
      product screens.
- [x] Expand the root README and create `plans/README.md` with this active plan.
- [x] Verify current npm name availability and confirm `mokabook` is the
      intentional package, executable, and product spelling.

At this milestone the target behavior is specified without changing runtime
code in any repository.

## Milestone 2: Repository And Package Foundation

Summary: create a buildable, testable npm CLI/library skeleton whose help and
public exports work before framework behavior is ported.

- [x] Fetch `origin/main`, preserve its additions, and confirm the consumer
      source tip has not moved; if it has, audit the new framework diff and
      update the baseline before copying code.
- [x] Coordinate renaming the GitHub repository from `futex-ai/mockbook` to
      `futex-ai/mokabook`, update the local `origin`, and verify redirects and
      repository settings without renaming the current branch.
      Completed with maintainer authorization via `gh repo rename`; the
      repository is `futex-ai/mokabook`, the local `origin` points at the new
      URL, old URLs redirect, and the current branch name is unchanged.
- [x] Create `package.json`/lockfile for public ESM `mokabook@0.0.0`,
      using npm commands to add current dependencies rather than guessing
      versions.
- [x] Add exact repository metadata, MIT `LICENSE`, `CHANGELOG.md`, Node engine,
      package manager, `files`, `exports`, types, `bin`, and public
      `publishConfig` fields from the release protocol.
- [x] Establish short, cohesive `src` module families for CLI, config,
      authoring, build, registry, legacy, server, client, review, and errors;
      target about 200 lines and do not transplant consumer monoliths.
- [x] Add a shebang-safe `mokabook` executable with `--help`, `--version`,
      default-serve dispatch, explicit subcommands, and typed option errors.
- [x] Add TypeScript build/typecheck, formatter/linter, and test scripts with no
      unexplained exclusions from typechecking.
- [x] Add the Cargo workspace and small trait-backed `xtask` used by
      `cargo xtask check` and `cargo xtask review`, with Rust tests and crate
      README following repository rules.
- [x] Add package metadata/export/bin unit tests and make the production build
      succeed before continuing.
- [x] Update README developer setup and code-jumping points for the real
      scaffold without claiming unfinished commands work.

At this milestone `npm run build`, package imports, `mokabook --help`, and the
initial `xtask` tests work even though catalogue commands may report a clear
not-yet-configured error.

## Milestone 3: Config, Authoring API, And Migration Ledger

Summary: replace source-repository assumptions with a typed host boundary and
port the pure public registry/review helpers.

- [x] Write failing tests for config discovery from nested directories, an
      explicit config path, npx-cache execution, npm workspaces, missing config,
      invalid paths, path traversal, and conflicting generated/source roots.
- [x] Implement `defineConfig` and typed config loading for mockups/entries/
      legacy roots, renderer, stylesheets, watch inputs, Review paths, and
      compatibility policy exactly as specified.
- [x] Port and document `defineScreen`, `defineCollection`, `defineUseCase`,
      `defineRoot`, `collection`, `screen`, `mockLink`, `MockLink`,
      `ReviewIgnore`, `ReviewIgnoreScope`, and `reviewMaterialKey`.
- [x] Ensure renderer and entry bundling resolves one React instance and works
      both from a local install and a transient npx package cache.
- [x] Implement a neutral default renderer plus a documented consumer renderer
      module contract; add a test-only custom renderer that wraps context and
      injects collected styles.
- [x] Audit every candidate file/behavior as ported, rewritten into config,
      retained in the consumer, product-specific test, or intentionally obsolete
      with rationale.
- [x] Add architecture documentation explaining package-owned versus
      consumer-owned dependencies and why app compatibility hooks cannot leak
      into defaults.
- [x] Run unit tests, typecheck, build, and file-size checks for this milestone.

At this milestone a neutral config and registry can be imported and validated
from a clean external fixture with no consumer-app dependencies.

## Milestone 4: Static Build, Check, And Legacy Compatibility

Summary: port deterministic generation and validation behind the new config,
with transactional output and explicit legacy extensions.

- [x] Add failing regressions for stale/missing/orphan output, duplicate ids and
      routes, fragment collisions, missing relationships, invalid routes,
      unresolved id/raw/anchor links, missing stylesheets, and unsafe deletes.
- [x] Port registry discovery/attribution, nested flattening, validation,
      fragment rendering, schema version 3 manifest generation, and version 2
      read compatibility.
- [x] Port generic `.source.ts`, `.source.tsx`, and `.source.html` discovery,
      bundling, component expansion, source linting, stage/screen limits, link
      checks, and generated-file ownership.
- [x] Extract consumer legacy route aliases, flat-family rules, allowlists,
      renderer, and stylesheet selection into fixture/consumer adapters; none
      may remain in framework defaults.
- [x] Implement an in-memory/staged generation transaction so failed rendering,
      validation, or linking preserves all last-good files.
- [x] Implement `mokabook build` and read-only `mokabook check` with sorted,
      grouped, actionable diagnostics and non-zero failure behavior.
- [x] Prove deterministic paths/bytes on macOS and Linux path semantics and
      ensure absolute checkout paths never enter output.
- [x] Port applicable consumer tests first, remove product assertions, and add
      config-boundary and security coverage for every rewritten assumption.
- [x] Update package/API docs and protocol ambiguities discovered while porting.
- [x] Run focused tests, the full unit/integration suite, typecheck, and build.

At this milestone a headless fixture catalogue builds, checks byte-stably, and
retains its previous generated output after a deliberate failed build.

## Milestone 5: Server, Watch, And Review Engines

Summary: port non-visual runtime behavior before implementing the package-owned
shell UI.

- [x] Port manifest loading/validation, catalogue and navigation models, safe
      route resolution, id redirects, static-file confinement, and Review route
      orchestration behind injected filesystem/Git/process boundaries.
- [x] Port the watched child supervisor, notification gate, debouncing,
      transactional rebuild/rollback, stable port handling, update stream,
      state-recovery protocol, startup readiness, and clean shutdown.
- [x] Replace package-source/runtime self-watch assumptions with config-derived
      consumer input classes; package development uses repository tooling.
- [x] Port Git base resolution/extraction, inventory, per-route/per-viewport
      comparison, shared-impact classification, Review-ignore normalization,
      aggregate ignored impact, artifact model, deterministic `review.json`,
      and CI summary generation.
- [x] Model filesystem, Git, process, watcher, clock, and server collaborators
      behind typed interfaces so unit tests use fakes rather than real ambient
      state; reserve real implementations for integration tests.
- [x] Add failure-first coverage for manifest-before-bind, occupied ports,
      port `0`, notification buffering, failed rebuild recovery, restart order,
      no watch loops, base-ref failures, malformed ignore regions, and path
      traversal.
- [x] Add integration tests for no-watch server routes, watched CLI lifecycle,
      review artifact contents, and process cleanup.
- [x] Keep implementation modules below the repository size target and update
      runtime docs with any resolved lifecycle detail.

At this milestone the server/runtime engines and static Review model work via
integration tests and simple diagnostic responses, without landing the final UI.

## Milestone 5A: Engine Review Hardening

Summary: resolve independently validated post-push findings without mixing in
the deferred Browse/Review UI.

- [x] Centralize Review output overlap validation for config, CLI overrides, and
      transactional artifact writes.
- [x] Make Review paths collision-free, preserve complete pane documents, and
      copy referenced local CSS/binary assets into isolated base/head snapshots.
- [x] Sandbox consumer documents in Browse and Review and reject realpath-based
      source exposure through static symlinks.
- [x] Resolve config imports from the consumer graph, strengthen generated-file
      ownership, and align authored/manifest repository-path validation.
- [x] Attach and clean up watched inputs before initial generation so startup
      changes cannot be lost and readiness failures leak no watcher.
- [x] Restore one-sided Review material-signal behavior, narrow verification
      documentation to the implemented gate, and add regression coverage.
- [x] Reject raw links to logical catalogue routes while retaining generated
      fragment and confined public-asset links.
- [x] Reject generated targets beneath authored roots at both compilation and
      transactional writer boundaries, including symlink-resolved paths.
- [x] Distinguish current engine guarantees from deferred release-ready Browse
      shell and browser-coverage requirements in the runtime protocol.
- [x] Validate Review-ignore and material markers during compilation and for
      one-sided added/removed Review panes.
- [x] Exclude the active Review output directory from Git changed-path and
      shared-impact evidence, including a CLI `--out` override.
- [x] Fall back to the compatibility v2 manifest only when the canonical v3
      manifest is absent, never when a present v3 manifest is invalid.
- [x] Describe the current diagnostic Review index/per-viewport pages without
      claiming the deferred grouped and combined-viewport UI.
- [x] Apply the same authored-source and regular-file confinement to Git base
      snapshot dependencies as current-worktree Review dependencies.
- [x] Reject root-absolute fragment links and rewrite only complete `mock:`
      `href` values, leaving text and non-link attributes byte-unchanged.
- [x] Run the Rust file-length audit once through the injected application
      boundary instead of recursively invoking `xtask` inside the check list.
- [x] Align Browse/current v2 manifest fallback with Review: canonical v3 must
      win, and the legacy v2 filename is read only when canonical output is absent.
- [x] Recover watched Serve through its serialized action queue when a child
      exits unexpectedly after reporting readiness.
- [x] Document filesystem paths, stylesheet paths, and repository-relative
      watch/Review globs with their actual resolution bases.
- [x] Constrain catalogue routes to portable URL-safe segments and encode every
      framework-emitted path so mock-link rewriting cannot corrupt attributes.
- [x] Reload changed consumer configuration transactionally, including watcher
      replacement, generated output, and the watched child.
- [x] Read base Review panes through the same regular-file and source-root Git
      guard used for transitive snapshot assets.
- [x] Attribute definitions to the module that invokes each authoring helper,
      including helpers shared by multiple entry modules.
- [x] Validate every local HTML/CSS resource URL and its transitive static
      dependencies during build/check, not only `href` navigation links.
- [x] Wire the versioned live-update stream into every served diagnostic page
      through a package-owned browser client.
- [x] Make watched shutdown wait for active config adoption before closing the
      final watcher and child, without restarting after shutdown begins.
- [x] Match stylesheet rules against documented catalogue routes while keeping
      generated fragment-relative stylesheet URLs.
- [x] Run focused tests, the full `cargo xtask check`, commit, push, and repeat
      `cargo xtask review` under the invoked review loop.

At this milestone the milestone-5 engines satisfy their safety and lifecycle
contracts and have no remaining valid post-push review findings.

## Milestone 6: Neutral Mokabook And Fixture Design

Tags: mockup

Summary: specify the package-owned Browse and Review experience using only
synthetic catalogue data before UI implementation.

- [x] Create a neutral example catalogue with at least two standalone screens,
      one nested collection, one use case, id links, related docs/dependencies,
      custom stylesheet rules, and one safe Review-ignore example.
- [x] Give every synthetic screen a distinct mobile and web/desktop component;
      keep fixture data under examples/tests and never present it as real
      product data.
- [x] Create standalone mobile and desktop Mokabook Browse mockups for home,
      selected screen/use case, details, missing route, and narrow navigation.
- [x] Create separate mobile and desktop Review mockups for changed, added,
      removed, shared-impact, ignored-only, and empty comparison states; split
      pages before any generated screen-spec page exceeds five screens.
      A difference-mode mockup was added beside the required states, and the
      design screens are split across four collections of at most four screens.
- [x] Use the existing Mokabook prototypes only as behavioral/visual reference;
      remove product names, screens, routes, data, colors,
      and theme dependencies from the new designs.
- [x] Ensure each design is reachable from the example navigation and that
      implementation notes live outside rendered screen areas.
- [x] Build/check/test/typecheck the example mockups and open every changed
      mobile/desktop page directly for visual smoke testing.
- [x] Record the approved CSS custom properties and responsive behavior in the
      protocol before the UI milestone begins.

At this milestone reviewers can inspect the complete neutral Browse/Review
design and example catalogue without any consumer screen being present.

## Milestone 7: Browse And Review UI

Tags: ui

Summary: implement the responsive package-owned shell and Review artifact UI
against the completed engines and approved mockups.

- [x] Implement self-contained shell/frame CSS, licensed font assets, icons,
      server-rendered markup, and details/navigation views matching the mobile
      and desktop mockups; do not require consumer gallery CSS.
      The approved design uses the system font stack, so the package ships no
      bundled font assets.
- [x] Implement screen fragment frames, viewport controls, use-case steps,
      legacy embedding, missing-route views, search, changed/all filtering,
      breadcrumbs, and details disclosure from the runtime models.
- [x] Implement progressive Browse navigation with eligible-link interception,
      latest-wins requests, History API restoration, active-row/title updates,
      escaped frame cleanup, focus management, announcements, and native
      fallback behavior.
- [x] Implement update-stream reconnection and one-shot directory-state recovery
      after successful development rebuilds/restarts.
- [x] Render Review summary and compare pages with side-by-side, overlay,
      difference, viewport, shared-impact, and ignored-impact views from the
      engine's artifact model.
- [x] Add semantic, keyboard, focus, reduced-motion, contrast, zoom, and
      JavaScript-disabled coverage for both shell variants.
- [x] Add Playwright regressions for durable links, multiple in-document
      navigations, Back/Forward, overlapping/failing requests, state retention,
      responsive layout, Review switching, updates, and clean shutdown.
- [x] Visually smoke every implemented state against the approved mockups and
      record any intentional difference before changing the design source.
      Intentional differences are recorded in `examples/basic/notes.md`.

If missing backend work is discovered here, insert a new backend milestone and
then a new `Tags: ui` milestone as required by repository rules; do not mix it
into this milestone.

At this milestone `mokabook serve` is a complete, accessible, watched Browse and
Review experience over the neutral catalogue.

## Milestone 8: Packed Package And Cross-Repository Parity

Summary: prove the published artifact contains the whole framework and no app,
and that it works in realistic consumer layouts before release automation is
enabled.

- [x] Build the production distribution and inspect `npm pack --dry-run --json`
      against an explicit allowlist; verify no consumer/Juno source, examples,
      tests, plans, caches, or review artifacts enter the tarball.
- [x] Install the real tarball in clean ESM and NodeNext consumers and test all
      public exports, declarations, `mokabook` bin, help/version, config
      discovery, build/check/serve/review, and local `npx mokabook` behavior.
- [x] Add a clean-cache smoke that executes the package the way
      `npx mokabook` does and proves entry imports still resolve the
      executing package plus consumer dependencies.
- [x] Add typed consumer module-resolution configuration for aliases,
      conditions, loaders, package roots, main fields, and extensions so
      React Native Web and other host dependencies resolve from packed installs.
- [x] Build/check/serve/review a themed fixture using a custom Firna
      renderer, multiple stylesheet families, legacy aliases, external watch
      input, and shared-impact globs.
- [x] Build/check/serve a Juno-shaped fixture with different roots, components,
      styles, and no themed-consumer adapter.
- [x] Add an explicitly configured temporary compatibility transformer and
      legacy exclude globs so the version 2 bridge is consumer-owned and cannot
      leak consumer rules into framework defaults.
- [x] In a temporary consumer worktree, install the tarball and draft only the
      app-owned config/renderer/compatibility bridge; run existing Mokabook
      gates and compare ids, routes, fragment DOM/styles, Browse behavior, and
      Review classification with the source implementation.
- [x] Treat schema/header/path changes documented by the version 3 migration as
      intentional; investigate every other parity difference before release.
- [x] Complete the file/behavior migration audit with no unexplained source
      candidate and prove product-specific tests remain in the consumer.
- [x] Run the entire unit, integration, browser, type, build, and package smoke
      suite with a 100% pass rate.

At this milestone the packed tarball—not a source checkout—passes neutral,
themed, Juno-shaped, and temporary external-consumer acceptance.

## Milestone 9: CI, Release Automation, And Documentation

Summary: make every change release-gated and prepare tokenless, repeatable npm
publishing without publishing yet.

- [x] Add PR/main CI with minimal permissions, concurrency, the minimum Node
      runtime, the current Firna release runtime, Linux `cargo xtask check`,
      Chromium, package-tarball smoke, and a required result aggregator.
- [x] Use current stable GitHub Actions and release-please majors at
      implementation time (the planning audit found checkout/setup-node v6 and
      release-please-action v5); apply the repository's reviewed pinning policy.
- [x] Add release-please Node configuration so Conventional Commits maintain a
      reviewed release PR, changelog, package/lock versions, `vX.Y.Z` tag, and
      GitHub release.
- [x] Add the same-workflow npm publish path with a GitHub-hosted runner, no
      release dependency cache, trusted-publishing-compatible Node/npm,
      `id-token: write` only on publish, full checks, tag/version validation,
      tarball inspection/smoke, and an already-published guard.
- [x] Add a manual `publish_ref` retry for an existing immutable tag; never
      rebuild from an unrelated branch or move an existing tag.
- [x] Test workflow structure and shell branches, including ordinary main
      pushes, release-PR formatting, no-release output, tag mismatch, existing
      npm version, failed checks, and manual retry.
- [x] Document required GitHub settings, release-please credential behavior,
      Firna npm membership/2FA, public access, the first `0.0.0` bootstrap tag,
      exact trusted-publisher workflow/environment/action, token restriction,
      and `0.1.0` verification.
- [x] Finish README install/CLI/config/examples/troubleshooting/release sections,
      API docs, architecture docs, migration audit, and protocol alignment.
- [x] Recheck current official npm trusted-publisher, npm-exec/bin, provenance,
      and release-please requirements immediately before finalizing workflows.

At this milestone the branch is release-ready, but no irreversible npm publish
has happened.

## Milestone 10: Target Verification, Commit, Push, And Review

Summary: complete this repository's required quality and review workflow for
the library pull request.

- [x] Exclude the gitignored `.context` collaboration and parity workspace from
      repository lint traversal so local evidence cannot change or stall the
      committed-source gate.
- [x] Apply Node's declared globals to executable repository scripts and make
      packed-server cleanup preserve the primary smoke failure without an
      unsafe `finally` throw.
- [x] Keep the changed build-test module below the repository size target by
      moving consumer module-resolution coverage into a focused test file.
- [x] Run formatter and lint checks.
- [x] Run TypeScript typecheck and require no unexplained exclusions.
- [x] Run all unit and integration tests with a 100% pass rate.
- [x] Run the example build/check twice and require byte-stable output.
- [x] Run the full Playwright/browser suite and watched/no-watch CLI smokes.
- [x] Run production build, `npm pack --dry-run --json`, packed-tarball consumer
      tests, clean-cache npx-style smoke, and dependency/license inspection.
- [x] Run `cargo fmt --all -- --check`, Clippy with warnings denied, all Rust
      tests, and applicable Rust source/file-length audits.
- [ ] Start `mokabook serve` from the packed example and manually smoke home,
      screen, collection expansion, use case, id redirect, missing route,
      static fragment, Review, watch rebuild/reload/failure recovery, and clean
      shutdown.
      Blocked only on visual interaction: the in-app browser advertised no
      available browser surface. The packed watched server passed direct route,
      collection-markup, Review, rebuild, last-good failure, recovery, and clean
      shutdown smokes; the 14-test Chromium suite covers the UI behavior.
- [x] Run `cargo xtask check` and require a 100% pass rate.
- [x] Fetch `origin/main`, audit its additions from the captured source tip, and
      inspect `git diff --name-status origin/main` plus deletion-only output;
      stop on unauthorized mainline removal or unrelated changes.
- [x] Update completed TODOs and docs, then run `git add -A`, commit all source,
      tests, assets, generated example artifacts, docs, and plan changes with a
      Conventional Commit title of at most 50 characters, and push the current
      branch without renaming it.
- [x] Run `cargo xtask review` only after the push so it reviews the complete
      diff against `origin/main`.
- [x] Do not automatically fix review findings. Report every finding as a
      numbered item with severity, feature/codebase context, impact of doing
      nothing, lettered solution options, and a recommended option that
      considers class-wide prevention.

At this milestone the Mokabook library PR is fully verified, pushed, and
reviewed. The plan remains active until release/bootstrap and consumer cutover
are complete.

## Milestone 10A: Review Runtime Correctness

Summary: resolve the independently confirmed build-link and changed-route
findings behind shared runtime invariants.

- [x] Add failure-first coverage proving a generated orphan cannot satisfy a
      current document link during compilation.
- [x] Centralize pending-orphan discovery and exclude pending generated orphans
      from HTML/resource validation and compatibility `availableRoutes`.
- [x] Add separate-source coverage proving a changed screen affects every use
      case that embeds its fragments.
- [x] Propagate directly changed screen entries to referencing use-case routes
      in the changed-only Browse model.
- [x] Run focused build, compatibility, and changed-route tests.

At this milestone a successful build cannot create a broken link by deleting
its validated target, and changed-only Browse includes visually affected use
cases.

## Milestone 10B: Reload-State Recovery

Tags: ui

Summary: make the documented one-shot watched-reload recovery restore real
Browse state instead of discarding its payload.

- [x] Add a browser regression that establishes search, viewport, details, and
      mobile-drawer state before a watched rebuild and requires it after reload.
- [x] Define and validate a typed Browse recovery snapshot with stable
      collection-disclosure identifiers.
- [x] Define the capture and restore integration needed by the browser adapter.

At this milestone the recovery state and DOM behavior are typed and ready for
the package-owned browser delivery boundary.

## Milestone 10C: Recovery Module Delivery

Summary: serve the additional package-owned browser module required by the
typed recovery implementation without widening the public static-file boundary.

- [x] Add the recovery module to the explicit in-memory browser-client
      allowlist loaded before server bind.
- [x] Add an HTTP regression proving the required module is served while
      unknown client module paths remain unavailable.
- [x] Run focused server and browser-client delivery tests.

At this milestone every import in the package-owned browser graph resolves
through the confined client-module endpoint.

## Milestone 10D: Complete Reload-State Recovery

Tags: ui

Summary: finish the UI behavior that was blocked on recovery-module delivery.

- [x] Capture Browse state immediately before an automatic reload and restore
      it only once on the same durable URL.
- [x] Cover malformed, stale-URL, one-shot, capture, and restore behavior with
      focused client tests.
- [x] Run focused client and Playwright watch tests.

At this milestone successful watched reloads preserve the user's Browse
context, while later manual reloads use clean server-rendered defaults.

## Milestone 10E: Review-Fix Verification

Summary: complete the repository workflow for the invoked Codex review loop.

- [x] Remove the four fixture whitespace warnings reported by the reviewer.
- [x] Update runtime/architecture documentation for the corrected invariants.
- [x] Run formatter, lint, typecheck, unit/integration/browser/package/Rust
      checks through `cargo xtask check` with a 100% pass rate.
- [x] Fetch and audit `origin/main`, inspect the complete diff and deletions,
      then commit all review fixes with a Conventional Commit and push.
- [ ] Run `cargo xtask review` after the push and repeat investigation, fixes,
      checks, commit, push, and review for up to ten total review cycles until
      no valid findings remain.

At this milestone the invoked review loop has no unaddressed valid finding and
the reviewed commit is pushed.

## Milestone 10F: Review Impact Mockup

Tags: mockup

Summary: align the approved mobile and desktop Review design screens with the
impact-only state before committing the artifact implementation.

- [x] Add an impacted group to the shared-impact Review mockup without
      relabelling it as a byte-level change.
- [x] Update the matching mockup styles and generate both mobile and desktop
      artifacts from the source components.
- [x] Build, check, and visually smoke the changed mockup through the automated
      Chromium Review flow.

At this milestone the approved Review design makes impact-only screens visible
and reachable on both supported layouts.

## Milestone 10G: Surface Review Impact

Tags: ui

Summary: keep byte-level comparison states precise while making every screen
with shared or dependency impact reachable and visible in Review artifacts.

- [x] Add failure-first index and CI-summary coverage for shared-impact-only
      and dependency-impact-only screens.
- [x] Add a distinct impacted group and count without relabelling unchanged
      fragment bytes as changed.
- [x] Keep the true no-change empty state only when no screen has byte or
      impact evidence.

At this milestone Review never tells a reviewer there is nothing to inspect
when shared or dependency evidence can affect rendered screens.

## Milestone 10H: Complete Runtime Contracts

Summary: resolve the remaining link-validation, watcher-shutdown, and HTTP
lifecycle findings from the second Codex review cycle.

- [x] Add failure-first coverage for elements containing both logical-link
      attributes in either order, then rewrite and validate every supported
      logical-link attribute.
- [x] Add failure-first coverage for shutdown during replacement-watcher
      readiness, then make candidate adoption cancellable without orphaning a
      watcher or restarting a child after shutdown.
- [x] Add failure-first coverage proving `HEAD /__mokabook/events` completes,
      then make the SSE endpoint method-aware.
- [x] Update runtime and package protocol documentation for the strengthened
      contracts.

At this milestone generated output has no unresolved supported logical link,
watched shutdown remains bounded during candidate adoption, and HEAD probes do
not create persistent streams.

## Milestone 10I: Second Review-Fix Verification

Summary: verify, commit, push, and independently review the second-cycle fixes.

- [x] Run focused tests for Review artifacts, links, watcher shutdown, and HTTP
      lifecycle.
- [x] Run formatter, lint, typecheck, unit/integration/browser/package/Rust
      checks through `cargo xtask check` with a 100% pass rate.
- [x] Fetch and audit `origin/main`, inspect the complete diff and deletions,
      then commit all second-cycle fixes with a Conventional Commit and push.
- [ ] Run `cargo xtask review` after the push and repeat the bounded review loop
      until no valid finding remains.

At this milestone every valid second-cycle finding is fixed and the reviewed
commit is pushed.

## Milestone 10J: Harden Runtime Boundaries

Summary: resolve the child-lifecycle, broad-watch, dependency-impact, and base
asset findings from the third Codex review cycle.

- [x] Add failure-first coverage proving a watched child exits when its parent
      IPC channel disconnects, then close the child server on disconnect.
- [x] Add failure-first coverage for broad watch rules across dependency,
      build, test, Review, and transaction paths, then enforce package-owned
      ignore and stylesheet precedence in both classification and filesystem
      traversal.
- [x] Add failure-first Browse and Review coverage for directory dependencies,
      then treat declared dependencies as roots matching themselves and
      descendants.
- [x] Add failure-first coverage for root-absolute and protocol-relative base
      resources, then make Review fail closed instead of emitting incomplete
      snapshots.
- [x] Update the runtime, package, architecture, and README contracts with the
      strengthened lifecycle and path semantics.

At this milestone watched processes cannot outlive their parent, broad rules do
not turn package-owned output into work, dependency impact is complete, and
Review snapshots fail closed on non-portable base resources.

## Milestone 10K: Third Review-Fix Verification

Summary: verify, commit, push, and independently review the third-cycle fixes.

- [x] Run focused failure-first regressions and the complete relevant test
      suites for child lifecycle, watch classification, impact, and Review
      assets.
- [x] Run formatter, lint, typecheck, unit/integration/browser/package/Rust
      checks through `cargo xtask check` with a 100% pass rate.
- [x] Fetch and audit `origin/main`, inspect the complete diff and deletions,
      then commit all third-cycle fixes with a Conventional Commit and push.
- [ ] Run `cargo xtask review` after the push and repeat the bounded review loop
      until no valid finding remains.

At this milestone every valid third-cycle finding is fixed and the reviewed
commit is pushed.

## Milestone 10L: Complete Watch Runtime Boundaries

Summary: resolve the remaining process-shutdown and authored-static-input
findings from the fourth Codex review cycle.

- [x] Add failure-first coverage for a child that ignores graceful shutdown
      and termination, then require supervisor close to wait for confirmed
      exit through a bounded graceful, terminate, and force-kill sequence.
- [x] Add failure-first coverage for authored static HTML beneath `mockupsDir`,
      then ignore only HTML proven to be Mokabook-owned while allowing explicit
      consumer watch rules to classify unowned public files.
- [x] Update runtime, package, and architecture documentation for the completed
      shutdown and output-ownership contracts.

At this milestone watched Serve cannot report shutdown before its child exits,
and authored public HTML remains a first-class configurable watch input.

## Milestone 10M: Restore Forward Scroll

Tags: ui

Summary: keep each Browse history entry's latest document position so both
Back and Forward restore the position promised by the runtime contract.

- [x] Add a failure-first browser regression that scrolls a destination route,
      navigates Back, then Forward, and requires the destination position to be
      restored.
- [x] Persist the active entry's latest scroll state with bounded browser work
      and restore it during either history direction.
- [x] Retain route-change focus management without allowing focus to override
      a restored history position.
- [x] Run the focused Browse browser suite and confirm ordinary in-shell
      navigation, overlapping requests, and native fallback remain intact.

At this milestone long Browse screens retain their document position through
both directions of session-history navigation.

## Milestone 10N: Fourth Review-Fix Verification

Summary: verify, commit, push, and independently review the fourth-cycle fixes.

- [x] Run focused failure-first regressions and the complete relevant test
      suites for child shutdown, watch ownership, and Browse history.
- [x] Run formatter, lint, typecheck, unit/integration/browser/package/Rust
      checks through `cargo xtask check` with a 100% pass rate.
- [x] Fetch and audit `origin/main`, inspect the complete diff and deletions,
      then commit all fourth-cycle fixes with a Conventional Commit and push.
- [ ] Run `cargo xtask review` after the push and repeat the bounded review loop
      until no valid finding remains.

At this milestone every valid fourth-cycle finding is fixed and the reviewed
commit is pushed.

## Milestone 11: First Package Release

Summary: after the library PR merges, reserve the unscoped package safely,
activate OIDC publishing, and produce the first supported release.

Blocked in this workspace until the reviewed branch is merged to `main`, the
external GitHub/npm settings are configured, and a maintainer gives explicit
approval for the irreversible first public publish.

- [ ] Confirm the merge commit on `main` matches the reviewed code and all
      required GitHub checks passed.
- [ ] Recheck that `mokabook` is available and pause for explicit
      maintainer approval before the irreversible first publish.
- [ ] From the exact checked `main` commit at `0.0.0`, rerun all checks, inspect
      the tarball, and manually publish it publicly under the documented
      bootstrap dist-tag solely to create the package.
- [ ] Configure the npm trusted publisher for the unscoped `mokabook` package,
      `futex-ai/mokabook`, the exact release workflow filename, optional
      protected environment, and `npm publish`; verify approved Firna
      maintainers, package owners, and 2FA.
- [ ] Restrict traditional token publishing and remove any obsolete npm write
      token after the trust relationship is proven.
- [ ] Merge the release-please `0.1.0` PR and verify the same workflow creates
      the immutable tag/GitHub release and publishes with provenance.
- [ ] From a clean directory, verify npm metadata, README, license, tarball
      contents, provenance, dist tags, `npx mokabook --version`, and a
      minimal generated/served fixture.
- [ ] Record release evidence and any manual recovery step in the release docs.

At this milestone `mokabook@0.1.0` is the first supported public version
and future releases are tokenless and release-PR controlled.

## Milestone 12: Downstream Consumer Cutover

Summary: in a separate consumer workspace, replace the in-repo
framework with the released dependency while preserving every actual screen and
generated product artifact.

Blocked here by milestone 11 and by the requirement to perform this change in a
separate consumer workspace after a supported package is released.

- [ ] Create and index a consumer-migration plan, update its
      Mokabook protocol/README first, and capture the latest source tip and
      `origin/main` additions before editing.
- [ ] Install an explicit compatible `mokabook` development dependency
      and update the consumer lockfile using npm.
- [ ] Add a consumer-owned `mokabook.config.ts`, Firna UI/React Native Web
      renderer, stylesheet rules, external email watch input, Review impact
      globs, legacy aliases/allowlists, and any temporary version 2 bridge.
- [ ] Update root and TypeScript npm scripts to call the installed `mokabook`
      bin for build/check/test/serve/review, retaining stable developer command
      names where useful.
- [ ] Update consumer CI's blocking mockup gates and non-blocking
      `mokabook-review` artifact/summary job to use the package and PR merge base.
- [ ] Preserve every consumer entry, page, component, product style/asset,
      Mokabook-related protocol requirement, generated fragment, route, id,
      relationship, and actual screen; regenerate only documented schema/header
      differences.
- [ ] Delete only framework files verified as ported in the consumer migration audit after
      package parity is green. Keep consumer adapters and product-specific tests;
      audit every deletion against `origin/main` as an authorized replacement,
      never a feature removal.
- [ ] Run consumer mockup build/check/test/browser/typecheck, Review against
      `origin/main`, direct-file and watched server smokes, plus the full
      `cargo xtask check` suite.
- [ ] Inspect product-fragment and manifest differences, links, orphan cleanup,
      and Review classification; resolve every unexplained difference.
- [ ] Commit and push the consumer change with a Conventional Commit, then run
      its required post-push `cargo xtask review` and report findings without
      automatically fixing them.
- [ ] Do not modify Juno in this milestone; add only a concise future migration
      handoff if its fixture exposed consumer work.

At this milestone the consumer contains no duplicate generic Mokabook framework,
uses the public package, and retains all real screen/spec content.

## Milestone 13: Close The Extraction Plan

Summary: record the released/consumed result in this repository and close the
plan only after both delivery repositories are verified.

Blocked until milestones 11 and 12 supply the release and consumer cutover
evidence required for an honest closeout.

- [ ] Update the extraction record with the released version, Mokabook merge/tag,
      consumer cutover commit, intentional output changes, and any deferred
      compatibility removal.
- [ ] Update README/protocol docs with the proven install and consumer behavior;
      remove planning-only language that is no longer true.
- [ ] Mark every milestone complete and move this plan from Active to Completed
      in `plans/README.md` only when no required task remains.
- [ ] Validate changed Markdown and inspect the final target-repo diff and
      deletions against `origin/main`.
- [ ] Commit and push the closeout documentation with a Conventional Commit,
      then run `cargo xtask review` post-push and report any findings using the
      required numbered severity/context/impact/options/recommendation format.

## Definition Of Done

- `mokabook` contains every reusable behavior identified by the extraction audit,
  has no product screen dependency, and passes all source and packed-artifact
  tests.
- `npx mokabook` serves a configured consumer catalogue; a local install
  supports `npx mokabook` and all explicit subcommands.
- Neutral and Juno-shaped fixtures prove app independence; a real consumer
  cutover proves production-scale parity.
- CI blocks broken code/generated output, Review provides non-blocking visual
  evidence, and release-please plus npm OIDC publishes reviewed tags.
- The consumer no longer owns a generic framework fork and no actual consumer
  screen, route, use case, generated artifact, or product documentation is
  lost.

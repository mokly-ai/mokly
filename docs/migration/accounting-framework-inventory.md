# Accounting Framework Migration Inventory

## Baseline And Meanings

This ledger covers the reusable candidate at Accounting commit
`50e422e442a6819f1aae0fbd038d99b519b72a72`. It is the deletion guard for the
later Accounting cutover; nothing in Accounting should be deleted merely
because a similarly named Mokly module now exists.

The implementation re-audit compared that commit with Accounting `origin/main`
at `fdd0049a6fb195d4ac59250c0df797302565e58f`. Only product entry/page/test/CSS
and generated artifact paths changed; no candidate in this ledger changed.

- **Ported**: behavior exists in this package, normally split into smaller files.
- **Config**: generic mechanism moved here; Accounting data/policy becomes an adapter.
- **Retained**: application-owned code remains in Accounting.
- **Obsolete**: superseded implementation detail has no consumer-facing behavior.

## Root Build And Authoring Files

| Accounting path under `docs/mockups/src/` | Disposition     | Mokly owner or rationale                                                       |
| ----------------------------------------- | --------------- | ------------------------------------------------------------------------------ |
| `build.cjs`                               | Ported          | `src/cli`, `src/build/compile.ts`, and transactional writer                    |
| `bundle_registry_entries.cjs`             | Obsolete        | Async esbuild graph loads directly; no blocking helper child                   |
| `core.ts`                                 | Ported/Config   | Split across build, legacy, registry, paths, links, and ownership modules      |
| `ensure_links.cjs`                        | Ported          | `src/build/html_links.ts`                                                      |
| `legacy_screen_lint.ts`                   | Ported/Config   | Generic opt-in `legacy.lint.maxScreensPerPage`                                 |
| `link_scan_lint.ts`                       | Ported          | Generated href and anchor validation                                           |
| `mock_links.ts`                           | Ported          | Viewport-aware id resolution in `src/build/mock_links.ts`                      |
| `page_bundler.cjs`                        | Ported/Config   | Single graph plus typed aliases/conditions/loaders/roots; no RNW defaults      |
| `register.cjs`                            | Obsolete        | esbuild handles TypeScript/TSX; no global require hook                         |
| `registry.tsx`                            | Ported          | Public helpers under `src/authoring`                                           |
| `review.cjs`                              | Ported          | `mokly review` CLI dispatch                                                    |
| `review_summary.cjs`                      | Ported          | Deterministic `summary.md` in `src/review/artifact.ts`                         |
| `screen_cap_lint.ts`                      | Ported/Config   | Legacy maximum is explicit; structured screens are one definition each         |
| `serve.cjs`                               | Ported          | `mokly serve` and default CLI command                                          |
| `serve_child.cjs`                         | Ported          | Typed hidden child in `src/server/child.ts`                                    |
| `serve_runtime.cjs`                       | Ported          | Server and supervisor module families                                          |
| `source_lint.ts`                          | Ported/Retained | Generic structure is package-validated; product source rules stay consumer CI  |
| `stage_id_lint.ts`                        | Ported/Config   | `legacy.lint.requireStageIds` with `data-mokly-stage`                          |
| `stylesheet_link_lint.ts`                 | Ported/Config   | Declarative rules plus existence and link checks                               |
| `component_utils.ts`                      | Config          | Generic expansion is package-owned; React render helper runs in consumer graph |
| `components.tsx`                          | Retained        | Accounting's comment-component names and output are its legacy adapter         |
| `email_template_data.tsx`                 | Retained        | Accounting email data; may be an explicit watch input                          |
| `render.tsx`                              | Retained        | Accounting theme, `@firna/ui`, and React Native Web style adapter              |
| `.gitignore`                              | Retained        | Consumer build-directory policy                                                |
| `_shims.d.ts`                             | Retained        | Accounting-only module declarations                                            |

The public helpers `components/mock_link.tsx` and
`components/review_ignore.tsx` are **Ported** to `src/authoring/links.tsx` and
`src/authoring/review_ignore.tsx`. Accounting may keep thin product wrappers
only if their props add real application policy.

## Registry Directory

| Accounting file                | Disposition   | Mokly owner                                     |
| ------------------------------ | ------------- | ----------------------------------------------- |
| `registry/discovery.ts`        | Ported        | build discovery and single-graph loader         |
| `registry/entry_validation.ts` | Ported        | `registry/prepare.ts`                           |
| `registry/fragment_page.tsx`   | Ported/Config | neutral default plus renderer hook              |
| `registry/fragments.ts`        | Ported        | manifest fragment routes and renderer viewports |
| `registry/hrefs.ts`            | Ported        | stylesheet-relative and id-link resolution      |
| `registry/manifest.ts`         | Ported        | schema version 3 writer and version 2 reader    |
| `registry/pipeline.ts`         | Ported        | in-memory compiler                              |
| `registry/types.ts`            | Ported        | public authoring and manifest types             |
| `registry/validation.ts`       | Ported        | registry preparation and collision checks       |

## Browse Runtime Directory

| Accounting file under `mockbook/` | Disposition   | Mokly owner or rationale                                                       |
| --------------------------------- | ------------- | ------------------------------------------------------------------------------ |
| `catalogue.ts`                    | Ported        | manifest indexes in `packages/viewer/src/shell/catalogue.ts`                   |
| `server.ts`                       | Ported        | confined HTTP runtime in `server/http.ts`                                      |
| `server_cli.ts`                   | Ported        | typed CLI arguments and dispatch                                               |
| `server_options.ts`               | Ported        | validated CLI/config options                                                   |
| `server_updates.ts`               | Ported        | monotonic child update messages, readiness, and SSE endpoint                   |
| `dev/child_process.ts`            | Ported        | injected `ChildHandle`/`ChildFactory` boundary                                 |
| `dev/process_supervisor.ts`       | Ported        | serialized, readiness-aware stable-port/version supervisor                     |
| `dev/rebuild.ts`                  | Ported        | compile then transactional write before restart                                |
| `dev/rebuild_worker.cjs`          | Obsolete      | rebuild runs through typed async APIs; no worker shim                          |
| `dev/run.ts`                      | Ported        | `server/serve.ts` orchestration                                                |
| `dev/watch_notification_gate.ts`  | Ported        | generic `NotificationGate`                                                     |
| `dev/watch_paths.ts`              | Ported/Config | derived entries/legacy/renderer/styles plus explicit rules                     |
| `nav_tree.ts`                     | Ported        | manifest tree rendered by `packages/viewer/src/shell/nav.tsx`                  |
| `nav_guides.ts`                   | Ported        | neutral structural navigation and breadcrumbs                                  |
| `client_bundle.ts`                | Ported        | package client modules served by `server/client_modules.ts`                    |
| `client/browser_navigation.ts`    | Ported        | eligible interception/fallback in `src/client/browser.ts`                      |
| `client/directory_state.ts`       | Ported        | tolerant directory-state restoration in `packages/viewer/src/client/browse.ts` |
| `client/entry.ts`                 | Ported        | package-owned browser and Browse entry modules                                 |
| `client/live_updates.ts`          | Ported        | latest-wins reload and one-shot recovery are package-owned                     |
| `client/navigation.ts`            | Ported        | progressive navigation in the neutral browser client                           |
| `client/route_dom.ts`             | Ported        | persistent-shell main-view replacement                                         |
| `icons.tsx`                       | Retained      | Accounting icons stay reference-only; Mokly owns neutral glyphs                |
| `shell.tsx`                       | Ported        | responsive neutral shell under `packages/viewer/src/shell`                     |
| `shell_details.tsx`               | Ported        | accessible native details panel                                                |
| `shell_head.tsx`                  | Ported        | package head, fonts, and self-contained shell assets                           |
| `shell_nav.tsx`                   | Ported        | responsive navigation tree and drawer                                          |
| `shell_scripts.ts`                | Ported        | package-owned progressive client modules                                       |
| `shell_stages.tsx`                | Ported        | sandboxed viewport/use-case stages                                             |
| `shell_view.tsx`                  | Ported        | screen, collection, use-case, legacy, and missing views                        |

## Review Directory

| Accounting file under `mockbook/review/` | Disposition | Mokly owner                                                                       |
| ---------------------------------------- | ----------- | --------------------------------------------------------------------------------- |
| `compare.ts`                             | Ported      | per-route/per-viewport comparison in `review/compare.ts`                          |
| `git_base.ts`                            | Ported      | injected Git object reader; no checkout                                           |
| `ignored_impact.ts`                      | Ported      | aggregate id/viewport evidence                                                    |
| `inventory.ts`                           | Ported      | base/head screen maps and fragment inventory                                      |
| `review_ignore.ts`                       | Ported      | fail-closed pair normalization                                                    |
| `review_json.ts`                         | Ported      | deterministic schema-v1 `review.json`                                             |
| `review_material.ts`                     | Ported      | public stable SHA-256 material keys                                               |
| `run.ts`                                 | Ported      | check-before-compare orchestration                                                |
| `artifact.tsx`                           | Ported      | responsive summary/compare pages with side-by-side, overlay, and difference modes |

## Styles, Fonts, And Generated State

| Accounting path                                    | Disposition          | Rationale                                                              |
| -------------------------------------------------- | -------------------- | ---------------------------------------------------------------------- |
| `docs/mockups/mockbook.css`                        | Retained/Ported      | Accounting CSS stays reference-only; package owns neutral shell CSS    |
| `docs/mockups/fonts/InterVariable.woff2`           | Retained             | Accounting fragment asset; the package shell uses a system font stack  |
| `docs/mockups/mockbook-manifest.json`              | Regenerated          | v2 is read only during cutover; package emits `mokly-manifest.json` v3 |
| `docs/mockups/**/*.mobile.html` / `*.desktop.html` | Retained/regenerated | real Accounting fragments never move to this repository                |

## Focused Test Disposition

| Accounting tests under `src/_tests_/`                                                                            | Disposition                                                                         |
| ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `core.test.ts`, `legacy_screen_lint.test.ts`, `mock_link.test.ts`                                                | Generic cases ported to config/build tests; Accounting product cases remain         |
| `registry.test.ts`, `registry_tree.test.ts`                                                                      | Pure registry/nesting/collision behavior ported                                     |
| `mockbook_dev_server.test.ts`, `mockbook_serve.test.ts`                                                          | Safe routes, port zero, occupied ports, no-watch and watched lifecycle ported       |
| `mockbook_supervisor.test.ts`, `mockbook_supervisor_startup.test.ts`, `mockbook_watch_notification_gate.test.ts` | Readiness, buffering, ordering, stable port, and cleanup ported                     |
| `mockup_review.test.ts`, `review_ignore.test.ts`, `review_material.test.ts`, `review_summary.test.ts`            | Git comparison, malformed markers, material keys, JSON, and summary behavior ported |
| `review_ignore_shell.test.ts`                                                                                    | Generic marker rules ported; Accounting shell context stays with its adapter        |
| `nav_tree.test.ts`, `mockbook_client.test.ts`, `mockbook_head.test.ts`, `mockbook_live_updates.test.ts`          | Generic behavior ported to shell/client unit and Playwright coverage                |

The auxiliary `src/_tests_/mockbook_browser.cli.ts` and
`src/_tests_/mockbook_browser/{fixture,server}.ts` are **Ported** as neutral
Playwright and CLI fixtures. Accounting's product-specific assertions remain in
Accounting rather than carrying Bookfolio screens into this package.

## Packed Accounting Acceptance

Milestone 8 used a real `mokly-0.0.0.tgz` in an isolated Accounting
worktree at `fdd0049a6fb195d4ac59250c0df797302565e58f`. Only a draft consumer
config, renderer, temporary link transformer, import rewrites, and generated
output changed there; no Accounting change was committed.

- Package Build and Check produced and revalidated 1,512 files.
- All 1,013 entry ids and logical routes matched the committed v2 manifest.
- All 1,506 mobile/desktop fragments retained identical visible DOM, referenced
  React Native Web rules, and external stylesheet links after removing only the
  intentional generated-header difference.
- Four fragments contained different unused cumulative React Native Web rules
  because graph evaluation order changed; no rendered class referenced those
  differing rules.
- The four old `mockbook/*.source.tsx` shell prototypes were explicitly
  excluded because their neutral replacements are package-owned. All five real
  Accounting legacy product pages remained.
- Accounting's mockup typecheck and all 156 existing unit/integration tests
  passed. Packed Build, Check, Browse/deep-link/static/legacy routes, and Review
  all passed; Review compared 753 screens against the compatibility v2 base.

This evidence proves the package boundary without authorizing the later
Accounting deletion/cutover. That remains a separate post-release workspace.

## Consumer-Only Behavior That Must Survive Cutover

- Accounting's renderer continues to wrap screens with its Firna theme and
  collect React Native Web atomic styles.
- Marketing, app, email, and PDF stylesheet rules remain explicit Accounting
  configuration.
- Email template data remains an Accounting input with an explicit watch action.
- Historical route aliases, flat-family repairs, exclusions, allowlists,
  component names, and screen-cap exceptions remain in Accounting's temporary
  compatibility adapter.
- Every real entry/page/component and all committed Accounting HTML stay in the
  Accounting repository.

This ledger must be re-audited against the then-current Accounting tip before
the dependency cutover deletes generic files.

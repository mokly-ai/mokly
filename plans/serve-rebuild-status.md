# Serve Rebuild Status

## Summary

Watched Serve keeps the last working catalogue when a saved change fails to
build, but only the terminal says so: the browser silently keeps showing the
previous version. Tell the Browse shell when the latest changes could not be
loaded and while an update is in progress, and make Live previews keep the
same "last working version" promise.

Requested by the user after the interactive views review. The user also
approved folding in review finding 1 of the
[interactive views plan](./interactive-views.md): Live must compile the
accepted generation's sources, otherwise it contradicts the notice by
compiling the broken file.

Decisions:

- Watched Serve only. `--no-watch`, `build`, `check`, `export` and `publish`
  never produce a rebuild status, and exported or published catalogues never
  contain one. The status is independent of `interactive`: every watched
  catalogue gets it.
- Two independent facts rather than one enum: whether a content update is in
  progress, and whether the latest source update failed. A failed `rebuild` or
  `reconfigure` watch action records a failure while the served generation
  stays the last good one; only a later successful `rebuild` or `reconfigure`
  clears it. `reload` and `restart` actions show progress but neither set nor
  clear a failure; their failures stay terminal-only because they are
  infrastructure faults, not consumer edits. `evidence` actions and background
  Changes failures keep their existing Changes presentation.
- Transport follows the interactive views pattern: the watched parent sends a
  validated IPC envelope to the HTTP child; the child carries the status in the
  private capability descriptor, so a reloaded page renders it immediately, and
  emits a private `rebuild` event on `/__mokly/events`, replayed when a stream
  opens. The CLI browser host validates and adopts it. It never enters public
  catalogue JSON, static workspace evidence, export or publication.
- The failure detail is developer-facing and secondary: ANSI-stripped, bounded
  in characters and bytes, with absolute repository paths rewritten to
  repository-relative ones, rendered as text only, and shown behind a
  disclosure. The headline never contains it.
- Product copy, finalized by the mockup milestone: "Your latest changes
  couldn’t be loaded." with "You’re seeing the last working version." and a
  "Show details" disclosure; progress reads "Updating…" and appears only after
  a short delay, so fast updates never flash. No copy mentions builds,
  bundles, generations or watch actions.
- The failure notice is full width, directly below the top bar on every shell
  route, at both widths, and announced once per failure rather than on every
  reload. It uses the component system's full-surface treatment and an icon,
  never a left-edge accent border or rail. Progress must not shift layout; the
  mockup milestone placed it in the top bar between the search field and
  Appearance, taking its room from the search field.
- A Live preview compiles the same repository-owned source bytes as its
  generation's Static build. The sources are captured while the generation's
  consumer graph builds, only when `interactive` is `serve`, retained for the
  current and previous generations, and sent to the watched child with the
  runtime. Installed packages resolve normally. A repository-owned module the
  capture lacks fails that generation's Live bundle with a typed diagnostic
  naming it; Static is unaffected.
- Naming: code and docs say "rebuild status"; product copy never does.

Protocol owner: `docs/protocol/mokly-rebuild-status.md` (created in Milestone
1). Related contracts: [watch](../docs/protocol/mokly-watch.md),
[live capabilities](../docs/protocol/mokly-live-capabilities.md),
[interactive views Serve delivery](../docs/protocol/mokly-interactive-views-serve.md),
[viewer](../docs/protocol/mokly-viewer.md) and
[shell design](../docs/protocol/mokly-shell-design.md).

Out of scope: interactive views review findings 2 (`MockLink asChild` in Live)
and 3 (forwarded app origins), which await the user's decision.

## Milestone 1: Define the rebuild status contract — completed

Documentation only. Every later milestone implements this contract.

- [x] Create `docs/protocol/mokly-rebuild-status.md` (about 250 lines or
      fewer) defining: the status model and its exact JSON shape and bounds;
      which watch actions set, clear and show progress; ordering against update
      versions, so a reloaded page never shows a cleared failure or misses a
      new one; the IPC envelope and its validation; the private descriptor
      field and the private SSE event, including replay on stream open; detail
      sanitizing (ANSI stripping, repository-relative paths, character and byte
      bounds, text-only rendering); multiple tabs; the progress delay; absence
      in unwatched Serve, export, publication, static evidence and embedded
      hosts; and failure states such as an invalid envelope, oversized detail
      and a child restart while failed.
- [x] Create `docs/protocol/mokly-rebuild-status-design.md` describing the
      states the mockups must depict: the failure notice on a screen, the
      notice with its details open, progress without a failure, progress while
      failed, and the notice on a component workspace in Live; the copy;
      accessibility; the no left-edge accent rule; and the constraint that
      progress never shifts layout. Leave exact progress placement to
      Milestone 2.
- [x] Define generation-pinned Live sources in
      `docs/protocol/mokly-interactive-views-serve.md`: what is captured and
      when, retention, transfer to the watched child, resolution of installed
      packages, the typed diagnostic for a missing capture, no capture when
      `interactive` is `off`, and that editing, deleting or breaking a file
      after acceptance cannot change or fail an accepted generation's Live
      bundle.
- [x] Cross-reference the new contract from `mokly-watch.md` (failed rebuilds
      are also announced to browsers), `mokly-live-capabilities.md` (descriptor
      field, event and CLI host adoption), `mokly-viewer.md` and
      `mokly-shell-design.md`, keeping each edit short because
      `mokly-watch.md` is already long.
- [x] Add both new docs to `docs/protocol/README.md`. Keep the packaged guides
      under `docs/guides` unchanged until the implementing milestones.
- [x] Validate Markdown with `npm run format:check`, check local link targets,
      review the diff, commit and push.

## Milestone 2: Design the rebuild status states — completed

Tags: mockup

Add the approved states to the design catalogue under
`examples/basic/entries/design`, reusing the existing shell, top bar, artboard
and inspector parts, with mobile and desktop variants for every screen and at
most five screens per page.

- [x] Add a screen-spec page for rebuild status with the five states from the
      design contract, each a standalone screen component with mobile and
      desktop variants, reachable from the design navigation.
- [x] Decide and depict where progress appears so it never shifts layout at
      either width, and record the placement and final copy in
      `docs/protocol/mokly-rebuild-status-design.md`.
- [x] Extend the design suites: ids and routes in both viewports, notice copy,
      the details disclosure, progress copy, counts and navigation.
- [x] Register the notice as the shared `design-ui-rebuild-notice` component
      and give the top bar an `updating` flag, with saved examples, inventory
      and palette records.
- [x] Run `npm run build`, `npm run example:build`, `npm run example:check`,
      smoke the pages through `npm run dev`, run `cargo xtask check`, commit
      and push.

## Milestone 3: Rebuild status in watched Serve

Backend. After this milestone the browser receives the status, but the shell
does not present it yet.

- [ ] Track progress and failure around the watched action queue
      (`src/server/watch_events.ts`, `watch_reporting.ts` and
      `serve_watched.ts`) behind a small interface, with sanitized detail.
- [ ] Send the status to the HTTP child through a validated IPC envelope in
      `src/server/update_messages.ts` and the supervisor, and keep the latest
      status across child restarts.
- [ ] Carry the status in the private capability descriptor and emit the
      private SSE event, replayed on stream open; validate and adopt it in the
      CLI browser host (`src/client`) and the viewer's live state, with no
      shell UI.
- [ ] Tests: a failure then a success clears it; reload and restart neither set
      nor clear it; evidence actions are ignored; progress covers queued and
      running actions; detail sanitizing and bounds; envelope validation;
      ordering against update versions; replay on stream open; absence in
      unwatched Serve, public catalogue JSON, static evidence and export.
- [ ] Update `src/server/README.md` and `src/client/README.md`; run
      `cargo xtask check`; commit and push.

## Milestone 4: Generation-pinned Live sources

Backend. Closes interactive views review finding 1.

- [ ] Capture the repository-owned source bytes a generation's consumer graph
      compiles, only when `interactive` is `serve`; retain them with the
      runtime for the current and previous generations; and send them to the
      watched child.
- [ ] Compile each generation's Live bundle from its capture, resolving
      installed packages normally, and fail it with a typed diagnostic naming
      any repository-owned module the capture lacks.
- [ ] Tests: after generation G is accepted and before its first Live request,
      editing, deleting or breaking a source leaves G's Live bundle equal to
      its accepted sources; a later generation sees the edit; nothing is
      captured when `interactive` is `off`; captures are released with retired
      generations.
- [ ] Update `src/interactive/README.md`; record in the plan index that
      interactive views finding 1 is closed; run `cargo xtask check`; commit
      and push.

## Milestone 5: Present rebuild status in the shell

Tags: ui

- [ ] Render the failure notice below the top bar on every shell route with the
      approved copy, icon, details disclosure and accessibility, and the
      progress indicator in its approved placement after the approved delay,
      reading only the private status from Milestone 3.
- [ ] Keep the notice correct across page reloads, route changes, Static and
      Live, comparisons, and narrow and wide layouts, announcing each failure
      once.
- [ ] Browser tests with a real watched Serve: break a source and see the
      notice in Static and Live, with the previous content still shown and
      Live still working; open the details; save again and see progress; fix
      the source and see the notice clear after the reload; confirm fast
      updates never show progress.
- [ ] Update `packages/viewer/README.md`, `packages/viewer/src/shell/README.md`,
      `docs/guides/cli/serve.md` and the root README; run `cargo xtask check`;
      commit and push.

## Milestone 6: Smoke test and review

- [ ] Smoke through `npm run dev` with the example catalogue: break and fix a
      screen, a component and the config at desktop and mobile widths in
      Static and Live, and save screenshots under `.context/`.
- [ ] Run the full check set and `cargo xtask check` if anything changed;
      `git add -A`, commit with a Conventional Commits message, and push.
- [ ] Review: after the push, use `docs/implementation-review-prompt.md`
      against `origin/main` and report numbered findings with severity,
      impact and lettered options, without changing the implementation.

## Post-merge follow-up (non-blocking)

- Consider presenting background Changes failures the same way if the existing
  Changes presentation proves insufficient.

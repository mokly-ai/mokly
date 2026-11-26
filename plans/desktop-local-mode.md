# Desktop local mode

Status: Active. On branch `calummoore/local-mode-desktop-support-3cij`, no
pull request yet. The pull request that completes the work deletes this plan,
as the `plans` skill says. Decision 4 is open.

The desktop app shows only published catalogues today. Local mode lets the
reader add a repository folder on their own computer. The app then lists every
checkout of that repository, the Git worktrees that agent tools such as
T3 Code and Conductor create included. When the reader selects a checkout,
the shell starts `mokly serve` in it. The cloud viewer shows its live screens
with the same chrome as a publication. Local mode works offline and without a
sign-in. The cloud controls that need the API show their error states.

This change does not cover agent editing, comparison with a published branch,
Windows, or a CLI bundled in the app. It also does not open a checkout from
another program until decision 4 is answered.

Contract owners:

- [Desktop application](../docs/protocol/cloud/desktop-app.md#local-mode).
- [Desktop bundle and origin](../docs/protocol/cloud/desktop-bundle.md).
- [Viewer host](../docs/protocol/cloud/viewer-host.md) and
  [Viewer address state](../docs/protocol/cloud/viewer-address-state.md).
- [Frame probe wire protocol](../docs/protocol/mokly-frame-probe-wire.md).
- [Embeddable viewer](../docs/protocol/mokly-viewer.md) and
  [Shell delivery](../docs/protocol/mokly-shell-delivery.md).
- [On-demand Serve](../docs/protocol/mokly-on-demand.md) and a new host
  serve protocol page.
- The [desktop README](../packages/desktop/README.md), the
  [CLI README](../crates/mokly-cli/README.md) and the
  [Serve guide](../docs/guides/cli/serve.md).

## Decisions

Cal answered decisions 1 to 3 on 2026-11-26, in the brainstorm of this
branch. The brainstorm notes are in `.context/desktop-local-mode/`.

### 1. How local screens reach the desktop: C

Decided 2026-11-26: **C**, the cloud viewer reads a local serve. Reason, from
Cal: cloud and local must work in the same way in the desktop app.

- **A.** The shell frames serve's own viewer beside a checkout list. Not
  chosen: the reader would see two different viewers.
- **B.** Agent tools start serve, and the app finds each running serve
  through a discovery record. Not chosen: a new worktree shows nothing until
  a tool starts serve, and the viewer is still serve's own.
- **C.** Chosen. Serve admits the desktop origin as a host. The cloud viewer
  mounts a local source with live updates and frames through the frame probe.

Option C named the change that lets the frame probe accept a non-HTTP host.
So Cal's choice also gives the approval that
`plans/follow-ups/viewer-frames-refuse-desktop-host.md` waited for.

Left out: a shell proxy that adds the headers through Electron `webRequest`,
because serve's render check would then live in header rewrites that no test
covers. A static build after each change, because it is not live. A CLI
bundled in the app, because its version can differ from the checkout's. One
serve for many checkouts, because serve allows one route set per process.

### 2. How the app finds checkouts: B

Decided 2026-11-26: **B**. The reader adds one repository folder. The app
runs `git worktree list --porcelain` there and lists each checkout with its
branch. Not chosen: **A**, a hand pick of each folder, because each new agent
worktree would need one. **C**, also watching the worktree folders of T3 Code
and Conductor, because it ties the app to their folder layouts.

The options check of 2026-11-26 added **D**: B plus a configuration path for
each repository. Serve searches upward for its configuration or takes
`--config`, and a cloud project is a repository plus a configuration path. So
a catalogue in a subfolder never serves without D. My call of 2026-11-26:
apply D as part of B. When the reader adds a repository, the app finds its
`mokly.config.json` files with `git ls-files`. It uses the only one, or asks
the reader to pick one.

### 3. What local Changes compares with: A

Decided 2026-11-26: **A**, serve's own Changes against the Git merge base. Not
chosen: **B**, the cloud's latest publication of the branch, because it needs
the network, a sign-in and a new comparison path. This replaces the protocol
requirement that local Changes compares with the published branch.

The options check corrected two claims of A. The embedded viewer pins every
comparison to a publication, so the hosted viewer needs live comparison
delivery, as Milestone 5 says. Serve installs the base dependencies from the
package registry, so a branch that changes its dependencies needs the network
once. B needs a new path too, so A still costs less. The check also added
**C**, the latest publication of the base branch. It has every cost of B.

### 4. Opening a checkout from an agent tool

- **Severity:** Low. **Effort:** Small (estimate), for A.
- **Source:** Design.
- **Category:** Product scope.
- **Location:** `packages/desktop/src/lifecycle.ts:21`
- **Background:** The shell already takes a `mokly://` address for the
  sign-in grant, through `packages/desktop/src/handoff.ts`. An agent tool
  could open its checkout in the app in a similar way.
- **Problem:** Any web page can open a `mokly://` address. Serve runs the code
  of the checkout.
- **Impact if no action:** The reader switches checkouts in the app, not from
  the tool.
- **Root question:** Which programs outside the app can select a checkout and
  so start its serve, and what proves that the reader wants it? The options
  check rewrote this question on 2026-11-26.
- **Options:**
  - **A.** Not in this change. The reader picks the checkout in the app.
    Effort: Small.
  - **B.** A command-line argument with a folder path. A T3 or Conductor
    script can call it. On macOS, `open -a Mokly --args` does not reach a
    running app. Effort: Small.
  - **C.** A `mokly://open` address, with a confirmation dialog before serve
    starts. Effort: Medium.
  - **D.** B, plus the macOS `open-file` event and a folder document type.
    Then `open -a Mokly {path}` and a folder dropped on the Dock icon work.
    Added by the options check. Effort: Medium.
  - **E.** A `mokly://open` address that names a repository and a branch. It
    opens only a checkout that the app already lists, with no dialog. After
    the browser asks once, any web page can start serve in a listed checkout.
    Added by the options check. Effort: Medium.
- **Left out:** A `mokly://` address with no confirmation for any folder,
  because it lets any web page run the code of any folder. Automatic selection
  of the newest worktree, because it fails when several agents run at once.
- **Wider fix:** None.
- **Previous examples:** The sign-in grant handoff in
  `packages/desktop/src/handoff.ts`.
- **Recommendation:** A. Decision 2 already lists every worktree. When this
  entry point follows later, D is the best form, because B does not reach a
  running macOS app.
- **Action:** ask the user, because it adds a new entry point from the
  operating system.

## Design

Each item below is my call of 2026-11-26 unless it names a decision.

- **Mokly stays host-neutral.** No Mokly rule names the desktop origin. Serve
  takes the host origin as an argument, and the frame probe accepts any
  canonical non-opaque origin that the host names. Reason:
  [Repository layout](../docs/protocol/repository-layout.md) says that Mokly
  never depends on the cloud.
- **Host serve contract.** `mokly serve --host-origin {origin}` admits one
  host origin. Serve then sends CORS headers for that origin on every
  response, so the index, the details, the live descriptor, the event stream,
  the comparison routes and the render route all answer it. It sends
  `frame-ancestors {origin}` on documents, injects the frame probe into
  documents, and accepts render calls whose `Origin` is the host origin. The
  loopback `Host` check stays. Without the flag, serve behaves as today. A
  JSON reporter mode writes one JSON line for each of the listening, ready,
  failed and stopped states. It is a reporter mode, because one reporter owns
  both output streams under
  [Terminal output](../docs/protocol/mokly-terminal-output.md). The new
  protocol page is `docs/protocol/mokly-serve-host.md`. Reason: a CLI contract
  serves any host program in any language, and serve already stops cleanly on
  `SIGINT`, `SIGTERM` and `SIGHUP`.
- **Frame probe host rule.** Decision 1 approves it. The adapter and the probe
  accept a host origin of any scheme when it has the form
  `{scheme}://{host}[:{port}]` with no path, and is not `"null"`. The check is
  a syntax check, because Node and jsdom give `"null"` as the origin of
  `mokly-app://desktop`. The frame origin stays HTTP(S). This also closes
  `plans/follow-ups/viewer-frames-refuse-desktop-host.md`, so published
  screens mount in the desktop app too.
- **Hosted live source.** `MoklyViewer` gains an optional public `live` prop.
  `serveLiveSource({ origin })` builds it for a serve on another origin. The
  hosted runtime then adopts each new revision in place, as the standalone
  shell does under "Updates In Serve". The prop also switches comparisons from
  pinned to live delivery, because the embedded viewer pins them today in
  `packages/viewer/src/viewer/environment.ts`. Props editing works through the
  same render route.
- **Checkout list.** Decision 2. The shell keeps each repository folder and
  its configuration path in a JSON file under the Electron `userData` folder.
  It reads the checkouts with `git worktree list --porcelain` on window focus
  and after each add. It hides prunable and bare worktrees. A checkout's
  identity is the first 16 hex characters of the SHA-256 of its real path and
  its configuration path.
- **Serve supervisor.** The shell starts serve when the reader selects a
  checkout. It runs the `mokly` shim from the checkout's own `node_modules`,
  never from `PATH`, because the Linux package installs the app itself as
  `/usr/bin/mokly`. It passes `--config`, `--port 0`,
  `--host-origin mokly-app://desktop` and the JSON reporter. It reads the
  login shell's `PATH` on macOS and Linux, so that Node from a version manager
  works in an app that the launcher started. It stops a serve that no window
  shows for 10 minutes, and every serve when the app quits. A missing, too old
  or too new CLI shows an error that names the install command. The version
  floor is the first `@mokly/mokly` release with `--host-origin`. The ceiling
  is the catalogue index version that the app reads, as
  [Mokly artifact compatibility](../docs/protocol/cloud/mokly-artifact-compatibility.md)
  says.
- **Bridge.** One preload script exposes `window.moklyDesktop` through
  `contextBridge`. Its methods list the repositories and their checkouts, add
  a repository through the native folder dialog, remove a repository, select
  a checkout, and subscribe to checkout and serve states. The main process
  checks every argument. Only the main frame on `mokly-app://desktop` gets the
  bridge. This replaces the requirement of one bridge method in the "Local
  Mode" section of the desktop protocol page.
- **Page policy.** The shell's CSP adds `http://127.0.0.1:*` to `frame-src`,
  `connect-src`, `img-src`, `font-src` and `style-src`. The app server's CSP
  does not change. The contract test that holds the two equal compares them
  without the loopback source.
- **Route and chrome.** A checkout has the route `/local/:checkoutId`. It needs
  no session and no API. `local` joins the app-owned first segments in
  `crates/mkc-domain/src/slug.rs`, so no workspace slug can hide the route.
  The cloud chrome keeps its slots. The publication pill becomes a checkout
  pill with the branch and a Local mark. History, Share and the Changes check
  slot stay empty. A checkout whose `origin` remote and configuration path
  match a project that the reader can read shows that project in the
  switcher. The project's switcher gains a Local group with its checkouts.
  The mockups settle the exact composition.
- **Changes.** Decision 3. The Changes tab shows serve's own classification
  against the merge base, with no cloud check.

## Milestone 1: Mockups

Tags: mockup

Depends on: none

Draw local mode in the cloud mockup catalogue under `docs/mockups`, with the
Mac window of `product/viewer/standalone/mac-app`.

- [ ] Draw the ready local viewer: the checkout pill, the Local mark and the
      empty History, Share and check slots.
- [ ] Draw the switcher with a Local group of several worktrees, each with its
      branch and folder, beside the branches and pull requests of the project.
- [ ] Draw the first run: no repository yet, the add action, the pick of one
      of several configurations, and a repository with no Mokly
      configuration.
- [ ] Draw the serve states of a checkout: starting, failed with its message,
      CLI missing, CLI too old, CLI too new, and stopped after idle.
- [ ] Draw local mode signed out and offline, where only local rows work.
- [ ] Register each new screen in
      [Product mockups: Mac app](../docs/protocol/cloud/product-mockups-mac-app.md).
- [ ] Run the check that `docs/mockups/README.md` gives. Smoke-test the
      changed pages.
- [ ] Update the design and the TODOs of this plan for each problem that the
      mockups show.

## Milestone 2: Documentation and protocol

Depends on: 1

State the requirements and the decisions of this plan. Each page whose
behaviour is not implemented yet gets a status line that links this plan.

- [ ] Rewrite the "Local Mode" section of `docs/protocol/cloud/desktop-app.md`
      with decisions 1 to 3 and the wider bridge. Update its "Current Viewer
      Limit" section and the opening paragraph.
- [ ] Update `docs/protocol/cloud/desktop-bundle.md` with the preload bridge
      and the loopback page policy.
- [ ] Add `docs/protocol/mokly-serve-host.md` with the host serve contract.
      Link it from `docs/protocol/mokly-on-demand.md` and
      `docs/protocol/README.md`.
- [ ] Update `docs/protocol/mokly-frame-probe-wire.md` with the host origin
      rule.
- [ ] Update `docs/protocol/mokly-viewer.md`, `docs/protocol/mokly-viewer-api.md`
      and the "Embedded Viewer" section of
      `docs/protocol/mokly-shell-delivery.md` with the `live` prop.
- [ ] Update `docs/protocol/cloud/viewer-host.md` and
      `docs/protocol/cloud/viewer-address-state.md` with the local source and
      the local route.
- [ ] Update `docs/product-direction.md`.

## Milestone 3: Frame probe accepts a non-HTTP host

Depends on: 2

- [ ] Change `origin` in `packages/frame/src/probe/values.ts` and the host
      check of `packages/frame/src/adapters/post_message_adapter.ts`. Add the
      tests in `packages/frame/tests`.
- [ ] Change `packages/desktop/src/_tests_/viewer.ts` to expect a mounted
      screen frame.
- [ ] Regenerate the contract fixtures with `cargo xtask mokly-fixtures` when
      they change.
- [ ] Delete `plans/follow-ups/viewer-frames-refuse-desktop-host.md`, and move
      its republish step to the post-merge section below.

## Milestone 4: Serve admits a host origin

Depends on: 2

- [ ] Add `--host-origin` and the JSON reporter mode to the grammar in
      `crates/mokly-cli/src/parsing.rs`, with the help snapshot.
- [ ] Add the CORS on every response, the `frame-ancestors` and the render
      authorization of the host origin in `crates/mokly-server`, next to
      `security.rs`.
- [ ] Inject the frame probe into served documents when a host origin is set.
- [ ] Write the JSON report lines for the listening, ready, failed and stopped
      states.
- [ ] Add HTTP tests under `crates/mokly-server/tests/http` for each admitted
      and each refused origin.
- [ ] Update `crates/mokly-cli/README.md` and `docs/guides/cli/serve.md`.

## Milestone 5: Hosted live source in the viewer

Depends on: 2, 4

- [ ] Add the optional `live` prop to `MoklyViewer` and export
      `serveLiveSource`. Reuse `packages/viewer/src/standalone/live_source.ts`
      with an origin argument.
- [ ] Adopt each revision in the hosted runtime, as the standalone shell does.
- [ ] Switch comparisons to live delivery when `live` is set, in
      `packages/viewer/src/viewer/environment.ts`.
- [ ] Add viewer tests under `packages/viewer/tests` against a test serve with
      a host origin.

## Milestone 6: Desktop checkouts, supervisor and bridge

Depends on: 4

- [ ] Add the repository store, the configuration finder and the worktree
      reader to `packages/desktop/src`.
- [ ] Add the serve supervisor: start, ready, failure, idle stop and quit.
- [ ] Add the preload script and the bridge. Turn on the preload in
      `packages/desktop/src/window.ts` for the main frame only.
- [ ] Add the loopback sources to the CSP in `packages/desktop/src/config.ts`.
      Update the contract test.
- [ ] Add logic tests for each new module under `packages/desktop/src/_tests_`.
- [ ] Update `packages/desktop/README.md`.

## Milestone 7: Local source in the app

Depends on: 3, 5, 6

- [ ] Add a typed client of the bridge in `packages/app/src/viewer`. On the web,
      it reports that local mode is unavailable.
- [ ] Add the local source to the viewer host, with
      `postMessageAdapter({ frameOrigin })` for the serve origin and the `live`
      prop.
- [ ] Add `local` to `APP_FIRST_SEGMENTS` in `crates/mkc-domain/src/slug.rs`,
      with its test and the generated copies that read it.
- [ ] Add the `/local/:checkoutId` route, which reads no session.
- [ ] Match a checkout's `origin` remote and configuration path to a readable
      project.
- [ ] Add logic tests under the app's test folders.

## Milestone 8: Local mode screens in the app

Tags: ui

Depends on: 7

- [ ] Build the checkout pill and the Local group of the switcher from the
      Milestone 1 mockups. Check the shared UI library that
      `packages/app/README.md` names first.
- [ ] Build the first run, the serve states, and the signed-out and offline
      states.
- [ ] Check the copy against `docs/protocol/cloud/product-copy.md`.
- [ ] Save screenshots of each state under `.context/desktop-local-mode/`.

## Milestone 9: Desktop local mode smoke

Depends on: 8

- [ ] Add a Playwright Electron spec under `packages/desktop/src/_tests_` that
      adds a copy of `examples/basic` with one extra worktree, opens both
      checkouts, edits a screen, and sees the frame reload.
- [ ] Run `cargo xtask check --suite cloud-desktop`.

## Milestone 10: Verification, commit, review, and pull request

Depends on: every other milestone

- [ ] Run the targeted tests and the complete gate named in `AGENTS.md`.
- [ ] Commit with Conventional Commits and push the branch.
- [ ] Review the complete local diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings,
      then apply the fix rule: fix the `fix now` findings, record
      follow-up items under `plans/follow-ups/` for the rest, re-review
      once, and report.
- [ ] Delete this plan when the `plans` skill says, under "Deleting the
      plan".
- [ ] Open the pull request. Its description gives the decisions and the
      design calls of this plan with their dates, a permalink to this plan,
      and the follow-up items that the change adds.

## Post-merge follow-up (non-blocking)

- [ ] Publish each hosted catalogue again with the changed CLI, so that its
      frame probe accepts the desktop host.
- [ ] Run a packaged macOS build against a T3 Code worktree and a Conductor
      workspace.

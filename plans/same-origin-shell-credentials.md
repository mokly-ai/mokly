# Send same-origin cookies with every shell request

Status: Active. On branch `calummoore/mokly-serve-domain-hosting`, no pull request yet. The pull request that completes the work deletes this plan, as the `plans` skill says.

The browser shell of `@mokly/viewer` fetches the catalogue index, the entry
details, the live descriptor, the deployment file, and the removed-preview
metadata with `credentials: "omit"`. The removed-preview renewal and the
pane documents of a pinned comparison omit credentials too. A sign-in gate
in front of the catalogue refuses each request without its session cookie.
Conductor workspace previews, Cloudflare Access, and Vercel Deployment
Protection are such gates. Behind a Conductor preview, the index request
gets `401 Sign in to view this preview.`, and the shell shows "The catalogue
could not be loaded". The HTML page loads, because a page navigation always
sends cookies. A local run behind a stand-in cookie gate showed the same
screen. The catalogue loaded when every request carried the cookie.

User decision, 2026-11-04: option B. Every shell request sends
`credentials: "same-origin"`, and one shared helper sets the mode. The
rejected options were:

- A. Change nothing, and reach Serve only without a gate, for example
  through an SSH tunnel. Conductor previews stay unusable for Mokly.
- C. Send same-origin cookies only in Serve. Static catalogues behind a
  gate still fail.
- D. Add a setting that selects the credential mode. Each user behind a
  gate must find and set it.

`credentials: "include"` was left out. With it, the browser rejects each
cross-origin response without `Access-Control-Allow-Credentials: true`, so
every cross-origin host that follows the static CORS rule stops working. The
reason for B: one rule fixes Serve and static catalogues behind a gate, and
a cross-origin fetch still carries no cookies.

The options check of 2026-11-04 confirmed B and added option E: keep B, and
give the embedded viewer an optional `fetch` prop for a gated catalogue on
another origin than the page. No known setup needs E, and a cross-origin
gate would need `Access-Control-Allow-Credentials`, which the static CORS
rule forbids. E is not part of this change. The check also corrected the
reach of B. It fixes an embedded host only when the catalogue shares the
page's origin. B also admits HTTP Basic and client-certificate gates,
because the credentials mode controls them too. The CDN cost is small,
because the stub page, the stylesheet, the scripts, the fonts, and the
preview frames already send the origin's cookies. Report:
`.context/same-origin-shell-credentials/options-check.md`.

The decision also answers `plans/follow-ups/viewer-credential-rule.md`. Its
root question was "Which credentials does each viewer request send?", and it
recommended omitted credentials everywhere. This branch deletes the item.

The change does not cover two open decisions. Serve accepts a live prop
edit only when `Origin` equals `http://` plus `Host`, so edits fail behind a
proxy: `plans/follow-ups/proxied-render-origin.md`. Serve refuses a `Host`
other than `localhost` or `127.0.0.1`:
`plans/follow-ups/serve-public-host-names.md`.

## Design

- My call, 2026-11-04: a new module `packages/viewer/src/catalogue/shell_request.ts`
  exports `shellRequest(init)`. It takes the request options without a
  `credentials` field, typed `Omit<RequestInit, "credentials">`, and returns
  them with `credentials: "same-origin"` set last, as a branded
  `ShellRequest` type. Reason: a type that cannot hold the field stops a
  call site from choosing its own mode. Seven call sites in five files chose
  their own mode before this change.
- My call, 2026-11-04, from the options check: the internal fetch
  boundaries accept only a `ShellRequest`. These are `JsonFetch` in
  `catalogue/sources.ts`, `ComparisonEnvironment.fetch`,
  `PreviewRequestEnvironment.fetch`, and
  `SnapshotPresentationEnvironment.fetch`. A call with its own options
  object then fails to compile. Reason: the helper alone stops only the
  calls that use it. None of these types is exported from the package.
- My call, 2026-11-04: the event stream keeps `new EventSource(url)` without
  `withCredentials`. That default already sends cookies to its own origin
  only. The protocol states the rule for every shell request, the event
  stream included.
- My call, 2026-11-04: the existing tests that assert `credentials: "omit"`
  are the tests of this requirement. They change to `"same-origin"` first
  and fail on the old code. No new browser spec: the browser's cookie
  handling for `"same-origin"` is third-party behaviour, so a stand-in
  cookie-gate run is a one-time proof.
- My call, 2026-11-04: `tests/browser/static_cors.spec.ts:124` keeps its
  own `"omit"` probe. It tests the CORS headers of the fixture host, not a
  shell request. A cross-origin request sends no cookies in either mode, so
  the probe cannot tell the two modes apart.

Contract owners:

- [Shell delivery fences](../docs/protocol/mokly-shell-fences.md).
- [Viewer](../docs/protocol/mokly-viewer.md).
- [Static delivery](../docs/protocol/mokly-export-delivery.md).
- [Comparison panes](../docs/protocol/mokly-comparison-panes.md).
- The [viewer README](../packages/viewer/README.md) and the
  [previews README](../packages/viewer/src/previews/README.md).

Replaced ways:

- A credential mode in each call site → `shellRequest`. Consumers:
  `fetchJson` in `catalogue/sources.ts`, `renewPreview` in
  `previews/request.ts`, `loadPresentation` in `previews/presentation.ts`,
  the selection and renewal requests in `shell/comparison_request.ts`, and
  the render and expiry requests in `standalone/live_source.ts`. Moved in
  Milestone 2. The pinned and live branch of `loadPresentation` is deleted
  in Milestone 2.

## Milestone 1: Documentation and protocol

Depends on: none

The protocol pages, the guides, and the READMEs state the same-origin rule
and the decision, with the rejected `"omit"` and its reason.

- [ ] `docs/protocol/mokly-shell-fences.md:49`: every shell fetch and the
      event stream send `credentials: "same-origin"`. A same-origin fetch
      carries the origin's cookies, so a sign-in gate admits it. A
      cross-origin fetch carries none. `"omit"` is rejected, because a gate
      refuses a request without its cookie.
- [ ] `docs/protocol/mokly-viewer.md:56`: the URL fetch rule names
      `credentials: "same-origin"`.
- [ ] `docs/protocol/mokly-export-delivery.md:97` and `:111-112`: the
      deployment check sends same-origin credentials. Cross-origin reads
      carry no cookies, so the exact-origin CORS rule needs no
      `Access-Control-Allow-Credentials`. A sign-in gate in front of the
      origin works.
- [ ] `docs/protocol/mokly-comparison-panes.md:28-29` and `:159`: pinned and
      live pane documents use the one shell rule.
- [ ] `docs/guides/cli/serve.md`, section "Access": browsing works through
      a forwarding service that rewrites the host to `localhost:{port}` and
      asks viewers to sign in. Component prop edits still need the local
      address, because they need the exact local origin.
- [ ] `docs/guides/catalogue/export-and-host.md`, section "Deploy the
      contents": a sign-in gate in front of the origin works.
- [ ] `packages/viewer/README.md:92`: the host example sends
      `credentials: "same-origin"`. `:189`: the viewer reads no cookie, and
      its requests send cookies only to the catalogue's own origin. Add the
      Key Code entry of `src/catalogue/shell_request.ts`.
- [ ] `packages/viewer/src/previews/README.md:28`: the renewal sends
      same-origin credentials.
- [ ] `packages/viewer/docs/deployment/README.md:29` and
      `packages/viewer/docs/concepts/README.md:24`: the viewer fetches with
      `credentials: "same-origin"`.

## Milestone 2: Shell requests

Depends on: 1

Every shell fetch builds its options through `shellRequest`.

- [ ] Change the expected mode to `"same-origin"` in the tests of the
      requirement. Run them and see each fail on its assertion:
  - [ ] `packages/viewer/tests/sources.test.ts`, the test "JSON routes are
        plain GETs that omit credentials", renamed for the new rule.
  - [ ] `packages/viewer/tests/standalone_transport.test.ts`, the index,
        detail, and live descriptor requests.
  - [ ] `packages/viewer/tests/removed_preview_renewal.test.tsx`.
  - [ ] `tests/client_removed_preview_generation.test.ts`.
  - [ ] `tests/client_removed_preview_presentation.test.ts`.
  - [ ] `tests/browser/removed_preview_presentation.spec.ts`.
- [ ] Add `shellRequest` and move each consumer of "Replaced ways" to it.
      Delete the pinned and live branch of `loadPresentation`, and its
      `delivery` parameter when nothing else reads it.
- [ ] Narrow the four internal fetch boundaries to `ShellRequest`.
- [ ] Remove the test "live presentations use same-origin credentials" in
      `tests/client_removed_preview_presentation.test.ts`. The test "pinned
      presentations accept extensionless delivery and cache by address"
      then asserts the same mode at the same level.
- [ ] Run the targeted tests and `cargo xtask check --suite repository`.
- [ ] Run each changed browser spec 10 times. Record the pass count under
      `.context/same-origin-shell-credentials/`.
- [ ] One-time proof: build, run Serve behind the stand-in cookie gate in
      Chrome without cookie injection, and confirm that the catalogue
      loads. Save the output under `.context/same-origin-shell-credentials/`.
- [ ] Smoke test: run `npm run dev` and open the catalogue.
- [ ] Share Serve at this workspace's Conductor preview URL. Ask the user to
      open it while signed in to Conductor, and to confirm that the
      catalogue loads.
- [ ] Delete `plans/follow-ups/viewer-credential-rule.md`.

## Milestone 3: Verification, commit, review, and pull request

Depends on: 1, 2

- [ ] Run the targeted tests and the complete gate, `cargo xtask check`.
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
      and the follow-up items that the change adds and deletes.

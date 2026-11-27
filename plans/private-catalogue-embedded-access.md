# Private catalogue embedded access

Status: Active. On branch `calummoore/private-catalogue-embedded-access-lm7q`, no pull request yet. The pull request that completes the work deletes this plan, as the `plans` skill says.

A private catalogue is a publication of a private project. Each of its files
needs the `__Host-mkc_catalogue` cookie on the publication host. The app gets
that cookie through a one-use access grant. Inside the app, the publication
host is a third-party site, and Safari and iOS block its cookie. Readers there
see a final blocked message and no screens. This plan resolves the follow-up
item `plans/follow-ups/private-catalogues-lose-changes-and-blocked-cookie-access.md`
with option G: a partitioned cookie first, then Mokly's embedded access route,
which carries a short-lived bearer token through a Mokly service worker.

The change does not cover private Changes and removed-entry previews, which
are option B of the item. B can later use the same bearer header through a
documented host transport of `@mokly/viewer`. The change does not cover the
native mobile app, which the workspace "native mobile app expo" owns. The
desktop shell's `mokly-app://desktop` origin stays refused by the frame
adapter, as `plans/follow-ups/viewer-frames-refuse-desktop-host.md` records.

## Decisions

### User decision, 2026-11-25: option G

The user chose G in the workspace "native mobile app expo", on the branch
`calummoore/native-mobile-app-expo-rnqn`. That conversation added options E,
F and G. The follow-up item file still lists only A to D, so this plan records
all of them. The options:

- **A.** Add `Partitioned` to the catalogue cookie and its clearing cookie.
  Current Chrome, Edge, Firefox and Safari 26.2 and later then keep the cookie
  in a partition for the app's site.
- **B.** A documented host transport of `@mokly/viewer` for its own reads,
  for private Changes. Out of scope here.
- **C.** B, and a new tab with a first-party grant exchange.
- **D.** A secret hostname for each grant, with no cookie.
- **E.** A, and a workspace admin setting that switches the workspace to D.
  Not chosen: every reader of the workspace gets D's hostname leak, and D is
  still built in full.
- **F.** A, and an automatic fallback for each blocked reader: a first-party
  new tab on the web, from a form post of a fresh grant to `/_access`, then
  the standalone shell. A future phone app gets a native first-party
  WebView. F is the recorded fallback if the WebKit proof of G fails.
- **G, chosen.** A, and Mokly's embedded route:
  1. Add `Partitioned` to the cookie and its clearing cookie. Ship it first.
     It needs no republish.
  2. The catalogue server answers a navigation of a private screen without a
     credential with a small public start page. It holds no private content.
  3. The start page asks the parent page for a short-lived token with
     `postMessage`, and accepts the answer only from the app origin. The
     parent gets the token as it gets the access grant today.
  4. The start page registers a Mokly service worker for the catalogue
     domain, gives it the token, and reloads the screen.
  5. The service worker adds `Authorization: Bearer {token}` to every request
     that the frame makes to its own domain. The catalogue server accepts the
     header as an alternative to the cookie.
  6. The parent sends a new token before the old one expires. The worker
     keeps the token in its own storage.

Reason: readers stay inside the app view in every browser, Safari before 26.2
included, and no secret goes into a hostname or a URL. The options check of
2026-11-25 narrowed "every browser": see the browser floor below. D was not chosen,
because a secret hostname leaks through passive DNS, clear-text TLS SNI,
Certificate Transparency without a wildcard certificate, and the `Origin`
header to servers that mockups load from. Grok Build (November 2026) and Meta
AI shares (October 2026) leaked such hostnames.

### Facts checked for this plan, 2026-11-25

- WebKit's "Features for Safari 26.2" confirms CHIPS: shipped in 18.4,
  removed in 18.5, back in 26.2. Chrome 114 and Firefox 141 ship it.
- Chrome 128 keys a partitioned cookie also by a cross-site ancestor bit.
  Chrome sets the bit for every cross-site cookie, so the app's own reads and
  the screen frame both carry it and share one partition. Milestone 2 proves
  this in Chromium.
- Not checked: Android WebView ignores `Partitioned` from 128. Safari runs
  service workers in cross-site frames, partitioned by the top site. The
  WebKit proof of Milestone 3 checks the second fact.
- The CLI injects the frame probe from `/mokly-viewer/client/frame-probe.js`
  into the current documents that it writes, under `static/`. The probe
  trusts the `mokly-host` query parameter, and the catalogue CSP
  `frame-ancestors` admits only the configured app origins.
- The app reads the index and each entry detail itself, with the cookie
  (`packages/app/src/viewer/catalogue-source.web.ts`). So in a browser that
  blocks the cookie, the app's own reads fail too, not only the frames.
- WebKit has run partitioned service workers in cross-site frames since
  Safari 11.1. The proof checks the narrower points: the header on the frame
  navigation, the start page flow, and the token after a worker restart.
- A worker's own `fetch` of a navigation sends `Sec-Fetch-Dest: empty`, not
  `iframe`. So the server's start page rule does not fire for it.
- The frame probe has a recorded 11,264-byte budget. On 2026-11-23 it had
  about 200 bytes free. The probe contract also excludes host-specific code.
- Authored files live under `/static/{repository path}`, and generated screen
  documents under `/static/mokly-generated/`. A worker's scope cannot rise
  above its script's folder without `Service-Worker-Allowed`.
- Browser floor of the worker route: Safari 16.4 and later, because older
  Safari sends no `Sec-Fetch-Dest`. iOS in-app browsers on WKWebView run no
  workers without App-Bound Domains. Readers who block all data of the
  catalogue domain get no route.
- An existing private catalogue answers 401 without access. That existence
  oracle is a recorded decision, so a start page with status 401 discloses
  nothing new.

### User approval, 2026-11-25

The user approved the plan: "impl the plan, run tests/spike before impl". The
user gave access to a test Mac mini over Tailscale for the WebKit and Safari
proof. The message answered none of the open decisions, so they stay open.

### User answers, 2026-11-27

The user answered D1 to D7 with "1 = A, 2 = A, 3 = B, 4 = A, 5 = A, 6 = A,
7 = B". The options check report is
`.context/private-catalogue-embedded-access/options-check.md`.

- **D1. Where the WebKit proof runs: A.** The hand-run proof of Milestone 3
  stays the WebKit proof, and the gate stays Chromium only. Not chosen: B, a
  WebKit project in the app browser suite; C, A and a manual Safari check
  after the deploy; D, B and C; E, a scheduled WebKit job; F, a gated WebKit
  spec in the Mokly browser suite, which was the recommendation; G, a device
  farm with old Safari; H, real Safari on the `macos-26` runner. Reason: no
  new gate. The manual Safari check after the deploy stays under the
  post-merge follow-up, as the approved plan had it.
- **D2. Token lifetime and scope: A.** The token is the cookie's own signed
  capability: one publication, one user, 300 seconds. Not chosen: B, a
  separate 120-second token; C, A and a `Sec-Fetch-Site` and `Origin` check;
  D, a token bound to a browser key. Reason: the mockup scripts that can read
  the token can already read the same files, and a shorter life adds
  failures after a tab sleeps.
- **D3. What a reader sees when no route works: B.** The app keeps its
  blocked stage. `postMessageAdapter` reports the failure through a new
  documented callback, and the app then shows the stage. Not chosen: A,
  remove the stage; C, keep the stage behind a check that no longer fails;
  E, a hidden start frame before the viewer mounts; F, a new error code
  through the viewer's `onError`. Reason: one clear stage is better than
  many broken frames, and the stage already exists.
- **D4. Where the renewal relay lives: A.** The relay goes into the frame
  probe, and the probe budget rises from 11 KiB to 12 KiB (12,288 bytes).
  Not chosen: B, a second relay script in every screen; C, no relay. Reason:
  the relay reuses the probe's trust check and adds no script to every
  screen.
- **D5. Whose bytes the public files are: A.** The server serves the
  publication's own CLI-written start page and worker without a credential.
  Old publications have none and rely on the partitioned cookie. Not chosen:
  B, A with a hash check against known Mokly releases; C, Mokly files built
  into the server. Reason: the host name is a random ID, and a writer can
  already copy the catalogue anywhere.
- **D6. A catalogue's own service worker: A.** The Mokly worker takes the
  scope `/`. A mockup's own worker with a narrower scope outranks it, the
  adapter then reports the failure, and the docs state the limit. Not
  chosen: B, the scope `/static/`; C, A and a build warning; D, the scope
  `/static/mokly-generated/`; E, A and a server refusal of authored worker
  scripts; F, two Mokly registrations. Reason: one registration covers the
  whole host, and the case is rare.
- **D7. The words of the blocked stage: B.** The stage takes option C of
  `blocked-cookie-message-has-no-words.md` now: the title **This publication
  can’t open in this browser** and the text "Open it in Chrome, Edge or
  Firefox on a computer." The stage loses the action **Open catalogue in a
  new tab**. The cloud mockup changes in its own mockup milestone. Not
  chosen: A, leave the words to the follow-up item. Reason: the stage then
  gives a way forward that works, in the same pull request. The answer also
  resolves that follow-up item.

### Open decision, 2026-11-27

- **D8. The words on the private comparison overlay.** The overlay reuses the
  blocked stage card, so D7 gives it words that are false there. The message
  of 2026-11-27 asks the user. The options are those of
  `plans/follow-ups/private-comparison-overlay-blocks-current.md`, and the
  recommendation is B: a card of its own with the title **Comparisons aren’t
  available for private publications** and the text "Choose another screen to
  keep browsing." D8 blocks the last TODO of Milestone 4 and the overlay part
  of Milestone 9.

### Design calls

My calls, 2026-11-25, under the decision test:

- **Token is the signed capability.** The bearer token is the same
  HMAC capability as the cookie value: one publication, one user, one expiry.
  The server verifies both with one path. Reason: no second credential type,
  and the scope that the user asked for already holds.
- **The app gets the token from `/_access`.** The exchange answers 200 with
  `{ "token", "expiresIn" }` and the same `Set-Cookie`. The API and its OpenAPI
  document do not change. Reason: the grant flow stays as it is, and only the
  publication host signs capabilities.
- **Bearer, then cookie.** The server checks the `Authorization` header first.
  When it is missing or invalid, the server checks the cookie. An invalid
  bearer clears no cookie. Reason: a stored old token must not hide a valid
  cookie.
- **The app sends the bearer only when the cookie fails.** The app keeps
  today's cookie reads. When the reachability check fails with the cookie, the
  app repeats it with `Authorization: Bearer` and then sends the bearer on its
  index and detail reads of this publication. CORS admits the `authorization`
  request header for admitted origins only, with an `Access-Control-Max-Age`.
  Reason: no preflight where the cookie works, and the reads work with app
  code only where it does not.
- **Start page only for a frame navigation.** The server answers the start
  page for a private publication, no valid credential, `GET`,
  `Sec-Fetch-Mode: navigate` and `Sec-Fetch-Dest: iframe`, for every path, with
  status 401 and `no-store`. It does not look the path up first, so no file
  name leaks. A top-level navigation keeps today's answer. A browser without
  `Sec-Fetch-Dest` keeps today's answer.
- **Worker answers an expired navigation.** When the server answers 401 to a
  navigation that the worker fetched, the worker answers with the start page
  file instead. Reason: the worker's fetch carries `Sec-Fetch-Dest: empty`, so
  the server rule does not fire, and the frame must still renew.
- **Cookie first in the start page.** After the parent answers with a token,
  the start page checks whether the screen now opens with the cookie alone.
  When it does, the page reloads without a worker. Reason: browsers where the
  partitioned cookie works keep the `HttpOnly` cookie and never store a
  token that scripts can read.
- **Exact origin.** The worker adds the header only to requests to its own
  exact origin. Reason: another publication host is another origin.
- **Renewal on resume.** The adapter also renews on `visibilitychange` and
  `pageshow`. Reason: iOS pauses timers in background tabs.
- **Mokly file names.** The start page is
  `mokly-viewer/client/access-start.html`, with its script inline, and the
  worker is `mokly-viewer/client/access-worker.js`, served with
  `Service-Worker-Allowed: /`. The server serves the publication's own
  CLI-written files, as D5 says.
- **Parent trust.** The start page and the probe accept a token only when
  `event.source === window.parent` and `event.origin` equals the `mokly-host`
  parameter. They send only to that exact origin. The CSP `frame-ancestors`
  limits the parent to the configured app origins. This is the probe's trust
  rule, so the user's "exact configured app origin" holds without server
  changes to Mokly bytes.
- **Own wire channel.** The access messages use the channel
  `mokly-frame-access`, version 1, not the probe wire. Reason: the probe wire
  rejects unknown types and versions, and old publications must keep
  inspection with the new adapter.
- **Renewal.** After the reload the screen holds the probe, not the start
  page. A relay in the screen forwards a valid `token` message to the
  controlling Mokly worker. The relay lives in the frame probe, as D4 says. The adapter
  renews each mounted frame before the token expires. The host's callback
  shares one token between frames.
- **Host API.** `postMessageAdapter` gains an optional `access` callback that
  returns `{ token, expiresAt }`. The Mokly docs call it an access token of the
  frame host. They never name the cloud.
- **Loop guard in the adapter.** The adapter answers at most one access
  request for each mount, and the access phase has a deadline. A second
  request or the deadline reports `unavailable`. Reason: frames of one
  publication load the start page together, so a marker in origin storage
  would trip the other frames.
- **One reload for each new publication.** Each publication host is its own
  origin. So a reader on the worker route sees one reload on the first screen
  of each publication, and one registration stays for each publication.
- **Protocol page length.** `catalogue-hosting.md` has 225 of 250 lines. The
  private access rules move to their own cloud page when they pass the cap.
- **Rust file length.** `catalogue.rs` has 294 of 300 lines. The bearer and
  start page rules go into a new module.

Calls of 2026-11-27, made by the Milestone 5 docs agent and checked by the
orchestrator. `docs/protocol/mokly-frame-access.md` states them:

- **Channel messages.** `request`, `token` (`token`, `expiresAt`), `reload`
  and `unavailable`, up to 8,192 bytes, without a nonce. Reason: `reload`
  keeps the rule of no load time limit, and `unavailable` makes an iOS in-app
  browser fail at once.
- **Token format.** `token68` with 1 to 4,096 characters, and `expiresAt` in
  milliseconds since the epoch. Reason: the worker puts the token in a header.
- **Deadline.** 10 seconds from the token to `reload` or `unavailable`. The
  access phase ends at `ready`.
- **Failure callback.** `onAccessFailure` fires at most once for each mount:
  for a second request, `unavailable`, the deadline, or a failed handshake
  after the reload. A rejected `access` call does not fire it, because the
  host knows its own failure.
- **Renewal timing.** Renewal starts 60 seconds before expiry, never sooner
  than 10 seconds after the last call, and goes to every frame whose
  handshake completed. The app reuses its shared token while more than two
  minutes remain.
- **Worker.** It keeps the newest token, replaces no existing `Authorization`
  header, drops no cookies, and stores no response.
- **Server.** When the bearer verifies, the server ignores the cookie. It
  never logs `Authorization`.
- **Failed bearer confirmation.** It stays retryable. Only `onAccessFailure`
  and the start page check below give the blocked stage.
- **Page splits.** The private access rules moved to
  `docs/protocol/cloud/catalogue-private-access.md`. The usage rules of the
  adapter page moved to `docs/protocol/mokly-frame-adapter-usage.md`, because
  of the 250-line cap.

My call, 2026-11-27, under D3 B:

- **Start page check.** Before the bearer confirmation, the app reads the
  publication's `mokly-viewer/client/access-start.html` once. A 404 shows the
  blocked stage. Reason: the frames of a publication without the start page,
  which is every publication from an older Mokly release, never reach the
  embedded route, so the adapter reports no failure, and each frame would
  show an error whose Try again cannot work. Safari before 16.4 still gets
  frame errors, because it sends no `Sec-Fetch-Dest`. Not chosen: change
  nothing; a failed first handshake reported as a failure, which turns a
  passing network error into a final stage; a user-agent check, which breaks
  easily; a server that refuses the bearer for old publications, which gives
  the retryable card.

## Contract owners

- [Catalogue hosting](../docs/protocol/cloud/catalogue-hosting.md), section
  "Private Access", or its split page.
- [Cloud viewer](../docs/protocol/cloud/viewer.md) and
  [viewer host](../docs/protocol/cloud/viewer-host.md).
- A new Mokly page `docs/protocol/mokly-frame-access.md`: the start page, the
  worker, the access channel, and the host callback.
- [Frame probe](../docs/protocol/mokly-frame-probe.md),
  [frame probe wire](../docs/protocol/mokly-frame-probe-wire.md),
  [viewer](../docs/protocol/mokly-viewer.md), and the export inventory pages.
- The READMEs of `packages/frame`, `packages/viewer`,
  `crates/mkc-catalogue-server`, and `packages/app/src/viewer`.

## Milestone 1: Documentation for the partitioned cookie

Depends on: none

- [x] Change the cookie rule of `catalogue-hosting.md` "Private Access": the
      cookie and its clearing cookie carry `Partitioned`. Record that browsers
      without partitioned cookies keep the final message until G lands.
- [x] Update `crates/mkc-catalogue-server/README.md` for the attribute.

## Milestone 2: Partitioned cookie

Depends on: 1

Option A ships alone, so it can merge first if the user asks.

- [x] Add `Partitioned` in `response.rs` `exchanged` and `clear_cookie`, with
      unit tests of both headers.
- [x] Add an app browser spec in `packages/app/src/_tests_/viewer/` that runs
      with third-party cookies blocked in Chromium, without a block of the
      catalogue site's other storage. It proves that the app's
      reads and the screen frames both use the partitioned cookie.
- [x] Run `cargo test -p mkc-catalogue-server` and the new spec.

## Milestone 3: WebKit proof of the worker route

Depends on: none

A throwaway proof, outside the product code. It decides between G and F.

- [x] Build a minimal two-site HTTPS setup: a top page on one site, a frame
      on another site that needs a bearer header, a start page, and a worker.
      Linux WebKit may drop `Secure` cookies and refuse workers on plain HTTP
      loopback hosts.
- [x] In Playwright WebKit, prove: the worker registers in the cross-site
      frame, it intercepts the frame navigation and its images, styles,
      fonts, scripts, `fetch` and nested frames, it adds the header, and it
      keeps the token after a worker restart. Prove the same in Chromium and
      Firefox.
- [x] Save the proof and its output under
      `.context/private-catalogue-embedded-access/webkit-proof/`.
- [x] If the proof fails, stop. Replace Milestones 4 to 8 with option F, and
      ask the user before you build it.

Result, 2026-11-25: the proof passed in real Safari 26.6.2 on the test Mac
mini, and in Playwright WebKit, Chromium and Firefox on Linux. G stays the
route, and F is not needed. Summary:
`.context/private-catalogue-embedded-access/webkit-proof/RESULT.md`.

## Milestone 4: Mockup of the blocked stage words

Tags: mockup

Depends on: none

D7 B gives the blocked stage new words and removes its new-tab action.

- [x] Change the blocked-cookie card in
      `docs/mockups/src/screens/product/viewer/stage-access.tsx`: the title
      **This publication can’t open in this browser**, the text "Open it in
      Chrome, Edge or Firefox on a computer.", and no action **Open
      catalogue in a new tab**. Check the words against
      `docs/protocol/cloud/product-copy.md`.
- [x] Run the cloud mockup check that `docs/mockups/README.md` gives, and
      look at the changed screen at desktop and mobile widths.
- [ ] Update the design and the TODOs of this plan for each problem that the
      mockup shows.

## Milestone 5: Documentation for the embedded route

Depends on: 2, 3, 4

- [x] Write `docs/protocol/mokly-frame-access.md`: the two files, the start
      page flow, the access channel messages, the worker rules and its scope
      `/` with the limit of D6, the loop guard, the `access` callback of
      `postMessageAdapter`, and the failure callback of D3. No cloud name.
- [x] Update the frame probe, probe wire, viewer, and export inventory pages
      for the access relay, the new files, and the callbacks. Raise the probe
      budget to 12 KiB (12,288 bytes), as D4 says.
- [x] Update the cloud private access rules: the bearer header, the token of
      D2, the start page answer, the public Mokly files of D5, the `/_access`
      answer, CORS, and `Vary`. Update `viewer.md` and `viewer-host.md` for
      the app's bearer reads and the blocked stage of D3 and D7.
- [x] Update each protocol statement that waits for
      `blocked-cookie-message-has-no-words.md`, which that item lists, to the
      words of D7.
- [x] Update the READMEs of the four areas.

## Milestone 6: Catalogue server bearer and start page

Depends on: 5

- [x] Accept `Authorization: Bearer` as the alternative credential, as the
      design calls say. Keep cookie clearing for the cookie only.
      Branch: `calummoore/embedded-access-catalogue-server-bearer-9fes`.
- [x] Answer `/_access` with 200 and the token JSON beside the cookie.
      Branch: `calummoore/embedded-access-catalogue-server-bearer-9fes`.
- [x] Serve the start page for a private uncredentialed frame navigation, and
      the two Mokly files without a credential, with `Service-Worker-Allowed: /`
      on the worker.
      Branch: `calummoore/embedded-access-catalogue-server-bearer-9fes`.
- [x] Add `authorization` to the CORS request headers and `Authorization` and
      `Sec-Fetch-Dest` to `Vary`.
      Branch: `calummoore/embedded-access-catalogue-server-bearer-9fes`.
- [x] Unit tests for each rule, and a test that no other private file opens
      without a credential.
      Branch: `calummoore/embedded-access-catalogue-server-bearer-9fes`.

## Milestone 7: Mokly start page, worker and relay

Depends on: 5

Runs in parallel with Milestone 6. The files do not overlap.

- [ ] Build `access-start.html` and `access-worker.js` in `packages/frame`,
      copy them through the viewer's browser outputs, and write them in the
      static build under `mokly-viewer/client/`.
- [ ] Add the access relay to the probe bundle, and raise the budget tests
      `packages/frame/tests/probe_budget.test.ts` and
      `tests/probe_inert.test.ts` to 12,288 bytes.
- [ ] Add the `access` callback to `postMessageAdapter`: answer a start page
      request, wait for the reload before `hello`, renew before expiry, and
      report the failure through the callback of D3.
- [ ] Package tests for the channel validation, the adapter states, and the
      worker's header rule. Regenerate the contract fixtures with
      `cargo xtask mokly-fixtures`.
- [ ] Add the frame access envelope, version 1, to the version table of
      `docs/protocol/cloud/mokly-artifact-compatibility.md`. The page has 250
      of 250 lines, so split it first.

## Milestone 8: App access through the bearer token

Depends on: 6, 7

- [ ] Keep the token from `/_access` in `access.ts`, share it, and renew it
      before expiry.
- [ ] Send the bearer on the app's private reads and the reachability check.
- [ ] Before the bearer confirmation, read `mokly-viewer/client/access-start.html`
      once, and show the blocked access state on a 404, as the start page
      check design call says.
- [ ] Pass the `access` callback and the failure callback to
      `postMessageAdapter` in `published.web.tsx`, and set the blocked access
      state when the failure callback fires.

## Milestone 9: Blocked stage words

Tags: ui

Depends on: 4, 8

- [ ] Give `AccessBlocked` in `packages/app/src/viewer/stage.tsx` the words
      of Milestone 4, and remove its action **Open catalogue in a new tab**.
- [ ] Remove the allowances that Milestone 4 added to
      `docs/mockups/src/_tests_/app-parity-allowances.ts` for the new words.
- [ ] Update the app tests of the stage, and check the stage in a browser
      at desktop and mobile widths.

## Milestone 10: End-to-end proof

Depends on: 9

- [ ] An app browser spec that drops the catalogue cookie at the network,
      not through a site setting that also blocks workers: a private screen
      loads through the worker, with its images and styles.
- [ ] The same spec checks a renewal after the token's lifetime, with a
      test clock, not a wait.
- [ ] Update the follow-up items that name the changed rules:
      `private-frames-break-after-cookie-expiry.md` and
      `private-comparison-overlay-blocks-current.md`. Delete
      `blocked-cookie-message-has-no-words.md`, which D7 resolves.
- [ ] Update `docs/architecture/cloud.md`, `docs/architecture/cloud-data-flows.md`
      and `packages/viewer/docs/deployment/README.md` for the bearer token and
      the embedded route.

## Milestone 11: Verification, commit, review, and pull request

Depends on: every other milestone

- [ ] Run the targeted tests and the complete gate `cargo xtask check`.
- [ ] Commit with Conventional Commits and push the branch.
- [ ] Review the complete local diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings,
      then apply the fix rule: fix the `fix now` findings, record
      follow-up items under `plans/follow-ups/` for the rest, re-review
      once, and report.
- [ ] Delete this plan and the follow-up item
      `private-catalogues-lose-changes-and-blocked-cookie-access.md`. Record
      option B, private Changes, as a new follow-up item that names the bearer
      header.
- [ ] Open the pull request. Its description gives the decisions and the
      design calls of this plan with their dates, a permalink to this plan,
      and the follow-up items that the change adds.

## Post-merge follow-up (non-blocking)

- [ ] Open a private catalogue in Safari before 26.2 and in Safari 26.2 or
      later, on a Mac and on an iPhone, in the deployed app.
- [ ] Publish the hosted catalogues again with the new CLI, so that they get
      the start page and the worker.

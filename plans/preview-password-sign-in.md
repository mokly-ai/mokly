# Preview password sign-in

Status: Active. On branch `calummoore/preview-password-sign-in-jofl`, no pull
request yet. The pull request that completes the work deletes this plan, as
the `plans` skill says. Every decision has its answer. Cal approved the plan
on 2026-11-25, and the milestones are in progress.

A PR preview is a temporary deployment of one pull request at
`https://pr-N.preview.mokly.ai`, with its own namespace `mkc-preview-pr-N` and
database. Today a reviewer of this public repository signs in to the shared
account `preview@mokly.ai` with an emailed link. The API writes that link to
its log, and the reviewer reads it with `kubectl` and
`infra/scripts/preview-link.py`. Reviewers without cluster access cannot sign
in alone. This change lets a reviewer type one shared preview password on the
preview's Sign-in page.

Cal chose option C on 2026-11-24: a preview password with derived values. An
operator creates one strong password once, and the team keeps it in its
password manager. A copy lives where only the trusted preview deploy job can
read it. Each preview stores only a value derived from the password with a
slow salted hash, for example `KDF(password, "preview-pr-504")`, in place of
today's random value in Secret `preview-sign-in`. The Sign-in page shows a
"Preview password" field only when the API has the `preview_sign_in`
capability, which production never has. The app sends the typed password to
`POST /v1/auth/preview`. The API derives the value from the typed password,
compares it in constant time, and on a match signs in `preview@mokly.ai`, as
today. The same password works for every preview, and a session keeps its
ordinary lifetime. Cal rejected on the same day: real email in PR previews,
through a Postmark token or a trusted relay; a private link workflow; a plain
shared password in every preview (option B); and a sign-in link, or an
expiring link, in the public PR comment.

The options check of 2026-11-24 found that a value derived from the password
and the preview's name is the same after every label cycle. So the stored
value is a verifier, which checks a typed password and opens nothing by
itself. On 2026-11-24 Cal said "I don't care about backwards compat" and
approved the password-only design ("ok, sounds good"). On 2026-11-25 he said
"stop asking me so many questions". The plan reads that as the answer to every
decision: each takes its recommended option, as the section Decisions records.
So the random link value, the Open preview link and the `{secret}` exchange
go, and the password is the one preview credential.

The change does not add a password to stable environments, does not change
the sessions that a sign-in issues, and does not change the email sign-in of
other addresses.

Contract owners:

- [Authentication and sessions](../docs/protocol/cloud/auth-sessions.md#preview-sign-in).
- [Authentication callbacks](../docs/protocol/cloud/auth-callbacks.md).
- [Preview seed](../docs/protocol/cloud/preview-seed.md).
- [Preview scripts](../docs/protocol/cloud/preview-scripts.md).
- [PR preview environments](../docs/protocol/cloud/pr-preview-environments.md).
- [REST API](../docs/protocol/cloud/rest-api.md).
- [Account mockups](../docs/protocol/cloud/product-mockups-account.md) and
  [Folio chrome: account entry](../docs/protocol/cloud/folio-chrome-account.md).
- The [preview runbook](../docs/ops/preview.md),
  [environment](../docs/ops/environment.md) and
  [secrets](../docs/ops/secrets.md) runbooks.

Replaced ways:

- The random link value and its `{secret}` exchange → the typed password and
  its verifier. Consumers, each moved or deleted in the milestone named:
  - Configuration and API: `MKC_PREVIEW_SIGN_IN_SECRET` in `mkc-config`, the
    `{secret}` body and its check in `mkc-auth` and `mkc-api`, their tests,
    `docs/api/openapi.json`, and the generated app types. Milestone 3.
  - Deploy: the random value of Secret `preview-sign-in` in
    `preview-lifecycle.py`, `preview-common.sh` and `preview-deploy.sh`, and
    their tests. Milestone 5.
  - Comment: the Open preview link, `--secret-file` and the
    `repository_private` input that only the link uses, in
    `preview-comment.py`, `preview-event.py`, `preview.yml`, and their tests.
    Milestone 5.
  - Local and smoke: `scripts/cloud/dev-api.sh`, `smoke_api.py`,
    `smoke_desktop_origins.py` and `smoke_preview_plan.py`, which then make a
    verifier from a known test password. Milestone 3.
  - App: the page `/auth/preview/callback`, its route and input code, and
    `preview-callback.spec.ts` and `callback-address.spec.ts`. Milestone 3.
  - Mockups: `product/account/callback/preview-invalid` and its callback
    landing tests. Milestone 1.
  - Docs: `auth-callbacks.md`, `preview-seed.md`, `preview-scripts.md`,
    `pr-preview-environments.md`, `preview-seed-local.md`,
    `product-navigation.md`, `web-app.md`, `web-api-client.md`,
    `docs/ops/preview.md`, `docs/development/cloud.md`, and the crate and
    chart READMEs. Milestone 2.

## Terms

- **Release job:** the trusted `release` job of
  `.github/workflows/preview.yml`. It runs the scripts of `main`, holds the
  deploy identity, and deploys the preview. PR code never runs in it.
- **Verifier:** a value made from the password with a slow hash. It checks a
  typed password and opens nothing by itself.
- **Secret Manager:** Google Cloud's secret store in project `mokly-508518`.
  Operator values such as `mkc-catalogue-dns-token` live there.
- **Log reader:** `infra/scripts/preview-link.py`, which reads an emailed
  sign-in link for one address from the API logs with `kubectl`.

## Design

Each item marked **my call** is a design call that I made on 2026-11-24 or
2026-11-25, with its reason.

- **Verifier.** The verifier is a standard self-describing scrypt string,
  `$scrypt$ln=14,r=8,p=5$<salt>$<hash>`, with a random 16-byte salt and a
  32-byte hash (decision 2, E). An operator makes it once with
  `python3 infra/scripts/preview-lifecycle.py preview-verifier`, which reads
  the password from standard input. The command warns on a password shorter
  than 20 characters (decision 5, D). The operator adds the verifier as a new
  version of the Secret Manager ID `mkc-preview-sign-in-password` (decision 1,
  D). Every preview holds the same verifier.
- **Memory bound, my call.** The API accepts a verifier only with r = 8,
  1 ≤ p ≤ 8 and ln ≤ 16, so one check uses at most 64 MiB. A verifier outside
  these bounds fails startup with a typed configuration error. Reason: the
  verifier comes from an operator, but a typing error must not take the API's
  memory.
- **Settings, my call.** `MKC_PREVIEW_SIGN_IN_SECRET` goes (decision 3, E).
  `MKC_PREVIEW_SIGN_IN_EMAIL` alone configures the shared account, and
  `MKC_PREVIEW_SIGN_IN_PLAN` keeps its rules. A new optional setting,
  `MKC_PREVIEW_SIGN_IN_VERIFIER`, requires the email and the same
  `preview_sign_in` capability. Without it, the API accepts no password, and
  the seed still runs. Secret `preview-sign-in` keeps its name and mount, and
  holds the verifier. Reason: a preview without a verifier must still deploy
  and seed, and the existing Secret name keeps the chart change small.
- **Exchange.** `POST /v1/auth/preview` accepts `{password, returnTo}`, with
  `returnTo` optional (decision 9, A, without `secret` under decision 3, E). A
  password has 1 to 1024 bytes. A longer or missing password fails with
  `validation-failed` and uses no admission. A wrong password, or any password
  without a verifier, answers `magic-link-invalid`. The API checks the
  password against the verifier in constant time and never logs it. The gate,
  the Origin check, the admission of 20 attempts per peer IP per 60 seconds,
  and the session issue stay as today.
- **Bounded hashing, my call.** One API process checks at most two passwords
  at once. Further attempts wait. Reason: each check uses about 16 MiB with
  the chosen parameters, and the API's memory limit is 1 GiB.
- **Configuration answer.** A public endpoint, `GET /v1/configuration`, says
  which optional configuration this API has (decision 4, F). It answers a
  typed object with one field for each optional configuration that the API's
  operation gate knows: today GitHub, billing and the preview password, for
  example `{"github": false, "billing": false, "previewPassword":
{"account": "preview@mokly.ai"}}`. The API builds the answer from the same
  list that its gate uses, so the answer and the gate cannot disagree, and a
  new optional configuration adds a field. Nothing secret goes in it. Sign in
  reads only `previewPassword` in this change (decision 8, D). It waits for
  the answer in its waiting form, so the panel does not move. When the read
  fails, Sign in draws email and GitHub sign-in only.
- **Screens, my call.** The section shows on Sign in only. Sign up and the
  desktop window do not draw it. Reason: the password signs in the shared
  account, which already exists, and the desktop window signs in through the
  browser. The layout puts a second `or` rule under Continue with email, then
  a **Password** field and a `secondary` action, **Continue as
  preview@mokly.ai**. The account entry allows one `primary` action, which
  stays Continue with email. A refused password marks the field with "This
  password isn't valid.", in the voice of "This link isn't valid". Other
  failures, such as the rate limit, show beside the action, as every write of
  the page does. The app trims leading and trailing white space before it
  sends the password, as it trims the email. The mockups settle the final
  layout and copy.
- **Mockup pages.** The mockups draw the section on four pages under
  `product/account/sign-in/preview-password`: the section at rest, its
  `password-refused` and `failure` variants, and `signing-in` beside them.
  Sign in's other pages, Sign up and the desktop window draw no section. On
  each page the email form stays at rest with Cal's address, as the GitHub
  pages draw it. While it signs in, the action reads "Signing in…" with the
  busy spinner, screen readers hear "Signing you in", and the Password field
  waits disabled. A refused password keeps the action's label, and the
  fragment around the action holds only the Details disclosure, as for a
  refused address. The failure page draws the busy cause above Try again. The
  product writes "This password isn’t valid." with a typographic apostrophe,
  as "This link isn’t valid". The field asks for `current-password` and turns
  off autocapitalize, autocorrect and spellcheck.
- **Panel movement, found by the mockups.** The section adds 184px to the
  panel on desktop and 192px on a 390px phone. The desktop panel is centred,
  so in a preview the title and every control above the section move up 92px
  when the configuration answer adds the section after the wait. The phone's
  panel is top-aligned, so only the line under the panel moves down.
  Production draws no section, so its panel does not move. If the wait held
  the section's place, every production Sign in would move instead, and the
  Wait composition draws a layout's most common form. So "the panel does not
  move" in **Configuration answer** holds for production only.
  My call, 2026-11-25: accept this move in previews. Reason: it happens
  once, only in previews, and before the reader can type. Keeping the last
  answer in the browser still moves on a first visit, and a top-aligned
  desktop panel changes a rule for every account screen.
- **Docs design calls, 2026-11-25.** The docs implementor made these calls
  in Milestone 2, and I accepted them:
  - Status lines go on protocol and README pages only, because the rules
    name only those. The runbooks read correctly before and after the change,
    because step 3 of the preview runbook falls back to the log reader.
  - The verifier is a PHC string: the salt and the hash are unpadded standard
    base64, and the hash covers the password's UTF-8 bytes. Reason: both
    sides must agree on each byte.
  - `preview-verifier` trims leading and trailing white space, because Sign
    in trims the password before it sends it.
  - A store read that fails for a cause other than a missing version warns
    and leaves the namespace copy unchanged, because a provider error is no
    proof of absence.
  - The deploy treats a value outside the API's bounds as malformed, because
    the API would not start with it.
  - `previewPassword` is always present: an object with `account`, or
    `null`, as the REST contract keeps always-present fields required.
  - A rotation keeps existing sessions, and a label cycle ends them, because
    the plan does not change sessions.
  - The general rules of `GET /v1/configuration` live in
    `rest-api-surface.md`, because the endpoint also serves GitHub and
    billing. The precise rule is that the answer never names a configuration
    that the gate refuses.
  - The runbook steps use private files and strip the newline, as the
    signing-key steps of the secrets runbook do.
- **Empty password, my call, 2026-11-25.** The action is disabled while the
  trimmed password is empty, as Continue with email is while the address is
  empty. Reason: an empty password cannot match, and the page already uses
  this rule.
- **Deploy.** The release job reads the verifier with
  `gcloud secrets versions access` into a private mode-0600 runner-temporary
  file, as it reads the DNS token. It writes Secret `preview-sign-in` when the
  value differs, before the Helm upgrade. When Helm did not roll the API pod,
  for example on a rerun with the same image, the deploy restarts the API
  Deployment and waits for the rollout. Reason, my call: the API reads its
  settings at startup, and the API pod uses the `Recreate` strategy, so a
  second roll after Helm's roll costs downtime.
- **Missing verifier.** A missing or malformed verifier gives a warning
  annotation on the workflow run, and the deploy writes no verifier (decision
  5, D). An existing verifier in Secret `preview-sign-in` is then deleted, so
  that a preview never keeps a verifier that the store no longer holds.
  Reason, my call: the store is the one source of the verifier. The configuration
  answer then says that no password is accepted, and Sign in draws no section.
- **Rotation.** An operator makes a new verifier from a new password and adds
  it as a new version. Each preview picks it up on its next deploy. A running
  preview accepts the old password until then. A rerun of the workflow
  deploys again.
- **Comment and seed.** The comment loses its Open preview link and every
  input that only the link uses. The seed keeps its steps. Its `signIn` status
  says whether the shared account is configured. The release job never passes
  the verifier to the seed.
- **Same derivation.** One fixture file under `infra/tests/fixtures/` holds a
  fixed password and a verifier made from it by hand with Python's
  `hashlib.scrypt`. Both the Rust tests and the Python tests read it
  (decision 7, C).
- **Local stack, my call.** `scripts/cloud/dev-api.sh` keeps a random local
  password in `.context/preview-password` (mode 0600), created once, and
  derives its verifier for the API. A developer signs in by typing that
  password. Reason: the local stack then tests the same section as a preview.
- **Password, my call.** The runbook creates the password with
  `python3 -c 'import secrets; print(secrets.token_urlsafe(24))'`: 32
  characters and 192 random bits. Reason: with a long random password, a
  leaked verifier does not give the password back.
- **Docs layout, my call.** The Preview Sign-In section moves out of
  `auth-sessions.md` into a new protocol page, `preview-sign-in.md`, and the
  old section links to it. Reason: `auth-sessions.md` has 240 lines, and the
  gate caps protocol Markdown at 250. `preview-scripts.md` (239 lines) and
  `preview-seed.md` (236 lines) link to the new page in place of new text.
- **Security statement.** The protocol states these facts. The Sign-in page
  and the API of a preview run the pull request's own code, so a hostile
  branch could capture a typed password. Only repository writers can deploy a
  preview, and the protocol treats previews as trusted code. A leaked
  verifier, from logs, namespace read access or the store, opens no preview.
  The slow hash keeps a long random password hard to recover from it.

## Decisions

Cal answered every decision on 2026-11-25 with "stop asking me so many
questions", after "I don't care about backwards compat" and "ok, sounds good"
for the password-only design on 2026-11-24. Each decision takes its
recommended option:

1. Where the password lives: **D**, a verifier in the Secret Manager ID
   `mkc-preview-sign-in-password`, made once by an operator.
2. The slow hash: **E**, a self-describing scrypt string,
   `ln=14, r=8, p=5`, with a random salt.
3. The credential: **E**, password only. The random link value, the Open
   preview link and the `{secret}` body go. This deletes functionality on
   `origin/main`, which Cal approved in the words above.
4. Field discovery: **F**, a typed `GET /v1/configuration`, which Cal
   proposed on 2026-11-25 in place of C.
5. A missing or malformed verifier: **D**, warn and accept no password.
6. Email link and log reader: **A**, both stay for every address.
7. Same derivation: **C**, one fixture file for both test suites.
8. The section's text: **D**, **Password** and **Continue as
   preview@mokly.ai**.
9. The request body: **A** without `secret`, as the design says.

The items below are the record of each decision as Cal saw it: the options,
the alternatives and the reasons. The options check of 2026-11-24 ran over
the first draft and added options. Its report is in
`.context/preview-password-sign-in/options-check-report.md`.

### 1. Where the preview password lives

- **Severity:** High. **Effort:** Medium.
- **Source:** Design.
- **Category:** Security.
- **Location:** `infra/terraform/foundation/preview.tf`, `infra/scripts/preview-common.sh`, `.github/workflows/preview.yml`.
- **Background:** The release job already reads operator values from Secret Manager with `gcloud secrets versions access`, for example `mkc-catalogue-dns-token`. Foundation Terraform declares each Secret Manager ID and gives the deploy identity read access. The values never enter Terraform state. `preview.yml` also runs a `pull_request` job, `deploy-pr`, from the branch's own copy of the workflow file.
- **Problem:** The deploy needs one copy of the password, or of a value made from it, that only trusted deploy code can read.
- **Impact if no action:** No preview can check a typed password.
- **Root question:** Where does the deploy's copy live, and what does it hold, so that only trusted deploy code can read it?
- **Options:**
  - **A.** A GitHub Actions secret on environment `preview`, given to the release job as a private file. No Terraform change. A branch's own workflow job that uses environment `preview` can read it, unless that environment allows only `main`, which no doc records. Effort: Small.
  - **B.** A new Secret Manager ID `mkc-preview-sign-in-password` that holds the password, with read access for the deploy identity only. The release job reads it as it reads the DNS token and derives a value for each preview. It needs a foundation apply, and then an operator adds the first value. Effort: Medium.
  - **C.** A Kubernetes Secret in namespace `mkc-preview-system`, which an operator writes with `kubectl`. No Terraform change. It adds a second model for operator values, and every cluster administrator can read it. Effort: Small.
  - **D.** The Secret Manager ID of B holds a verifier, not the password. A verifier checks a typed password and opens nothing by itself. An operator makes it once with a runbook command, and the release job copies it into each preview. The password then stays only in the team's password manager. Every preview holds the same verifier, which changes the words "derived from the password and its own name" of Cal's decision. It needs option D or E of decision 3. Effort: Medium.
- **Left out:** An encrypted file in the repository, because it needs a key that the release job must read from a store anyway. A store that the API reads at runtime, because it gives PR code access to it. A repository-level GitHub secret, because A is better on every point. A password manager's CI integration, because its own token needs the home of A or B.
- **Wider fix:** None, because this is a choice of a new home, not a class of defect.
- **Previous examples:** `mkc-catalogue-dns-token` and `mkc-cloudflare-worker-token`. `docs/ops/secrets.md` put the second one in Secret Manager because its provider accepts only the `main` workflow.
- **Related:** Decision 3: option D here needs its option D or E. Decision 5: the check of a short password moves into the runbook command under D.
- **Recommendation:** D, changed from B by the options check. No machine store then holds the password, and a leaked stored value opens nothing. B stays best if decision 3 takes A.
- **Action:** ask the user, because Cal asked to settle where the password lives, and option D changes one sentence of his decision.

### 2. Which slow hash makes the verifier

- **Severity:** High. **Effort:** Medium.
- **Source:** Design.
- **Category:** Security.
- **Location:** `crates/mkc-auth/src/preview.rs`, `infra/scripts/preview-lifecycle.py`.
- **Background:** Python code from `main` makes the value, and Rust code from the pull request checks it. The API pod has a memory limit of 1 GiB and a CPU request of 250m. Admission allows 20 attempts per peer IP per 60 seconds. Python's `hashlib.scrypt` refuses N = 2^15, r = 8, p = 3 under its default memory limit. N = 2^14, r = 8, p = 5 runs in about 0.17 seconds.
- **Problem:** The plan must name the hash, its cost and how the value records them.
- **Impact if no action:** A fast hash lets a person with a leaked value test many guesses. A heavy hash costs the API memory and time on each attempt.
- **Root question:** How does a leaked stored value stay useless for finding the password, at a cost per attempt that a preview API can carry?
- **Options:**
  - **A.** PBKDF2-HMAC-SHA256 with 600 000 iterations, as 64 hex digits. Python has it, and Rust uses the `pbkdf2` crate. It uses no memory, so graphics cards test guesses cheaply. Effort: Small.
  - **B.** scrypt with N = 2^14, r = 8, p = 5, as 64 hex digits, with a fixed salt. Python has it, and Rust uses the `scrypt` crate. It uses about 16 MiB for each attempt. The parameters are constants on both sides. Effort: Small.
  - **C.** Argon2id with 19 MiB, two passes and one lane. Rust uses the `argon2` crate. Python needs the `argon2-cffi` package, the first third-party package in the trusted release job. Effort: Medium.
  - **D.** HMAC-SHA256 keyed by the password, as 64 hex digits. It needs no new crate and no memory. It protects only a long random password, so it needs a length failure. It drops the slow hash of Cal's decision. Effort: Small.
  - **E.** scrypt as in B, stored as a standard self-describing string, `$scrypt$ln=14,r=8,p=5$<salt>$<hash>`, with a random salt. The API reads the parameters and the salt from the value, within a memory bound. The parameters can rise later without a change to the API. It needs option D or E of decision 3, because the setting of today's link value accepts only 64 hex digits. Effort: Medium.
- **Left out:** None. The fast hash, left out in the first draft, came back as D.
- **Wider fix:** E, because the value then carries everything that both sides must agree on.
- **Previous examples:** None found.
- **Related:** Decision 7: E is the wider fix of that item. Decision 3: E needs its option D or E.
- **Recommendation:** E, changed from B by the plan after the options check. It is memory-hard, needs no new Python package, and removes most ways for the two sides to disagree. B, with the parameters above, stays best if decision 3 takes A.
- **Action:** ask the user, because Cal asked to settle the hash and its parameters.

### 3. Which credential the one-click link carries

- **Severity:** High. **Effort:** Medium.
- **Source:** Design.
- **Category:** Security.
- **Location:** `infra/scripts/preview-comment.py`, `crates/mkc-config/src/preview.rs`, `docs/protocol/cloud/preview-seed.md`.
- **Background:** In a private repository, the PR comment carries an Open preview link with a random value in its fragment. The page `/auth/preview/callback` sends that value to `POST /v1/auth/preview` as `{secret}`. When a link leaks, the runbook says to remove and add the `preview` label, which creates a new random value. This repository is public, so its comment has no link. Smoke scripts, two browser specs and the local sign-in steps use the same `{secret}` exchange. The smoke scripts start their own local API with their own value, for example `scripts/cloud/smoke_preview_plan.py:35`. Cal said on 2026-11-24 that backward compatibility does not matter.
- **Problem:** Cal's option C puts a derived value in place of the random value. A derived value is the same after every label cycle.
- **Impact if no action:** A leaked link can no longer be retired by a label cycle, or the link breaks.
- **Root question:** Which credential does a private repository's one-click link carry, so that a leaked link can still be retired?
- **Options:**
  - **A.** The link carries the derived value. The API accepts `{secret}` equal to the stored value, beside the typed password. No new Secret. A leaked link opens its preview until the password is rotated, because a label cycle makes the same value. Effort: Small.
  - **B.** A second Secret holds a new random value for the link, and the derived value takes the place of today's value. The API holds two credentials. Older images then read the derived value as the link value. Effort: Medium.
  - **C.** Remove the link, the page `/auth/preview/callback`, the `{secret}` body and the link logic of the comment script. It deletes functionality on `origin/main`, and it breaks the smoke scripts, two browser specs and the local sign-in steps. Effort: Medium.
  - **D.** Keep the link, Secret `preview-sign-in`, its random value and `MKC_PREVIEW_SIGN_IN_SECRET` as they are. Add the verifier in a new optional Secret and setting, for example `MKC_PREVIEW_SIGN_IN_VERIFIER`. The API compares the verifier only with a typed password. Older images ignore the new setting. A label cycle still retires a leaked link, and a leaked verifier opens nothing. It changes "in place of today's random value" of Cal's decision. Effort: Medium.
  - **E.** Password only. Each preview holds only the verifier of decision 1, option D. Remove the random value, Secret `preview-sign-in`, `MKC_PREVIEW_SIGN_IN_SECRET`, the Open preview link of the comment, the page `/auth/preview/callback` with its mockup, and the `{secret}` body. Tests and smoke scripts make their own verifier from a known test password. People and tests sign in only with a password. It deletes functionality on `origin/main`, and private repositories lose the one-click link. Effort: Medium.
- **Left out:** A link that carries the password, because a PR comment would then hold the password of every preview.
- **Wider fix:** None, because this is a choice about one credential.
- **Previous examples:** None found.
- **Related:** Decisions 1, 2 and 5: their recommended options need D or E here. Decision 9: under E, its body loses the `secret` field. Follow-up `plans/follow-ups/preview-sample-project-needs-log-access.md`: under E, its option B, a link from Secret `preview-sign-in`, goes.
- **Recommendation:** E, changed from D after Cal's note of 2026-11-24. With no need for backward compatibility and no link in this public repository, one credential is simpler and safer than two. D stays best if private repositories must keep the one-click link.
- **Action:** ask the user, because options C and E delete functionality on `origin/main`, which needs Cal's explicit approval.

### 4. How Sign in knows to show the field

- **Severity:** Medium. **Effort:** Medium.
- **Source:** Design.
- **Category:** Product bug.
- **Location:** `packages/app/src/screens/account/entry-screen.tsx`.
- **Background:** The Sign-in page of the Expo app under `packages/app` draws GitHub and email sign-in. The app learns that GitHub sign-in is off only after a press, from a 503 `operation-unavailable` answer. The API grants `preview_sign_in` only with `MKC_ENV=preview` or `development`. Each environment builds its own app image.
- **Problem:** The page must show the field only where the API accepts a password. No API answer says this before the reader acts.
- **Impact if no action:** The field shows nowhere, or it shows everywhere, production included.
- **Root question:** How does a reviewer reach a password form only where the API accepts a password?
- **Options:**
  - **A.** A build flag in the preview app image, such as `EXPO_PUBLIC_MKC_PREVIEW_PASSWORD=true`. No API change. The flag can disagree with the API, for example in local development. Effort: Small.
  - **B.** A new field in the answer of `GET /v1/health`. It puts a sign-in method into the operations health answer, which smoke checks read. Sign in waits for the answer in its waiting form. Effort: Small.
  - **C.** A new public endpoint `GET /v1/auth/methods`, with `Cache-Control: no-store`. It answers an object with one field for each sign-in method that configuration controls, today only the preview password. Sign in waits for the answer in its waiting form. It adds an endpoint, its OpenAPI entry and generated types. Effort: Medium.
  - **D.** A page of its own, for example `/auth/preview`, which the PR comment links. No discovery is needed, and Sign in stays the same in every environment. A reviewer whom the app sends from a deep link to Sign in must go back to the comment. The comment contract changes, and the page needs its own mockups. Effort: Medium.
  - **E.** On load, Sign in sends `POST /v1/auth/preview` with an empty body, and draws the field on 400 and not on 503. The protocol fixes the order of these checks, and the attempt uses no admission. Every production Sign in then sends a write that the API answers with 503. Effort: Small.
  - **F.** Added on 2026-11-25 from Cal's question about a more generic feature flag or configuration. A public endpoint `GET /v1/configuration` answers a typed object with one field for each optional configuration of the API's operation gate: GitHub, billing and the preview password. The answer comes from the same list as the gate. The GitHub sign-in notice, the App install screen and the Billing pane can later read it in place of a refused request. Effort: Medium.
- **Left out:** A check of the host name, because it fails in local development. A field that always shows, because it draws a dead field in production. A flag that the app server serves, because C is better on every point. A feature-flag service with runtime toggles or rollout by user, because nothing needs a toggle that differs from the deployment's configuration, and it adds a store. An untyped map of flag names, because the generated types then cannot check a name, and the app would compare strings.
- **Wider fix:** C, because its object takes a later method as a new field. A field for GitHub sign-in would fix the notice that shows only after a press, and it is a follow-up item.
- **Previous examples:** The GitHub notice in `entry-screen.tsx`, which shows only after a press.
- **Related:** Decision 8: its option D reads the account address from this answer.
- **Recommendation:** F, changed from C after Cal's question of 2026-11-25. It costs about the same as C, its answer comes from the gate itself, and it serves the three features that today learn their state from a refused request.
- **Action:** Decided F on 2026-11-25.

### 5. What deploy does without a usable verifier

- **Severity:** Medium. **Effort:** Small.
- **Source:** Design.
- **Category:** Process.
- **Location:** `infra/scripts/preview-common.sh`, `infra/scripts/preview-deploy.sh`.
- **Background:** The release job runs the scripts of `main`, so the new deploy starts only after this change merges. The store of decision 1 can then still be empty until an operator adds a value. A read of a Secret Manager ID that does not exist yet answers a permission error. An operator can also store a short password, which the slow hash protects less.
- **Problem:** The deploy needs a rule for a missing, malformed or weak value.
- **Impact if no action:** Deploys fail with a raw provider error, or the field refuses the right password with no sign of the cause.
- **Root question:** What does a deploy without a usable value leave for reviewers and operators?
- **Options:**
  - **A.** Fail the deploy with a message that names the store or the minimum of 20 characters. Every labelled PR stays undeployed until an operator acts. It adds a new deploy failure. Effort: Small.
  - **B.** Warn and continue with a random value in Secret `preview-sign-in`, as today. The field then shows and refuses every password until an operator acts. Effort: Small.
  - **C.** Warn on a missing value, as in B, and fail on a short password, as in A. It adds a new deploy failure for the length only. Effort: Small.
  - **D.** Warn with an annotation on the workflow run, and write no verifier. A malformed value gets the same treatment, with its own warning. The configuration answer then names no account, and Sign in draws no field. The log reader keeps working, and the link too under option D of decision 3. The runbook command of decision 1 warns on a password shorter than 20 characters. It needs option D or E of decision 3. Effort: Small.
- **Left out:** A check in the API, because the API never sees the password before a reviewer types it.
- **Wider fix:** None, because this is a rule for one input.
- **Previous examples:** None found.
- **Related:** Decision 3: D needs its option D or E. Rollout: the Secret Manager ID should hold a value before the deploy change runs, so that the permission-error window does not occur.
- **Recommendation:** D, changed from B by the options check. It keeps the rollout graceful and never shows a field that calls the right password wrong. B stays best if decision 3 takes A.
- **Action:** ask the user, because options A and C add a new deploy failure, which the always-on rules leave to the user.

### 6. Whether the email link and log reader stay

- **Severity:** Low. **Effort:** Small.
- **Source:** Design.
- **Category:** Docs or spec.
- **Location:** `infra/scripts/preview-link.py`, `docs/ops/preview.md`.
- **Background:** In a preview, the API writes every email to its log. The log reader reads the sign-in link of any address from that log. Today it is the only way to sign in to a preview of this public repository. Reviewers also use it to sign in as other addresses, for example to test sign up or an invitation.
- **Problem:** The password replaces the log reader for the shared account only. The plan must say what stays.
- **Impact if no action:** The runbook keeps sending reviewers to `kubectl` for the shared account.
- **Root question:** How does a reviewer sign in to a preview as an address other than the shared account?
- **Options:**
  - **A.** Keep the email link and the log reader for every address. The runbook makes the password the first way for the shared account, and the log reader the way for other addresses. Effort: Small.
  - **B.** Let the password sign in any address that the reviewer types beside it. It changes Cal's decision, which signs in the shared account only, and it creates unverified accounts for any address. Effort: Medium.
  - **C.** Remove the log reader. It deletes functionality on `origin/main` and stops tests of sign up and invitations in previews. Effort: Medium.
  - **D.** A preview-only page that shows sent mail to the shared account. It puts every address behind the shared password, adds a page that only previews draw, and needs a mail store that previews do not have. Effort: Large.
- **Left out:** Real email and a private link workflow, because Cal rejected both on 2026-11-24.
- **Wider fix:** None, because no class of defect is involved.
- **Previous examples:** None found.
- **Recommendation:** A. It keeps every way to sign in and only changes which way the runbook gives first.
- **Action:** ask the user, because Cal asked to settle whether the email or log link path stays.

### 7. How both sides keep the same derivation

- **Severity:** Low. **Effort:** Small.
- **Source:** Design.
- **Category:** Test.
- **Location:** `crates/mkc-auth/src/preview.rs`, `infra/tests/`.
- **Background:** After the deploy, a seed Job runs the PR's own API binary. It creates the shared account and a sample project, and writes its status. No deploy check sends a credential to the API. Python code from `main` makes the value, and Rust code from the PR checks it.
- **Problem:** A PR that changes the Rust side breaks its own password sign-in, and after the merge it can break every preview.
- **Impact if no action:** A reviewer sees "This password isn't valid" with the right password.
- **Root question:** How do the deploy from `main` and a pull request's API keep the same derivation?
- **Options:**
  - **A.** No new deploy check. The Rust tests and the Python tests each assert one fixed password and its expected value as literals. A PR that changes one side and its own literal still passes. Effort: Small.
  - **B.** After the smoke checks, the release job sends the password once to the preview. A refusal fails the required check. It sends the password to PR code on every deploy, and it adds a new deploy failure. Effort: Small.
  - **C.** As A, but one fixture file holds the password and its expected value, and both test suites read it. A PR that changes one side then fails the other side's test. Effort: Small.
  - **D.** The seed checks a fixed public test vector with the PR's code and writes the result to its status. The release job warns on a difference. It changes the seed status schema, which needs its own PR first. Effort: Medium.
  - **E.** Option E of decision 2: the value carries its parameters and salt, so only a change of the algorithm needs both sides. Effort: Medium.
- **Left out:** None. The check inside the seed Job, left out in the first draft, came back as D with a public vector.
- **Wider fix:** E, because it removes most ways for the two sides to differ.
- **Previous examples:** None found.
- **Related:** Decision 2: E there is E here.
- **Recommendation:** C, changed from A by the options check, together with E through decision 2. It costs the same as A and catches the PR that changes one side.
- **Action:** ask the user, because Cal asked to settle the seed and the tests, and option B adds a new deploy failure.

### 8. What the password section says

- **Severity:** Low. **Effort:** Small.
- **Source:** Design.
- **Category:** UX wording.
- **Location:** `packages/app/src/screens/account/entry-screen.tsx`, `docs/protocol/cloud/pr-preview-environments.md`.
- **Background:** Cal's decision names the field "Preview password". `pr-preview-environments.md` says "No product screen gains environment labels". The `product-ui` rules say the same for normal views. The account entry allows one `primary` action, so the password action takes the `secondary` tone.
- **Problem:** "Preview password" names the environment, which a protocol line and a product rule forbid.
- **Impact if no action:** The screen breaks a protocol requirement, or the protocol changes without a decision.
- **Root question:** Which text tells a reviewer which password to type?
- **Options:**
  - **A.** "Preview password", with the action "Continue with password". It says which password to type. It needs the protocol line changed. Effort: Small.
  - **B.** "Password", with the action "Continue with password". No environment name. A reader can think that Mokly accounts have passwords. Effort: Small.
  - **C.** "Team password", with the same action. "Team" is also the name of a plan, so the label can read as a plan's password. Effort: Small.
  - **D.** "Password", with the action "Continue as preview@mokly.ai". The address comes from the configuration answer of decision 4. It names the one account that the password opens, with configured data and no environment name. Effort: Small.
- **Left out:** Helper text under the field, because the copy rules remove text that does not change what the reader does.
- **Wider fix:** None, because this is one text.
- **Previous examples:** None found.
- **Related:** Decision 4: D needs the address in its answer.
- **Recommendation:** D, changed from A by the options check. It says whose password to type and keeps the protocol line. A stays possible if Cal wants his words, with the protocol line changed.
- **Action:** ask the user, because the label in Cal's decision conflicts with a protocol requirement, and the user decides which side wins.

### 9. The request body for a typed password

- **Severity:** Low. **Effort:** Small.
- **Source:** Design.
- **Category:** Docs or spec.
- **Location:** `crates/mkc-api/src/contract/account.rs`, `docs/protocol/cloud/rest-api.md`.
- **Background:** Cal's decision says that the app sends the password to `POST /v1/auth/preview`. It accepts `{secret}` today and answers a wrong value with `magic-link-invalid`, a reason that `rest-api.md` already uses for a preview credential. Its answer's `returnTo` is always `/dashboard`. Email sign-in accepts an optional `returnTo`, so a reader returns to the page that sent them to Sign in.
- **Problem:** The typed password needs a body shape, a size limit, a refusal reason and a destination.
- **Impact if no action:** The API, the OpenAPI document and the app can disagree on the body.
- **Root question:** What does the API accept and answer for a typed password?
- **Options:**
  - **A.** The body holds exactly one of `secret` or `password`, and an optional `returnTo` with the password, validated like the email request. A password has 1 to 1024 bytes and is compared as sent. Both fields, neither field, or a longer password fail with `validation-failed` and use no admission, because such a body cannot match. A wrong password answers `magic-link-invalid`. Effort: Small.
  - **B.** As A, and a wrong password answers a new reason, `preview-password-invalid`. It adds a reason to the code, `rest-api.md` and the OpenAPI document. Effort: Small.
  - **C.** As A, without `returnTo`. Every password sign-in lands on the dashboard. A reviewer who opened a deep link must find the page again. Effort: Small.
  - **D.** A separate operation, for example `POST /v1/auth/preview/password`, with `{password, returnTo}`, behind the same gate and admission. The link's operation stays unchanged. It differs from the endpoint that Cal's decision names. Effort: Small.
- **Left out:** None.
- **Wider fix:** None, because this is one request contract.
- **Previous examples:** Request bodies with one of several shapes exist, such as `CreateProject` and `RequestBuild`.
- **Related:** Decision 3: under its option E, the body holds only `password` and the optional `returnTo`, and the `secret` field goes.
- **Recommendation:** A. It follows Cal's endpoint, reuses the reason that already covers a preview credential, and returns the reviewer to the page that they asked for.
- **Action:** ask the user, because the body, its limit and its destination are new behaviour at the boundary that no requirement covers.

## Milestone 1: Mockups

Tags: mockup

Depends on: none

The Sign-in screen gains the password section in the cloud mockup catalogue
under `docs/mockups`. Each page draws its mobile and desktop variants.

- [x] Add the password section to the Sign-in screen component under
      `docs/mockups/src/screens/product/account/`, as a prop that the default
      Sign-in page leaves off.
- [x] Add the pages under
      `docs/mockups/src/entries/product/account/sign-in/preview-password/`:
      the section at rest, the refused password on the field, the action
      while it signs in, and a failure beside the action. Keep each page at
      five screens or fewer.
- [x] Link the new pages from the Sign-in page, so that a reader reaches them
      from the existing account pages.
- [x] Delete the mockup `product/account/callback/preview-invalid` and its
      cases in the callback landing tests, because the page
      `/auth/preview/callback` goes.
- [x] Run the mockup check that `docs/mockups/README.md` gives. Smoke-test the
      changed pages in a browser, and save screenshots under
      `.context/preview-password-sign-in/`.
- [x] Update the design and the TODOs of this plan for each problem that the
      mockups show.

## Milestone 2: Documentation and protocol

Depends on: 1

The docs state the requirements and the decisions in force for the work
below. History stays in this plan.

- [x] Create `docs/protocol/cloud/preview-sign-in.md` from the Preview
      Sign-In section of `auth-sessions.md`. Add the verifier, its setting
      and its bounds, the exchange of decision 9, the configuration answer of
      decision 4, the security statement, and rotation. Remove the `{secret}`
      exchange and its setting. Leave a short section with a link in
      `auth-sessions.md`.
- [x] Narrow the sentence "Human passwords are not accepted" in
      `auth-sessions.md` to name the preview password as the one exception.
- [x] Update `rest-api.md` and `rest-api-surface.md` for the exchange body and
      the configuration endpoint.
- [x] Remove the preview callback from `auth-callbacks.md`,
      `product-navigation.md`, `web-app.md` and `web-api-client.md`.
- [x] Update `preview-seed.md`: the Secret rows, the verifier format in
      Contract With Main, because `main` makes it and the PR's API reads it,
      the `signIn` status, and the outcome table without its Open preview
      column. Remove the exposure paragraph of the link.
- [x] Update `preview-scripts.md`: deploy step 2, the verifier read, the
      missing-verifier warning, the comment without the link and its inputs,
      and the Sign-In Log Reader introduction.
- [x] Update `pr-preview-environments.md`: the resource table, the Secret
      Manager ID, and the API mount paragraph.
- [x] Update `preview-seed-local.md` for the local password.
- [x] Update `product-mockups-account.md` and `folio-chrome-account.md` for
      the new section and pages.
- [x] Remove the preview landing from `product-mockups-account.md`: the
      callback row, the Preview invalid sentences, the Callback Landings
      sentence, and the count of callback states, which becomes twelve.
      Remove its row from the Variant Slugs table of `mockup-tooling.md`.
- [x] Update `docs/ops/preview.md`: review step 3 uses the password, the log
      reader serves other addresses, and the steps to create and rotate the
      password.
- [x] Update `docs/ops/secrets.md`, `docs/ops/environment.md`,
      `docs/development/cloud.md`, `infra/README.md` and
      `infra/terraform/README.md` for the store and the verifier.
- [x] Update `crates/mkc-config/README.md` and `crates/mkc-api/README.md`.
- [x] Check every changed protocol page against the 250-line cap.
- [x] Update `plans/follow-ups/preview-sample-project-needs-log-access.md`:
      the password removes its need for log access to sign in, and its
      private Changes limit stays. Drop its option B, which used the random
      link value.
- [x] Update the other live references that the searches found:
      `crates/mkc-auth/README.md` and `infra/helm/mokly-cloud/README.md`,
      which the replaced ways name as crate and chart READMEs, the plan rule
      in `billing.md`, the account link in `platform-model.md`, the cloud
      protocol index, and the cutover check in
      `docs/ops/repository-cutover.md`.
- [x] Move the shared error state of failed callback landings from the
      removed Preview Callback section into the Desktop Callback section of
      `auth-callbacks.md`, because the desktop landing uses it.

## Milestone 3: API password exchange

Depends on: 2

The API checks a typed password against an optional verifier. The `{secret}`
exchange and its setting go. Every consumer of the `{secret}` body moves in
the same milestone, so the app, the smoke scripts and the local stack keep
building and passing. Reason, my call of 2026-11-25: the regenerated app
types drop `secret`, so the preview callback page and the test servers stop
compiling unless they move together.

- [ ] Add `MKC_PREVIEW_SIGN_IN_VERIFIER` to `mkc-config`, with the email,
      capability and bound rules of the design. Remove
      `MKC_PREVIEW_SIGN_IN_SECRET`, and let the email alone configure the
      shared account and the seed.
- [ ] Add the `scrypt` crate to `mkc-auth` with `cargo add`, on the `digest`
      generation of the locked `sha2` and `hmac` crates.
- [ ] Accept `{password, returnTo}` in `POST /v1/auth/preview`, with bounded
      hashing, and remove the `{secret}` body and its check. Keep the order of the gate, Origin, body and admission
      checks.
- [ ] Regenerate `docs/api/openapi.json` and
      `packages/app/src/api/generated/schema.ts`.
- [ ] Add the `preview-verifier` command to
      `infra/scripts/preview-lifecycle.py`, with Python's `hashlib`. It trims
      the password, as Sign in does.
- [ ] Add the shared fixture under `infra/tests/fixtures/`: a fixed password
      and a verifier made from it by hand with `hashlib.scrypt`.
- [ ] Map Secret `preview-sign-in` to `MKC_PREVIEW_SIGN_IN_VERIFIER` in
      `infra/docker/entrypoint.sh`, and update
      `infra/e2b/tests/assert_build_template.py` and
      `infra/tests/test_preview_runtime.py`.
- [ ] Change `scripts/cloud/dev-api.sh` to the local password of the design.
      Change `smoke_api.py`, `smoke_desktop_origins.py` and
      `smoke_preview_plan.py` to sign in with a known test password and its
      verifier.
- [ ] Change the app's test API server, `packages/app/src/_tests_/api-server.ts`
      and `publication-runtime.ts`, to a known test password and its
      verifier.
- [ ] Remove the page `/auth/preview/callback`, its route and input code,
      `verifyPreviewSignIn` in `packages/app/src/data/auth.ts`, and its
      cases in `preview-callback.spec.ts`, `callback-address.spec.ts` and
      `callback-input.test.ts`.
- [ ] Remove `preview-callback.spec.ts` from the test list of the active plan
      `plans/loading-states-match-content.md` when the spec goes.
- [ ] Remove or narrow each status line that links this milestone: search
      `docs/` and every `README.md` for `#milestone-3-api-password-exchange`.
      Also narrow the status lines that name the preview callback page, which
      this milestone removes.
- [ ] Tests, each at the lowest level that fails without the change:
  - [ ] Configuration: a verifier without the email, without the capability,
        malformed, or outside the bounds fails startup with a typed error
        that names the key.
  - [ ] The shared fixture: its password matches its verifier in Rust and in
        Python, and another password does not.
  - [ ] The Python command makes a verifier that the Rust check accepts for
        the trimmed password, and it warns on a short password.
  - [ ] The exchange signs in with the right password, refuses a wrong one
        with `magic-link-invalid`, and refuses a password without a
        verifier.
  - [ ] A body without a password, with a `secret`, or with a password over
        1024 bytes fails with `validation-failed`
        and uses no admission. A wrong password uses admission, and the 21st
        attempt in the window is refused.

## Milestone 4: Configuration answer

Depends on: 3

The API tells the app which optional configuration it has, the preview
password and its account included.

- [ ] Add `GET /v1/configuration` and its contract, built from the list of
      the operation gate. Regenerate the OpenAPI document and the generated
      types.
- [ ] Tests: each field follows its configuration, the preview password
      answer names the account only with a verifier, and production settings
      give no preview password.
- [ ] Remove or narrow each status line that links this milestone: search
      `docs/` and every `README.md` for `#milestone-4-configuration-answer`.

## Milestone 5: Store, deploy, comment and local stack

Depends on: 3

The release job copies the verifier into each preview, and the comment loses
its link. A branch that has not merged this change gets a verifier that its
older API refuses at startup, so it must merge `main` to deploy. Cal accepted
this on 2026-11-24: "I don't care about backwards compat".

- [ ] Declare the Secret Manager ID `mkc-preview-sign-in-password` in
      `infra/terraform/foundation/preview.tf`, with read access for the
      deploy identity, and update its contract test.
- [ ] Change `preview-common.sh` and `preview-deploy.sh`: read the verifier
      privately, validate it, write or delete the verifier in Secret
      `preview-sign-in`, restart the API only when Helm did not roll it, and
      warn on a missing or malformed verifier. Remove the random value.
- [ ] Mount Secret `preview-sign-in` as optional in the chart's PR overlay.
      Update the Helm golden file.
- [ ] Remove the Open preview link, `--secret-file` and the
      `repository_private` input from `preview-comment.py`,
      `preview-event.py` and `preview.yml`, with their tests.
- [ ] Tests: shell tests in
      `infra/tests/` cover the write, the unchanged value, the restart rule,
      the deletion, and the missing and malformed verifier.
- [ ] Build and test the two rules that the Deploy and Password And Rotation
      sections of `docs/protocol/cloud/preview-sign-in.md` add: a read that fails for a cause other than a missing version
      warns and leaves Secret `preview-sign-in` unchanged.
- [ ] Remove or narrow each status line that links this milestone: search
      `docs/` and every `README.md` for
      `#milestone-5-store-deploy-comment-and-local-stack`.

## Milestone 6: Sign-in password section

Tags: ui

Depends on: 1, 4

The app draws the section as the mockups show and sends the password.

- [ ] Add the password call and the configuration read to
      `packages/app/src/data/auth.ts`.
- [ ] Draw the section in `packages/app/src/screens/account/entry-screen.tsx`
      from the `@firna/ui` and app components, as the mockups show. Keep the
      file under 300 lines.
- [ ] Give `packages/app/src/components/field.tsx` a `password` type, as
      `docs/mockups/src/components/input.tsx` draws it: masked, with
      `autoComplete="current-password"`, and without autocapitalize,
      autocorrect or spellcheck.
- [ ] In `docs/mockups/src/_tests_/owners/account.ts`, replace the pending
      owner of the four `product/account/sign-in/preview-password` pages with
      the app file that draws the section. Move `previewPassword.refused`
      into `fieldRefusals` in `docs/mockups/src/fixtures/product-states.ts`,
      with its home in `docs/mockups/src/_tests_/app-parity-copy.test.ts`. The
      label and copy parity checks then cover the section.
- [ ] Tests: the section shows only when the configuration answer names an
      account, the trimmed password goes to the API with the page's
      `returnTo`, a refused password marks the field, and a success leaves
      for the answer's `returnTo`.
- [ ] Smoke-test the section against the local stack: sign in with the local
      password, and refuse a wrong one. Save screenshots under
      `.context/preview-password-sign-in/`.
- [ ] Update `packages/app/README.md`, whose Responsibilities still name the
      preview landing, for Sign in's password section.
- [ ] Remove or narrow each status line that links this milestone: search
      `docs/` and every `README.md` for
      `#milestone-6-sign-in-password-section`.

## Milestone 7: Verification, commit, review, and pull request

Depends on: every other milestone

- [ ] Run the targeted tests and the complete gate named in `AGENTS.md`.
- [ ] Commit with Conventional Commits and push the branch.
- [ ] Review the complete local diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings,
      then apply the fix rule: fix the `fix now` findings, record
      follow-up items under `plans/follow-ups/` for the rest, re-review
      once, and report.
- [ ] Add a follow-up item: the GitHub sign-in notice, the App install
      screen and the Billing pane read `GET /v1/configuration` before a
      press, in place of a refused request.
- [ ] Update `plans/follow-ups/preview-proof-runs-not-recorded.md`: no
      comment carries an Open preview link, and the shared account signs in
      with the preview password.
- [ ] Delete this plan when the `plans` skill says, under "Deleting the
      plan".
- [ ] Open the pull request. Its description gives the decisions and the
      design calls of this plan with their dates, a permalink to this plan,
      and the follow-up items that the change adds.

## Post-merge follow-up (non-blocking)

The release job runs the scripts of `main`, so a preview uses the new deploy
only after the merge.

- [ ] Let the Foundation workflow apply the new Secret Manager ID. Then make
      the password and its verifier, add the verifier as the first version,
      and put the password in the team's password manager.
- [ ] Deploy one labelled PR. Sign in with the password, and check that a
      wrong password is refused.
- [ ] Rotate the password once, rerun the workflow, and check that only the
      new password signs in.

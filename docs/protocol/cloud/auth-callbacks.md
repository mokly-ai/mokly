# Authentication Callback Landings

Email, the preview sign-in link, GitHub identity authorization and GitHub App
setup return to separate application routes. A landing never guesses its
provider from a shared query,
and `/auth/callback` is not a route. The API is the only authority that
consumes credentials, binds a GitHub flow or chooses the stored `returnTo`.

## Routes

| Route                    | Browser input                                                                                | API call                                                                                            | Completion                                                                                     |
| ------------------------ | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `/auth/email/callback`   | One `token` in the fragment; `client=desktop` in the query selects the handoff               | `POST /v1/auth/callback` with Origin                                                                | Adopt the session and replace with the returned `returnTo`                                     |
| `/auth/preview/callback` | One `secret` in the fragment                                                                 | `POST /v1/auth/preview` with Origin                                                                 | Adopt the session and replace with the returned `returnTo`                                     |
| `/auth/github/callback`  | One `code` and `state` in the query                                                          | `POST /v1/auth/github/callback` with Origin, plus session CSRF for a connected or installation flow | Adopt the rotated session and replace with the returned `returnTo`                             |
| `/auth/github/install`   | `installation_id` with `state`, `installation_id` without `state`, or `setup_action=request` | Callback POST for the stateful arrival; no API call for the other arrivals                          | Continue authorization, replace with `/install?installationId=<id>`, or draw the request state |

Every landing is an account-shell screen with a pending state and the exact
provider-specific recovery below.

## Address Cleanup

A landing's provider input leaves the address before the app router starts.
The cleanup removes the whole GitHub query, except that a stateless
`installation_id` arrival replaces the address with
`/install?installationId=<id>`. It removes the email or preview fragment while
keeping any query. It creates no history entry, never copies a credential into
a path or query, and sets a `no-referrer` policy on the GitHub landings. No
address a landing's document takes after it loads carries its credential.
The email landing reads exactly one `client` value from the query it kept.
It is the only query the API puts on an email link.

Each landing takes its input exactly once. A landing reached any other way,
including a reload, has no input, which is the missing-input recovery below.
The landing paths are exactly the paths of the links the API issues.

## Tab-Scoped GitHub Flow State

The originating screen keeps the response's `state` and `codeVerifier` in
browser storage scoped to that tab before leaving for GitHub in the same
window. Each record has one purpose:

| Purpose                    | Written by                           | Consumed by             |
| -------------------------- | ------------------------------------ | ----------------------- |
| Logged-out sign-in         | Sign in or sign up                   | `/auth/github/callback` |
| Signed-in connection       | Account settings                     | `/auth/github/callback` |
| Installation setup         | `/install`                           | `/auth/github/install`  |
| Installation authorization | `/install` or `/auth/github/install` | `/auth/github/callback` |

Starting a new GitHub trip replaces every GitHub flow record in that tab. In
the desktop shell the provider's return is rewritten onto the desktop origin
by the shell's navigation rule, and the window is one tab, so the record is
read exactly as here. The installation landing consumes the setup record,
posts the installation callback, then stores the returned state and verifier
as the installation authorization before leaving for GitHub OAuth, because App
setup and user authorization are two provider returns in one server-side
installation flow. A candidate flow started on `/install` stores the returned
state and verifier as installation authorization directly. Browser storage
never holds an OAuth code, installation ID,
authorization URL, `returnTo`, session or CSRF token.

Each landing requires exactly one non-empty value for every required query or
fragment field. It compares query `state` with the relevant stored state before
calling the API. Missing, malformed, duplicate or mismatched values are a local
invalid-flow recovery: no request is sent. Initializing a landing consumes its
matching record; an invalid GitHub callback clears all callback-purpose records
in that tab, while an invalid installation return clears the setup record.
Reload therefore cannot replay browser-held flow material. API state,
verifier, expiry, session binding and CSRF checks are authoritative.

A GitHub identity return with matching stored state and either provider
`error` or no `code` is a local provider refusal. It never reaches the API and
uses the matched sign-in, connection or installation-authorization purpose to
choose recovery before consuming the matching tab record.

## Email Callback

The email landing takes the `token` captured from its fragment and posts it
once. Success adopts the session, validates the API's stored `returnTo` with
the shared validator and replaces the route.

| State                              | Screen title                      | Message                        | Action               |
| ---------------------------------- | --------------------------------- | ------------------------------ | -------------------- |
| Pending                            | `Signing you in`                  | Progress indicator only        | None                 |
| Success                            | No rendered state                 | None                           | None; route replaced |
| Missing or `magic-link-invalid`    | `This link isn’t valid`           | `Request another sign-in link` | **Back to sign in**  |
| `magic-link-expired`               | `This link has expired`           | `Request another sign-in link` | **Back to sign in**  |
| `magic-link-used`                  | `This link has already been used` | `Request another sign-in link` | **Back to sign in**  |
| Any other API or transport failure | `We couldn’t sign you in`         | `Request another sign-in link` | **Back to sign in**  |

**Back to sign in** is the sole primary action and goes to `/sign-in`. An API
failure also shows its error details; missing local input has none.

When the query carries exactly one `client=desktop` outside the desktop shell,
the landing holds the token in memory and renders the handoff instead of
posting it. Inside the shell it ignores the query and exchanges the token:

| State                      | Screen title        | Message                                       | Actions                                      |
| -------------------------- | ------------------- | --------------------------------------------- | -------------------------------------------- |
| Handoff (`client=desktop`) | `Finish signing in` | `You requested this link from the Mokly app.` | **Open Mokly**, then **Continue in browser** |

**Open Mokly** is primary, carries the external glyph and opens
`mokly://auth/email/callback#token=<token>` in the same tab, the address the
desktop shell accepts in [Desktop application](./desktop-app.md#sign-in-handoff);
the browser hands the address to the operating system and the page stays. It
is the package Button, which renders no anchor, so the address lives only in
memory: no `href` shows the token on hover or offers to copy it.
**Continue in browser** is secondary and posts the token exactly as the table
above does, so its outcomes are that table's. The landing never opens the
scheme on its own, renders no part of the token as text, and a missing token
with `client=desktop` is the ordinary missing-input recovery. The token is
single use, so whichever side exchanges it first wins and the other sees
`This link has already been used`. The document title is
`Finish signing in · Mokly`.

The handoff is a scheme link, not a device-code flow. The email link stays an
HTTPS page, because email clients do not open custom schemes reliably. The API
knows a link request from the shell by its Origin, so the request carries no
field, and the user agent decides nothing.

## Preview Callback

The preview landing takes the `secret` captured from its fragment and keeps it
only in memory after address cleanup. Success adopts the session, validates the
API's `returnTo` with the shared validator and replaces the route, as the email
landing does.

The account shell owns the one visible heading. Every failed preview state
then renders the shared error state: one problem glyph and one `role="alert"`
section, with no state title or body that repeats the heading. The recovery
action group follows that block. Request details, when present, are inside the
block as a closed **Details** disclosure. Each failed state's alert carries a
hidden announcement that equals the screen title exactly and leaves the visible
screen unchanged.

| State                                         | Screen title              | State block                                           | Alert announcement        | Actions                                 |
| --------------------------------------------- | ------------------------- | ----------------------------------------------------- | ------------------------- | --------------------------------------- |
| Pending                                       | `Signing you in`          | Skeleton; screen-reader-only `Signing you in…` status | None                      | None                                    |
| Success                                       | No rendered state         | None                                                  | None                      | None; route replaced                    |
| Missing secret                                | `This link isn’t valid`   | Problem alert only; no title, body or details         | `This link isn’t valid`   | **Back to sign in**                     |
| API `magic-link-invalid`                      | `This link isn’t valid`   | Problem alert with request details                    | `This link isn’t valid`   | **Back to sign in**                     |
| Other request failure with a request ID       | `We couldn’t sign you in` | Problem alert with request details                    | `We couldn’t sign you in` | **Try again**, then **Back to sign in** |
| Request or local failure without a request ID | `We couldn’t sign you in` | Problem alert only; no title, body or details         | `We couldn’t sign you in` | **Try again**, then **Back to sign in** |

While pending, the visible page says `Signing you in` only in its heading,
assistive technology still hears `Signing you in…`, and the skeleton stays
visible.

**Try again** is primary. Selecting it enters the pending state, waits until
any `Retry-After` deadline has passed, then re-sends the in-memory secret; a
new refusal replaces the displayed details. **Back to sign in** is secondary
and goes to `/sign-in`. The invalid state offers no retry and no request for a
new link. API error details contain `Reference <request-id>`; a local or
transport failure without a request ID omits the disclosure. The landing
shares the email landing's screen; no copy names an environment.

## GitHub Callback

The landing matches `state` against the sign-in, connection and installation-
authorization records. The matched purpose chooses the request headers:
logged-out sign-in sends Origin only; connection and installation require the
same live session and CSRF token used when the flow began. The GitHub landings
handle all four startup session states before making that choice: `loading`
keeps the pending state; `error` keeps the validated one-use attempt in memory
and offers **Try again**, which reloads the session without exchanging;
`signed-out` permits a logged-out sign-in but sends a session-bound connection
or installation to local recovery; and `signed-in` permits the flow to continue
with the headers its purpose requires. The callback always posts `code`, query
`state` and the stored `codeVerifier` to the one callback endpoint. It never
substitutes a query value for the verifier or the server-stored destination.

On success the callback adopts the returned session, including its rotated
CSRF token, then replaces the route with the validated returned `returnTo`.
Only the account pane starts a signed-in connection, and it stores the pane's
own address as that destination. The recovery mapping is deliberately small. A
known sign-in purpose returns to `/sign-in`, a connection purpose returns to
`/settings/account`, and an unknown local purpose also returns to `/sign-in`:

| Condition                                                               | Purpose            | Title                                                     | Action                  | Destination                       |
| ----------------------------------------------------------------------- | ------------------ | --------------------------------------------------------- | ----------------------- | --------------------------------- |
| Missing/mismatched local state                                          | Unknown            | GitHub sign-in expired                                    | **Back to sign in**     | `/sign-in`                        |
| Matching provider refusal or `github-auth-invalid`                      | Sign-in/connection | GitHub sign-in expired                                    | **Back to sign in**     | `/sign-in` or `/settings/account` |
| `github-identity-conflict`                                              | Sign-in            | This GitHub account is connected to another Mokly account | **Back to sign in**     | `/sign-in`                        |
| `github-identity-conflict`                                              | Connection         | This GitHub account is connected to another Mokly account | **Back to account**     | `/settings/account`               |
| `operation-unavailable`                                                 | Sign-in/connection | GitHub sign-in opens soon                                 | **Continue with email** | `/sign-in` or `/settings/account` |
| `internal-error`, provider/transport failure or an unrecognized refusal | Sign-in/connection | GitHub sign-in failed                                     | **Back to sign in**     | `/sign-in` or `/settings/account` |
| `github-installation-conflict`                                          | Installation       | This GitHub account is connected to another workspace     | **Back to install**     | `/install`                        |
| `permission-denied`                                                     | Installation       | You don’t administer this GitHub account                  | **Back to install**     | `/install`                        |
| Any other refusal                                                       | Installation       | Installation wasn’t completed                             | **Back to install**     | `/install`                        |

The `github-installation-conflict` state also shows the line "Remove it from
that workspace first." The `permission-denied` state shows no line.

API failures expose their request reference; a local validation failure has no
invented reference.

## GitHub Installation Setup

The stateful installation landing requires a signed-in session. It validates
the installation-setup record and positive base-10 `installation_id`, then
posts `installationId`, `state` and the stored `codeVerifier`. Success stores
the returned authorization flow as described above and continues to the
returned authorization URL in the same window. The next GitHub return lands on
`/auth/github/callback`; its successful `SessionIssued.returnTo` is the
destination originally stored by `POST /v1/github/installations`.

A stateless arrival has a positive `installation_id` and no `state`, without
`setup_action=request`. It does not call the API. It replaces its address with
`/install?installationId=<id>` without adding a history entry. The install
screen then requires a signed-in session and starts the candidate flow.

An arrival with `setup_action=request` takes precedence over the stateless
arrival and draws **Installation requested**. It
shows the line "An owner of the GitHub organization approves it on GitHub."
It offers **Back to install**.

Missing or mismatched local input and `github-auth-invalid` show
**Installation expired**. `operation-unavailable` shows
**GitHub installation opens soon**. Provider, transport and internal failures
show **Installation wasn’t completed**. Each offers only **Back to install** at
`/install`, and an API failure includes its request reference.

# Preview Sign-In

A [PR preview](./pr-preview-environments.md) signs in one shared account with
one shared password, the preview password. The same password works in every
preview, and each preview holds only a verifier of it. Every address, the
shared account included, can still sign in with an
[email link](./auth-sessions.md#magic-links), which a preview writes to its
log for the [log reader](./preview-scripts.md#sign-in-log-reader). The
[preview seed](./preview-seed.md) creates the account's sample data, and
[Authentication](./auth-sessions.md#sessions) defines the sessions that a
sign-in issues.

The preview password is the one preview credential. A one-click sign-in link
in the PR comment was rejected, because a value derived from the password is
the same after every label cycle, so a leaked link could not be retired. Real
email in previews was rejected, because it needs a mail provider secret in
every preview namespace.

## Account And Capability

`MKC_PREVIEW_SIGN_IN_EMAIL` configures the shared account. It is validated
and normalized like any account email, and it requires the named
`preview_sign_in` capability, which `MKC_ENV=preview` and `development` grant
and production never does. A malformed email, or the email without the
capability, fails startup with a typed configuration error that names the
key. Stable environments run with `MKC_ENV=production`, so no stable API
accepts a password. The preview [seed command](./preview-seed.md#seed-command)
finds or creates the configured account under the same settings and
capability, and it issues no session.

`MKC_PREVIEW_SIGN_IN_PLAN` is optional: `free` (the default when absent) or
`team`. It requires the email and the same capability. A plan without the
email, a plan without the capability, or an unknown value fails startup with
a typed error that names the key and never a value. At workspace creation the
API compares the creator's normalized email, read in that same transaction,
with the configured email. A match uses the configured initial plan; every
other creator uses `free`. This setting never changes an existing
workspace's plan. See [Billing](./billing.md#plan-catalogue) for the
consequences.

## Verifier

`MKC_PREVIEW_SIGN_IN_VERIFIER` is optional and holds one verifier of the
preview password. A verifier checks a typed password and opens nothing by
itself. It is the scrypt string of the PHC string format,
`$scrypt$ln=<ln>,r=<r>,p=<p>$<salt>$<hash>`: N is 2^ln, the salt is 16 random
bytes, the hash is the 32-byte scrypt output of the password's UTF-8 bytes,
and both are base64 with the standard alphabet and no padding. The verifier
requires the email and the same capability. Without it, the API accepts no
password, and the seed still runs.

The API accepts a verifier only with r = 8, 1 ≤ p ≤ 8 and 1 ≤ ln ≤ 16, so one
check uses at most 64 MiB. A malformed verifier, or one outside these bounds,
fails startup with a typed configuration error that names the key and never
the value, because a typing error in an operator's value must not take the
API's memory. The verifier carries its parameters and its salt, so the
trusted code that makes it and the API of a pull request agree on everything
except the algorithm. A bare hash with fixed parameters was rejected, because
both sides would then have to change together to raise the cost. scrypt was
chosen because it is memory-hard and Python's standard library has it, so
the trusted release job needs no third-party package.

Each preview holds the verifier, never the password, so neither namespace
read access nor the store gives the password away. The same plain password
in every preview was rejected for that reason.

## Password And Rotation

An operator creates the password once and keeps it in the team's password
manager. It is long and random, so a leaked verifier does not give it back.
`python3 infra/scripts/preview-lifecycle.py preview-verifier` reads the
password from standard input to its end and removes leading and trailing
white space, as Sign in does. It writes the verifier, with a new random salt
and ln = 14, r = 8 and p = 5, to standard output. It warns on standard error
when the password has fewer than 20 characters, and it never prints the
password.

The operator adds the verifier as a new version of the shared Secret Manager
ID `mkc-preview-sign-in-password`. Of the workflow identities, only the deploy
identity can read it. Every preview gets the same verifier. To rotate, the
operator adds the verifier of a new password as a new version. Each preview
takes it at its next deploy, and a rerun of the preview workflow deploys
again. Until then, a running preview accepts the old password. A rotation
leaves existing sessions in place. A label cycle ends them, because namespace
deletion removes every session.

## Deploy

The deploy reads the latest version of `mkc-preview-sign-in-password` into a
private mode-0600 runner-temporary file outside `.context/`, as it reads the
catalogue DNS token, and removes the file after use. It never prints the
value. Before the Helm upgrade, it writes a valid verifier with no newline to
key `preview-sign-in` of the namespace Secret `preview-sign-in` when the
stored value differs. The API mounts that Secret as optional and read-only at
`/var/run/mokly-secrets/preview-sign-in`. The entrypoint sets
`MKC_PREVIEW_SIGN_IN_VERIFIER` from a mounted value that starts with
`$scrypt$`. It ignores a mounted value without that prefix and warns with
the file name, so the API starts and accepts no password. The release job
never passes the verifier to the seed or to the comment.

The API reads its settings at startup. A deploy that changes or removes the
verifier saves a fresh, nonsecret rollout marker in the same Secret update.
Helm puts the marker in the API pod template, so an upgrade with a new marker
replaces the pod and waits for the replacement. An unchanged verifier keeps
its marker. Helm omits the annotation when the Secret has no marker. A rerun
after a Helm rollback uses the marker from the Secret.

When the store answers that the ID has no version, or the value is malformed
or outside the bounds of the API, the deploy writes a warning annotation on
the workflow run, one for each cause. It then deletes the verifier from
Secret `preview-sign-in` and continues, so a preview never keeps a verifier
that the store no longer holds. The preview then accepts no password, and the
shared account signs in with an email link. A failed deploy was rejected,
because it would hold every labelled PR until an operator adds a value. A
read that fails for another cause, such as a permission or transport error,
also warns and leaves Secret `preview-sign-in` unchanged, because a failed
read is not evidence of absence.

## Password Exchange

`POST /v1/auth/preview` accepts `{password, returnTo}`, with `returnTo`
optional, and requires an admitted Origin; like the magic-link exchange, it
cannot require a session CSRF token. The shared optional-operation gate runs
first. Without the shared account's configuration the endpoint answers 503
`operation-unavailable`, as unconfigured GitHub operations do, even when the
Origin and the body are invalid. Once configured, it validates Origin, then
its JSON body, then admission.

A body without `password`, or with a password outside 1 to 1024 UTF-8 bytes,
fails with `validation-failed` and consumes no admission, because it cannot
match.
[REST transport](./rest-transport.md) refuses unknown fields, such as
`secret`. Every attempt that passes the Origin and body checks consumes
admission: at most 20 per selected peer IP per 60 seconds in a persistent
fixed window. A rejected admission answers 429 `rate-limited` with a positive
`Retry-After` in seconds.

The API checks the password as sent, without trimming, against the verifier,
and compares the hashes in constant time. A wrong password, and any password
while the API has no verifier, answers `magic-link-invalid`, which already
covers a refused preview credential. The password is never logged. One API
process checks at most two passwords at once, and further attempts wait, so
the memory of concurrent checks stays far below the API's limit.

On success one transaction finds or creates the user with the configured
email, revokes a supplied existing session and issues a session exactly as
the magic-link exchange does: the same cookie, deadlines, CSRF token and
`SessionIssued` response under `Cache-Control: no-store`. Its `returnTo` is
the request's `returnTo` after the
[redirect rules](./auth-sessions.md#csrf-origins-and-redirects), or
`/dashboard` when that value is absent or rejected. This is the only account
created without email verification; knowledge of the preview password
replaces it, and only under the capability. The password leaves no expiry,
consumption or replay records, and its sessions follow the ordinary
lifetimes.

## Configuration Answer

The public [configuration answer](./rest-api-surface.md#configuration-answer)
carries `previewPassword`. When the API has the shared account and a
verifier, it is an object whose `account` is the configured email. Otherwise
it is `null`, so production and a preview whose deploy found no verifier
answer `null`. The field holds nothing secret.

## Sign-In Section

Sign in draws the password section only when the configuration answer names
an account. While the answer is read, Sign in draws its waiting form, which
has no section. When the read fails, Sign in draws email and GitHub sign-in
only. Sign up and the desktop app's window never draw the section, because
the password signs in an account that already exists and the window signs in
through the browser. A build flag in the app image was rejected, because it
can disagree with the API.

The section sits under Continue with email: a second `or` rule, the
**Password** field and the `secondary` action **Continue as** with the
account's address, such as **Continue as preview@mokly.ai**. Continue with
email keeps the one `primary` action. The labels name the account and never
the environment.
[Product mockups: account](./product-mockups-account.md#account-and-onboarding)
lists the drawings.

The app removes leading and trailing white space from the password, as it
does from the email, and sends it with the page's `returnTo`. The action is
disabled while the trimmed password is empty, as Continue with email is
while the address is empty. A
`magic-link-invalid` refusal marks the field with "This password isn’t
valid." and keeps the action's label, because the same password would be
refused again. Every other refusal shows beside the action, as every write of
the page does, and the action reads **Try again**. Success adopts the
session, validates the answer's `returnTo` with the shared validator and
replaces the route.

In a preview, the desktop panel moves up once when the answer adds the
section after the wait, because the panel is centred. Production draws no
section, so its panel never moves. A wait that holds the section's place was
rejected, because every production Sign in would then move instead.

## Security

The Sign-in page and the API of a preview run the pull request's own code, so
a hostile branch could capture a typed password. Only repository writers can
deploy a preview, and a preview is a trusted-code review environment, as
[PR preview environments](./pr-preview-environments.md#chart-values-and-runtime)
says. A leaked verifier, from logs, namespace read access or the store, opens
no preview, and the slow hash keeps a long random password hard to recover
from it. The password and the verifier never reach logs, evidence, artifacts
or the PR comment.

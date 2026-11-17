# GitHub App smoke procedure

The automated smoke uses native Postgres, a running API and a loopback GitHub
HTTP double. A live App requires credentials and a repository administered by
the operator; that part is a post-merge follow-up and has not been run here.

## Recorded smoke

Provide Postgres 16 with the `mkc_test` database and a role allowed to create
schemas. Install libpq and run from the repository root:

```sh
MKC_TEST_DATABASE_URL=postgres://postgres:postgres@localhost/mkc_test \
  RUSTC_WRAPPER= cargo test -p mkc-api --test github_tests -- --nocapture
```

Each test creates and removes its own schema. It applies the real migrations,
starts the API and its worker, and replays sanitized GitHub responses through
actual reqwest HTTP. Coverage includes verified email identity reuse, concurrent
OAuth consumption, installation administration proof, scoped repository/project
creation, all seven event families, renamed-push recovery, repository lifecycle
reconciliation from the recorded repository rename shape, new-repository
discovery under all-repositories selection, HMAC rejection, original bytes,
duplicate IDs, handler retries, expired leases, suspension, disconnect, uninstall
and workspace deletion after reconnect. No Docker or real App credentials
are required.

When `MKC_TEST_DATABASE_URL` or `CI` is set, an unreachable database fails the
suite. Only an unconfigured developer machine may skip with a printed reason.
The CI workflow provisions Postgres and explicitly supplies this variable.
The [fixture provenance](../../crates/mkc-github/fixtures/README.md) describes
the distinction between these examples and authenticated live recordings.
The [repository delivery source](../../crates/mkc-api/tests/fixtures/github/README.md)
includes its original `changes` and top-level `installation` fields. Stage 18
checks that every documented subscription has a delivery fixture.

## Register an App

Choose dedicated test accounts and a disposable repository. Use HTTPS tunnel
addresses that remain stable during the run. The app and API should use
same-site hosts, such as `app-smoke.example.com` and `api-smoke.example.com`,
so the existing SameSite=Lax session cookie works for browser API requests.
Forward the API host to local port 8080 and the app host to the Expo server on 8081. A tunnel/reverse proxy must preserve request body bytes and the GitHub
signature/delivery/event headers. This procedure does not require Docker.

Register at GitHub Settings → Developer settings → GitHub Apps → New GitHub App:

| Field                                          | Value                                                                                           |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| GitHub App name                                | A unique name identifying your smoke App                                                        |
| Homepage URL                                   | Your app HTTPS origin                                                                           |
| Callback URL                                   | `<app-origin>/auth/github/callback`                                                             |
| Setup URL                                      | `<app-origin>/auth/github/install`                                                              |
| Redirect on update                             | Enabled; `<app-origin>/auth/github/install`                                                     |
| Request user authorization during installation | Disabled                                                                                        |
| Expire user authorization tokens               | Enabled                                                                                         |
| Webhook URL                                    | `<api-origin>/v1/github/webhooks`                                                               |
| Webhook content type                           | JSON                                                                                            |
| Webhook secret                                 | Independent random secret, at least 32 bytes                                                    |
| Repository permissions                         | Checks write; Contents read; Metadata read; Pull requests write                                 |
| Organization permissions                       | Members read                                                                                    |
| Account permissions                            | Email addresses read                                                                            |
| Events                                         | Installation; installation repositories; repository; pull request; push; check suite; check run |
| Installation availability                      | Your test account, or any account if testing a separate GitHub organization                     |

Installation lifecycle events are supplied automatically by GitHub; select the
other events where its registration UI exposes them. Generate an App private
key and client secret, and record its numeric App ID, client ID and slug. Use
the environment variables listed in [GitHub App](../protocol/cloud/github-app.md).
`MKC_GITHUB_PRIVATE_KEY` contains the complete PEM text. Keep credentials outside
the checkout and avoid shell tracing, access-log request bodies and screenshots
containing OAuth codes or credentials.

Start the API with explicit origins, database and mail configuration:

```sh
RUSTC_WRAPPER= cargo run -p mkc-api -- serve
```

Its startup applies the new migration. GitHub routes return 503 when App
configuration is absent; partial configuration or an invalid private key fails
startup. Confirm the registration's initial ping receives 202.

## Sign-in and installation

Use one browser tab for the complete walkthrough so the app's tab-scoped state
and verifier survive each provider trip. Keep DevTools open to the Network
panel if request evidence is required, but never copy OAuth codes, state or
verifiers into the run report.

The walkthrough uses `cal`, `mokly-ai` and their repository names as examples.
Replace them with a personal test account, a GitHub organization test account
and disposable repositories that you administer.

1. Open `/sign-in`, choose **Continue with GitHub**, and authorize the App.
   GitHub must return to `/auth/github/callback`; the landing sends
   `POST /v1/auth/github/callback`, removes `code` and `state` from the visible
   URL and resumes the API's `returnTo`. Browser Back must not reveal or replay
   the callback query. Go Back and re-submit the landing; expect the
   **GitHub sign-in expired** recovery and no new session. Confirm the session
   email is GitHub's verified primary email. An account previously created by
   magic link with that email retains its UUID.
2. For the signed-in connection path, start from a magic-link session whose
   email differs from GitHub's verified primary email, open the account pane
   (`/settings/account`) and use **Connect GitHub**. The same callback
   landing must send the session CSRF token, rotate the session, retain the
   Mokly user ID and email, and return to the pane. A GitHub identity already
   linked to another Mokly user must show the documented account-conflict
   recovery instead of moving the identity.
3. Create a workspace named `App smoke`, continue to `/install`, and
   choose **Install on GitHub**. Install it on the personal account `cal` and
   select only `cal/release-notes`. GitHub
   must return setup to `/auth/github/install`, not the install screen. The
   landing sends `POST /v1/github/installations/callback`, removes
   `installation_id`, `state` and `setup_action` from the visible URL, and
   follows the returned authorization URL in the same tab. The final GitHub
   authorization returns through `/auth/github/callback` and resumes the
   stored product destination. Browser Back must expose neither provider
   query.

Verify `GET /v1/github/installations` and its `/{installationId}/repositories`
return the selected account/repository. Create a project with
`POST /v1/workspaces/{workspaceId}/projects`, supplying `name`, `slug`, the
repository's Mokly `repositoryId`, and `configPath: "mokly.config.json"`.
Repeat the request and expect 409 `duplicate-project`.
Selecting that repository from another workspace must return 404. A GitHub
member without active account administration must not complete installation
binding.

4. Add a second account to the same workspace. Open the GitHub accounts pane
   and choose **Add GitHub account**. Install the App on the GitHub organization
   account `mokly-ai`. Confirm that the
   workspace has two connected accounts and that the repository select has one
   section for each account. Confirm `cal/release-notes`, `mokly-ai/mokly-cloud`
   and `mokly-ai/mokly` stay under their account headings.
5. Open the App's Configure page on GitHub for `mokly-ai` and change its
   repository selection. GitHub must return to `/auth/github/install` with
   `installation_id` and no `state`. Confirm that the app replaces the address
   with `/install?installationId=<id>` without adding history. Choose the
   workspace and **Continue on GitHub**. Confirm that the repository snapshot
   refreshes and the app returns to the stored destination.
6. Start an installation from GitHub's App page without first opening Mokly.
   GitHub must return to `/auth/github/install` without `state`. Confirm that
   the app reaches `/install?installationId=<id>`. Choose the workspace that
   owns the account and continue on GitHub. Confirm that the existing binding
   refreshes.
7. Create a second workspace and start the same candidate flow there. Complete
   the GitHub authorization for the account already held by the first workspace.
   Confirm the recovery title **This GitHub account is connected to another
   workspace**, the line "Remove it from that workspace first.", and
   **Back to install**. Confirm that the original workspace still owns the
   installation.

## Delivery and recovery assertions

1. Push a commit to a branch, open a PR, change its title and push another
   commit. Check GitHub Recent deliveries for 202 and inspect branch/PR state.
2. Add/remove a repository selection. Confirm listing reflects current access.
   Rename it, transfer it between test accounts, and change visibility; confirm
   `repository` deliveries for `renamed`, `transferred`, `privatized` and
   `publicized` refresh the listed name/privacy. Push after a rename and verify
   processing completes on its first attempt using the new name. Archive it,
   then unarchive it; both actions reconcile current selection. With an
   all-repositories installation, create a repository and confirm its `created`
   delivery makes it listable without waiting for `installation_repositories`.
   Delete it; `deleted` reconciles selection and retains project history.
   Use another selected repository for the remaining checks.
   Suspend the App and confirm that its row remains in the GitHub accounts pane
   with **Suspended** and **Resume on GitHub**. Confirm that the link opens a new
   tab. An owner or admin can start an installation flow while that binding is
   suspended. A member's direct flow-start request still returns 403
   `permission-denied`. Resume on GitHub and confirm the row has no state word.
3. Redeliver a successful delivery. Its attempt count and stored effects must
   remain unchanged. Change one byte when manually replaying a signed body;
   expect 401 `webhook-signature-invalid` and no inserted delivery.
4. Stop the API, cause a delivery failure and restart it. Redeliver through
   GitHub. Retained pending rows must process; expired processing leases recover
   within five minutes. Inspect failure categories without dumping raw bodies.
5. Once the publication worker supplies an actual Mokly check, rerequest it
   from GitHub and confirm its persisted rerun flag. M8 alone does not create
   a product check; the recorded smoke verifies this persistence boundary.
6. Disconnect through `DELETE /v1/github/installations/{installationId}`. The
   project remains; repository-selection deliveries do not reconnect it. Uninstall
   the App on GitHub and confirm inactive installation/repository state.

Restricted database inspection, using the configured database:

```sql
SELECT id, event, status, attempts, due_at, lease_until, last_failure
FROM github_webhook_deliveries ORDER BY received_at DESC LIMIT 20;
SELECT github_id, account_name, active, connected FROM github_installations;
SELECT full_name, private, active FROM github_repositories;
SELECT number, open, merged, head_sha FROM github_pull_requests;
SELECT name, head_sha FROM github_branches;
SELECT github_id, head_sha, rerequested FROM github_check_runs;
```

Record delivery IDs, expected/actual statuses and test commit SHAs in the manual
run report. Uninstall the test App, stop tunnels and revoke its credentials when
finished. Keep any follow-up item for this live smoke under
[`plans/follow-ups/`](../../plans/follow-ups/) open until the operator records
these results; never treat recorded fixtures as proof of live authorization.

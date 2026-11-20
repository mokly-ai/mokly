# Architecture: Data Flows

This page is part of the [architecture doc](./cloud.md). It
describes the flow of data across the boundaries between the components
that the architecture doc names.

## Publishing

1. The producer runs `mokly publish`, in CI with a project publishing token
   or in a build sandbox with a build-scoped token. It builds the catalogue
   and sends the plan: the upload envelope, the ownership marker, and the
   catalogue index, whose records carry the Changes against the branch's base.
2. The API validates the plan within its limits, records the upload attempt,
   and reserves a blob reference for every file hash the project does not
   hold yet.
3. The producer uploads the missing blobs by hash; the API stores each one
   and marks it durable.
4. The producer completes the upload. The API verifies that every referenced
   blob is durable, makes the publication ready in one transaction, points
   the branch alias at it, and appends the ready event.
5. The check delivery loop reads the event and creates or updates the head
   commit's `Mokly` check run with the Changes count and links into the
   hosted viewer.
6. The ready publication stays until its project or workspace is deleted.
   Maintenance later closes abandoned attempts and removes old failed ones,
   and blob collection removes objects that no publication references.

A cloud build starts when a push to the default branch or a pull request
reaches a project linked to the GitHub App with Automatic builds on, or when
a reader requests or re-runs a build. An API replica's build worker claims
the build, mints its token, and runs the producer in a sandbox; the build's
check outbox posts the `Mokly` check for each build state.

## Viewing

1. The browser requests the public origin. The router hands the site's paths
   to Pages and every product path to the app.
2. The app resolves the readable address to a workspace, a project, and
   a selection, and reads branches, pull requests, history, and screens from
   the API with the session cookie.
3. The app reads the catalogue index and the entry details from the
   publication's host on the catalogue origin and passes them to the viewer.
   The viewer loads the screen frames from the same host. For a
   private project the app first obtains a one-use grant from the API, and the
   catalogue host exchanges it for its own cookie.
4. The viewer's chrome writes the selection back to the address, so a link
   or a browser history entry reopens the same view.

## Sign-in and accounts

A reader signs in with a magic link, sent through Postmark from a template
generated out of the mockup catalogue, or with GitHub OAuth. Either path
issues one session cookie; browser mutations also carry a CSRF token. The
desktop app signs in through a Mokly page in the browser, which hands a
one-use desktop grant to the app through the `mokly` scheme; the app exchanges
it for its own session, and its GitHub setup opens on the web. A
workspace connects a GitHub installation; its repositories become projects,
and the installation's webhooks keep branch and pull request state current
through the durable delivery queue.

## Billing

An owner starts Stripe Checkout or the Portal from the settings dialog. Stripe
reports the outcome through signed webhooks that land in the durable delivery
queue. The billing delivery worker derives the workspace's plan from the
subscription status, and the seat reconciler keeps the billed quantities equal
to the seats in use. Plan-gated writes check the stored plan inside their own
transaction.

## Deployment

The repository gate builds and verifies every push. A merge to `main` first
applies the saved foundation Terraform plan: the shared platform, its IAM and
the CI identities. The Deploy run of the same commit builds the three workload
images while it waits for that apply. It then deploys the Worker, applies the
saved Terraform plans for the stable environments, syncs the email templates to
Postmark, releases the Helm charts and runs the smoke checks against each
rollout. The site workflow deploys the site from the same merge without that
wait. A labelled pull request gets its own preview namespace with its own
Postgres and blob prefix on the shared preview platform, seeded with a sample
project, and cleaned up when the label or the pull request goes away.

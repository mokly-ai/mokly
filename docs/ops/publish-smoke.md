# Publication Smoke

Run the required fixture and published-CLI integration with native Postgres 16,
`psql`, Python 3, Node/npm, and the repository's Rust toolchain. No Docker is
needed. The process smoke creates a unique Postgres schema, uses temporary
storage and API-created projects/tokens, then drops the schema after its child
processes exit.

The published-CLI path installs `@mokly/mokly@latest` from npm in an isolated
prefix. It records that version and runs its executable against the frozen
v0.19 source fixture on a clean committed checkout.
Neither path turns a current-only upload into an
available `listScreens` or screen-specific Share API response; those paths
remain `operation-unavailable` under the comparison-only API projection
defined by the read-model contract.

```sh
npm ci
RUSTC_WRAPPER= \
MKC_TEST_DATABASE_URL=postgres://postgres:postgres@localhost/mkc_test \
  cargo test -p mkc-catalogue-server --test publish_tests -- --nocapture
RUSTC_WRAPPER= \
MKC_TEST_DATABASE_URL=postgres://postgres:postgres@localhost/mkc_test \
  cargo test -p mkc-publications --test maintenance -- --nocapture
RUSTC_WRAPPER= \
MKC_TEST_DATABASE_URL=postgres://postgres:postgres@localhost/mkc_test \
  cargo test -p mkc-api --test github_tests check_delivery_tests -- --nocapture
```

The first test launches the real API and catalogue application factories in
separate child processes on ephemeral loopback listeners. It supplies shared
local storage and a test-only signing key. Real sessions and project tokens
come from HTTP endpoints. A run owns both its schema and a fresh temporary blob
directory, so it never changes durability markers belonging to another suite.
It publishes through the
[upload exchange](../protocol/cloud/publication-upload-exchange.md) and then:

1. Holds two plan streams open, verifies admission returns 503 for a third
   plan, and proves disconnects cannot publish a catalogue.
2. Revokes a token during an admitted plan and verifies that the completed
   plan body is rejected before it reserves anything.
3. Exercises plan HTTP 426/400/401/403/413 with the Milestone 6 fixture and
   malformed variants: marker versions, marker entry limits and grammar,
   envelope identity, an extra plan file, an undeclared envelope digest,
   reserved hosting paths and a missing or invalid catalogue index. Every
   rejection that keeps
   an authorized head identity delivers one failure check to the injected
   provider double; unauthorized envelopes retain no head. The driver supplies
   its project through `MKC_SMOKE_PROJECT_ID` and the expected check count
   through `MKC_SMOKE_FAILURE_CHECKS`; the worker filters pending events before
   its batch limit. Repeat this test against the same database without
   resetting it, including after other publication suites.
4. Runs the blob and completion status matrix on one attempt: wrong media
   type, missing or oversized `Content-Length`, a query string, a size or
   digest mismatch, an unreserved or malformed hash, unknown attempts, an
   early completion (409) and a completion body. It then stores every missing
   file, repeats one PUT, completes twice with the same 201 receipt and
   receives 410 for a PUT after completion. A durable reserved file answers
   204 without a second object. It also sends a gzip Blob through the local
   receiver, verifies the decoded bytes and digest, and checks that an invalid
   gzip body stores nothing. A token revoked between plan, blob and completion
   is refused.
5. Races two complete exchanges of the same head, verifies one 201 and one
   superseded 200 with the same receipt, repeats both completions, and checks
   that replay plans list nothing, one ready winner and exact database
   reference counts. It reports the retained API database connections after
   the eight-worker writes and enforces the eight-connection application pool
   plus the separate one-connection health bound.
6. Exchanges one-use grants; fetches index HTML, a real screen fragment,
   `404.html`, unknown routes and HEAD metadata; verifies expired grants,
   tampering and removed membership fail.
7. Verifies public immutable blob URLs, control-file denial, branch aliases,
   stale-cookie clearing, and cascading project cleanup. After a newer
   different-head publication and an unfinished attempt, the real retention
   worker runs 31 days later. It keeps every ready publication and fails the
   unfinished attempt, whose completion and PUT then answer 410. A same-head
   replay of the original catalogue returns the same ready publication; its
   plan lists no missing files and its plan event reports zero objects and
   zero bytes written. The original and newer catalogue URLs both return 200.
8. Publishes the fixture again in a second project, which plans every
   catalogue file as missing; the first project's bearer receives 404 for the
   second project's attempt. Each project keeps and collects its own copy.
9. Copies the version-owned `scripts/cloud/fixtures/publication-smoke-v0.19/`
   authored fixture into an isolated Git repository under `.context`. The
   [fixture README](../../scripts/cloud/fixtures/publication-smoke-v0.19/README.md)
   gives the strict validation build and the two source-only commits. Require
   a clean checkout before running the published CLI twice.

   ```sh
   "$SMOKE_CONSUMER/node_modules/@mokly/mokly/bin/mokly.mjs" publish --strict \
     --config mokly.config.json --base HEAD~1 \
     --repository github.com/mokly-ai/mokly-cloud
   ```

   `SMOKE_CONSUMER` is the smoke's isolated installation prefix. Every build,
   publish, and recording command uses its one executable. The smoke rejects
   linked packages, linked executables, and paths outside that installation.
   It records the version from the installed package.
   `MOKLY_ENDPOINT` is the exact local
   `/v1/projects/<project-id>/publications` URL on the API's
   `MKC_API_ORIGIN`; `MOKLY_TOKEN` is a real project token passed only through
   the subprocess environment. The smoke reserves the API's loopback port
   before starting it so the plan's blob and completion URLs share the
   endpoint's origin, as the CLI requires. The isolated installation supplies
   the checkout's dependencies. The fixture imports no private npm workspace package.
   `publish` has no `--out`: it builds in a private directory outside the
   checkout and removes that directory after success. The smoke
   creates `.context` itself, because `build` output must stay inside the
   repository.
   `--base HEAD~1` compares the two clean committed revisions, and the CLI
   renders the base side from the first commit's sources. The
   smoke requires a stored upload envelope 3 with the installed version and a
   catalogue index 9 whose Changes count includes the changed screen.
   It compares the served files byte for byte with a strict
   build of the same commit and base. The second run
   reports `Mokly catalogue already published for this commit.` and leaves
   one ready
   publication. The explicit canonical repository identity keeps the smoke
   valid in nested local clones.

The smoke fixture is source-only.
The tests in `scripts/cloud/_tests_/publication_smoke_fixture_tests.py` require a
strict validation build of each temporary commit before the next step.
A failed first validation build must stop before the heading change
and before publication.
Keep the real CLI dirty-source refusal in the temporary repository; it still
proves that no API upload attempt occurred. The smoke compares that refusal
with its recording under `infra/tests/fixtures/catalogue-capture/`.
The CLI has no stale-output refusal, because no
generated output is committed.
Contract archives and JSON under `crates/mkc-mokly-contract/fixtures/` remain
committed golden files checked byte for byte by the `cloud-fixtures` suite;
they are not generated
catalogue directories. See [Fixture regeneration](../protocol/cloud/mokly-fixture-regeneration.md).

The API can refuse an upload before the smoke has sent the whole request body.
The smoke then reads and checks that refusal, both in the HTTP exchange and in
the plain-socket token-revocation request. A status below 400 after a failed
send fails the smoke. A failed response read keeps the send error as its cause.
The tests in `scripts/cloud/_tests_/publication_exchange_tests.py` cover this
behavior. They use a local server that answers before it reads fixed-length,
chunked and plain-socket request bodies.

Repeating standalone `publish_tests` proves repeatability on one database; its
per-run schema also isolates it from retained publications, events and markers
owned by concurrent suites.

## Gzip Blob rollout

Phase 1 deploys the receiver decoder with `api.uploadBlobGzip: false` in every
environment. The Plan response stays raw-only. After the rollout, send a
known gzip Blob through the public preview API origin. Compare its
`Content-Encoding`, encoded `Content-Length` and raw body bytes with a direct
receiver or a temporary edge echo target. The API must accept the unchanged
encoded request and store the expected decoded digest. Keep the evidence in
`.context/gzip-blob-uploads-receiver/edge-phase-1.md`.

The repository has no local Cloudflare, GCE, or ingress-nginx edge. Do not add
a simulated edge test. Keep the API and loopback receiver tests automated and
keep this provider check as a preview operation.

The Mokly CLI, from 0.19.0, sends a gzip Blob body when the Plan lists gzip
and gzip is smaller. After phase 1 passes with that CLI, set the
switch to true in one preview environment. Run the published CLI smoke and
check that the Plan lists `["gzip"]`, a smaller Blob carries
`Content-Encoding: gzip`, an unhelpful compression stays raw, and completion
and catalogue reads succeed.
Enable stable environments only after this check. Rollback turns the switch
off first and keeps the decoder for the full sixty-minute upload lifetime.

The contract-fixture path always runs. The published-CLI path is also required
and fails with its actual exit/error output if the package, network, config or
renderer cannot run; it is not silently skipped. Before reading either fixture,
signing up or launching npx, missing dependencies fail with exactly one
actionable line:
`Missing publication smoke dependencies; run npm ci`. The frozen
fixture is the CLI smoke's sole authoring input; canonical catalogue and
worktree changes do not alter its version boundary. An explicitly configured
unreachable Postgres fails. Only an unconfigured developer machine may skip
with a printed reason. CI provisions Postgres and sets `MKC_TEST_DATABASE_URL` in
[ci.yml](../../.github/workflows/ci.yml).

The maintenance test uses isolated Postgres schemas and a real local file store.
It advances an injected integration-test clock, keeps every ready publication
on every branch, closes abandoned uploads, prunes old failed attempts, and
collects only unreferenced or orphaned content. Ready publication bytes remain
readable. It also checks conditional state transitions, ready idempotency and
exact incarnation tombstones. Schemas and temporary directories are removed
afterward.

## Interactive Local Procedure

Start `scripts/cloud/dev-api.sh` and `scripts/cloud/dev-catalogue.sh` in separate terminals.
They share `.context/catalogue-signing-key` and `.context/blobs`. Obtain a session
through the logged development sign-in link; create a workspace, repository
project and publishing token through the API as documented in OpenAPI.
If local publication state needs resetting, clear `.context/blobs` and the
selected development database together. Resetting only one leaves database
durability markers and stored bytes with different histories. A `build`
output directory that the CLI's ownership marker does not authorize
cannot be replaced; move any files to keep, remove that directory and build
again.

Set `MOKLY_ENDPOINT` to that project's full upload endpoint on the API's
`MKC_API_ORIGIN`, which `scripts/cloud/dev-api.sh` sets to `http://localhost:8080`
(for example `http://localhost:8080/v1/projects/<project-id>/publications`),
and `MOKLY_TOKEN` to the returned secret; run the pinned command above, which
takes no output directory. The CLI sends its bearer only to blob
and completion URLs on its endpoint's origin, so an endpoint on `http://127.0.0.1:8080` fails
while the plan's URLs name `localhost`. Keep tokens out of shell history and logs. The CLI prints the
viewer URL, and the publication's catalogue uses the canonical
`p-<UUID>.localhost:8082` origin. Public project bytes can be opened
there directly. Private access uses an API-issued grant exchanged by an
exact-app-Origin JSON POST to `/_access`; the host-only signed cookie then
covers HTML, data, screen fragments and comparison files. A raw HTTP client
must preserve the canonical Host header when connecting to loopback.

## Clean-Checkout Failures

The CLI checks HEAD and Git status before its build and again before Plan.
`git-uncommitted`
means modified, staged, deleted, renamed, type-changed, unmerged or untracked
non-ignored files, including submodule changes, anywhere in the repository.
Commit, stash or ignore them. Mokly writes no generated output into the
repository: `publish` builds in a private directory outside it, and a `build`
output directory must be ignored. When a listed path lies under
a `build` output directory, the error names the `.gitignore` rule to add.
The canonical catalogue ignores its root `mokly-static/` build
output and commits authored source only.
There is no override; publishers commit before they publish and pass
`--strict`. The refusal stops before a receiver request. The CLI
smoke tests must assert the clean second commit and verify the refusal.

## Observed Results And Remaining Provider Smoke

On 2026-10-01 the delta cutover passed `publish_tests` and the viewer read
smoke with the actual `@mokly/mokly@0.13.0 publish` command: the first run
completed with 201 and served its index, screen fragment, fallback and pinned
review with export bytes; the repeated run completed with 200 and kept the
first publication.

On 2026-09-16 the first review revisions passed `RUSTC_WRAPPER= cargo xtask check`
with `MKC_TEST_DATABASE_URL=postgres://postgres:postgres@localhost/mkc_m9_revision`:
16 active stages passed, with app-tests and openapi-drift pending Milestone 12.
The Rust stage passed 262 checks. The browser suites passed 745 catalogue tests
and 8 viewer-journey tests, and stage 17 reproduced all six frozen fixtures.
The then-pinned single-archive `@mokly/mokly@0.9.0 publish` command exited 0
and its served index, screen fragment, fallback and pinned review matched
export bytes. The real retention worker allowed same-head republishing under a
new ready ID with HTTP 200 delivery. Four authorized rejected HTTP uploads
delivered failure checks through the provider double. Public stale cookies
were cleared while content still served; private stale cookies remained
denied.

An attempted system temporary output directory failed with
`[mokly/export-invalid] Export output resolves outside repoRoot through a symlink`.
The smoke now creates its own `.context` parent, as required by this release.
Use a fresh development database when moving between unmerged Milestone 9
migration revisions; the gate used a new task-owned database, leaving the
previous review database untouched.

The API now runs the check worker when the full GitHub App group is configured.
Every five seconds, it processes one publication batch and one publication
rerequest batch, each at most 100 rows. CI uploads to installation-linked
projects use the installation and canonical repository name. Projects without
a repository binding and disconnected or uninstalled Apps acknowledge events
without a provider call; suspension retries.

The `check_delivery_tests` smoke starts the real API with native Postgres and a
recorded GitHub HTTP double. It completes the upload exchange with real project
tokens, verifies create and same-run update, loses a create response and
recovers the stored provider run through the filtered list, and verifies
check-run and check-suite rerequests and unbound-project delivery. These are
recorded provider tests, not a live GitHub proof.

For a live check, configure the registered App and install it on a test
repository using [GitHub App smoke](./github-app-smoke.md). Create the project
with `repositoryId`, then publish a real commit with its project token. Verify
`delivered_at` for the publication's ready event and the matching
`mokly-publication:<id>` record in `github_check_runs`. On that commit or pull
request, open the `Mokly` check and its Changes link. Press Re-run and verify
that the same GitHub check ID gets the same result and its stored rerequest
mark clears. Inspect failures with [Check recovery](./check-recovery.md).
Use the test repository named in the
[build template runbook](./build-template.md#provision-and-enable-one-environment) for
this check. No live test is recorded in this checkout yet.

The requested CSP contains exactly `frame-ancestors 'self' <app-origin>`:
`'self'` lets the publication's standalone viewer frame its own documents, and
the one configured app origin lets the embedded cloud viewer do the same. No
wildcard, other publication origin or duplicate source is accepted.
The CSP permits standalone same-publication nested frames. The dated HTTP
smoke proves file delivery, not standalone browser interaction.
[Milestone 3](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/mokly-dependencies-upgrade.md#milestone-3-end-to-end-verification-and-review)
of the archived Mokly dependencies upgrade plan records the 0.14.0 viewer
interaction proof separately.

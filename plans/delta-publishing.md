# Delta Publishing

Replace the single-archive `mokly publish` upload with the content-addressed
delta exchange that Mokly Cloud is adopting: the receiver learns every file's
SHA-256 from the export ownership marker before any catalogue bytes are sent,
answers with the hashes it does not hold, receives only those files as blobs,
then commits. Nothing is live, so the single-archive exchange is removed, not
kept beside the new one. The cloud consumes this repository only through a
published exact `@mokly/mokly` version and its shipped protocol docs and
fixtures, so the protocol docs, the CLI and the release are the deliverable.

The normative requirements come from the user's brief (2026-09-26). Milestone 1
records them in the protocol docs so no later milestone needs the brief.

## Scope And Decisions

- **Versions.** The `mokly-upload.json` envelope stays `schemaVersion: 1`, so
  [`mokly-upload.md`](../docs/protocol/mokly-upload.md) keeps its title and
  slug. The ownership marker becomes schema 2 and its fixture becomes
  `export-ownership-v2.json`. The plan response has its own `schemaVersion: 1`
  and a new `upload-plan-v1.json` fixture.
- **No local v1 tolerance.** `mokly export` and `mokly publish` write schema 2
  and the local exporter accepts only schema 2 in an existing output directory.
  A stale v1 directory fails with an `export-invalid` message telling the user
  to remove it. This follows the "no backward compatibility" instruction;
  confirm if replacement of old v1 directories should be tolerated instead.
- **CHANGELOG.** `CHANGELOG.md` is release-PR owned by release-please
  ([release contract](../docs/protocol/npm-release.md#release-management)), so
  the entry is produced from the implementation commit's `feat(publish)!:`
  title and `BREAKING CHANGE:` footer, not by hand-editing the file. With
  `bump-minor-pre-major`, that commit yields the next minor (`0.13.0`).
- **Export fixtures.** This repository commits no export directories or
  archives containing a marker. "Regenerate every export fixture" therefore
  means: every test and packed-consumer smoke that writes or asserts a marker
  emits or expects schema 2 with real digests, through one shared helper.
- **GitHub Action.** `.github/actions/publish` forwards only its documented
  inputs; `--upload-concurrency` is CLI-only and the action gains no input.
- **`{sha256}` placeholder.** WHATWG URL parsing percent-encodes braces, so
  the CLI counts and substitutes the literal `{sha256}` on the raw `blobUrl`
  string, requires it inside the path (before any `?` or `#`), then parses the
  substituted URL for the origin check. Receivers emit unencoded braces.
- **Progress copy.** The rich upload progress line is
  `Uploading <n> of <total> files · <size>`. The counting rules below were
  replaced by [Review Fix Decisions](#review-fix-decisions) (counts and
  plurals): `<n>` counted completed blob uploads, `<total>` the files whose
  hash is in `missing`, `<size>` their total byte size in binary units,
  `<uploaded>` the marker entries whose hash was uploaded in this run
  (including a 409 re-plan), and `<unchanged>` the remaining entries.
- **Complete body.** `201`/`200` succeed regardless of body validity; the
  viewer URL line is printed only when `viewerUrl` is an absolute http(s) URL
  string in a JSON body of at most 16 MiB. Other fields are ignored. Any other
  2xx on Complete is `upload-failed`. A `200` means the receiver kept an
  earlier publication for the same `headSha` and `configPath`; the CLI then
  prints `Mokly catalogue already published for this commit.` instead of the
  counts (cloud decision, 2026-09-26).
- **Expiry and 410.** A `410` on a blob or Complete, or a locally reached
  `expiresAt`, is handled like `409`: one re-plan, then `upload-failed`. Mokly
  Cloud allows sixty minutes per upload, stores the plan-archive files at plan
  time so a replay yields an empty `missing`, and computes `missing` per
  project (cloud decisions, 2026-09-26).

## Review Fix Decisions

The user approved fixing every finding of the
[delta publishing review](../docs/reviews/delta-publishing.md) with its
recommended option (2026-09-26). Milestones 7–13 carry that work; `#n` refers
to finding _n_ of that review. These decisions settle what the
recommendations left open:

- **Counts (#3).** Counting is by digest. A marker entry is _uploaded_ when
  this command sent its digest, either as a file in a plan archive or through
  at least one blob PUT attempt in any round; every other entry is
  _unchanged_. The rich progress `<total>` for a round is the number of
  entries whose digest is in that round's plan archive or `missing`; `<n>`
  starts at the plan-archive entries and advances by every entry sharing a
  digest when that digest's PUT completes; `<size>` is the byte size of the
  round's distinct contents, plan-archive files included. A first publish to
  an empty receiver therefore reports `0 unchanged`, and a single-round
  progress label ends at the summary's `<uploaded>`. No progress label is
  shown for a round whose `missing` is empty.
- **Plurals and cancellation (#8).** `1 file uploaded`, `2 files uploaded`,
  `Uploading 0 of 1 file`; `unchanged` takes no plural. Serve's inline plural
  moves to the same helper. Cancelling publish keeps the `upload-failed`
  category but prints its own fixed message and, in rich mode, no connection
  hint; the transport failure's message and rich hint no longer repeat each
  other.
- **Repeated Complete (#2).** Complete is idempotent per upload: repeating it
  for an upload that already completed returns that upload's first status
  and body and never creates another publication. `200` means a different
  upload already completed a publication for the same `headSha` and
  `configPath`, which the receiver returns unchanged.
- **Over-limit marker entries (#9).** An integer `size` above 67108864 and a
  `path` over 1,024 UTF-8 bytes exceed limits: receivers answer `413`
  (`upload-too-large`), and the ownership fixture classifies them with a new
  `too-large` rejection. Malformed values (negative, fractional or
  non-numeric sizes, grammar violations) stay `400`/`422` (`invalid`).
  Receivers answer `missing` from blobs stored for the same project,
  including blobs received for an earlier upload that has not completed.
- **Path grammar (#1, #10).** One portability rule covers every exported
  path, marker entry and upload path: nonempty, at most 1,024 UTF-8 bytes,
  well-formed Unicode, no Unicode category Cc character (U+0000–U+001F and
  U+007F–U+009F), no leading `/`, no `\` or `:`, and no empty, `.` or `..`
  segment. Format characters such as U+200D are allowed. A marker in which
  one entry's path equals a directory prefix of another, compared after
  lowercasing, is invalid. A missing `schemaVersion` is invalid; any present
  value other than the number `2`, including the string `"2"`, is
  unsupported (426).
- **Deployment identity (#5).** The identity input excludes the ownership
  marker and the publication metadata files that an export adapter declares;
  publish declares only `mokly-upload.json`. The marker still lists and
  hashes the manifest.
- **Retries (#7).** Five attempts per request; the wait before attempt _k_
  (2 to 5) is a uniformly random duration up to 1 s × 2^(k−2), so at most
  1, 2, 4 and 8 seconds. The unreachable 16 s cap is removed.
- **Plan URLs (#12).** `blobUrl` and `completeUrl` must be absolute `http:` or
  `https:` URLs whose scheme, hostname and port equal the endpoint's, without
  userinfo; `blob:` and other schemes are rejected before any request.
- **Release (#15).** Squash-merge the pull request as
  `feat(publish)!: upload catalogue content deltas` and keep the
  `BREAKING CHANGE:` footer in the squash body, because release-please reads
  that squash commit on `main`. A new check enforces Conventional Commits pull
  request titles of at most 50 characters.

## Second Review Fix Decisions

On 2026-09-27 the user chose option B for finding 1 and option A for finding 2
of the [second review](../docs/reviews/delta-publishing.md#second-review). The
other nine second-review findings are not approved and stay open. Milestones
14–17 carry this work; `second #n` refers to finding _n_ of that review.

- **Typed cancellation (second #1).** A failure is a cancellation only when it
  is exactly the requested cancellation: a platform abort error (`name` is
  `AbortError`, as produced by `AbortSignal` and the Git runner) or a
  `MoklyError` marked as a cancellation where the cancellation was detected.
  The mark is set by the export's cancellation check, by baseline
  interruption, by publish's own cancellation, and by any wrapper whose only
  content is a cancellation (a successful rollback after cancellation, or the
  export's wrapper around a non-Mokly abort). It is never set on an error
  that combines a cancellation with another failure (rollback, backup or
  reservation cleanup), and a reader never infers it from `cause` chains,
  `AggregateError` members or messages. The publish identity readers rethrow
  a cancellation instead of reporting a Git failure.
- **Cancellation precedence (second #1).** `mokly publish` prints the
  cancellation output only for a cancellation. Every other `MoklyError`,
  including an export recovery error that names a backup or reservation path,
  is printed unchanged with its own category, whether or not the command was
  cancelled. Exit status stays 1. `mokly export` output does not change.
- **Deterministic tests (second #2).** Unit and browser tests depend only on
  the tree under test. They never read the real checkout's remote-tracking
  references (`origin/…`, `refs/remotes/…`, `FETCH_HEAD`, upstream settings);
  fixture repositories may create their own. The pull request title test
  keeps its fixed type list and its `AGENTS.md` example check and drops the
  `origin/main` history scan. A static test enforces the rule for every test
  source at `tests/test_repository_refs.test.ts`.

## Third Review Fix Decisions

On 2026-09-27 the user asked to fix the three
[third-review](../docs/reviews/delta-publishing.md#third-review) findings with
their recommended options: B + D for finding 1, B for finding 2 and B + C plus
the cheap cases of A for finding 3. Second-review findings 3–11 stay open.
Milestones 18–22 carry this work; `third #n` refers to finding _n_ of that
review.

- **Pre-installation cancellation (third #1).** Before the export's
  installation begins (publish configuration loading, repository identity,
  comparison preparation, compile, staging, capture and the input recheck) no
  backup or reservation holds the previous export. A failure in this window
  after the command's cancellation signal fired is a cancellation: it keeps
  its own code and message, so `mokly export` output is unchanged, and
  `mokly publish` prints the cancellation output. From the start of
  installation only the explicit marks of second #1 apply. A cleanup failure
  after a pre-installation cancellation still produces the combined recovery
  error.
  This window is the only place a cancellation is inferred from the signal,
  and the export recovery contract owns it. Spawned publish tests without
  `--no-changes`, for committed and derived catalogues, send SIGINT to the
  whole process group, as a terminal does.
- **Tree-only example tests (third #2).** The preview unit test and the
  browser suite's server compare the example against tree-owned bases, never
  `origin/main`. The preview test uses `createExampleBaseline` to make an
  isolated fixture repository from checked-out sources, then changes one known
  example input so its comparison assertions remain meaningful. The browser
  server uses the checked-out `HEAD`. CI removes remote-tracking references
  before the unit and browser suites and stops reading `origin/main` for the
  baseline lockfile, so a test that needs a remote reference fails in CI.
  Before delivery the unit and browser suites also pass in a local copy that
  has no remote-tracking references.
- **Remote-reference lint (third #3).** The static test is a best-effort lint
  behind CI's remote-free run. It takes the target repository only from `cwd`
  or `-C`; a Git call with neither targets the real checkout (the unit
  runner's working directory). It matches `origin/` and `remotes/` anywhere in
  an argument, `refs/remotes`, `-r`, `--all`, `--remotes`, `FETCH_HEAD`,
  upstream spellings in any letter case, and the `fetch` and `ls-remote`
  subcommands. The contract lists exactly what it recognises and what it
  cannot see.

## Fourth Review Fix Decisions

On 2026-09-27 the user asked to fix the seven
[fourth-review](../docs/reviews/delta-publishing.md#fourth-review) findings with
their recommended options: A + D for finding 1, B for 2, A for 3, B for 4,
A + B for 5, A for 6 and A for 7. Second-review findings 3–11 stay open.
Milestones 23–27 carry this work; `fourth #n` refers to finding _n_ of that
review.

- **Signal timing (fourth #1).** The window decides only after the event loop
  has processed every signal the operating system already delivered. When a
  window step fails while the command's signal is not yet set, the boundary
  lets the event loop complete one full turn that includes an I/O poll (for
  example two `setImmediate` hops) and checks again; there is no wall-clock
  delay. The recovery contract defines "after the signal fired" this way and
  lists every step the window covers exactly as implemented, including
  changed-path evidence, comparison generation, Changes and removed-page
  previews.
- **Shared remote-free script (fourth #2).**
  `scripts/verification/remove-remote-state.mjs` removes every configured
  remote (which also deletes its remote-tracking references and upstream
  settings), deletes any leftover `refs/remotes/*` without following symbolic
  references, deletes `FETCH_HEAD`, and fails unless no remote,
  remote-tracking reference or `FETCH_HEAD` remains. CI's unit and browser
  jobs and the documented local remote-free run use it.
- **Asserted preview edit (fourth #3).** The preview test asserts the exact
  changed count its edit produces, that Welcome is marked changed and that an
  unedited screen is unmodified.
- **One owner for CI caching (fourth #4).** `ci-verification.md` owns CI
  caching and Git history; `npm-release.md` links to it instead of repeating
  it, and the stale merge-base lockfile sentences are removed.
- **Lint precision (fourth #5).** The target comes from the last `-C` or
  `--git-dir` before the subcommand, else an inline `cwd` property, including
  shorthand `{ cwd }`. A call with no options argument, or an inline options
  object without `cwd`, targets the real checkout; an options argument that is
  not an inline object (a variable, spread or call) leaves the target unknown
  and is not flagged. The subcommand is the first argument after global
  options, skipping the values of `-C`, `-c`, `--git-dir`, `--work-tree`,
  `--namespace` and `--config-env`. `-r`, `-a`, `--all`, `--remotes` and
  `--remotes=…` count only for the reference-listing subcommands `branch`,
  `show-branch`, `log`, `rev-list`, `rev-parse`, `describe`, `name-rev` and
  `shortlog`. `ci-verification.md` documents the behaviour and blind spots
  without claiming completeness.
- **Keep-alive (fourth #6).** `mokly export` and `mokly publish` hold one
  referenced handle from installing their signal listeners until they finish,
  so Node cannot exit while an unreferenced helper process such as esbuild is
  still settling after Ctrl+C; the command ends with its normal Mokly output
  and status 1.
- **In-place marks (fourth #7).** Marking a failure as a cancellation never
  replaces it. The window marks the original `MoklyError` in a private
  registry that both `isCancellation` and `MoklyError.cancelled` read, so its
  class, fields, message and stack stay intact and `MOKLY_DIAGNOSTIC=1` shows
  the original stack. Non-Mokly failures keep the existing marked
  `Could not export catalogue` wrapper.

## Script Removal Decision

On 2026-09-28 the user judged `scripts/verification/remove-remote-state.mjs`
too dangerous and asked to remove it:
[fifth-review](../docs/reviews/delta-publishing.md#fifth-review) finding 1
showed that, run in a Conductor worktree or a copy of one, it deletes the
shared repository's remotes. Milestones 28–29 carry this work.

- Delete the script, its declaration file and
  `tests/verification_remote_state.test.ts`, and remove its step from CI's unit
  and browser jobs. No replacement cleanup step is added, in CI or locally.
- `ci-verification.md` keeps the rule that tests depend only on the tree under
  test and its two fixes: the example preview test builds a fixture-owned
  baseline, and the browser server compares with `HEAD`. It no longer promises
  a runtime proof that tests never read remote-tracking references; the static
  lint stays as the only automated guard and remains best-effort. CI keeps
  reading the baseline lockfile from the checked-out tree, not `origin/main`.
- This resolves fifth-review finding 1 and the script-specific parts of
  finding 2. The symlinked-path entry guard in finding 2 still applies to
  `scripts/verification/pull-request-title.mjs`, and fifth-review findings
  3–5 and second-review findings 3–11 stay open.

## Milestone 1: Protocol and guide contract — completed

Define the complete receiver and CLI contract before any code changes. Docs
and fixtures only; `cargo xtask check` is not required, validate Markdown with
Prettier and the guide-structure test.

- [x] Rewrite [`mokly-export-ownership.md`](../docs/protocol/mokly-export-ownership.md)
      as Export Ownership v2: the `{ path, sha256, size }` entry shape and
      TypeScript type, one entry per regular file except the marker including
      `mokly-upload.json`, writer sort order (JavaScript default string order),
      v1 path grammar, uniqueness and case-folded collision rules, 64 lowercase
      hex digest of exact bytes, integer size from 0 to 67108864, receiver
      validation (entry shape, hex grammar, size range, unique paths → 400/422),
      any other `schemaVersion` → 426 `upload-unsupported-version`, and the v2
      fixture format with an optional `rejection` field
      (`unsupported-version` | `invalid`) on invalid cases. Delete the v1 shape.
- [x] Rewrite the exchange sections of [`mokly-upload.md`](../docs/protocol/mokly-upload.md):
      `--upload-concurrency <n>` (1 to 32, default 8) in the CLI section; a
      Plan request (POST endpoint, gzip tar with exactly `mokly-upload.json`,
      `.mokly-export-artifact` and the `comparisonPath` review file, headers,
      the `200` JSON body and every field rule including sorted unique
      `missing` hashes present in the marker, absolute same-origin `blobUrl`
      with one literal `{sha256}` in its path and same-origin `completeUrl`,
      unknown fields ignored, 16 MiB body cap, non-JSON content type →
      `upload-failed`); Blob PUTs (headers, raw bytes, any 2xx stored, 400 →
      `upload-invalid-bundle`, 404 → `upload-failed`); Complete (POST with
      `Content-Length: 0`, `201` new, `200` existing publication for the same
      `headSha` and `configPath`, response body fields, 409 → one re-plan then
      `upload-failed`); Retries (408/429/500/502/503/504 and transport
      failures, five attempts, 1 s doubling to 16 s with full jitter,
      integer `Retry-After` up to 60 s, never after `expiresAt`); and the
      status→category table for every request. Delete the single-archive
      exchange and the "retrying is a new upload" caveat.
- [x] Revise the upload archive layout, validation and limits sections: the
      plan archive contains three entries at most; receivers verify blob bytes
      against the declared digest and size, require every marker hash before
      commit, and keep the 20,000-file, 64 MiB per-file, 1,024-byte path and
      16 KiB manifest ceilings. State the 120 s per-request timeout and that
      ownership-marker version failures are 426.
- [x] Update [`mokly-terminal-output.md`](../docs/protocol/mokly-terminal-output.md):
      publish phases and the in-place `Uploading <n> of <total> files · <size>`
      progress, the rich completion summary with counts, the exact plain line
      `Published Mokly catalogue. <uploaded> files uploaded, <unchanged> unchanged.`
      and the optional viewer URL line in both modes.
- [x] Update every remaining ownership/upload reference: [`mokly-export.md`](../docs/protocol/mokly-export.md)
      (public v2 schema, size ceiling enforced when writing the marker, stale v1
      directories rejected), [`mokly-export-delivery.md`](../docs/protocol/mokly-export-delivery.md),
      [`mokly-catalogue.md`](../docs/protocol/mokly-catalogue.md) and
      [`docs/protocol/README.md`](../docs/protocol/README.md) index entries;
      [`mokly-guides.md`](../docs/protocol/mokly-guides.md) needed no change
      because the Reference slugs are unchanged.
- [x] Author the contract fixtures now so the docs link to real files:
      `docs/protocol/fixtures/export-ownership-v2.json` (46 cases with real
      digests) and `docs/protocol/fixtures/upload-plan-v1.json` (65 cases);
      the v1 ownership fixture stays until Milestone 2 switches every reader.
- [x] Rewrite the guides [`cli/publish.md`](../docs/guides/cli/publish.md)
      ("What is uploaded" as the three-step exchange, retries, the counted
      success line and viewer URL line),
      [`ci/the-upload.md`](../docs/guides/ci/the-upload.md) (the three
      requests, the manifest, what a receiver must do, retries),
      [`ci/publish-from-ci.md`](../docs/guides/ci/publish-from-ci.md)
      (success line, retries), [`ci/project-tokens.md`](../docs/guides/ci/project-tokens.md)
      (token on every request) and [`ci/github-action.md`](../docs/guides/ci/github-action.md)
      (no concurrency input); keep the guide frontmatter, link and heading
      rules enforced by `tests/guides_structure.test.ts`. The
      `--upload-concurrency` rows for `cli/publish.md` and
      `cli/options-and-exit-status.md` wait for Milestone 3 because
      `tests/guides_cli.test.ts` requires every documented option to be
      parsed and listed in `--help`.
- [x] Update `tests/guides_ci.test.ts`, which checks the CI guides against
      the protocol doc and the transport: its doc-vs-doc assertions now
      expect the plan, blob and complete fences, retries and the
      regular-files-only rule, while its transport assertions still hold for
      the current single-archive request (same headers, exact endpoint, no
      redirect) until Milestone 3 replaces them.
- [x] Update [`.github/actions/publish/README.md`](../.github/actions/publish/README.md),
      [`src/publish/README.md`](../src/publish/README.md) and
      [`src/export/README.md`](../src/export/README.md) to name the delta
      exchange and the plan that lands it; the root `README.md` already
      described publish without naming the archive and needed no change.
- [x] Add this plan to `plans/README.md`; run `npx prettier --check` and the
      guide-structure test on every changed file and review the diff.

## Milestone 2: Export ownership v2 — completed

The exporter writes schema 2 markers with real digests, every local reader
accepts only schema 2, and the public fixture is replaced. Export, repository
preview and the existing publish path keep working end to end.

- [x] Add failing tests first: `parseExportOwnership` accepts only v2 entries,
      rejects schema 1, missing fields, bad hex, out-of-range sizes and
      duplicate or case-colliding paths; `stageExport` writes sorted entries
      with SHA-256 and byte sizes for every file including `mokly-upload.json`;
      a file over 64 MiB fails as `export-invalid` before staging.
- [x] Add a v2 marker builder (digest and size per file) beside
      `src/export/ownership.ts`, keeping `src/export/stage.ts` byte-identical
      for every other file; update `ExportOwnership` to the v2 type and adapt
      `assertExportOwnership`, `src/export/ignored.ts`, `src/export/backup.ts`
      and `scripts/preview/catalogue.mjs` to entry paths.
- [x] Give a stale v1 directory an actionable `export-invalid` message naming
      the directory to remove.
- [x] Delete `docs/protocol/fixtures/export-ownership-v1.json` and point every
      reader at the `export-ownership-v2.json` fixture authored in Milestone 1;
      extend its cases if the parser work exposes a missing shape.
- [x] Update `scripts/package/ownership.mjs` to an independent v2 reader that
      also verifies each entry's digest and size against extracted bytes, and
      `scripts/package/export.mjs` to iterate entry paths; update
      `tests/export_ownership_contract.test.ts`, `tests/package.test.ts`,
      `tests/helpers/release_fixture.ts`, `tests/helpers/bootstrap_fixture.ts`
      and `scripts/package/archive.mjs` to the new fixture name.
- [x] Add `tests/helpers/ownership_marker.ts` that builds a v2 marker from a
      directory or file map, and use it in every test that hand-writes a
      marker (`export_transaction`, `export_transaction_races`,
      `export_destination_races`, `export_paths`, `export_backup_cleanup`) and
      every test that reads `files.includes(...)` (`catalogue_export`,
      `inspector_publication`, `removed_preview_delivery`).
- [x] Extend the v2 fixture for the discovered control-character, invalid
      Unicode and over-limit UTF-8 path shapes; cover schema 1 watch treatment.
- [x] Run the export, publish, package and browser export suites; rebuild the
      example and run `npm run package:smoke`.

## Milestone 3: Plan, blob and complete exchange in the CLI — completed

`mokly publish` performs the three-step exchange through the injectable fetch
boundary with typed failures, deterministic retries and bounded concurrency.
The command remains fully functional against a receiver implementing the new
contract; the single-archive upload is deleted.

- [x] Add failing unit tests first, driven by an injected `fetch`, `now`,
      `sleep` and `random`: the plan archive contains exactly the three
      artifact files byte-identical to the export (two without comparisons);
      plan-response validation accepts the documented body and rejects each
      field violation, an unsorted, duplicate, non-hex or unknown `missing`
      hash, a foreign-origin `blobUrl`/`completeUrl`, a missing or repeated
      `{sha256}`, a non-JSON content type and a body over 16 MiB as
      `upload-failed` without echoing the body; blob PUT headers, bodies and
      the 400/404 mappings; complete `201`/`200` results, any other 2xx as
      `upload-failed`, and viewer URL extraction; one re-plan after 409, 410
      or a locally reached `expiresAt`, then `upload-failed`; the retry
      schedule (five attempts, 1 s → 16 s with full jitter, `Retry-After`
      honoured up to 60 s, no attempt or wait past `expiresAt`, non-retryable
      statuses fail immediately);
      concurrency never exceeds the limit and a failed blob cancels the rest;
      `--upload-concurrency` parsing (1 to 32, default 8, publish-only,
      assigned form, `cli-invalid` otherwise).
- [x] Split `src/publish/http.ts` into small modules: a shared request helper
      (120 s timeout, `redirect: "manual"`, status→category mapping, bounded
      body reader), `plan.ts` (archive of the three artifacts and response
      validation), `blobs.ts` (bounded worker pool of PUTs), `complete.ts`,
      `retry.ts` (schedule, jitter, `Retry-After`, expiry) and typed
      `PlanResponse`/`PublishResult` in `types.ts`; move the `exportedAt`
      timestamp validator into `validation.ts` for `expiresAt`.
- [x] Extend `PublishDependencies` with `sleep` and `random` seams and
      `PublishOptions` with `uploadConcurrency`; make `publishCatalogue` keep
      the finalized file map plus the parsed v2 marker, run plan → blobs →
      complete (with the single re-plan after 409, 410 or expiry), and return
      a `PublishResult` whose `outcome` is `published` or `already-published`
      beside `uploaded`, `unchanged` and `viewerUrl`.
- [x] Add `--upload-concurrency` to `src/cli/arguments.ts`, `src/cli/help.ts`
      and the publish command validation; wire it through `src/cli/publish.ts`;
      then add its rows to `docs/guides/cli/publish.md` and
      `docs/guides/cli/options-and-exit-status.md` and name it where the
      guides say "several files at a time".
- [x] Update the transport assertions in `tests/guides_ci.test.ts` (plan
      request headers through the new request helper, status mapping per
      request kind, retry schedule instead of "one request per status").
- [x] Check the `upload-plan-v1.json` fixture authored in Milestone 1 (root
      `endpoint`, `marker` digests and cases with optional `status`,
      `contentType`, `document` or raw `body`, plus `step: "complete"` cases
      with `outcome` and `viewerUrl`) against the CLI validator and an
      independent reader in `scripts/package/`, mirroring the ownership
      fixture tests; register the file in the package allowlists and release
      fixtures.
- [x] Remove the single-archive `uploadCatalogue` and its tests; update
      `tests/publish_http.test.ts` and `tests/publish_run.test.ts` to the
      new boundaries.
- [x] Keep the existing CLI integrations and packed-consumer smoke green with
      minimal plan/blob/complete receivers until Milestone 5 installs the full
      scripted fake receiver.
- [x] Update the protocol delivery status, CLI/CI guides and publish/CLI
      READMEs for the shipped content-addressed exchange.

## Milestone 4: Terminal output for the exchange — completed

Progress, summary and the viewer URL line follow the updated terminal
contract in both output modes.

- [x] Add failing reporter tests first: rich mode renders the in-place
      `Uploading <n> of <total> files · <size>` progress and settles to the
      counted success line; plain mode prints exactly
      `Published Mokly catalogue. <uploaded> files uploaded, <unchanged> unchanged.`
      or, after a `200` completion,
      `Mokly catalogue already published for this commit.`, followed by the
      viewer URL line only when present; forced-rich pipes remain
      deterministic; nothing else reaches stdout or stderr.
- [x] Add a phase `update(label)` capability to `ReporterPhase` (no-op in
      plain mode, in-place re-render in rich mode) and a publish progress
      observer that reports completed blob counts and the total size.
- [x] Use the `PublishResult` in `src/cli/run.ts` for the plain and rich
      summaries and print the viewer URL as its own unstyled line.
- [x] Reset rich progress to the new missing set after a re-plan and omit the
      progress label when that set is empty; document the behavior.
- [x] Suppress viewer URLs containing the raw or encoded bearer token and
      document the defense-in-depth rule.

## Milestone 5: Fake receiver integration and packed-consumer smoke — completed

The complete CLI is exercised against a local receiver that implements the
contract, and the packed package smoke proves the shipped artifact does the
same without importing package internals.

- [x] Add `tests/helpers/fake_receiver.ts`: an HTTP receiver that extracts the
      plan archive, validates the v2 marker, answers `missing` from its own
      blob store, verifies PUT bytes against the declared digest and size,
      completes with `201`/`200`, stores the plan-archive files at plan time,
      keeps the first publication per `headSha` and `configPath`, and can be
      scripted to return 409 once, 410 once, a short `expiresAt`, retryable
      statuses with `Retry-After`, and each rejection status.
- [x] Add integration tests through `dist/cli/bin.js`: first publish uploads
      every blob; replay with the same export yields empty `missing`, no PUTs,
      `200` and the already-published line; 409 once then success; 410 once
      then success; a short `expiresAt` re-plans once and then succeeds, and a
      second expiry is `upload-failed`; every rejection status on plan, blob
      and complete maps to its category;
      tokens never appear in output; a failed publish keeps the local export;
      `--no-changes` sends a two-entry plan archive.
- [x] Update `tests/publish_cli.test.ts`, `tests/publish_assigned_options.test.ts`
      and `tests/publish_derived.test.ts` to the fake receiver and the new
      plain output line.
- [x] Rewrite `scripts/package/publish.mjs` to run the receiver exchange
      against the installed CLI in both comparison modes, compare every stored
      blob and the plan archive entries with the local export bytes, and check
      the v2 marker with the independent reader; keep the leading-dash token
      case and the fixture conformance check.
- [x] Run `npm run package:smoke` and the publish action tests; smoke-test
      the built CLI manually against the fake receiver in rich and plain
      modes and record the observed output in this plan.

Manual smoke observed on 2026-09-26 against two fresh fake-receiver instances:

```text
MOKLY_OUTPUT=plain
Published Mokly catalogue. 47 files uploaded, 1 unchanged.
http://127.0.0.1:<port>/catalogues/publication-1/view
stderr: <empty>
PUT requests: 44

rich pseudo-terminal (representative in-place frames)
  ⠋ Uploading 0 of 44 files · 1.1 MiB…
  ⠋ Uploading 1 of 44 files · 1.1 MiB…
  …
  ⠙ Uploading 44 of 44 files · 1.1 MiB…
  ✔ Catalogue uploaded (95ms)
  ✔ Published Mokly catalogue · 47 files uploaded, 1 unchanged (594ms)
http://127.0.0.1:<port>/catalogues/publication-1/view
stderr: <empty>
PUT requests: 44
```

## Milestone 6: Verification and delivery — completed

Complete branch work before review; merge remains the completion boundary.

- [x] Run the focused publish, export, guides, package and browser suites,
      then `cargo xtask check`; resolve every failure.
- [x] Confirm the documentation, READMEs and fixtures match the shipped
      behaviour, and that no `upload v1` single-archive wording remains
      outside historical plans and reviews.
- [x] After checks pass, `git add -A` and commit with a Conventional Commits
      message and a `BREAKING CHANGE:` footer describing the removed
      single-archive exchange and the schema 2 marker, so the release PR
      records the CHANGELOG entry and bumps the next minor; push the branch.
      Committed as `52ca854 feat(publish)!: upload catalogue content deltas`;
      the title originally planned here was 51 characters, over the
      50-character limit in `AGENTS.md`.
- [x] After the push, use [the implementation review prompt](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main`; write the
      numbered, severity-rated findings with lettered options and a
      recommendation to `docs/reviews/delta-publishing.md` and report them
      without changing the implementation. Fifteen findings (five Medium,
      ten Low) are recorded in the
      [review](../docs/reviews/delta-publishing.md) for the user's decision.

## Milestone 7: Review fix contract — completed

Documentation and contract only, so the implementation milestones need no
guesswork. Fixture cases the current code would fail land with that code in
later milestones, tests first. Validate with Prettier and the guide tests;
`cargo xtask check` is not required.

- [x] Split `docs/protocol/mokly-upload.md` (364 lines) into `mokly-upload.md`
      (CLI, repository identity, upload manifest, output and GitHub Action)
      and a new `mokly-upload-exchange.md` (plan, blobs, complete, retries,
      rejections, limits and receiver validation), each near the ~250-line
      guidance; update every link and anchor, the protocol index, and the
      package allowlists and release fixtures that list shipped protocol
      files (#9).
- [x] Record the [Review Fix Decisions](#review-fix-decisions) in the
      exchange contract: repeated Complete (#2); counts, progress, plurals
      and cancellation copy (#3, #8); `413` for over-limit declared sizes and
      paths and "stored for the same project" (#9); http(s) plan URLs (#12);
      the five-attempt schedule without the 16 s cap (#7).
- [x] Update `mokly-export-ownership.md`: the portability rule with category
      Cc, the prefix-collision rule, version precedence, the `too-large`
      rejection class and its `413` mapping, and the fixture cases Milestone
      8 adds (#9, #10).
- [x] Update `mokly-export.md` step 5 and Output Ownership for the
      portability rule and the export error naming the escaped path (#1) and
      the earlier-release message (move added files, then delete the folder)
      (#11); update `mokly-export-delivery.md` Deployment Identity and every
      other identity statement for declared publication metadata (#5).
- [x] Update `mokly-terminal-output.md`: counting and progress definitions,
      plurals, cancellation copy, and erasing the line before every in-place
      frame (#3, #6, #8).
- [x] Update the CLI, CI and export guides to match (#1, #3, #7, #8), and
      `docs/protocol/ci-verification.md` for the pull request title check
      (#15).
- [x] Update the doc-only assertions in `tests/guides_*.test.ts` that the new
      wording and the split change; run Prettier and the guide tests.

## Milestone 8: Export portability, ownership and identity — completed

The exporter enforces one path rule at the point files enter the export,
the marker readers classify every documented case, publications of unchanged
content stop changing page shells, and Watch stops re-parsing markers.

- [x] Add failing tests first: a public file whose path has a Cc character,
      invalid Unicode or more than 1,024 UTF-8 bytes fails export as
      `export-invalid` naming the `JSON.stringify`-escaped path; the marker
      parser rejects prefix collisions and returns `too-large` for over-limit
      sizes and paths; the earlier-release message tells the user to move
      added files and then delete the folder; page shells and
      `__mokly/catalogue.json` are byte-identical across two publishes whose
      manifests differ only in `headSha` and `exportedAt`; Watch parses an
      unchanged marker once across many ignore checks and again after it
      changes.
- [x] Add one portability predicate in `src/export`, enforce it where files
      enter `ExportInventory`, and reuse it in the marker builder and parser
      and in `src/publish/validation.ts` (#1).
- [x] Give `parseExportOwnership` a `too-large` result, the prefix-collision
      rule and the documented version precedence; local readers treat
      `too-large` as an invalid inventory (#9, #10).
- [x] Extend `export-ownership-v2.json`: DEL, U+0085, an accepted U+200D, a
      valid path of exactly 1,024 UTF-8 bytes, a multi-byte path over the
      limit, and exact and case-folded prefix collisions; reclassify
      `size-over-limit` and `path-byte-limit-exceeded` as `too-large`; update
      the independent reader in `scripts/package/ownership.mjs` and both
      conformance tests (#9, #10).
- [x] Reword the earlier-release message (#11).
- [x] Exclude adapter-declared publication metadata from the deployment
      identity; publish declares `mokly-upload.json`; add a test that a
      second `--no-changes` publish of unchanged content on a new commit
      uploads no blob, and update the delta and deployment tests (#5).
- [x] Cache parsed markers in `src/export/ignored.ts` by device, inode, size
      and modification time as owned-path and directory-prefix sets, bounded
      in size, with an injected reader for a parse-count test; raise the
      marker read cap to 64 MiB (#13).
- [x] Run the export, ownership, watch, preview, publish and package suites
      and `npm run package:smoke`.

## Milestone 9: Publish structure, counts and plan URLs — completed

The publish module is split before new logic lands, counts follow one
definition, and plan URLs accept only http(s).

- [x] Split `src/publish/run.ts` into orchestration, snapshot validation and
      exchange modules; move the shared response helpers into `http.ts` and
      the error factories into one leaf module; behaviour and tests unchanged
      (#14).
- [x] Add failing counting tests first: a first publish reports
      `0 unchanged`; entries sharing a digest; plan-archive entries; a lost
      PUT response followed by a re-plan; a single-round progress label ends
      at the summary's `<uploaded>` (#3).
- [x] Add one counting module that owns `<uploaded>`, `<unchanged>` and each
      round's progress; the exchange and the CLI progress read from it (#3).
- [x] Validate `blobUrl` and `completeUrl` with one helper (absolute http(s),
      scheme, hostname and port equal to the endpoint's, no userinfo); add
      `blob:` cases to `upload-plan-v1.json` and the same rule to the
      independent reader in `scripts/package/upload_plan.mjs` (#12).
- [x] Update the publish unit and integration tests and the packed smoke to
      the new counts.

## Milestone 10: Terminal copy and rendering — completed

Rich progress redraws cleanly and every publish line reads correctly.

- [x] Add failing tests first: a long-then-short label leaves no stale
      characters under an emulated terminal; progress and summaries for 0, 1
      and 2 files; cancellation prints its own message and no connection hint
      in rich mode; the transport failure's detail and hint differ.
- [x] Erase the line before every in-place frame (#6).
- [x] Add one plural helper used by publish progress, publish summaries and
      Serve's changed-screen count (#8).
- [x] Give publish cancellation a typed error that keeps `upload-failed`, its
      own fixed message and its own rich hint; reword the transport failure
      message so its detail and hint differ (#8).

## Milestone 11: Receiver conformance tests — completed

The fake receiver and the contract tests can express and catch every
documented receiver and request rule.

- [x] Make the fake receiver decide keep-first at Complete time, remember
      completed uploads and replay their first result, drop a scripted
      Complete response after processing it, answer `413` for `too-large`
      markers, and let overrides carry headers such as `Location` (#2, #4,
      #9).
- [x] Test overlapping uploads (the second Complete returns `200` with the
      first publication), a repeated Complete (the same `201` body and one
      publication), and a CLI publish whose first Complete response is
      dropped (#2).
- [x] Build fixture response bodies from bytes and assert each built
      response's status and content type; assert `redirect: "manual"` for
      plan, blob and Complete through one shared request-init assertion; make
      the `302` cases send a same-origin `Location` that is never requested
      (#4).
- [x] Export the retry schedule constants from `src/publish/retry.ts` and
      derive the guides' attempt count and maximum wait from them in
      `tests/guides_ci.test.ts` (#7).
- [x] Cross-check the ownership fixture's rejection classes against the
      exchange contract's status table (#9).

## Milestone 12: Pull request title check — completed

Release notes depend on the squash title, so CI checks it.

- [x] Add failing tests first for a validator script: this repository's
      Conventional Commits types, an optional lowercase scope, an optional
      `!`, a nonempty description and at most 50 characters.
- [x] Add `.github/workflows/pull-request-title.yml` running the validator on
      pull requests (opened, edited, reopened and synchronize), passing the
      title through an environment variable rather than interpolating it
      into the script; extend the workflow tests (#15).
- [x] Document the check in `docs/protocol/ci-verification.md` and the
      release contract (#15).

## Milestone 13: Review fix verification and delivery — completed

- [x] Run the focused publish, export, guides, package, CI and browser
      suites, then `cargo xtask check`; resolve every failure.
- [x] Mark each finding in `docs/reviews/delta-publishing.md` addressed and
      summarize what changed.
- [x] After checks pass, `git add -A`, commit with a Conventional Commits
      title of at most 50 characters, and push the branch. Committed as
      `b012d69 fix(publish): apply the delta publishing review`.
- [x] After the push, use [the implementation review prompt](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main`; append the
      numbered, severity-rated findings with lettered options and a
      recommendation to `docs/reviews/delta-publishing.md` and report them
      without changing the implementation. Eleven findings (two Medium, nine
      Low) are recorded in its Second Review for the user's decision.

## Milestone 14: Second review fix contract — completed

Documentation and contract only. Validate with Prettier and the guide tests;
`cargo xtask check` is not required.

- [x] State the cancellation precedence in the exchange contract
      ([`mokly-upload-exchange.md`](../docs/protocol/mokly-upload-exchange.md)
      Accounting And Output and Rejections), the
      [terminal contract](../docs/protocol/mokly-terminal-output.md) and the
      [export recovery contract](../docs/protocol/mokly-export-recovery.md):
      what counts as a cancellation, that a recovery failure after
      cancellation is shown unchanged with its paths, and that `mokly export`
      output is unchanged (second #1).
- [x] Update the publish cancellation sentences in
      [`cli/publish.md`](../docs/guides/cli/publish.md) and
      [`ci/the-upload.md`](../docs/guides/ci/the-upload.md) to match
      (second #1).
- [x] Add the deterministic-test rule and its enforcing test to
      [`ci-verification.md`](../docs/protocol/ci-verification.md) (second #2).
- [x] Run Prettier and the guide tests; check every changed link.

## Milestone 15: Typed cancellation — completed

Publish shows the cancellation output only for a real cancellation, and
export recovery errors reach the user unchanged.

- [x] Add failing tests first: `isCancellation` accepts a marked
      `MoklyError` and a platform abort error and rejects combined, wrapped
      and unrelated errors without reading causes; export rollback success
      after cancellation is a cancellation, while rollback failure and
      reservation or backup cleanup failure are not and still name their
      paths; the export's wrapper around a non-Mokly abort is a
      cancellation; baseline interruption is a cancellation; the publish
      identity readers rethrow a cancellation instead of `git-failed`; the
      publish error mapping keeps every non-cancellation `MoklyError`.
- [x] Add spawned `mokly publish` tests with
      `tests/helpers/export_failure_preload.ts` (adding modes as needed):
      cancellation with a clean rollback prints exactly the cancellation line
      and restores the previous `site/`; cancellation with a failed restore
      prints the export rollback error naming the backup; cancellation with
      a reservation cleanup failure prints the export error naming the
      reservation; the Blob-upload cancellation test still passes. Cover
      plain and rich output for the failed-restore case.
- [x] Add the cancellation mark to `MoklyError` and `isCancellation` to
      `src/errors.ts`; mark the export cancellation check, baseline
      interruption, publish cancellation and the cancellation-only wrappers;
      make the publish identity readers rethrow cancellations.
- [x] Replace the abort-signal check in `src/cli/publish.ts` with
      `isCancellation`, so only cancellations map to the cancellation output.
- [x] Confirm `mokly export` and Serve output are unchanged, including
      `tests/export_cli_failures.test.ts`, and update the export, publish and
      CLI READMEs.

## Milestone 16: Deterministic pull request title test — completed

The title test no longer depends on the state of `origin/main`, and a static
test keeps every test independent of remote-tracking references.

- [x] Remove the `origin/main` history scan from
      `tests/verification_pull_request_title.test.ts`; keep the fixed type
      list, the `AGENTS.md` example check and every boundary case
      (second #2).
- [x] Add `tests/test_repository_refs.test.ts`, a static test that fails when
      a test or test helper runs Git in the
      real repository with a remote-tracking reference, with synthetic
      positive cases (including the removed code) and negative cases (fixture
      repositories, local references); it reports no violation on the
      current tree (second #2).

## Milestone 17: Second review fix verification and delivery — completed

- [x] Run the focused publish, export, baseline, CLI, guides, package and CI
      suites, then `cargo xtask check`; resolve every failure.
- [x] Mark second-review findings 1 and 2 addressed in
      `docs/reviews/delta-publishing.md` and summarize what changed.
- [x] After checks pass, `git add -A`, commit with a Conventional Commits
      title of at most 50 characters, and push the branch. Committed as
      `bf63380 fix(publish): keep recovery errors after Ctrl+C`.
- [x] After the push, use [the implementation review prompt](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main`; append the
      numbered, severity-rated findings with lettered options and a
      recommendation to `docs/reviews/delta-publishing.md` and report them
      without changing the implementation. Three findings (two Medium, one
      Low) are recorded in its Third Review for the user's decision.

## Milestone 18: Third review fix contract — completed

Documentation and contract only. Validate with Prettier and the guide tests;
`cargo xtask check` is not required.

- [x] Add the pre-installation window to the
      [export recovery contract](../docs/protocol/mokly-export-recovery.md)
      and reference it from the cancellation rule in
      [`mokly-upload-exchange.md`](../docs/protocol/mokly-upload-exchange.md),
      replacing the unconditional "never infer from the signal" sentence with
      the window's single exception (third #1).
- [x] Rewrite the deterministic-test rule in
      [`ci-verification.md`](../docs/protocol/ci-verification.md) so it is
      true: tree-owned bases for the example, CI's removal of
      remote-tracking references before the unit and browser suites, the
      local remote-free proof, and the full-history sentence corrected
      (third #2).
- [x] Describe the lint in `ci-verification.md` as best-effort and list
      exactly what it recognises and cannot see (third #3).
- [x] Update the publish guides, the export, publish and CLI READMEs and the
      review follow-up wording where they describe these rules; run Prettier
      and the guide tests; check every changed link.

## Milestone 19: Pre-installation cancellation — completed

A clean Ctrl+C before the export's installation prints the cancellation line
in every catalogue mode.

- [x] Add failing tests first: spawned `mokly publish` without `--no-changes`
      for committed and derived catalogues, with SIGINT sent to the whole
      process group during comparison preparation, compile or staging, and
      the input recheck, asserting the exact plain cancellation line (and
      rich output for one case), exit status 1 and an unchanged `site/`;
      one spawned case during configuration loading; a unit matrix that
      passes each Git reader's aborted failure (Git commands, batch reads,
      review asset reads) through the pre-installation boundary and expects
      a cancellation with its code and message kept, while the same failure
      without an abort stays unmarked.
- [x] Implement the window at the export boundary (`generateExport` before
      `transaction.install`) and at the publish boundary before the export
      starts, preserving code, message and presentation, with the original
      error as the cause; installation, rollback and cleanup keep their
      rules.
- [x] Keep `tests/export_cli_failures.test.ts`, the second-review
      cancellation tests and `mokly export` output unchanged.

## Milestone 20: Tree-only example tests and remote-free CI — completed

The example's preview test and browser server stop reading `origin/main`, and
CI proves the suites do not need remote-tracking references.

- [x] Point `tests/preview.test.ts` and the browser server in
      `playwright.config.ts` at a tree-owned base, keeping their assertions
      meaningful, and update any test or setup that assumed `origin/main`.
- [x] In `.github/workflows/ci.yml`, read the baseline lockfile from the
      tree-owned base and remove remote-tracking references before the unit
      and browser suites; update the workflow tests.
- [x] Run `tests/preview.test.ts` and the browser global setup with one spec
      in a local copy without remote-tracking references.

## Milestone 21: Best-effort remote-reference lint — completed

- [x] Add failing synthetic cases first for calls without `cwd`, `-C`
      targets, `HEAD..origin/main`, `^origin/main`, `remotes/origin/main`,
      `refs/remotes`, `-r`, `--all`, `--remotes=origin`, `@{U}`,
      `@{UPSTREAM}`, `fetch` and `ls-remote`, and a negative case with
      `repositoryRoot` only in `env`.
- [x] Widen `tests/helpers/test_repository_refs.ts` to the decided scope and
      keep zero violations on the tree, fixing any real violation it finds.

## Milestone 22: Third review fix verification and delivery — completed

- [x] Run the focused publish, export, baseline, CLI, guides, package and CI
      suites, then the unit and browser suites in a local copy without
      remote-tracking references, then `cargo xtask check`; resolve every
      failure.
- [x] Mark the third-review findings addressed in
      `docs/reviews/delta-publishing.md` and summarize what changed.
- [x] After checks pass, `git add -A`, commit with a Conventional Commits
      title of at most 50 characters, and push the branch. Committed as
      `78f259d fix(publish): classify Ctrl+C before installation`.
- [x] After the push, use [the implementation review prompt](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main`; append the
      numbered, severity-rated findings with lettered options and a
      recommendation to `docs/reviews/delta-publishing.md` and report them
      without changing the implementation. Seven findings (one Medium, six
      Low) are recorded in its Fourth Review for the user's decision.

## Milestone 23: Fourth review fix contract — completed

Documentation and contract only. Validate with Prettier and the guide tests;
`cargo xtask check` is not required.

- [x] In [`mokly-export-recovery.md`](../docs/protocol/mokly-export-recovery.md),
      define when the signal counts as fired, list every step the window
      covers exactly as implemented, state the keep-alive guarantee and state
      that marking keeps the original error and its diagnostic stack
      (fourth #1, #6, #7).
- [x] In [`ci-verification.md`](../docs/protocol/ci-verification.md), name the
      shared removal script and the local remote-free procedure that uses it,
      remove the stale merge-base lockfile sentences, and describe the lint's
      behaviour and blind spots without claiming completeness; make
      [`npm-release.md`](../docs/protocol/npm-release.md) link to it for CI
      caching and Git history (fourth #2, #4, #5).
- [x] Update the READMEs these rules touch; run Prettier and the guide tests;
      check every changed link.

## Milestone 24: Cancellation timing, keep-alive and in-place marks — completed

- [x] Add failing tests first: spawned compile cases for committed and derived
      catalogues whose preload sends SIGINT to the process group from inside
      esbuild work and waits for esbuild to exit before returning, asserting
      the exact cancellation line; a unit case where a window step fails in
      the same turn an abort is queued; a keep-alive case where awaited work is
      held only by unreferenced handles and must settle instead of exiting
      with status 13; marking that preserves identity, class, fields and
      stack, including a `BaselineCommandError`; and `MOKLY_DIAGNOSTIC=1`
      showing the original stack after a classified Ctrl+C.
- [x] Implement the event-loop turn in `withPreInstallationCancellation`, the
      in-place registry in `src/errors.ts`, and one keep-alive helper used by
      `runExport` and `runPublish`.
- [x] Keep every earlier cancellation and recovery test passing unchanged.

## Milestone 25: Shared remote-free script — completed

- [x] Add failing tests first: run the script in a fixture clone with a
      symbolic `origin/HEAD`, packed references, `refs/remotes/pull/1/merge`,
      an upstream setting and `FETCH_HEAD`; assert nothing remote remains,
      `git fetch origin` fails, and `HEAD` and the working tree are unchanged;
      assert the script fails when it cannot remove something.
- [x] Add `scripts/verification/remove-remote-state.mjs`, use it in CI's unit
      and browser jobs, and make the workflow tests require the script
      instead of inline shell.

## Milestone 26: Preview assertions and lint precision — completed

- [x] Assert the preview edit's changed count, Welcome as changed and an
      unedited screen as unmodified (fourth #3).
- [x] Add failing lint cases first: shorthand `{ cwd }` with a fixture, an
      options variable and a spread (not flagged); `ls-tree -r HEAD` in the
      real checkout (not flagged); `branch -r` and `log --all` in the real
      checkout (flagged); `-c name=value fetch` in the real checkout
      (flagged); `--git-dir` pointing at a fixture (not flagged); and
      `log -C origin/main` (a `-C` after the subcommand is not a target).
      Then implement the decided rules (fourth #5).
- [x] Keep zero lint violations across the tree.

## Milestone 27: Fourth review fix verification and delivery — completed

- [x] Run the focused publish, export, baseline, CLI, guides, package and CI
      suites; make a local copy without remote state using the shared script
      and run the unit and browser suites there; then run
      `cargo xtask check`; resolve every failure.
- [x] Mark the fourth-review findings addressed in
      `docs/reviews/delta-publishing.md` and summarize what changed.
- [x] After checks pass, `git add -A`, commit with a Conventional Commits
      title of at most 50 characters, and push the branch. Committed as
      `4f230ad fix(publish): settle Ctrl+C races and remote state`.
- [x] After the push, use [the implementation review prompt](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main`; append the
      numbered, severity-rated findings with lettered options and a
      recommendation to `docs/reviews/delta-publishing.md` and report them
      without changing the implementation. Five findings (one Medium, four
      Low) are recorded in its Fifth Review for the user's decision.

## Milestone 28: Remove the remote-state cleanup script

- [ ] Rewrite the "Deterministic Test Repository Inputs" section of
      [`ci-verification.md`](../docs/protocol/ci-verification.md) without the
      removal step, the local procedure or the runtime-proof wording, keeping
      the rule, the two tree-owned bases and the lint as the remaining
      best-effort guard; check every link to that section.
- [ ] Delete `scripts/verification/remove-remote-state.mjs`,
      `scripts/verification/remove-remote-state.d.mts` and
      `tests/verification_remote_state.test.ts`, and remove the "Remove
      remote-tracking test inputs" steps from `.github/workflows/ci.yml`.
- [ ] Update `tests/ci_workflow.test.ts` and `tests/guides_ci.test.ts` to the
      new contract, keeping the checks that the unit and browser jobs do not
      read `origin/main`; confirm no reference to the script remains outside
      historical plans and reviews.

## Milestone 29: Script removal verification and delivery

- [ ] Run the CI, verification, workflow, guides and preview tests, then
      `cargo xtask check`; resolve every failure.
- [ ] Record the removal in `docs/reviews/delta-publishing.md` against
      fifth-review findings 1 and 2.
- [ ] After checks pass, `git add -A`, commit with a Conventional Commits
      title of at most 50 characters, and push the branch.
- [ ] After the push, use [the implementation review prompt](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main`; append the
      numbered, severity-rated findings with lettered options and a
      recommendation to `docs/reviews/delta-publishing.md` and report them
      without changing the implementation.

## Post-merge follow-up (non-blocking)

- Merge the release-please PR that ships the next minor (`0.13.0`) and verify
  its CHANGELOG entry names the delta exchange and the schema 2 marker.
- Notify the cloud repository of the released version so it pins it and
  regenerates its contract fixtures from the published package, including a
  real `mokly publish` export against its receiver.
- Consider an optional `upload-concurrency` input for the composite action if
  consumers ask for it.
- Make the pull request title check a required status check in the
  repository's branch protection.

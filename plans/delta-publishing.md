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
  `Uploading <n> of <total> files · <size>`. `<n>` counts completed blob
  uploads, `<total>` is the number of files whose hash is in `missing`, and
  `<size>` is their total byte size in binary units. `<uploaded>` counts marker
  entries whose hash was uploaded in this run (including a 409 re-plan);
  `<unchanged>` is the remaining entries.
- **Complete body.** `201`/`200` succeed regardless of body validity; the
  viewer URL line is printed only when `viewerUrl` is an absolute http(s) URL
  string in a JSON body of at most 16 MiB. Other fields are ignored.

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
      `docs/protocol/fixtures/export-ownership-v2.json` (43 cases with real
      digests) and `docs/protocol/fixtures/upload-plan-v1.json` (47 cases);
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

## Milestone 2: Export ownership v2

The exporter writes schema 2 markers with real digests, every local reader
accepts only schema 2, and the public fixture is replaced. Export, repository
preview and the existing publish path keep working end to end.

- [ ] Add failing tests first: `parseExportOwnership` accepts only v2 entries,
      rejects schema 1, missing fields, bad hex, out-of-range sizes and
      duplicate or case-colliding paths; `stageExport` writes sorted entries
      with SHA-256 and byte sizes for every file including `mokly-upload.json`;
      a file over 64 MiB fails as `export-invalid` before staging.
- [ ] Add a v2 marker builder (digest and size per file) beside
      `src/export/ownership.ts`, keeping `src/export/stage.ts` byte-identical
      for every other file; update `ExportOwnership` to the v2 type and adapt
      `assertExportOwnership`, `src/export/ignored.ts`, `src/export/backup.ts`
      and `scripts/preview/catalogue.mjs` to entry paths.
- [ ] Give a stale v1 directory an actionable `export-invalid` message naming
      the directory to remove.
- [ ] Delete `docs/protocol/fixtures/export-ownership-v1.json` and point every
      reader at the `export-ownership-v2.json` fixture authored in Milestone 1;
      extend its cases if the parser work exposes a missing shape.
- [ ] Update `scripts/package/ownership.mjs` to an independent v2 reader that
      also verifies each entry's digest and size against extracted bytes, and
      `scripts/package/export.mjs` to iterate entry paths; update
      `tests/export_ownership_contract.test.ts`, `tests/package.test.ts`,
      `tests/helpers/release_fixture.ts`, `tests/helpers/bootstrap_fixture.ts`
      and `scripts/package/archive.mjs` to the new fixture name.
- [ ] Add `tests/helpers/ownership_marker.ts` that builds a v2 marker from a
      directory or file map, and use it in every test that hand-writes a
      marker (`export_transaction`, `export_transaction_races`,
      `export_destination_races`, `export_paths`, `export_backup_cleanup`) and
      every test that reads `files.includes(...)` (`catalogue_export`,
      `inspector_publication`, `removed_preview_delivery`).
- [ ] Run the export, publish, package and browser export suites; rebuild the
      example and run `npm run package:smoke`.

## Milestone 3: Plan, blob and complete exchange in the CLI

`mokly publish` performs the three-step exchange through the injectable fetch
boundary with typed failures, deterministic retries and bounded concurrency.
The command remains fully functional against a receiver implementing the new
contract; the single-archive upload is deleted.

- [ ] Add failing unit tests first, driven by an injected `fetch`, `now`,
      `sleep` and `random`: the plan archive contains exactly the three
      artifact files byte-identical to the export (two without comparisons);
      plan-response validation accepts the documented body and rejects each
      field violation, an unsorted, duplicate, non-hex or unknown `missing`
      hash, a foreign-origin `blobUrl`/`completeUrl`, a missing or repeated
      `{sha256}`, a non-JSON content type and a body over 16 MiB as
      `upload-failed` without echoing the body; blob PUT headers, bodies and
      the 400/404 mappings; complete `201`/`200` results and viewer URL
      extraction; one 409 re-plan then `upload-failed`; the retry schedule
      (five attempts, 1 s → 16 s with full jitter, `Retry-After` honoured up
      to 60 s, stop at `expiresAt`, non-retryable statuses fail immediately);
      concurrency never exceeds the limit and a failed blob cancels the rest;
      `--upload-concurrency` parsing (1 to 32, default 8, publish-only,
      assigned form, `cli-invalid` otherwise).
- [ ] Split `src/publish/http.ts` into small modules: a shared request helper
      (120 s timeout, `redirect: "manual"`, status→category mapping, bounded
      body reader), `plan.ts` (archive of the three artifacts and response
      validation), `blobs.ts` (bounded worker pool of PUTs), `complete.ts`,
      `retry.ts` (schedule, jitter, `Retry-After`, expiry) and typed
      `PlanResponse`/`PublishResult` in `types.ts`; move the `exportedAt`
      timestamp validator into `validation.ts` for `expiresAt`.
- [ ] Extend `PublishDependencies` with `sleep` and `random` seams and
      `PublishOptions` with `uploadConcurrency`; make `publishCatalogue` keep
      the finalized file map plus the parsed v2 marker, run plan → blobs →
      complete (with the single 409 re-plan), and return
      `{ uploaded, unchanged, viewerUrl }`.
- [ ] Add `--upload-concurrency` to `src/cli/arguments.ts`, `src/cli/help.ts`
      and the publish command validation; wire it through `src/cli/publish.ts`;
      then add its rows to `docs/guides/cli/publish.md` and
      `docs/guides/cli/options-and-exit-status.md` and name it where the
      guides say "several files at a time".
- [ ] Update the transport assertions in `tests/guides_ci.test.ts` (plan
      request headers through the new request helper, status mapping per
      request kind, retry schedule instead of "one request per status").
- [ ] Check the `upload-plan-v1.json` fixture authored in Milestone 1 (root
      `endpoint`, `marker` digests and cases with optional `status`,
      `contentType`, `document` or raw `body`) against the CLI validator and
      an independent reader in `scripts/package/`, mirroring the ownership
      fixture tests; register the file in the package allowlists and release
      fixtures.
- [ ] Remove the single-archive `uploadCatalogue` and its tests; update
      `tests/publish_http.test.ts` and `tests/publish_run.test.ts` to the
      new boundaries.

## Milestone 4: Terminal output for the exchange

Progress, summary and the viewer URL line follow the updated terminal
contract in both output modes.

- [ ] Add failing reporter tests first: rich mode renders the in-place
      `Uploading <n> of <total> files · <size>` progress and settles to the
      counted success line; plain mode prints exactly
      `Published Mokly catalogue. <uploaded> files uploaded, <unchanged> unchanged.`
      followed by the viewer URL line only when present; forced-rich pipes
      remain deterministic; nothing else reaches stdout or stderr.
- [ ] Add a phase `update(label)` capability to `ReporterPhase` (no-op in
      plain mode, in-place re-render in rich mode) and a publish progress
      observer that reports completed blob counts and the total size.
- [ ] Use the `PublishResult` in `src/cli/run.ts` for the plain and rich
      summaries and print the viewer URL as its own unstyled line.

## Milestone 5: Fake receiver integration and packed-consumer smoke

The complete CLI is exercised against a local receiver that implements the
contract, and the packed package smoke proves the shipped artifact does the
same without importing package internals.

- [ ] Add `tests/helpers/fake_receiver.ts`: an HTTP receiver that extracts the
      plan archive, validates the v2 marker, answers `missing` from its own
      blob store, verifies PUT bytes against the declared digest and size,
      completes with `201`/`200`, and can be scripted to return 409 once,
      short `expiresAt`, retryable statuses with `Retry-After`, and each
      rejection status.
- [ ] Add integration tests through `dist/cli/bin.js`: first publish uploads
      every blob; replay with the same export yields empty `missing`, no PUTs
      and `200`; 409 once then success; `expiresAt` reached → `upload-failed`;
      every rejection status on plan, blob and complete maps to its category;
      tokens never appear in output; a failed publish keeps the local export;
      `--no-changes` sends a two-entry plan archive.
- [ ] Update `tests/publish_cli.test.ts`, `tests/publish_assigned_options.test.ts`
      and `tests/publish_derived.test.ts` to the fake receiver and the new
      plain output line.
- [ ] Rewrite `scripts/package/publish.mjs` to run the receiver exchange
      against the installed CLI in both comparison modes, compare every stored
      blob and the plan archive entries with the local export bytes, and check
      the v2 marker with the independent reader; keep the leading-dash token
      case and the fixture conformance check.
- [ ] Run `npm run package:smoke` and the publish action tests; smoke-test
      the built CLI manually against the fake receiver in rich and plain
      modes and record the observed output in this plan.

## Milestone 6: Verification and delivery

Complete branch work before review; merge remains the completion boundary.

- [ ] Run the focused publish, export, guides, package and browser suites,
      then `cargo xtask check`; resolve every failure.
- [ ] Confirm the documentation, READMEs and fixtures match the shipped
      behaviour, and that no `upload v1` single-archive wording remains
      outside historical plans and reviews.
- [ ] After checks pass, `git add -A` and commit with a Conventional Commits
      message titled `feat(publish)!: upload catalogues as content deltas` and
      a `BREAKING CHANGE:` footer describing the removed single-archive
      exchange and the schema 2 marker, so the release PR records the
      CHANGELOG entry and bumps the next minor; push the branch.
- [ ] After the push, use [the implementation review prompt](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main`; write the
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

# Gzip Blob Uploads

Status: Active. On branch `conductor/dedup-2-gzip-blob-uploads`, no pull
request yet. The plan closes when its PR merges.

`mokly publish` uploads by content address. The Plan request sends the
envelope, the ownership marker, and the index in one gzip tar. The receiver
answers with the digests that it does not hold. The CLI then sends each
missing digest once, as one Blob PUT with the raw file bytes. Measured on
2026-10-27 at `a9dd1e81` with `examples/basic`: a first publication sends
1,453 Blobs with 41.0 MB. Gzip on each file gives 6.0 MB, 14.6 %. The 240
entry details carry the `deploymentId`, so each publication with a new
`deploymentId` sends them again: 20.8 MB raw, 1.3 MB with gzip. Mokly Cloud
keeps blobs per project between publications, so a later publication sends
only new contents. Gzip makes those smaller too. The brief's numbers match
this build when the ownership marker is left out.

User decision (2026-10-27): option A of the "Hash-Based Content Caching"
investigation. The receiver lists gzip in a new optional field of the Plan
response. When the field is present, the CLI sends Blob PUTs with
`Content-Encoding: gzip`. The receiver decodes the body and checks the
SHA-256 and the size of the decoded bytes against the marker entry. Earlier
receivers do not send the field, so they keep getting raw uploads. The
brief of this workspace names only option A. The investigation workspace
keeps the other options and their evidence. The Rust rebuild kept exchange
v1 unchanged under its user decision 7 of 2026-10-12. This change keeps v1
and adds an optional field.

This change does not change the build output, the index, the entry details,
the ownership marker, or the Plan archive. It adds no compression across
files. One xz stream over all distinct files gives 0.80 MB, but it needs a
new batch format for Blobs. It adds no coding other than gzip and no CLI
option. The receiver keeps its own storage format. The Mokly Cloud change
ships in `mokly-ai/mokly-cloud` with its own owner. The shell's screens and
copy do not change, so the change has no mockup milestone.

Evidence: `.context/gzip-blob-uploads/measurement-2026-10-27.md`.

Contract owners:

- [Upload exchange](../docs/protocol/mokly-upload-exchange.md) and its
  [plan fixture](../docs/protocol/fixtures/upload-plan-v1.json).
- [Upload validation](../docs/protocol/mokly-upload-validation.md).
- The [mokly-publish README](../crates/mokly-publish/README.md).
- The [CI upload guide](../docs/guides/ci/the-upload.md).

## Open decisions

The user answers these before Milestone 1 starts. The milestones assume the
recommended option of each decision.

1. Raw bytes for files that gzip does not make smaller. Recommended: B.
   - A. Gzip every Blob when the Plan lists gzip. Incompressible files grow.
     64 MiB of random bytes grows by 10,588 bytes and passes the 64 MiB
     Blob ceiling.
   - B. Gzip each Blob, and send the gzip body only when it is smaller than
     the file. Otherwise send the exact bytes without `Content-Encoding`. No
     list is necessary. A receiver can then reject an encoded body that is
     larger than the declared size.
   - C. Skip gzip for a list of compressed media types, such as PNG, JPEG,
     WebP, and WOFF2, and apply B to the rest. This saves CPU time on media
     files, but the code and the protocol must keep the list.
2. Bytes that the rich progress `<size>` counts. Recommended: A.
   - A. Count the decoded file bytes, as today. The Plan archive already
     travels compressed and counts its files' raw bytes.
   - B. Count the bytes that the requests send. The label then needs every
     missing Blob compressed before the first frame. This changes the
     terminal contract.
   - C. Show both values in the label. This changes the terminal contract.
3. Owner of the Mokly Cloud change. Recommended: A.
   - A. Milestone 2 creates a Conductor workspace in `mokly-ai/mokly-cloud`
     with a brief. Its plan and pull request own the receiver change. The
     review.json removal used this method on 2026-10-26.
   - B. Milestone 2 writes the brief only. The user names the owner and
     starts the work.
   - C. Start the receiver work after the release of this change.

The summary line counts marker entries, not bytes. The encoding does not
change `<uploaded>` or `<unchanged>`.

## Design

### Plan field

- `blobEncodings` is an optional array of content-coding names. The
  receiver decodes these codings in the Blob bodies of this upload.
- The CLI uses gzip for a Plan round when the value is an array that holds
  the exact string `gzip`. The CLI ignores other items. Any other value,
  `null` included, counts as absent. The CLI adds no rejection, as for the
  optional Complete body.
- Each Plan round reads the field again, so a re-plan can change the
  encoding.
- The Plan exchange keeps version 1. Earlier CLIs ignore unknown Plan
  fields, and earlier receivers never list the field. #217 kept entry detail
  v2 for optional fields by the same rule. Rejected: Plan v2, because a v1
  CLI refuses every v2 Plan, so a receiver would choose a version for each
  client.
- Rejected: an `Accept-Encoding` header on the Plan response (RFC 7694). The
  Plan's upload instructions are in the JSON body, the public fixture tests
  JSON documents, and the HTTP adapter keeps only the protocol's headers.

### Blob body

- When the round lists gzip, the Blob job encodes the file as one gzip
  member: flate2 `GzBuilder`, `mtime(0)`, no file name, and
  `Compression::default()`. This is level 6, the level of the Plan archive.
  Level 9 is 0.3 % smaller and needs 1.3 times the CPU time.
- Decision 1 sets when the encoded body replaces the file bytes.
- `Content-Type` stays `application/octet-stream`. `Content-Length` is the
  body length. Only an encoded body has `Content-Encoding: gzip`.
- The marker digest and size always describe the decoded file bytes. The
  Blob URL does not change.
- The encoding runs on Tokio's blocking pool, because the publish runtime
  has two worker threads. It runs inside the Blob job, so at most
  `--upload-concurrency` encodings run at the same time.
- The job waits for the encoding together with the command cancellation.
  Cancellation then stops at once. An encoding that started finishes in the
  background, and the CLI never sends its body.
- Each running job holds one encoded body of at most the file size. Level 6
  took 0.44 s of one CPU for the 43.7 MB example and 1.87 s for 64 MiB of
  random bytes.

### Retries and re-plans

- The job builds one `Request` with the encoded body and its encoding
  before the retry loop. `Requests::send` clones that request for each
  attempt and changes only the timeout. Every attempt therefore sends the
  same headers and body.
- A re-plan encodes the file again. The encoder gives the same bytes for the
  same input and level, so a repeated digest gets the same body.
- Rejected: send an encoded Blob again as raw bytes after a 400 or 415. The
  receiver's listing rule prevents that case. A real mismatch would cost a
  second upload and hide a receiver defect.

### Receiver rules

- A receiver lists `gzip` only when it decodes gzip Blobs for the whole
  upload, until the upload expires.
- Under decision 1 B, a gzip Blob's `Content-Length` is at most the
  declared size. The receiver checks this before it reads the body and
  answers 400 otherwise. Under decision 1 A, the bound is the 64 MiB Blob
  ceiling.
- The receiver decodes the body as a stream and stops after the declared
  size plus one byte. This is the decoded-size limit.
- Invalid gzip data, a decoded size other than the declared size, or a
  decoded digest other than the URL digest is 400. The receiver then stores
  nothing.
- Raw Blobs keep their rules. Any other `Content-Encoding` value is 400. The
  120-second reception bound does not change.

### Format versions and the other three plans

- This plan changes no format number. Plan response and exchange stay 1,
  upload metadata 3, export ownership 3, catalogue index 8, and entry
  detail 2. The fixture keeps its name, `upload-plan-v1.json`.
- Changes 1 and 3, and maybe 4, change the entry detail format. This plan
  never reads or writes the index, the entry details, or the comparison
  files. It compresses the bytes that the build writes. The four plans can
  therefore merge in any order, and a detail version bump needs nothing
  from this plan.
- Expected textual overlap is small. This plan does not edit
  `mokly-format-versions.md`, where the other plans change the entry detail
  row. In shared prose, such as the upload guide, this plan edits only its
  Blob, receiver, and counts sections.
- The gain gets smaller when changes 1, 3, and 4 remove repeated content.
  Milestone 4 measures the output that `main` holds at that time.

### Rollout across the two repositories

1. This repository merges the change and releases it in the next minor
   version. The new CLI sends raw bytes to the current Mokly Cloud, because
   no Plan lists gzip.
2. Mokly Cloud phase 1 deploys gzip decoding for Blob PUTs on every server,
   without the listing. All CLIs still send raw bytes.
3. Mokly Cloud phase 2 starts after every server that receives Blobs runs
   phase 1. A configuration switch turns on the listing. A smoke test in a
   preview environment uses the released CLI.
4. Rollback turns the listing off first. The decoder stays until every
   upload with a gzip Plan has expired, 60 minutes at Mokly Cloud. A CLI
   downgrade needs no receiver step, because earlier CLIs ignore the field.

Every pairing works: an earlier CLI ignores the field, and the new CLI gets
no field from an earlier receiver. During a rolling deploy, every server
decodes before any server lists. The wrong order fails: today's Mokly Cloud
answers 400 to any `Content-Encoding`, which the CLI reports as
`upload-invalid-bundle`.

## Milestone 1: Documentation, protocol, and fixture

State the requirements and the decisions in force, and add the fixture
cases, so that the CLI work and the Mokly Cloud work share one contract.

- [ ] Write the answers to the three open decisions into this plan, with
      the date.
- [ ] Update `docs/protocol/mokly-upload-exchange.md`. Add the status line
      below the title.
  - [ ] Plan: add `blobEncodings` to the example. Add the field rule and the
        listing rule. Add the decision in force for keeping v1.
  - [ ] Fixture paragraph: a valid Plan case can carry `blobEncoding`, with
        `gzip` or the default `identity`. The coverage includes the encoding
        rule.
  - [ ] Blobs: the header block with `Content-Encoding: gzip` and
        `Content-Length` as the body length. Add the body rule of decision
        1 with its decision in force. The marker describes the decoded
        bytes, and each attempt sends the same request. A 400 also covers
        invalid gzip and a decoded mismatch.
  - [ ] Accounting And Output: `<size>` counts the bytes of decision 2. Add
        its decision in force.
  - [ ] Keep the page at 250 lines or fewer. If it passes 250, move
        Accounting And Output to its own page. Then update the four links to
        `#accounting-and-output`.
- [ ] Update `docs/protocol/mokly-upload-validation.md`. Add the status line.
      Add invalid Blob encoding to the 400 or 422 row. Add a limits row for
      a gzip Blob body and its decoded bytes. Add the receiver rules above to
      Receiver Validation.
- [ ] Add about seven cases to `docs/protocol/fixtures/upload-plan-v1.json`:
      `["gzip"]`, `["zstd","gzip"]`, `[null,1,"gzip"]` give `gzip`.
      `["br"]`, `["GZIP","gzip "]`, `"gzip"`, and `null` give `identity`.
- [ ] Update the case counts in `crates/mokly-publish/src/_tests_/fixtures_tests.rs`
      and `tests/installed_receiver_fixtures.test.ts`.
- [ ] Make `plan()` in `tests/helpers/receiver/upload.ts` return the
      encoding. Check each case's `blobEncoding` in
      `tests/installed_receiver_fixtures.test.ts`.
- [ ] Confirm that `mokly-upload.md`, `mokly-format-versions.md`, and
      `mokly-terminal-output.md` stay true. Change nothing that stays true.
- [ ] Run `npm run format:check`, `npm test -- tests/markdown_links.test.ts`,
      `npm test -- tests/installed_receiver_fixtures.test.ts`, and
      `cargo test -p mokly-publish fixtures`. Commit and push.

## Milestone 2: Mokly Cloud handoff

Give the receiver change its own owner under decision 3. The receiver plan
and pull request live in `mokly-ai/mokly-cloud`.

- [ ] Write `.context/gzip-blob-uploads/cloud-brief.md` against the protocol
      docs of this branch. Include:
  - [ ] The listing behind a configuration switch that is off by default:
        `blobEncodings` on `PlanResponse` in `crates/mkc-api/src/upload_plan.rs`.
  - [ ] The Blob handler in `crates/mkc-api/src/upload_blob.rs`. Accept
        `gzip`, which it rejects today. Apply the `Content-Length` rule.
        Decode within the decoded-size limit. Check the decoded length, then
        store through `store_blob`. Keep the drain path for durable blobs.
  - [ ] The upload memory reservation for the encoded and the decoded bytes.
  - [ ] Its docs: `docs/protocol/publication-upload-exchange.md`, the
        ingest memory budget, and the Blob description in
        `crates/mkc-api/src/contract/uploads.rs`.
  - [ ] A check that its edge forwards encoded request bodies unchanged.
  - [ ] The two phases, the rollback rule, and the fixture refresh from the
        release with `cargo xtask mokly-fixtures`.
  - [ ] Tests: a stored gzip Blob, the raw path, the length rule, a body
        that decodes past the declared size, invalid gzip, and the switch.
- [ ] Hand the brief to the owner of decision 3. Record the workspace or
      the owner here.

## Milestone 3: Gzip Blob bodies in the CLI

Parse the field, encode Blob bodies, and send them. The Plan archive,
Complete, accounting, and the summary keep their behaviour.

- [ ] `crates/mokly-publish/src/plan.rs`: parse `blobEncodings` with a
      typed lenient deserializer into `Plan`. Any other shape counts as
      absent.
- [ ] Add a module for the Blob body. A pure function takes the file bytes
      and the round's encoding. It returns the body and its encoding under
      decision 1.
- [ ] `crates/mokly-publish/src/http.rs`: add the encoding to `Request`.
      Plan and Complete use none. `ReqwestHttp` sets `Content-Encoding: gzip`
      on an encoded Blob.
- [ ] `crates/mokly-publish/src/exchange.rs`: encode on the blocking pool
      before `requests.send`, and observe cancellation while the job waits.
- [ ] `crates/mokly-publish/src/error.rs`: add an `InternalError` variant
      for an encoding or blocking-task failure.
- [ ] Update every `Request` construction in the tests.
- [ ] Rust unit tests, with unimock and the fake clock:
  - [ ] Body: compressible bytes give gzip that decodes to the same bytes,
        twice the same. Seeded random bytes, empty, and tiny files stay raw.
        Without the listing, every file stays raw.
  - [ ] Fixtures: `fixtures_tests.rs` checks each Plan case's
        `blobEncoding`.
  - [ ] Gzip path: each encoded Blob decodes to bytes with the URL digest.
        The incompressible file is raw.
  - [ ] Raw path: no Blob carries an encoding when the Plan has no field.
  - [ ] Retries: a gzip Blob answered 503, then 204, sends equal bodies and
        equal encodings, from captured inputs.
  - [ ] Re-plans: a gzip round followed by a round without the field sends
        raw bodies. Two gzip rounds send equal bodies.
  - [ ] Progress: `<size>` follows decision 2 when gzip is in use.
  - [ ] Cancellation while an encoding is pending gives `Error::Cancelled`
        and no Blob request.
- [ ] Rust integration tests with reqwest and the local server:
  - [ ] A receiver that lists gzip gets `content-encoding: gzip` with a body
        shorter than the file that decodes to the installed bytes. Without
        the listing, it gets raw bodies and no header.
  - [ ] `tests/fixture_server_tests.rs` checks each Plan case's
        `blobEncoding` across the HTTP boundary.
- [ ] Update `crates/mokly-publish/README.md`: the Blob encoding under
      `## What This Crate Does`, and the new module under `### Key Code`.
- [ ] Update `docs/guides/ci/the-upload.md`: the blobs, what the receiver
      must do, and the size in counts and cancellation.
- [ ] Remove the status lines from both protocol pages.
- [ ] Run `cargo test -p mokly-publish` and `cargo test -p mokly-cli`.

## Milestone 4: End-to-end test, smoke test, and measurement

Prove the encoding through the real CLI and record the gain.

- [ ] `tests/helpers/static_exchange.ts`: add a `gzip` option. It lists
      gzip, decodes with `maxOutputLength` set to the declared size plus one,
      and records each Blob's encoding. Without the option, a Blob with
      `content-encoding` fails the test.
- [ ] Add a Node test that runs `mokly publish` against the gzip receiver.
      It checks the exact received inventory, at least one gzip Blob, and
      gzip bodies smaller than their files.
- [ ] Run `npm run build`. Publish `examples/basic` in rich mode against a
      local receiver that lists gzip, then against one that does not. Record
      the Blob count, the body bytes, the raw Blobs, and the progress label.
      Save the receiver script and the results under
      `.context/gzip-blob-uploads/`. Add one line with the result below.

## Milestone 5: Verification, commit, review, and pull request

- [ ] Run the targeted tests: `cargo test -p mokly-publish`,
      `cargo test -p mokly-cli`, the new Node test,
      `npm test -- tests/static_publication.test.ts`,
      `npm test -- tests/installed_receiver_fixtures.test.ts`,
      `npm test -- tests/markdown_links.test.ts`, and
      `npm run format:check`.
- [ ] Run `cargo xtask check --suite repository`, then the complete gate
      `cargo xtask check`.
- [ ] Commit with Conventional Commits and push the branch.
- [ ] Review the complete local diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings,
      then apply the review-fix rule: fix the `Auto-fix: yes` findings,
      re-review once, and report the rest.
- [ ] Open the pull request when every other milestone TODO is ticked.
      Put its link in the status paragraph.

## Post-merge follow-up (non-blocking)

- [ ] Release the change in the next minor version.
- [ ] Mokly Cloud phase 1: deploy the decoder on every server, without the
      listing. Refresh the contract fixtures from the release.
- [ ] Mokly Cloud phase 2: turn on the listing. Publish `examples/basic` to
      a preview environment with the released CLI, and confirm gzip Blobs.
- [ ] Measure a first and a repeated publication against Mokly Cloud.

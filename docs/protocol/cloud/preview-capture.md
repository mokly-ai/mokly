# Preview Catalogue Capture

This is the capture sub-contract of [Preview seed](./preview-seed.md).

## Catalogue Capture

Capture publishes the checked-out committed revision. Keep tracked source,
styles and assets clean. `publish` builds in its own private directory outside
the checkout, so a local build output, such as the ignored `mokly-static/`,
never supplies publication bytes.
Never change uncommitted source during capture to conceal a revision
mismatch. The CLI checks HEAD and status before its build and again
before Plan. It stops before any receiver request on `git-uncommitted`.

| Failure category                     | Recovery                                                                                                                                               |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `git-uncommitted`                    | Commit, stash or ignore the named changes. Every build output directory follows [output ownership](./repository-generated-files.md) and stays ignored. |
| `build-invalid` from strict warnings | Fix the reported source, commit it and rerun. A `base-dependencies` warning never fails strict mode, so it never stops capture.                        |

The unprivileged `capture` job runs beside the image build with only
`contents: read` and no environment, secrets or OIDC. Neither job restores or
saves an Actions cache. No checkout persists credentials, and the PR checkout
holds the history that resolves `origin/main` and the merge base. Capture
runs the PR's own capture tools in that checkout, with `MKC_REVISION` set
to the PR head. Install and render already execute PR code in this job.
Run from the PR checkout:

```sh
python3 infra/scripts/capture-catalogue.py preview-pr-N \
  --checkout . --branch HEAD_REF
```

Add `--debug-timings` to forward Mokly's flag. Mokly writes one
`[mokly:timing] `-prefixed JSON event per diagnostic to stderr. Capture adds
one `Capture timings: ` JSON summary to stdout after a successful exchange.
The flag changes diagnostics only; the stored plan and blob bytes keep the
same contract. Default runs print neither timing stream.

| Capture summary field | Meaning                                                                                                         |
| --------------------- | --------------------------------------------------------------------------------------------------------------- |
| `headInstallSeconds`  | Head `npm ci` duration; null under `--local`, which requires installed dependencies and skips that install      |
| `publishSeconds`      | Entire Mokly subprocess duration, including the base render, any base dependency install, comparison and upload |
| `totalSeconds`        | Entire capture duration, including identity checks, head install when needed, receiver and final validation     |

The phase event fields are the pinned producer's own contract: the installed
`@mokly/mokly` package documents them in `docs/protocol/mokly-timings.md`.
Diagnostics contain no bearer value.

1. Validate the environment grammar, the 40-digit lowercase revision, the
   branch (nonempty, at most 255 UTF-8 bytes, no controls) and that the
   checkout's `HEAD` is that revision.
2. Run `npm ci` in the checkout.
3. Listen on `127.0.0.1` with an ephemeral port as the receiver of exactly one
   [upload exchange](./publication-upload-exchange.md), described below. Every
   request must carry the random placeholder bearer.
4. Run the checkout's exact-pinned 0.19.0 `node_modules/.bin/mokly publish`
   with `--strict` and `--config mokly.config.json`,
   `--repository github.com/mokly-ai/mokly-cloud`
   and `--endpoint` naming the loopback URL, a random placeholder
   `MOKLY_TOKEN`, `GITHUB_ACTIONS=true`, `GITHUB_HEAD_REF=<branch>` and
   `GITHUB_REF=refs/pull/N/head` for that process only. The workflow's own
   `GITHUB_REF` names the base branch and would drop the PR number. Config
   `review.base` (`origin/main`) selects comparison. Deadline: 15 minutes.
   That same publish deadline includes the base source extraction, any base
   dependency install, both renders, the comparison and the upload exchange.
   The preceding head dependency install has its own 15-minute command limit;
   the workflow's capture job has a 20-minute limit.
5. Require exit 0, a completed exchange and no refused request. Before opening
   the stored plan body as a tar, require exactly one complete gzip member
   whose CRC32 and ISIZE validate and no bytes after its trailer. Truncation, a
   second gzip member and any trailing bytes fail with exactly
   `Catalogue capture failed: catalogue upload is not a valid gzip archive`.
6. Read its `mokly-upload.json`
   and require repository `github.com/mokly-ai/mokly-cloud`, the input branch,
   `headSha` equal to `MKC_REVISION`, `pullRequest` `N`, `configPath`
   `mokly.config.json`, `baseRef` `origin/main`, `baseSha` equal to the merge
   base of the revision and `origin/main`, and `schemaVersion: 3`.
   Envelope 3 has no comparison path, so the non-null `baseRef`
   and `baseSha` are the proof of a comparison.
7. Write the exchange as the directory `.context/seed/catalogue`, holding the
   plan body byte-for-byte as `plan.tar.gz` and each blob as
   `blobs/<sha256>`; the job uploads that directory as artifact
   `seed-catalogue`, retained for one day.

The receiver answers the CLI as the released exchange requires:

| Request                                                                   | Receiver                                                                                    | Answer        |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------- |
| Plan: `POST`, `application/gzip`, positive `Content-Length` up to 100 MiB | Stores the body, applies step 5's gzip check, reads the envelope, marker and index versions | 200 plan JSON |
| Blob: `PUT` a `missing` hash, raw or Plan-approved gzip bytes             | Hashes the decoded body and keeps it as `blobs/<sha256>` only on a match, once per hash     | 204           |
| Complete: `POST` with no body after every missing hash arrived            | Marks the exchange complete; a repeat answers the same                                      | 201, no body  |

The plan archive must hold exactly upload envelope 3, the schema 3 ownership
marker and the index 9 `mokly-viewer/index.json`, each declared in the marker
with its exact digest and size. The
plan lists in `missing` every distinct declared hash except the plan archive's
own files, in ascending order, with a random upload ID, an expiry sixty minutes
ahead with exactly three fractional digits, and blob and completion URLs on the
receiver's own loopback origin, which the CLI requires before it sends its
bearer. The receiver refuses any other request, a second plan, more than 19,999
missing blobs or more than 512 MiB of them, a blob whose length or digest
differs from its declaration and a completion before every missing blob
arrived. Refusals use statuses the CLI does not retry, and each one fails
capture; when the CLI exits non-zero, capture reports the first refusal.

The stored plan and blobs are byte-for-byte what `mokly publish` sends to a
receiver that holds none of the catalogue. Capture is unprivileged because
install and render execute PR code. The release job copies these untrusted
bytes unopened to the run's [seed folder](./preview-seed.md#seed-command) in
the PR's bucket prefix, and the seed command replays them through the API's
upload service. The release job never opens, extracts or executes them. The
gzip pass proves framing only; the API remains the authoritative
[upload validator](./publication-upload.md).

## Comparison Base

The base is the merge base of the revision and `origin/main`.
[Mockup comparison base](./mockup-baselines.md) defines how the CLI
renders it from that commit's sources and installs its locked dependencies.
Capture adds these rules. A base install needs npm registry
access, also with `--local`; that option skips only the head install. Run only
trusted `origin/main` base code, because the base render executes that
commit's code and the CLI's environment allowlist is not a sandbox. Capture
runs in the unprivileged job with no cloud credentials, secrets, OIDC or
restored Actions cache. The fresh hosted runner starts with an empty Mokly
cache, so the capture budget must cover a cold base extraction and install.

A base whose sources fail the current validation makes Changes unavailable.
The CLI then finishes a current-only publication with null
`baseRef` and `baseSha` and no comparison generation. Capture
requires a comparison and rejects that envelope. Merge a `main` whose sources
pass the current validation into the PR and rerun. Capture never creates a
synthetic comparison.

## Format Changes

A PR that changes capture configuration or upload formats previews itself
with its own tools. Decision: capture runs the PR's own tools, because they
match the PR's producer, and the job already executes PR code. Rejected:
trusted `main` tools, which fail the capture of such a PR, and `main` tools
that read two format families.

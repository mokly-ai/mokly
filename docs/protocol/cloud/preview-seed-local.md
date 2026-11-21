# Local Preview Seed

This sub-contract of [Preview seed](./preview-seed.md) defines the local
preview account and the local capture and seed commands.

## Local Stack

On every run, `scripts/cloud/dev-api.sh` creates `.context/preview-sign-in`
(mode 0600) when absent and always runs the API with it as
`MKC_PREVIEW_SIGN_IN_SECRET`, `MKC_PREVIEW_SIGN_IN_EMAIL=preview@mokly.ai` and
`MKC_PREVIEW_SIGN_IN_PLAN=team`.
This is not an opt-in. The script passes its arguments to the API binary and
runs `serve` when it gets none.

- `capture-catalogue.py --local --checkout . --repository OWNER/NAME` accepts `--local` in place of
  `preview-pr-N`. It uses the installed packages instead of `npm ci` and
  captures the checkout's `HEAD` without Actions context.
  Supply the repository stored by the sample project.
  [Step 6](./preview-capture.md#catalogue-capture) requires the current branch
  and a null pull request together with the same repository, head, config path
  and comparison checks.
  The [comparison base](./preview-capture.md#comparison-base) still renders
  from the merge base's sources and may install its locked dependencies, so
  local capture needs registry access and the same trusted base.
  `--debug-timings` forwards
  Mokly's flag; [Preview capture](./preview-capture.md#catalogue-capture)
  defines the timing output, in which `headInstallSeconds` is null under
  `--local`.
- `scripts/cloud/dev-api.sh preview-seed` stages `.context/seed/catalogue` and a
  request for the checkout's `HEAD` as the run `local` in the local store,
  with environment `local` and a null pull request. It then runs the same
  [seed command](./preview-seed.md#seed-command), `preview-seed --run local`,
  against the local stack. The status and the proof use environment `local`,
  the proof's `pullRequest` is null, and its viewer URL starts with the local
  app origin. A catalogue captured at another commit fails the head check
  before any upload; capture it again.

The [workspace README](../../development/cloud.md#local-preview-stack) gives the commands.
The local sample project is public too, so its Changes load. A signed-out
reader opens its publication at `http://p-<publicationId>.localhost:8082/`,
with the `publicationId` of `seed/local/seed-proof.json` under
`MKC_FILE_STORE_ROOT`. The local scripts default that root to `.context/blobs`
and the catalogue origin to `http://localhost:8082`. To use the app, sign in by
opening `<app origin>/auth/preview/callback#secret=<secret>` with the local
secret.

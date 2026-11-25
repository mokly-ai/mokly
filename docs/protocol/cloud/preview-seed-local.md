# Local Preview Seed

Status: The local stack still creates a random sign-in value in place of a local password, and Sign in draws no password section yet. [Milestone 5](../../../plans/preview-password-sign-in.md#milestone-5-store-deploy-comment-and-local-stack) builds the local password, and [Milestone 6](../../../plans/preview-password-sign-in.md#milestone-6-sign-in-password-section) the section.

This sub-contract of [Preview seed](./preview-seed.md) defines the local
preview account and the local capture and seed commands.

## Local Stack

On every run, `scripts/cloud/dev-api.sh` creates `.context/preview-password`
(mode 0600) with a random local preview password when absent. It always runs
the API with that password's verifier as `MKC_PREVIEW_SIGN_IN_VERIFIER`, with
`MKC_PREVIEW_SIGN_IN_EMAIL=preview@mokly.ai` and
`MKC_PREVIEW_SIGN_IN_PLAN=team`, so the local stack draws the same password
section as a preview.
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
Sign in on `<app origin>/sign-in` with the password from
`.context/preview-password` in **Password**. The project remains private. The
viewer reads comparison documents without credentials, so its private
comparison stops at
the documented
[private artifact limit](./viewer.md#private-artifact-limit).
The viewer then shows an overlay without an action for
Changes, and it does not claim that private Changes loaded. The
current catalogue stays browsable.

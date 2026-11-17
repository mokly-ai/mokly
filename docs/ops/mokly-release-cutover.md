# Mokly Release Cutover

This runbook covers the current 0.19.0 upgrade and the earlier format cutover.
[Deployment](./deploy.md) holds the release and publish proof commands.

## Upgrade To 0.19.0

1. Deploy the app and API with the exact-pinned 0.19.0 packages.
2. Republish each hosted catalogue with `@mokly/mokly@0.19.0` from a clean
   committed checkout. Use the publish command below. Pages from 0.18 use
   frame wire version 2, while the new viewer requires version 3.
3. Run the [publish proof](./deploy.md#publish-proof) with 0.19.0.

The upload envelope remains 3, the index remains 9, and entry details remain 4.
The upgrade needs no database reset. Existing publications keep their bytes.
Their frame interaction needs a new publication from the matching CLI.

The steps below apply only to environments that still need the earlier
0.18 format cutover from 0.14. Use the currently installed 0.19.0 CLI when
republishing after that cutover.

## Order

Run these steps in order after the change merges.

1. Deploy the API and the app before any job publishes with 0.18.0. The
   normal Deploy run of the merge commit does this. A receiver from before the
   cutover answers HTTP 426 `upload-unsupported-version` to envelope 3, and
   the new receiver answers 426 to every envelope other than 3 and every index
   other than 9.
2. Reset each stable environment with
   `gh workflow run deploy.yml --ref main -f reset=true`, as
   [Promotion and infrastructure ownership](./deploy.md#promotion-and-infrastructure-ownership)
   defines. It recreates main-preview first, and production only when
   `MKC_PRODUCTION_ENABLED=true`.
   Stored 0.14.0 publications are not converted, because the 0.18.0 viewer
   cannot render them. A migration that deletes only
   publication rows and a reader for stored 0.14.0 reviews were rejected for
   the same reason.
3. Republish the dogfood catalogue in each reset environment. Sign up again,
   then create the workspace, the `mokly-ai/mokly-cloud` project with config
   path `mokly.config.json` and a publishing token through the app.
   Do not use SQL fixtures or seed migrations. Set `PROJECT_ID`
   and `MKC_API_ORIGIN` as the [publish proof](./deploy.md#publish-proof)
   does. Keep the token in a mode-0600 file outside the checkout. After
   `npm ci` in a clean checkout of the merge commit, run:

   ```sh
   export MOKLY_ENDPOINT="${MKC_API_ORIGIN:?}/v1/projects/${PROJECT_ID:?}/publications"
   export MOKLY_TOKEN="$(cat /secure/dogfood-publish-token)"
   node_modules/.bin/mokly publish --strict --config mokly.config.json \
     --repository github.com/mokly-ai/mokly-cloud --no-changes
   unset MOKLY_TOKEN
   ```

4. Recreate every labelled PR preview that was created before the merge, once
   its branch contains the cutover. Its seed project keeps the old config path,
   so the seed fails with a mismatch until the preview is new.
   Remove the `preview` label, wait for cleanup, and add the label again; the
   new namespace seeds an empty database. Each cycle issues a new catalogue
   certificate, so respect the
   [certificate limits](./preview.md#costs-and-certificate-limits).
5. Run the preview proof on the next labelled PR: its capture, seed and
   **Sample project** must pass. A capture-job change takes effect only after
   it merges, because `pull_request_target` runs the workflow from `main`.
   Later format-changing PRs preview themselves with their own tools, as
   [format changes](../protocol/cloud/preview-capture.md#format-changes) defines.
6. Run the [publish proof](./deploy.md#publish-proof) with 0.19.0 and record
   it.
7. Follow the [gzip Blob rollout](./publish-smoke.md#gzip-blob-rollout),
   because the pinned CLI sends gzip Blob bodies when the Plan lists gzip.

## Clean Checkout

Use a clean committed checkout for capture and the deployed proof. On
`git-uncommitted`, commit, stash or ignore the named changes. A build output
directory must be ignored, and the error names the `.gitignore` rule to add.
The canonical tree follows
[output ownership](../protocol/cloud/repository-generated-files.md).
Do not use an override or publish uncommitted source. The CLI refuses before
Plan. A base whose sources fail the current validation makes Changes
unavailable, which preview capture rejects.

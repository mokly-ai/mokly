# Preview Seed Job

This sub-contract of [Preview seed](./preview-seed.md) defines the Job that
runs the [seed command](./preview-seed.md#seed-command) in a PR namespace, and
the trusted release script that starts it and collects its result.

## Job Template

The PR's Helm release, rendered from `main`'s chart, holds a suspended CronJob
`preview-seed` as the template of the seed Job; stable releases render none.
Its pod runs the API image with `args: [preview-seed]`, the API's environment
and secret mounts, the `api` service account and the `maintenance` label. It
sets `restartPolicy: Never`, `backoffLimit: 0` and a 1200-second
`activeDeadlineSeconds`. Each deploy updates the template's image, so a Job
made from it runs the deployed revision.

## Release Script

After deploy evidence, also when capture failed, the trusted release job runs
`python3 infra/scripts/preview-seed-job.py preview-pr-N --run <run>`, with
`--catalogue .context/seed/catalogue` only when capture succeeded. The script:

1. Writes `request.json` with revision `MKC_REVISION`. With `--catalogue`, it
   copies the captured plan and blobs unopened to the run's `catalogue/` folder.
2. Creates the Job `preview-seed-<run>` from the CronJob, with `--run <run>`
   added to its arguments.
3. Waits up to 25 minutes for the Job to complete or fail, and prints the
   Job's log in the workflow log.
4. Downloads the status and the proof that exist to `.context/seed-status.json`
   and `.context/seed-proof.json`.
5. Deletes the Job, and removes the seed folders of earlier runs.

Steps 3 to 5 also run after a failed Job or an expired wait, so a late pod
never seeds beside the next run and the workflow log always holds the seed's
output. The script then fails unless the status has `project` `seeded`.

When the Job fails and wrote no status, the command did not start or found no
valid request. The script then reports exactly `The seed wrote no status. If
this revision predates the API preview seed, merge main into the pull request
and rerun the workflow.` Its other diagnostics start with
`Preview seed failed: `.

`preview-seed-job.py preview-pr-N --validate-evidence` requires the downloaded
status and proof to hold exactly the fields of
[Status and proof](./preview-seed.md#status-and-proof), for the tested
environment and `MKC_REVISION`, with `signIn` `accepted`, `project` `seeded`,
the seed slugs, state `ready`, pull request `N`, `uploadStatus` 200 or 201,
canonical UUIDs and a viewer URL under `https://pr-N.preview.D/`.

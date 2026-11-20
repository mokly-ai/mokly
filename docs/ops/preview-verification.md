# Preview Verification Record

Operator-run proofs of the [preview environments](./preview.md), kept as
evidence of the live checks.

Operator-run proof on 2026-09-23 against `mkc-autopilot` with this branch's
scripts, for `preview-pr-18` (PR 18, revision `8f409ac1`):

| Step                   | Result                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Foundation apply       | Shared address `34.173.26.38`, preview bucket, three secret IDs, deploy grants, `*.preview.D` and `*.preview.api.D` created; the plan is clean afterwards                                                                                                                                                                                                                                                                                       |
| Shared secrets         | Origin CA certificate for exactly `*.preview.D`, `*.preview.api.D` (expires 2027-09-23); catalogue DNS token scoped to `C` only, verified by probe                                                                                                                                                                                                                                                                                              |
| Platform               | `preview-platform.sh` installed cert-manager v1.21.2 and ingress-nginx 4.15.1; readiness gate reports the reserved address                                                                                                                                                                                                                                                                                                                      |
| Deploy identity        | With a token minted as `mkc-github-deploy`, every platform and PR object verb is allowed after `mkcPreviewPlatformDeploy`; before it, RBAC and webhook creation were denied                                                                                                                                                                                                                                                                     |
| Deploy and smoke       | First install passed API, migration and revision checks; the app check needed the origin router, which had never been deployed on `main` (no Worker routes existed). After the Worker deploy all eight smoke checks pass through Cloudflare                                                                                                                                                                                                     |
| Redeploy               | Helm revision 2; PVC `data-postgres-0` and `Secret/catalogue-tls` kept their UIDs                                                                                                                                                                                                                                                                                                                                                               |
| Catalogue TLS          | `Certificate/catalogue-tls` Ready, Let's Encrypt, valid to 2026-12-22                                                                                                                                                                                                                                                                                                                                                                           |
| Trusted proxy          | 21 magic-link requests each forging a different `X-Forwarded-For` hit the per-peer limit on request 21 (HTTP 429), so forged headers are ignored                                                                                                                                                                                                                                                                                                |
| Publish proof          | Real upload 201, replay 200, ready app and catalogue URLs, private bytes and isolation headers verified through the edge                                                                                                                                                                                                                                                                                                                        |
| Browser suite          | Run as the `e2e` Job in the PR namespace against the deployed preview: 118 passed, 48 skipped (the exact checked-in exclusion inventory), 2 flaky, 1 failed in 22 minutes, with a complete publish proof (upload 201, replay 200, content and isolation verified). The one failure, `viewer-mobile.spec.ts:151`, fails identically from an operator laptop and is a product defect recorded in the plan's review findings, not a preview defect |
| Idempotence            | After the first destroy, a fresh deploy passed all eight smoke checks within three minutes (Helm revision 1, new PVC); the second destroy removed 212 objects in two batches and finished in under two minutes with the namespace, bindings, objects and DNS record gone                                                                                                                                                                        |
| Destroy                | First run removed the release, namespace, bindings and DNS record but left every object: the cleanup parser rejected the CLI's JSON array, and the fixed parser then removed one object per CLI call, 428 objects running past a 25-minute command timeout with 67 left. With batched removal the rerun of the same command finished in 27 s; namespace, bindings, objects and DNS record all gone                                              |
| Redeploy after destroy | Fresh namespace: Helm revision 1, a new `data-postgres-0` UID, `Certificate/catalogue-tls` Ready and all eight smoke checks passed within three minutes                                                                                                                                                                                                                                                                                         |

Live runs exposed and fixed fourteen defects in the branch before this record:
kubectl's `List` kind for selector listings (endpoint discovery and the
sign-in link reader), root-owned suite output directories in the e2e image,
an empty Job log capture, a Job wait that ignored `Failed`, a 30-minute Job
deadline the suite cannot meet on Autopilot, a `beforeEach` skip that let
excluded tests run after a retried neighbour, catalogue hosts that cannot
hairpin to the shared external address from inside the cluster (resolved to
the controller ClusterIP through `hostAliases` and a Chromium resolver rule),
an `ipBlock` policy rule Dataplane V2 never matches for in-cluster traffic
(replaced by a namespace and pod selector), Chromium's private network access
block on the resolved catalogue address, a sign-in link reader whose
since-time started after the request reached the API, the two object
cleanup defects in the destroy row, a sign-in link reader that failed on the
invitation email an invited member also receives, a harness that ended a test
on one refused log request and hid the reader's diagnostic, and a runner that
lost the report frames when the operator's log stream was reset.

The in-cluster browser Job, its test image and the publish proof recorded above
were removed on 2026-09-25 because the suite added about 30 minutes to every
push. Browser tests run in CI against a local stack.

`pull_request_target` uses the workflow on `main`, so the merged workflow's
first label/push/unlabel/close run is a separate post-merge follow-up. Record
its run URLs here after it happens; local fixtures are not cloud evidence.
The first label run is
[36113198199](https://github.com/mokly-ai/mokly-cloud/actions/runs/36113198199)
(PR 17): attempt 1 stopped when the cluster's DNS endpoint answered the
namespace create with a Google front-end 403 before it reached Kubernetes;
attempt 2 created the namespace, deployed and passed all eight smoke checks.

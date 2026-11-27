# Production Deployment

Production infrastructure was provisioned on 2026-09-21 in `mokly-508518`,
alongside the existing main-preview environment. The table and release evidence
below record that deployment before the shared-origin migration; they have not
been repeated for the new layout.

| Surface                    | Address                                                                 |
| -------------------------- | ----------------------------------------------------------------------- |
| App                        | `https://app.mokly.ai`                                                  |
| API                        | `https://api.mokly.ai`                                                  |
| Publications               | `https://p-<uuid>.moklyusercontent.com`                                 |
| Reserved ingress IPv4      | `34.54.181.183`                                                         |
| GKE namespace              | `mkc-production` in `mkc-autopilot`, `us-central1`                      |
| Cloud SQL                  | `mokly-508518:us-central1:mkc-production`, private regional Postgres 16 |
| Private publication bucket | `mokly-508518-production-blobs`                                         |

The next rollout serves the app at `https://mokly.ai/dashboard` through the Worker,
with its workload at `app-origin.mokly.ai`. The API and publication origins
remain as recorded above. Before rollout, reconcile DNS and rotate the Origin
CA certificate to cover the internal app host, API and catalogue wildcard, per
[Secrets](./secrets.md) and [Environments](./environment.md). Run the
[deployment smoke](../protocol/cloud/deployment-smoke-checks.md) against the new
public origin and record fresh evidence.

## Provisioning Evidence

The environment plan created ten resources with no updates or deletes: the
reserved ingress address, Cloud Armor policy, publication dead-letter alert,
three proxied DNS records, Cloud SQL instance/database and two IAM SQL users.
The post-apply environment plan reported no changes.

Foundation now owns the workload Google-account secret grants. Six existing
main-preview grants were imported before the reviewed reconciliation created
six production grants and removed twelve obsolete Kubernetes-principal grants.
This was a targeted reconciliation of the two secret modules; it did not apply
the unrelated legacy-domain redirect migration. See [Secrets](./secrets.md) for
the identity model and import procedure.

Production has its own catalogue signing key and Origin CA certificate, valid
until 2027-09-21, covering the app, API and catalogue wildcard. Their key match,
hostnames and expiry were verified before rollout. Both Cloudflare zones use
Full (strict) TLS with Browser Integrity Check disabled. The existing production
Postmark server credential authenticated successfully without sending mail.

Temporary GKE Jobs applied all six API migrations through the production API
IAM identity. Database/schema grants ran as the administrator; table and default
privilege grants ran as the API table owner. The administrator password was
invalidated and all temporary Jobs, the credential Secret and bootstrap service
account were removed. No product data was seeded.

## GitHub App

Production uses the existing **Mokly AI** App, owned by `mokly-ai`:

```json
{
  "github": {
    "enabled": true,
    "appId": "4991152",
    "clientId": "Iv23liVmZ4ZTUEoNCon6",
    "appSlug": "mokly-ai"
  },
  "billing": {
    "enabled": true
  }
}
```

This is repository variable `MKC_PRODUCTION_APP_CONFIG`. Its private key
authenticated as the expected App, and its webhook uses
`https://api.mokly.ai/v1/github/webhooks`, JSON and verified TLS. The original
20-byte webhook secret was rotated to a 64-character random value in GitHub,
the operator's local credential file and Secret Manager before rollout. All
three GitHub credentials are API-only Secret Manager mounts.

The recorded release used callback `https://app.mokly.ai/auth/github/callback`
and setup URL `https://app.mokly.ai/auth/github/install`. At the shared-origin
rollout, change them to `https://mokly.ai/auth/github/callback` and
`https://mokly.ai/auth/github/install`. The production App had Redirect on
update disabled until the operator enabled it on 2026-11-27. App authentication and
deployment smoke do not substitute for the interactive OAuth/installation
walkthrough in [GitHub smoke](./github-app-smoke.md).

## First Release Inputs

The first release uses revision `bef1e6c076f4e8d7ad53e5da6419aff472ae8f79`, whose
images and main-preview rollout passed in
[Deploy run 35637044881](https://github.com/mokly-ai/mokly-cloud/actions/runs/35637044881).
The production app was separately built with production origins.

| Workload               | Immutable image digest under `us-central1-docker.pkg.dev/mokly-508518/mokly/` |
| ---------------------- | ----------------------------------------------------------------------------- |
| `mkc-api`              | `sha256:4a419b4921ec9b86968aef7781ae5c397028874faa99f8c0ebd59fa4f3897a78`     |
| `mkc-catalogue-server` | `sha256:40c468c9b870af9ec50e2166ca56d135da42d175980ee46f4dab2c35a8ce8ac0`     |
| `app`                  | `sha256:5b8764eef6dc72c90c0dcd80f30cf79f0beb65bb25399193fe2c1d9a843c14b1`     |

Strict Helm lint and GKE server admission passed for all 25 rendered resources.
Release values SHA-256:
`3009e66574d50352240306eba2efb06b49422fdc56d02c986d7d2f627e0565a0`.
Rendered manifests SHA-256:
`bbd4f79794b7073154762eef89f80746efaf9de4f76efa130e2914c59d146d7b`.

Helm revision 1 is `deployed`. Each service has two available replicas, ingress
reports `34.54.181.183`, and all four reported GCE backends are healthy. The
rollout's own smoke passed all seven checks. An independent public smoke also
passed at 22:19:32 UTC on 2026-09-21, confirming the intended revision, current
migrations, app document, wildcard DNS and catalogue isolation/security headers.
The browser sign-in page returned 200 and rendered both sign-in actions without
JavaScript errors. These checks do not constitute a production publish proof.

## Promotion

Repository variable `MKC_PRODUCTION_ENABLED=true` was enabled only after the
first production rollout and smoke succeeded.

The ingress map preserves main-preview's `8.232.187.218` and adds production's
`34.54.181.183`. A push or accepted manual Deploy dispatch on `main` authorizes
production deployment without a second environment review. The workflow
publishes and applies the exact saved infrastructure plan before starting the
release with its matching Helm values. A release must pass main-preview apply,
rollout and smoke before production planning begins; production also requires
its own successful apply and smoke. See [Deployment](./deploy.md).

The first-install smoke budget is 15 minutes for a new GCE load balancer;
subsequent releases use 60 seconds. All checks remain required, and an upgrade
failure rolls back to the prior Helm revision. The stable deployment jobs allow
40 minutes for tool setup, Helm and smoke.

## Billing

On 2026-10-30 the operator enabled billing in production, in the Stripe live
mode of `acct_1UI7K0POK3tj6dqE`, before the main-preview
[walkthrough](./billing-smoke.md#walkthrough) ran:

| Item                                      | Value                                                                                                                                                          |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Secret versions                           | Version 1 of `mkc-production-stripe-catalogue-key`, `mkc-production-stripe-secret-key` and `mkc-production-stripe-webhook-secret`                              |
| Webhook endpoint                          | `we_1UWHTaPOK3tj6dqEtwnzyRPp`, for `https://api.mokly.ai/v1/billing/webhooks` with Snapshot payloads, API version `2026-08-26.dahlia` and the six typed events |
| Customer Portal default configuration     | `bpc_1UWHUbPOK3tj6dqEBc8RFXUg`, with the one-subscription limit on                                                                                             |
| Product `mokly_team`                      | `prod_VXMarBUGYWJn59`                                                                                                                                          |
| Price `mokly_team_editor_usd_month`       | `price_1UWHr3POK3tj6dqE7fBRPMcz`                                                                                                                               |
| Price `mokly_team_collaborator_usd_month` | `price_1UWHr3POK3tj6dqEqaLoWdoL`                                                                                                                               |

[Deploy run 41078918408](https://github.com/mokly-ai/mokly-cloud/actions/runs/41078918408)
from revision `06320e4f484905567fa9e06bea1a87350b59abb3` created the product and
both prices, and passed all twelve production smoke checks, including both
billing webhook checks. A separate request with a forged signature returned 401
`webhook-signature-invalid`, and a request without the header returned 400
`validation-failed`. Stripe Tax is active with a GB head office and no
registration, so Checkout adds no tax until the operator adds one. No live
Checkout has run yet.

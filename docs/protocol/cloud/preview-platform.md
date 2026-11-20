# Shared Preview Platform

This sub-contract of [PR preview environments](./pr-preview-environments.md)
is implemented by the main deploy workflow's `preview-platform` job after
`origin-router` and before `plan-main-preview`. It is a required aggregate
stage whenever cloud deployment is configured. PR workflows call only the
readiness script, never install or upgrade shared components.

## Inputs And Foundation

`bash infra/scripts/preview-platform.sh` and
`bash infra/scripts/preview-platform-ready.sh` take no positional arguments.
Both require `MKC_REGION`, `MKC_PREVIEW_INGRESS_IP` (IPv4),
`MKC_PREVIEW_BLOBS_BUCKET=mokly-508518-preview-blobs`, `MKC_DOMAIN`,
`MKC_CATALOGUE_BASE_DOMAIN`, `MKC_CATALOGUE_CLOUDFLARE_ZONE_ID` and an
authenticated Google identity. Validate all inputs before provider calls: region follows the existing
`[a-z]+-[a-z]+[0-9]+` grammar; zone ID is 32 lowercase hexadecimal digits;
D/C are DNS domains with distinct ICANN/private-PSL registrable domains.
The scripts use the system `libpsl` data for that registrable-domain check;
an unavailable PSL runtime is a validation failure, never a reason to fall
back to comparing the final two labels.
Use cluster `mkc-autopilot`, project `mokly-508518` and its DNS endpoint;
select the explicit context rather than an operator's current namespace.

Foundation owns the regional external address `mkc-preview-ingress`, bucket,
two proxied A wildcards and three shared Secret Manager IDs in the parent
contract. Both wildcards are proxied A records with Cloudflare automatic TTL
(`1`); specific stable DNS records win over them, and the app/API edge pack is
shared. Foundation outputs `preview_ingress_ip` and `preview_blobs_bucket`
supply the two repository variables. Secret versions are operator-owned.

## Installation Contract

Create namespace `mkc-preview-system` idempotently. Read the three Secret
Manager values into private temporary storage that is removed on exit,
validate a nonempty token and check the key and certificate with the
[origin certificate rules](#origin-certificate-rules), then upsert:

| Kubernetes Secret     | Type / keys                               | Secret Manager source                                       |
| --------------------- | ----------------------------------------- | ----------------------------------------------------------- |
| `preview-origin-tls`  | `kubernetes.io/tls`, `tls.key`, `tls.crt` | `mkc-preview-origin-tls-key`, `mkc-preview-origin-tls-cert` |
| `catalogue-dns-token` | `Opaque`, `api-token`                     | `mkc-catalogue-dns-token`                                   |

The installer stops with a distinct diagnostic for each of three causes of a
failed certificate check: a missing `openssl` command, a certificate that
`openssl` cannot read, and a certificate that is expired or expires within
24 hours. One generic certificate error is rejected because it hides the
real cause, such as a missing tool reported as an expiry.

Never log values, inject tokens as command arguments, or put them in Helm
values/release history. Only the catalogue-zone DNS token enters the cluster.

Install both releases in that namespace from their pinned chart versions,
waiting at most 15 minutes for each:

| Release         | Chart                                                             |
| --------------- | ----------------------------------------------------------------- |
| `cert-manager`  | `cert-manager` from `https://charts.jetstack.io`                  |
| `ingress-nginx` | `ingress-nginx` from `https://kubernetes.github.io/ingress-nginx` |

The [checked-in platform values](../../../infra/helm/platform/) hold every static
chart setting. The installer passes only the reserved address and the
Cloudflare CIDR list as per-run overrides, and that list has one checked-in
copy, shared with the workload chart. Cert-manager installs its CRDs, keeps
its webhook and cainjector enabled, elects leaders and stores cluster resources
in `mkc-preview-system`, and declares explicit Autopilot resource requests.
Ingress-nginx runs one controller replica for class `mkc-preview` (controller
value `mokly.ai/preview-ingress-nginx`, not the default class, watching no
classless Ingress) with its admission webhook disabled and snippet annotations
refused. Its Service is an L4 passthrough load balancer with `Local` traffic
policy on the reserved address, which preserves the source address, and its
default certificate is `preview-origin-tls`.

Restrict real-IP trust to Cloudflare CIDRs; full forwarded headers append the
original connecting peer, preserving the Cloudflare hop. The API performs
the allowlisted walk in [REST](./rest-proxies.md#trusted-proxies). PR ingress must
permit the upload contract: `nginx.ingress.kubernetes.io/proxy-body-size: 100m`
and `nginx.ingress.kubernetes.io/proxy-read-timeout: "300"`, with request
buffering disabled (`nginx.ingress.kubernetes.io/proxy-request-buffering: "off"`).
Do not inherit nginx's small default upload limit. Stable GCE limits stay as-is.

Apply `ClusterIssuer/mkc-preview-letsencrypt` with
`spec.acme.server=https://acme-v02.api.letsencrypt.org/directory`,
`privateKeySecretRef.name=mkc-preview-letsencrypt-account` and no email field
(ACME contact is optional; no invented operator address). The account Secret
lives in `mkc-preview-system` and survives PR cleanup. One solver has
`selector.dnsZones=[C]` and
`dns01.cloudflare.apiTokenSecretRef={name: catalogue-dns-token, key: api-token}`.
The token has Zone → DNS → Edit and Zone → Zone → Read on exactly catalogue
zone `C`; neither app-zone access nor Cloudflare account-wide DNS access.
Cert-manager owns temporary DNS-01 TXT records and removes them after validation.
The installer substitutes the validated catalogue domain into the checked-in
issuer template in private temporary storage before authorization and apply.

## Authorization And Readiness

Deploy holds project-level `roles/container.developer`, Artifact Registry
writer, named ingress-secret access, and the project-level custom
`mkcPreviewPlatformDeploy` role, plus
`roles/secretmanager.secretAccessor` on the three shared IDs and
`roles/storage.admin` on the shared preview bucket only. This grants no
Terraform state access or project IAM administration. The bucket IAM exception
permits the two per-PR conditions, never changes to other buckets.

Before installing, render both pinned charts and inventory their cluster-scoped
resources: cert-manager CRDs, ClusterRoles/ClusterRoleBindings, validating and
mutating webhook configurations; ingress-nginx ClusterRole/ClusterRoleBinding
and `IngressClass/mkc-preview`; then the ClusterIssuer. For every item, verify
the deploy identity's `create`, `get`, `list`, `watch`, `update`, `patch` and
`delete` permissions with the real cluster; one denial stops before namespace
or Secret mutation. The installer records the rendered names, and the tests
hold the inventory of the pinned renders. Do not
assume `roles/container.developer` permits CRDs or RBAC escalation: a denied
operation blocks installation until
foundation records the smallest necessary grant and its reason. No blanket
Owner, Editor or cluster-admin fallback is authorized by this contract.

`roles/container.developer` cannot create ClusterRoles, ClusterRoleBindings,
Roles, RoleBindings or webhook configurations, all of which the two charts
create, so foundation binds the custom
`projects/mokly-508518/roles/mkcPreviewPlatformDeploy` to the deploy service
account only. It grants exactly the missing RBAC and webhook
create/update/delete permissions, plus RBAC `escalate` and `bind`, because
Kubernetes refuses to create a (Cluster)Role or (Cluster)RoleBinding whose
permissions the caller does not itself hold. Project IAM cannot condition the
role on Kubernetes object names; the project has only cluster `mkc-autopilot`,
and only trusted `main` workflows can assume the deploy identity.

Wait for all three cert-manager Deployments and `ingress-nginx-controller`
rollout; require the class controller value above, issuer `Ready=True`,
nonempty TLS/DNS Secrets of the listed types, a `preview-origin-tls` key and
certificate that meet the [origin certificate rules](#origin-certificate-rules),
and controller Service
`status.loadBalancer.ingress[].ip` equal to `MKC_PREVIEW_INGRESS_IP`.
Reject an observed different IP immediately; allow at most 900s for a pending
address or issuer. Report only resource names, chart versions, readiness and
address, including the complete cluster-scoped inventory. Re-running must
preserve the ACME account, address, certificate identities and PR resources.
Both the installer's final gate and the read-only gate also require the
namespace metadata-name label used by PR NetworkPolicies. Their 900-second and
60-second budgets respectively cover the complete explicit rollout/readiness
gate, rather than resetting once for every Deployment.

The read-only readiness script checks the same namespace, Deployments, class,
issuer, TLS Secret and Service address within 60s. It does not read Secret
Manager, install charts or repair the platform. Any failed resource check emits one actionable
diagnostic: `Preview platform is not ready; run deploy.yml's preview-platform job.`
Include the failing resource name without secret bytes and exit nonzero.
Only a wholly unconfigured cloud deployment may explicitly skip this job; a
partial identity/variable configuration is a failure of the required aggregate.

## Origin Certificate Rules

Here `D` is `MKC_DOMAIN`. The installer applies these rules to the Secret Manager key and certificate
before the upsert. The installer's final gate and the read-only gate apply the
same rules to `tls.key` and `tls.crt` of the cluster Secret `preview-origin-tls`:

- The certificate is readable.
- The certificate expires more than 24 hours later.
- Its SANs are exactly `*.preview.D` and `*.preview.api.D`.
- The private key is readable and matches the certificate.

When the cluster Secret fails a rule, both gates name
`Secret/preview-origin-tls` as the failing resource. Neither script writes
decoded Secret bytes outside private temporary storage that is removed on exit.
Both scripts require the `openssl` command and check for it before provider
calls. When `openssl` is missing, the read-only gate stops with its own
diagnostic, not `Preview platform is not ready`. A rerun of the platform job
does not install a missing tool. The rules do not check the issuer, so a pass
does not show that Cloudflare accepts the certificate.

Readiness checks the certificate, not only its nonempty bytes, so that a PR
deploy stops before it changes resources when the certificate is unusable. One
set of rules for all three checks is chosen over separate readiness checks,
which could drift from the installer's. The readiness gate makes no network
probe through Cloudflare.

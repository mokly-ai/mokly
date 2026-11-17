---
title: Security
effective: 2026-09-22
---

This page summarizes how Mokly protects account, workspace, project,
repository and publication data.

Send security questions and reports to
[hello@mokly.ai](mailto:hello@mokly.ai).

## 1. Hosting and isolation

Production runs in Google Cloud's `us-central1` region in Iowa, United States.
The API and catalogue services run on Google Kubernetes Engine Autopilot.
Application records are stored in a private, regional Cloud SQL PostgreSQL 16
instance. Publication files are stored in a private Google Cloud Storage bucket
with public access prevention and uniform bucket-level access.

Production data, credentials and signing keys are kept separate from review
environments. Production PostgreSQL is regional and
configured for high availability.

Cloudflare provides DNS and TLS transport for the public site, application,
API and publication hosts. It is not the system of record for customer
content, and app, API and publication traffic bypasses edge caching where
authorization must be checked by Mokly.

## 2. Encryption and transport

Public web, API and publication traffic uses HTTPS/TLS. Cloudflare uses strict
TLS between its edge and Mokly's ingress. Database connections use the Cloud
SQL Auth Proxy over encrypted connector traffic, and the database has no public
IPv4 address.

Google Cloud provides encryption at rest for customer content stored in its
managed infrastructure, including Cloud SQL, Cloud Storage, Secret Manager and
backups.

## 3. Authentication and sessions

Mokly does not accept passwords. Email sign-in uses a cryptographically random,
single-use magic link that expires after 15 minutes. Mokly stores only its
SHA-256 digest.

GitHub sign-in uses OAuth state, PKCE and an exact callback address. Mokly
accepts only a verified primary GitHub email for sign-in. GitHub user access
and refresh credentials are discarded after the callback and are not stored.

Signed-in sessions use a cryptographically random credential whose digest is
stored in the database. The cookie is Secure, HttpOnly and SameSite=Lax, is
revocable and rotates after authentication and explicit session rotation.
Sessions expire after seven days without activity and after 30 days in all
cases.

Authenticated changes require the exact application origin and a
session-specific CSRF token. Authentication and token responses are not cached.

## 4. Roles, integrations and tokens

Workspace roles and project grants limit what each user can read or change.
Project administration, membership changes, visibility changes, publishing
tokens and deletion are checked at the API boundary. The last workspace
owner cannot be removed or demoted.

GitHub repository access is granted through a GitHub App installation. Mokly
uses installation credentials only for the connected workflow and keeps user
authentication separate from repository installation authorization.

Publishing tokens contain 256 random bits. Mokly stores a SHA-256 digest and a
short non-secret prefix, returns the full token only when it is created and
supports revocation. Credentials, cookies, CSRF tokens and email bodies are not
written to production diagnostics.

## 5. Publication isolation

Each publication is served from its own subdomain under the separate
`moklyusercontent.com` catalogue domain. User-authored HTML is never served
from the application or API origin.

Publication responses apply content-type, referrer, permissions and content
security policies. Catalogue HTML can load only same-publication resources and
cannot submit forms, load arbitrary external scripts or connect to unrelated
origins. The application adds an iframe sandbox when it embeds a catalogue.

Public projects can be read without a credential. Private publications require
a one-use access grant exchanged on the publication host for a signed,
host-only, Secure, HttpOnly cookie lasting five minutes. The application
session is never sent to a publication host. Stored publication objects remain
private in Google Cloud Storage; object hashes are not access credentials.

## 6. Secrets and operational access

Runtime secrets are stored in Google Secret Manager. Workloads use Google
Workload Identity and separate service accounts: the API can manage publication
objects, while the catalogue service can only read them. Cloud SQL uses IAM
service accounts rather than database passwords.

Deployment credentials are held separately in GitHub Actions. Workloads receive
only the secrets needed for their role; for example, the catalogue service does
not receive email or GitHub credentials.

Operational access is limited to what is needed to deploy, support, secure and
maintain Mokly. Anyone with operational access must use it only for legitimate
service, support, security, legal or compliance purposes.

## 7. Backups and recovery

Production Cloud SQL keeps seven daily backups and seven days of point-in-time
recovery logs. The instance uses regional high availability and deletion
protection.

Publication storage uses object versioning and a seven-day soft-delete window.
Non-current object versions are eligible for deletion after 30 days. Stable
storage prevents public access and cannot be destroyed while it contains
objects.

Deployment checks validate service health, database migrations, TLS, wildcard
publication routing and isolation headers before a release is accepted.

## 8. Security engineering

Mokly's source contracts and automated tests cover authentication replay,
session rotation, CSRF and origin checks, role enforcement, token handling,
GitHub webhook verification, publication validation, private catalogue access,
path handling, content security policy and cross-publication isolation.

Infrastructure changes are reviewed as code. Release images are pinned by
digest, migrations run before workloads start and failed releases roll back to
the previous healthy revision where one exists.

These controls reduce risk but do not constitute a guarantee, certification or
independent security audit.

## 9. Vulnerability reports

If you believe you have found a security issue, email
[hello@mokly.ai](mailto:hello@mokly.ai) with enough detail for us to reproduce
and assess it. Include the affected route or component, the steps you followed,
the impact you observed and a safe proof of concept where useful.

Do not exploit the issue beyond what is needed to confirm it, access customer
data, disrupt the service, use automated high-volume testing or publish details
before we have had a reasonable opportunity to investigate and respond. Do not
send live credentials or personal data in the report.

Mokly does not currently offer a bug bounty or promise payment for reports.

## 10. Limitations

No online service can guarantee perfect security. Mokly uses technical and
organizational measures designed to protect the service and customer data and
continues to improve them as the product and its infrastructure develop.

Protect your devices, email and GitHub accounts, sessions, invitations and
publishing tokens. Report suspected compromise promptly so we can investigate.

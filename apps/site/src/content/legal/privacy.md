---
title: Privacy Policy
effective: 2026-09-22
---

This Privacy Policy explains how Mokly handles personal data.

Mokly is provided by Calum Moore Consulting Limited, a company registered in
England and Wales with company number 09018453 and registered office at 26 John
Hogan V C Road, Manchester, England, M40 7QU.

For privacy questions, requests or complaints, contact
[hello@mokly.ai](mailto:hello@mokly.ai).

## 1. Controller and service role

Calum Moore Consulting Limited is the controller for personal data we process
for our own purposes, including account administration, authentication,
security, support, legal compliance and operation of Mokly.

When a customer publishes a catalogue or other content containing personal
data, the customer is normally the controller for that content and Mokly
processes it to provide the service. Customers are responsible for having a
lawful basis to include personal data in content they publish.

## 2. Data we collect

We collect and process these categories where relevant:

- **Account data:** name, email address, user identifier, workspace
  membership and role.
- **Authentication and security data:** hashed magic-link, desktop app
  sign-in grant, session and publishing-token credentials; session and CSRF records; authentication
  events; GitHub identity; invitation state; and rate-limit or abuse-prevention
  records.
- **Workspace and project data:** workspace and project names,
  repository identity, configuration path, visibility, access grants and
  publishing-token metadata.
- **GitHub data:** account and installation identifiers, GitHub login,
  repository names and identifiers, default branches, branch and commit
  references, pull request numbers, titles and authors, check runs and webhook
  event payloads needed to keep the integration current.
- **Publication content:** generated HTML, CSS, JavaScript, images, fonts and
  other catalogue files; screen and view identifiers; branch, commit and pull
  request references; publication state; comparison metadata; and related
  operational events.
- **Support and complaint data:** messages, feedback, screenshots, documents
  and other details you send when asking for help, exercising a right or making
  a complaint.
- **Technical data:** IP address, browser and device information, request
  metadata, timestamps, service logs, error details and security events.

Mokly does not accept a user password. Authentication uses an email magic link
or GitHub, and Mokly stores digests rather than plaintext session, link,
desktop app sign-in grant and publishing-token credentials.

We do not intentionally collect special-category personal data. If customer
content contains it, we process that content only as needed to provide, secure
and maintain Mokly.

Mokly is intended for adults and workplace teams. We do not knowingly collect
personal data from anyone under 16.

## 3. Where data comes from

We receive personal data:

- directly from you when you create an account, configure a project, publish
  content, contact us or make a request;
- from other users when they invite you, assign access or include information
  about you in customer content;
- from the Mokly CLI or a publishing workflow you or your organization run;
- from GitHub when you sign in, connect an account or installation, select a
  repository or use a connected repository workflow;
- automatically from your browser, device and requests to the service; and
- from providers that help us host, protect and operate Mokly or deliver
  service email.

## 4. How we use data and our lawful bases

We use personal data:

- to create and administer accounts, workspaces, projects, memberships and
  sessions, relying on contract;
- to receive, validate, host, display and control access to publications,
  relying on contract and, where appropriate, the customer's legitimate
  interests;
- to authenticate with GitHub, maintain repository metadata and publish pull
  request checks, relying on contract;
- to send magic links, invitations, security messages and important service
  notices, relying on contract or legitimate interests;
- to answer support requests, privacy requests and complaints, relying on
  contract, legal obligation or legitimate interests;
- to prevent misuse, diagnose failures, monitor reliability and protect users,
  providers and the service, relying on legitimate interests;
- to establish, exercise or defend legal claims and meet legal, tax,
  regulatory, security and fraud-prevention obligations, relying on legal
  obligation or legitimate interests; and
- to plan and improve Mokly using service operation and feedback, relying on
  legitimate interests.

Our legitimate interests include operating a secure software service,
preventing fraud and misuse, supporting users, maintaining integrations and
improving reliability. We balance those interests against the rights and
interests of affected people.

We do not sell personal data, use customer content for advertising or run
product analytics on the public site or application.

## 5. Hosting and international transfers

Production application records, PostgreSQL data and publication files are
hosted in Google Cloud's `us-central1` region in Iowa, United States.
Production and preview environments use separate databases, storage and
service identities.

Cloudflare provides DNS and TLS transport and may process limited request
metadata at its global edge. It is not the system of record for customer
content. GitHub and Postmark process the account, integration and email data
needed to provide their services.

Because Calum Moore Consulting Limited is in the United Kingdom and providers
may process data elsewhere, personal data can be transferred outside the UK.
Where a restricted transfer needs a safeguard, we use an applicable adequacy
regulation, international data transfer agreement, UK addendum to approved
standard contractual clauses or another lawful transfer mechanism.

## 6. Sharing data

We share personal data only where needed for the purposes in this policy.
Recipients may include:

- **Google Cloud**, for application hosting, PostgreSQL, file storage, secrets,
  backups, logging and infrastructure operation;
- **Cloudflare**, for the public website, DNS, TLS and network delivery;
- **GitHub**, when you choose GitHub authentication or connect a repository or
  installation;
- **Postmark**, for magic links, invitations and other service email;
- professional advisers, insurers, auditors, banks or accountants where
  reasonably needed;
- courts, regulators, law enforcement or public authorities where required or
  reasonably necessary; and
- an organization involved in a merger, acquisition, financing,
  reorganization or sale of our business, subject to appropriate safeguards.

We require providers to protect personal data and use it only for the services
they provide to us. We may also share data when you direct us to or when a
project's public visibility makes published content available to anyone.

## 7. Retention

We keep personal data only as long as needed to provide and secure Mokly, meet
legal obligations, resolve disputes and enforce agreements.

Current service records follow these specific boundaries:

- Magic links expire after 15 minutes. Their records are normally removed
  seven days after expiry.
- Desktop app sign-in grants expire after five minutes. Their records are
  normally removed seven days after expiry.
- Sessions last no more than 30 days and expire after seven days without
  activity. Expired session records are normally removed after one day.
- Authentication rate-limit records are normally removed one day after their
  window resets.
- GitHub OAuth flows expire after 10 minutes. GitHub user access credentials
  are discarded after the callback; Mokly does not store a GitHub user access
  or refresh token. Expired OAuth flow records become eligible after one day,
  and daily cleanup removes eligible records.
- Completed, ignored or failed GitHub webhook delivery records, including their
  original payloads, become eligible after 30 days and are removed by daily
  cleanup. Deliveries still waiting or being processed remain until processing
  reaches a terminal state.
- A private catalogue access cookie lasts five minutes. The one-use access
  grant that creates it expires with the same short access flow.
- Successful publications remain until their project or workspace is deleted,
  whatever their age, branch or pull request state. Records of failed
  publication attempts become eligible for removal 30 days after the attempt
  starts. Daily cleanup removes eligible attempt records, closes abandoned
  uploads and removes expired access grants.

Account, workspace, project, membership, repository and publication records
remain while they are needed for an active account or project. Deleting
a project or workspace removes its dependent service records, subject to
backups, versioned storage, security records and legal obligations.

When publication files no longer have a live reference, Mokly waits at least 24
hours before deleting their current storage objects. Provider deletion failure
is retried by later maintenance. The storage provider then keeps deleted object
versions through its seven-day soft-delete window.

The production database keeps seven daily backups and seven days of
point-in-time recovery logs. Publication storage keeps version history and a
seven-day provider soft-delete window; non-current file versions are eligible
for deletion after 30 days. Support, complaint, security and legal records are
kept only as long as needed for their purpose.

The periods and schedules above apply to current service records. Deleted data
can remain in backups, storage version history and soft-delete windows until
those recovery periods end.

## 8. Your rights

Depending on the circumstances, you may have the right to:

- access your personal data;
- correct inaccurate or incomplete personal data;
- ask us to delete personal data;
- restrict how we use personal data;
- object to processing based on legitimate interests;
- receive certain data in a portable format;
- withdraw consent where processing relies on consent; and
- complain to the Information Commissioner's Office.

These rights are not absolute. We may need to keep some records to protect
security, resolve disputes, meet legal obligations or establish legal claims.

To exercise a right, email [hello@mokly.ai](mailto:hello@mokly.ai). We may need
to verify your identity. If the relevant content is controlled by a Mokly
customer, we may refer your request to that customer or ask you to contact them
directly.

## 9. Cookies and browser storage

The public website sets no cookies, makes no runtime API calls and loads no
third-party scripts. It does not run analytics.

The Mokly application uses only storage needed to operate the service:

- a Secure, HttpOnly, SameSite=Lax session cookie, with a 30-day absolute and
  seven-day idle lifetime;
- a Secure, HttpOnly, host-only catalogue cookie lasting five minutes for a
  private publication;
- tab-scoped session storage for GitHub authorization state and a PKCE
  verifier, removed after the callback; and
- local storage containing the identifier of the last project opened on that
  device.

Blocking essential cookies or browser storage may stop authentication,
private-catalogue access or navigation from working. Mokly does not currently
use advertising or non-essential analytics cookies.

## 10. Automated decisions

Mokly uses automation to validate publications, compare generated screens,
apply access rules and report workflow results. These operations support the
service and user review.

We do not use solely automated decision-making that produces legal or similarly
significant effects about individuals.

## 11. Security

We use technical and organizational measures designed to protect personal
data, including access controls, short-lived and revocable credentials,
isolated publication origins, private cloud storage, encrypted transport,
provider encryption at rest, backups and security monitoring.

Our [Security page](/security/) explains these controls and how to report a
concern. No online service is perfectly secure, so protect your devices, email
and GitHub accounts, sessions, invitations and publishing tokens.

## 12. Changes to this policy

We may update this policy as Mokly, our providers or legal requirements change.
If a change is material, we will take reasonable steps to notify affected
users, such as by email or an in-product notice.

The current version is always available at `/privacy/`.

## 13. Contact and complaints

For privacy questions or requests, contact:

- Calum Moore Consulting Limited, company number 09018453
- 26 John Hogan V C Road
- Manchester
- England
- M40 7QU

Email: [hello@mokly.ai](mailto:hello@mokly.ai)

Our [Complaints page](/complaints/) explains how we handle complaints. You can
also [complain to the Information Commissioner's Office](https://ico.org.uk/make-a-complaint/)
if you are unhappy with how we handle personal data.

# Site Legal Documents

This contract defines the Terms, Privacy, Complaints and Security documents on
the public site. [Site](./site.md) owns their routes and shared navigation;
[Site design](./site-design.md) owns their presentation.

## Source And Rendering

- The four source documents are Markdown in this repository. JSX and MDX are
  not accepted as legal-document source.
- Frontmatter declares a nonempty `title` and an approved `effective` date.
  The rendered intro shows that date in `en-GB` form.
- Every document uses the shared readable column and ends with links to the
  other three. The shared footer reaches all four.
- Site-relative Markdown links connect the documents. External authority links
  may point to the ICO or Companies House where useful.
- Each document is substantive: it carries its complete numbered section
  inventory, names the confirmed operator where the operator is a party, and
  holds no placeholder copy.

## Operator And Scope

- Mokly is provided by Calum Moore Consulting Limited, company number 09018453,
  registered in England and Wales at 26 John Hogan V C Road, Manchester,
  England, M40 7QU.
- The service contact is `hello@mokly.ai` for general, privacy, complaint and
  vulnerability messages until a separately monitored address is established.
- Terms apply to the hosted Mokly Cloud service. The open-source Mokly CLI
  remains governed by its published MIT license.
- Customers keep ownership of their repository and publication content while
  granting only the rights needed to provide, secure, support and maintain the
  hosted service.
- England and Wales govern the service terms, subject to rights that applicable
  law does not permit the terms to limit.

## Data And Providers

- Production application records, PostgreSQL data and publication files are
  hosted in Google Cloud's `us-central1` region in Iowa, United States.
- Cloudflare handles the public site, DNS, TLS and limited request metadata at
  its edge. GitHub processes authentication and repository-integration data;
  Postmark processes service email.
- The public site sets no cookies and runs no analytics. It keeps two items in
  browser storage and sends neither to Mokly: the scheme choice of
  [Site chrome](./site-chrome.md#scheme-control) and the tree position of
  [Site docs layout](./site-docs-layout.md#tree-scroll).
- The application uses the session, catalogue-access and browser-storage
  mechanisms defined by [Authentication](./auth-sessions.md),
  [Callbacks](./auth-callbacks.md),
  [Desktop sign-in](./desktop-sign-in.md) and
  [Catalogue hosting](./catalogue-hosting.md). It also keeps one preference on
  the device, the [Theme](./viewer-chrome-account.md#theme) choice. The Privacy
  Policy names each of these items, and the `SameSite` value of the session
  cookie in a browser and in the desktop app.
- For each item that the site keeps and for the Theme, the Privacy Policy
  gives the purpose, says that the item stays in the browser, and says how to
  remove it.
- Provider and international-transfer statements distinguish the UK operator
  from US hosting and other provider processing. They do not claim UK hosting.
- The controller/processor distinction names Calum Moore Consulting Limited as
  controller for service operation and the customer as the normal controller
  for personal data included in customer-authored publication content.

## Retention And Complaints

- Authentication periods match the deployed schedule: magic-link records are
  normally pruned seven days after their 15-minute expiry; desktop app sign-in
  grants, stored as hashes, expire after five minutes and are normally pruned
  seven days after expiry; expired sessions
  and rate-limit records are normally pruned after one day; sessions have a
  30-day absolute and seven-day idle lifetime.
- Publication wording states that successful publications remain until their
  project or workspace is deleted, whatever their age, branch or pull request
  state. Failed-attempt records become eligible for removal 30 days after the
  attempt starts; the wording promises no exact deletion day. Daily cleanup
  removes eligible attempt records, recovers abandoned uploads and removes
  expired access grants. The wording explains the 24-hour unreferenced-object
  grace, deletion retry and provider soft-delete boundary.
- Expired GitHub OAuth-flow hashes are retained for one day. Terminal raw
  webhook deliveries are retained for 30 days; active queue records are not
  deleted by age.
- Backup wording matches seven daily Cloud SQL backups, seven days of
  point-in-time recovery, versioned publication storage, a seven-day provider
  soft-delete window and 30-day noncurrent-version eligibility.
- Privacy and other data-protection complaints are acknowledged within 30
  days. Other complaints are acknowledged promptly; no unsupported final
  response deadline is invented.
- Privacy rights name the ICO and remain qualified where security, legal or
  controller obligations apply.
- The Terms direct workspace deletion to `hello@mokly.ai` until a reviewed
  self-service settings flow exists; they do not imply that the current app
  exposes that control.

## Claim Boundary

The documents describe shipped service behavior and current infrastructure.
They do not claim a certification, independent audit, support SLA, restore
test, analytics system, paid plan, bug bounty, anonymization, scheduled
cleanup or security control that this repository does not establish. Legal
prose does not reuse the MIT license as service terms. Any provider, region,
retention, identity, control or browser storage change must update this
contract and the affected Markdown in the same change.

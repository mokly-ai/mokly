# Email

Mokly Cloud sends two transactional emails: the sign-in link issued by
`POST /v1/auth/magic-links` and the invitation issued by
`POST /v1/workspaces/{workspaceId}/members`. Each is a reviewed Folio mockup in the
dogfood catalogue and generated into committed templates synchronized to both
stable Postmark servers. The API sends by hosted template alias with typed
values; Postmark renders the HTML and plain-text bodies. [Product copy](./product-copy.md),
[Design tokens](./design-tokens.md) and the [catalogue contract](./mockups.md)
apply; delivery follows [Authentication](./auth-sessions.md) and the
[platform model](./platform-model.md). No other message exists, neither
carries tracking or unsubscribe machinery, and the published logo is the only
resource either one loads.

## Content

A message is a validated recipient address and typed content, never a
rendered body. Sign-in content carries the link and the lifetime; invitation
content carries the link, the workspace name, the inviter's name and the
lifetime.

The link is the complete app-origin URL from the owning contract — the
`/auth/email/callback` landing with its `#token=` fragment, or
`/workspaces/{workspaceId}/invitations/{memberId}/accept`. Invitation
IDs identify the pending record; the acceptance API still checks the
signed-in, verified email address. The workspace and inviter names are the
stored names, validated to 1–80 characters with no control characters. The
lifetime in the copy is the issued lifetime, 15 minutes for a link and 7 days
for an invitation, named once by the issuing service so the copy cannot
disagree with the policy. No body, link or name is logged in production.

The mailer receives the message only after the owning transaction commits.
The sign-in service composes its message directly. The invitation needs the
workspace and the inviter, which only the transaction can read, so the
invite command reads both inside it and records the message as an effect of
the transaction; the service sends the committed attempt's effects after the
transaction returns and never inside it, per
[Persistence boundaries](./persistence-boundaries.md#atomic-work).

## Copy

Every sentence below is the delivered text. `{{name}}` marks a substituted
value. Headings are one color and sentence case; the action label names the
outcome; the expiry sentence is the one system fact the reader needs.

**Sign-in**

| Part      | Text                                               |
| --------- | -------------------------------------------------- |
| Subject   | `Sign in to Mokly`                                 |
| Preheader | `Your sign-in link is valid for {{expiry}}.`       |
| Heading   | `Sign in to Mokly`                                 |
| Action    | `Sign in`                                          |
| Fallback  | `Or open this link:` followed by the link          |
| Expiry    | `The link is valid for {{expiry}} and works once.` |
| Ignore    | `If you didn’t request it, ignore this email.`     |

**Invitation**

| Part      | Text                                             |
| --------- | ------------------------------------------------ |
| Subject   | `Join {{organization}} on Mokly`                 |
| Preheader | `{{invitedBy}} invited you to {{organization}}.` |
| Heading   | `{{invitedBy}} invited you to {{organization}}`  |
| Body      | `Sign in with this email address to accept.`     |
| Action    | `Accept invitation`                              |
| Fallback  | `Or open this link:` followed by the link        |
| Expiry    | `The invitation is valid for {{expiry}}.`        |

The plain-text alternative carries the same sentences in the same order, with
the action written as `Sign in: {{link}}` or
`Sign in with this email address to accept: {{link}}`, a blank line between
groups, and no wordmark, preheader or markup. `{{expiry}}` is the formatted
lifetime: `15 minutes`, `7 days`, and the singular `1 minute` or `1 day`.
There is no footer, sender line or site link: the recipient asked for the
message or was named in it, and every fact the reader needs is above the fold.

## Document

The delivered HTML is one self-contained document. Its shell is fixed:

- `<!DOCTYPE html>`, `<html lang="en">`, `<meta charset="utf-8">`, the
  viewport meta, `<meta name="color-scheme" content="light dark">`,
  `<meta name="supported-color-schemes" content="light dark">`, `<title>`
  equal to the subject, and one `<style>` block holding only the override
  rules below.
- A hidden preheader `div` (`display:none`, zero height, transparent 1px
  text) directly after `<body>`, so the inbox list shows the preheader and
  not the heading.
- Table layout: every table is `role="presentation"` with zero cell padding,
  spacing and border. The canvas table is 100% wide; the message table is
  `width="600"` with `width:100%; max-width:600px` so it stays 600px on
  desktop clients and fills narrow ones. The message table uses
  `border-collapse:separate; border-spacing:0` so the card cell's hairline
  follows its rounded corners without gaps; the other layout tables may
  collapse their borders.
- The canvas is the account canvas of
  [Folio chrome: account entry](./folio-chrome-account.md): a
  `background` fill under
  `background-image: radial-gradient(<border> 1px, transparent 1px)` at
  `space.6` by `space.6`. The dots are decorative, so a client that draws no
  gradient shows the flat canvas, and the cell keeps its content at the top so
  a taller window does not centre it.
- One card cell on `surface` with a `border` hairline, `radius.medium`
  corners, `shadow.medium` (the Lifted role the account panel carries; a
  client without shadows shows the hairline alone) and `space.10` (40px)
  padding, holding in order: the brand, the heading, the body sentence when
  the kind has one, the action, the fallback link and the expiry line, with
  the ignore sentence after it for sign-in.
- The brand is the published logo — the Mokly mark beside the serif
  `mokly.` wordmark, one artwork — as an `img` of the 768×256 lockup drawn at
  `width="96" height="32"` (its 3:1 canvas at the product wordmark's height),
  with `alt="Mokly"`, `display:block` and `border:0`, in a cell of its own
  above the heading. No HTML text stands in for the wordmark: a client that
  blocks images shows the alternative text, and the heading beneath still
  names the product. Both logos are sent: the light table shows `e-logo-light`
  and hides `e-logo-dark` with `display:none; mso-hide:all`, the dark table
  does the reverse, and the override block swaps them. Their `src` is
  `<brandRoot>mokly-logo-light.png` and `<brandRoot>mokly-logo-dark.png`,
  where `brandRoot` is the one value the composition supplies beside the
  content: `{{siteOrigin}}/brand/` in the delivered document, the published
  path under [Site delivery](./site-delivery.md#output), and the catalogue's
  own resource path in the mockups. They are the only images and the only
  resource the message loads; no SVG, web font, script, linked stylesheet,
  form or other `http` resource appears in the document.
- Every rendered element carries inline styles resolved from the token tables
  at generation time. Typography and spacing use pixel lengths equivalent to
  the shared tokens at a 16px root. Inline styles and overrides use the same
  lengths. The Folio surface family binds `background`, `surface`,
  `text`, `textMuted` and `border` exactly as the app's account panel binds
  them, so the message and the account panel share one canvas and one card;
  `surfaceRaised`, `surfaceMuted` and `borderStrong` are excluded.
  The only shared accent roles are `accent`, `accentSolid` and `onAccent`;
  transparency is permitted for hidden and mobile surfaces. The heading is `heading3`
  (24/32, 600, `-0.02em`), body copy is `body` (16/24) in `text`, the fallback
  and expiry lines are `small` (14/20) in `textMuted`, links are `accent` ink
  underlined, and `font-family` is the sans stack verbatim.
- The action is the email's single accent fill: a link rendered
  `display:inline-block` inside a table cell filled with `accentSolid`,
  `radius.chrome` corners, `space.3` by `space.6` padding and a `uiTitle`
  (15/22, 600) `onAccent` label with no underline, at least `controlMin`
  (44px) tall. No other cell carries the accent.
- Class names are prefixed `e-` and exist only for the override block; no rule
  targets a tag. The canvas table carries `data-mkc-email` set to the kind, so
  a check finds one message in either composition, as the consumer-owned
  `data-mkc-screen` finds a screen.

Light is the canonical, inline rendering. The `<style>` block holds two
generated override groups, each declared `!important` so a client that
supports the query beats the inline value:

- `@media (prefers-color-scheme: dark)`: for each `e-` class, every
  declaration whose dark value differs from light — the color roles from the
  dark token table, the canvas gradient and card shadow that carry them, and
  the two logos, which trade places.
- `@media (max-width: <breakpoint>)`, at the shared `layout.breakpoint`
  (768px): the mobile account panel's composition in
  [Folio chrome: account entry](./folio-chrome-account.md) — the canvas loses
  its dots and its
  padding, and the card loses its fill, hairline, radius and shadow so the
  blocks sit on the canvas at `space.8` above, `gutterMobile` at the sides and
  `space.12` beneath.

The mobile group is written after the dark one, so on a dark phone it wins the
declarations they share and the card falls away over the dark canvas. Apple
Mail, iOS Mail and Outlook honor the scheme query with those meta tags; Gmail
ignores the block and applies its own inversion to the inline light palette.
A client supporting neither query shows the light desktop composition, which
fits any width.

The catalogue draws the same message in both schemes and both viewports
without relying on either query, so the dark and mobile artboards are what a
client honoring the queries shows. The frame around the email shows the
subject and preheader as the reader's inbox would, the email's heading is the
document's one `h1`, and the frame releases the message from the catalogue's
own reading rules, which no mail client applies.

## Source And Generation

[Email authoring](./email-authoring.md#source-and-generation) defines shared
source, generation, committed templates and drift checks.

## Hosted Delivery

`mkc-email-templates` embeds the six generated files and owns the stable
`mokly-sign-in` and `mokly-invitation` aliases. Their placeholder set is
closed: sign-in uses `link`, `expiry` and `siteOrigin`; invitation also uses
`organization`, which carries the workspace name, and `invitedBy`. Every placeholder a committed template uses
has a field in the typed Postmark model, and every field has a placeholder.
Both logo `src` values use `{{siteOrigin}}/brand/`; that value is the
validated `MKC_SITE_ORIGIN`. Production shares it with the app origin;
main-preview uses the public site origin for its logo while action links keep
their main-preview app origin. The lifetime phrase is the issuing service's
expiry. Model values are raw: Postmark HTML-encodes values in the HTML
document and inserts them unchanged in the subject and plain text.

`mkc-email-postmark` submits `POST /email/withTemplate` with `TemplateAlias`, a
typed `TemplateModel`, `InlineCss: false`, `MessageStream: outbound`,
`TrackOpens: false` and `TrackLinks: None`. Disabling CSS inlining preserves
the document's dark and mobile media queries. The hosted template supplies
the subject, HTML and text; the API does not send separate body fields.
Deployment [synchronizes the aliases](./email-postmark-sync.md) before each
stable API rollout. The development mailer emits one `mkc_dev_mail` tracing
event with only the recipient and the link; local smoke scripts and the app's
browser harness read the link from that event. The stable API configuration
supplies `MKC_SITE_ORIGIN` from the site domain. Postmark's
[template send API](https://postmarkapp.com/developer/api/templates-api)
defines the provider request and response.

## Catalogue And Checks

[Email authoring](./email-authoring.md#catalogue-and-checks) defines the
catalogue paths, journeys, stylesheets, policy and browser checks.

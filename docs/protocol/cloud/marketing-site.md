# Marketing Site

The public website and documentation live in this repository as the static
Astro npm workspace `apps/site`. Marketing lives here, not in `packages/app`,
because the site documents the cloud from the cloud protocol docs and consumes
the cloud design tokens, while the product app serves only the signed-in
application and its account routes. The site and app share one
public origin; the site's explicit first segments take precedence over
workspace slugs. This document fixes route ownership and links.
[Site](./site.md), [Site design](./site-design.md),
[Site docs](./site-docs.md) and [Site delivery](./site-delivery.md) own the
implementation contract.

## Ownership

| Public surface                | Owner          | Routes                                                                                     |
| ----------------------------- | -------------- | ------------------------------------------------------------------------------------------ |
| Shared app/site origin        | `apps/site`    | `/`, `/docs/…`, `/changelog`, `/pricing`, `/terms`, `/privacy`, `/complaints`, `/security` |
| Shared app/site origin        | `packages/app` | `/dashboard`, `/sign-in`, `/sign-up`, `/auth/…`, `/:workspace/:project`                    |
| Catalogue publication origins | Rust workload  | per-publication sandbox subdomains, see [Viewer](./viewer.md)                              |

The internal app-origin hostname is an app-workload endpoint used only by the
Worker. It is not a public surface and is never linked or navigated directly.

The site is static, makes no API calls and sets no cookies. The app serves no
marketing content and no documentation; `packages/app` has no static marketing
export. The [origin router](./origin-router.md) handles the whole origin,
passes `/` and the site's declared first segments through to Pages and sends
all other paths to the app workload. Every path on a preview host belongs to
the app; site previews keep their Pages aliases.

The site declares its routes and top-level asset outputs once. The Worker's
committed site-segment inventory is generated from that declaration, and the
reserved workspace names follow it, so a public section is declared before
a workspace can claim its address. Drift between the declaration, the
generated inventory, the built output and the reserved names fails the checks.

## Links From The Site To The App

The site links one application route: **Create an account** and **Start a
7-day trial** on the pricing page open `/sign-up`. **Get started** opens the
Install guide at `/docs/start/install/`, and the site has no **Sign in** link.
[Site](./site.md#get-started) owns these rules and the link check's exception
for application routes.

## Public Repository Link

The shared site header links **GitHub** directly to the public Mokly repository
at `https://github.com/mokly-ai/mokly`. The link is present on mobile and
desktop so the open-source CLI is reachable from every public page.

## Links From The App To The Site

Account entry carries two outbound links in its footer — **Terms** and
**Privacy** — plus the wordmark, which links to the site's home from the
logged-out screens. It carries no Docs or Changelog link: those belong to the
site's own header, and a sign-in page whose only job is one field cannot afford
the chrome (see [Folio chrome: account entry](./folio-chrome-account.md)). The one
exception across the nine primary account/onboarding screens is Project
created, which offers **Publish from CI**, the CI setup guide at
`/docs/ci/publish-from-ci/`, because setting up publishing is the reader's next
task and it lives on the site;
[Viewer build navigation](./viewer-build-navigation.md#project-setting-and-onboarding) says when it
leads and when Open project does. No other account screen or state adds a
contextual site link. Its catalogue path is `product/account/project-created`.
The signed-in
account menu links **Home**,
**Docs** and **Changelog** to the shared site origin, the Billing pane links
**Pricing** at `/pricing` when it cannot show a verified price, and contextual
help inside the product links documentation pages by their site path. Those
paths are recorded in [Product navigation](./product-navigation.md) when added.
[Outbound links](./web-product-shell.md#outbound-links) defines the origin
for these links on web, native surfaces and the desktop shell.

## Same-Origin Security

Sharing an origin does not relax the site's static boundary. Every site page
loads scripts only from its own origin, sets no cookie and makes no API call.
Cloudflare Pages emits the `Content-Security-Policy` defined in
[Site delivery](./site-delivery.md) from the checked-in `_headers` file, and a
page that loads a script from another origin fails the site build. The Worker
returns the Pages response unchanged for site paths, retaining its content,
caching and security headers.

## Shared Design

The site and the app share one look and one brand. The site consumes this
repository's private `@mokly-cloud/tokens` npm workspace directly; the site and
mockups declare no token and keep no copied palette. The site's look is in
[Site design](./site-design.md), canonical values in
[Design tokens](./design-tokens.md), and copy on both origins follows
[Product copy](./product-copy.md).

## Written Ahead Of Release

The site describes the product direction (browse, review, edit, open
foundation) and documents cloud behavior from this repository's protocol docs
before the cloud ships. [Site](./site.md#ahead-of-release-pages) owns the
`status: ahead` convention and the alignment that happens before the apex
domain goes live. Until then the [source rule](./site.md#boundary) lets the
site draw a fictional demo app and depict features that the product does not
have yet.

## Mockups

The home, docs, changelog, pricing, Terms, Privacy, Complaints and Security
screens live in the dogfood catalogue's `Design › Site` folder with stable
`design/site/*` paths. An eight-step site tour reuses those owning screen
components. Each screen renders mobile/desktop and light/dark, and the site
and the mockups share selectors as [Site mockups](./site-mockups.md#mockups)
requires. Sign-in and sign-up remain product screens under the
`Product › Account` folder, and the pricing screen's plan actions link the
sign-up screen; see [Product mockups](./product-mockups.md).

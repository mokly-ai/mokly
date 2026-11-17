# Public Site

This contract defines the public Mokly website: the marketing home, the
documentation, the changelog and the legal documents. The site is
built from this repository and deployed as static files. Mokly Cloud keeps
only the logged-in application and its sign-in and sign-up routes. The site
never links to them and never calls the cloud API. Design tokens are in
[Site design](./site-design.md), the documentation architecture in
[Site docs](./site-docs.md), and build, tests and deployment in
[Site delivery](./site-delivery.md). The published policy contract is in
[Site legal](./site-legal.md). The [architecture doc](../../architecture/cloud.md)
places the site, the origin router and the app on the one public origin.

## Boundary

- The site lives in the private npm workspace package `apps/site/`, beside
  `apps/app`, `apps/mockups` and `packages/tokens`. It is not published as a package.
- CLI guides, reference documents, the CLI version and release notes come from
  the exact installed `@mokly/mokly` package. The site locates that package
  through the npm workspace installation and never imports its private code.
- Output is static HTML, CSS, JavaScript and images. No page calls an API at
  runtime, sets a cookie or loads a third-party script. Analytics is off; if
  enabled later it must be a cookie-free, build-time-configurable setting
  that defaults to disabled.
- The same deployment publishes transparent Mokly lockup and icon assets under
  `/brand/` in SVG and PNG formats. Explicit `-light` and `-dark` variants
  target light and dark surfaces; unsuffixed paths alias the light variants.
  These are stable assets rather than page routes.
- Every value shown comes from a real source: the installed package, this
  repository's dogfood catalogue, or checked-in cloud-owned Markdown. No
  invented customers, testimonials, counts, integrations or dates.

## Routes

| Route         | Purpose                                                   | Primary action              |
| ------------- | --------------------------------------------------------- | --------------------------- |
| `/`           | Explain Mokly as a design tool for teams; lead to the CLI | Get started → Install guide |
| `/docs/…`     | Documentation for the CLI, authoring, catalogue and cloud | Read; search                |
| `/changelog`  | Release notes from the installed package changelog        | Open the release on GitHub  |
| `/terms`      | Terms of Service for Mokly Cloud                          | Read; open another policy   |
| `/privacy`    | Privacy Policy for Mokly Cloud                            | Read; open another policy   |
| `/complaints` | How to make and follow a complaint                        | Read; contact Mokly         |
| `/security`   | Current service security controls and reporting guidance  | Read; report a concern      |

Every route also serves under its trailing-slash form and a `404.html` page
uses the shared layout. There are no other public routes.

The site owns the first segment of every route above and of its root asset
outputs. [Marketing site](./marketing-site.md#ownership) fixes how that
ownership reaches the origin router and the reserved workspace names.

## Get Started

**Get started** links to the relative path `/docs/start/install/`, the first
Getting started guide. The site carries no **Sign in** link and no link to
an application route, so the launch leads readers to the open-source CLI.
The site build fails on a link to a path the site does not publish.

The site and the app share the production apex rather than separate hosts;
the [origin router](./origin-router.md) sends application paths to the app.
A PR site preview keeps its `pr-N.mokly-site.pages.dev` Pages alias; its bot
comment gives the reviewer the app address `https://pr-N.preview.D/sign-in`.
An app preview is `https://<label>.preview.D` and serves no site.
Main-preview has no site.

## Shared Header And Footer

Every page renders the same header and footer around one `main` landmark.

- Brand: the Mokly mark beside the lowercase serif wordmark `mokly` with a
  green period. The brand links Home with the accessible name "Mokly home".
- Desktop header: brand, **Docs**, **Changelog**, **GitHub**, and a small
  rounded secondary button **Get started →**. **GitHub** links directly
  to the public `https://github.com/mokly-ai/mokly` repository.
- Mobile header (below 768px): the brand and a control named "Menu"; on
  documentation routes the search control takes the row beneath. The control
  opens a modal dialog named "Menu" that slides in from the right edge over
  the dimmed page and lists **Docs**, **Changelog**, **GitHub** and
  **Get started →**. Its "Close menu" control takes the menu
  control's place and focus. That control, Escape and a press on the dimmed
  page close the menu and return focus to the menu control. Widening to the
  desktop header or leaving the page also closes it.
- Footer: the brand with the line stating the Mokly CLI is open source under
  the MIT license, then two link columns in this reading order — Product
  (**Home**, **Docs**, **Changelog**) and Legal (**Terms**, **Privacy**,
  **Complaints**, **Security**).
- A skip link to `#main` is the first focusable element. The current route's
  header, menu and footer links carry `aria-current="page"`; a docs page marks
  **Docs**. Every link and control has a visible focus ring and a target of at
  least 44px. Reading order is header, main, footer on every viewport.

## Positioning

Mokly is a design tool for teams whose mockups are React components in Git,
increasingly authored by agents. The comparison point is Figma: one place to
browse, discuss and edit screens, with the difference that the source of truth
stays in the team's repository, renders locally with the open-source CLI, and
every change is a pull request. The site speaks to engineering-led teams and
the product people who review their work.

The home tells the whole product in this order of emphasis:

1. **Browse.** Every branch and pull request publishes a hosted catalogue:
   screens at mobile and desktop, light and dark, built from the team's real
   components, with Changes between branch and base and a check on the pull
   request.
2. **Review.** Comments pinned to the component on the screen, approvals, and
   two-way sync with the pull request review.
3. **Edit.** An agent beside the viewer edits the mockup source in a live
   branch session; click an element to reference it; publish from the session
   back to the branch.
4. **Open foundation.** Author locally with the MIT CLI, keep screens in Git,
   host the static catalogue anywhere. The cloud adds hosting, review and the
   agent; it never owns the source.

Product nouns are screen, publication, branch, pull request, catalogue,
check. Internal nouns (bundle, manifest, inventory, tarball, blob, worker,
schema) never appear in marketing or headline copy. Follow the copy rules
below.

## Home Copy

[Site home copy](./site-copy.md) defines the approved hero, real dogfood
stage, features and closing.

## Pricing

The site publishes no pricing page and no plan prices. The launch leads with
the open-source CLI, and Mokly Cloud pricing returns with the cloud launch.
`pricing` stays a reserved workspace name through the GitHub-derived policy
seed.

## Changelog

`/changelog` renders every release in the installed package's `CHANGELOG.md`
newest first. Each entry shows the version as a **Mokly CLI `<version>`**
label, the release date from the heading, the grouped notes (breaking changes,
features, bug fixes, performance) with their links preserved, and one link to
the GitHub compare or release view from the heading. Entries whose heading has
no link show no link. If the file has no release headings, the page shows
**Updates will appear here**. The page also publishes an Atom feed at
`/changelog.xml`, linked from every page. The parser never guesses a date or
invents a title: a level-two heading that names a version but not a release
date fails the build rather than publishing a half-read release, and a
level-two heading that names no version is prose the file keeps beside its
releases and is skipped with everything under it. Notes keep their links,
code spans and the emphasis the release tool writes around a commit scope.
[Site mockups](./site-mockups.md) owns the depicted release facts.

## Legal Documents

Terms, Privacy, Complaints and Security are Markdown documents rendered in the
shared readable layout and reached from the footer. Their operator facts,
service boundaries, provider disclosures, retention statements, complaint
handling and security claims are defined in [Site legal](./site-legal.md).

## Copy Rules

The repository's [product copy contract](./product-copy.md) applies in full.
The site-specific consequences are:

- Write plainly, in the second person, about outcomes. Lead with what the
  reader can do; never lead with what Mokly lacks.
- No page says "not supported", "coming soon" or "roadmap" outside a code
  sample. The Reference section and the release notes on the changelog page
  are exempt because they republish package text verbatim.
- Minimum necessary copy: no subtitle or paragraph added to fill space, no
  narration of system behavior, no repeated reassurance. Remove any sentence
  whose absence would not change what the reader understands or does.
- Headline copy uses product nouns; technical detail lives in reference docs
  where it is exact.
- No invented content: every number, release fact and product claim comes from
  this repository or the installed package.

## Ahead-Of-Release Pages

The site is written ahead of the cloud product: it describes the product Mokly
is becoming and documents the cloud from this repository's protocol docs. A
docs page written before the behavior it describes ships carries
`status: ahead` in frontmatter; the status is never rendered. Every such page
opens with `<!-- Source: mokly-cloud <path> -->` naming the local document or
documents it was written from, with multiple paths separated by `, ` and
relative to this repository's `docs/`, and every cited path exists. A section
is wholly ahead or wholly shipped. A page keeps the status until its routes,
fields, labels and behavior match the shipped product, and loses it when they
do. Before the production domain goes live, every ahead page is compared with
the deployed product, and text that did not ship is removed or reworded.

These pages leave out, until they ship: the native iOS, Android and desktop
surfaces, catalogue isolation and access-grant mechanics, request-level
concurrency and audit records, and this repository's internal mockup
fixtures.

The installed packages are authoritative for CLI and viewer behavior. This
repository is authoritative for cloud behavior. The site may claim the
released `@mokly/viewer@0.19.0` adoption. For a private
catalogue, it must not claim comparisons, the previous versions of removed
entries or the catalogue in its own tab until a published transport closes the
limitation in [Viewer](./viewer.md#private-artifact-limit).

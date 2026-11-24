# Public Site

This contract defines the public Mokly website: the marketing home, the
documentation, the changelog, the pricing page and the legal documents. The
site is built from this repository and deployed as static files. Every page
reads as a part of one depicted design file, `mokly.ai`: frames on a canvas,
with the people and agents who work in the file. Mokly Cloud
keeps only the logged-in application and its sign-in and sign-up routes. The
site links to one of them, `/sign-up`, and never calls the cloud API. The
shared header, footer and scheme control are in [Site chrome](./site-chrome.md).
The look, its tokens and the brand are in [Site design](./site-design.md), the
documentation architecture in [Site docs](./site-docs.md), and build, tests and
deployment in [Site delivery](./site-delivery.md). The published policy
contract is in [Site legal](./site-legal.md). The
[architecture doc](../../architecture/cloud.md) places the site, the origin
router and the app on the one public origin.

## Boundary

- The site lives in the private npm workspace package `apps/site/`, beside
  `packages/app`, `apps/mockups` and `packages/tokens`. It is not published as a package.
- CLI guides, reference documents, the CLI version and release notes come from
  the exact installed `@mokly/mokly` package. The site locates that package
  through the npm workspace installation and never imports its private code.
- Output is static HTML, CSS, JavaScript and images. No page calls an API at
  runtime, sets a cookie or loads a script, a font or any other resource from
  a third-party host. Analytics is off; if enabled later it must be a
  cookie-free, build-time-configurable setting that defaults to disabled.
- Every page reads fully without script.
- The same deployment publishes transparent Mokly lockup and icon assets under
  `/brand/` in SVG and PNG formats. Explicit `-light` and `-dark` variants
  target light and dark surfaces; unsuffixed paths alias the light variants.
  These are stable assets rather than page routes.
- Every claim about Mokly comes from a real source: the installed package, this
  repository, or its checked-in cloud-owned Markdown. No page invents a
  customer, a testimonial, a count, an integration or a date about Mokly.
- The site may draw the demo app: the clearly fictional coffee shop
  `acme/storefront`, with its screens, branches, pull request and counts. It
  may also draw the people of the design file, Maya and Sam. Both stay as
  fiction after the production domain goes live.
- Until go-live, the site may also depict features that the product does not
  have yet: comments, approvals, agent sessions and presence. Presence inside a
  depicted Mokly screen counts as such a feature, and so does each named agent,
  Claude and Codex, wherever the site draws it.
- The site source marks each drawing of such a feature, and the
  [site mockups](./site-mockups.md#mockups) mark the same drawing. The mark
  names the features of its drawing, and no page or mockup renders it. One
  search finds every mark in both, together with the
  [ahead pages](#ahead-of-release-pages).
- Before go-live, the [alignment pass](#ahead-of-release-pages) checks every
  marked drawing against the deployed product. A drawing of a feature that did
  not ship is removed, together with the copy that names the feature. The
  removal changes the site mockups first, because they are the visual source
  of truth, and then the site. A drawing whose features all shipped loses its
  mark in both.
- Decision 2 draws the demo app as static components at build time. A real
  example catalogue that Mokly renders was rejected, because it turns the
  redesign into catalogue work. Decision 20 keeps the demo app and the people
  after go-live and checks only the depicted Mokly features. Ending both at
  go-live was rejected, because it removes the home spread and the people from
  every page header.

## Routes

| Route         | Purpose                                                   | Primary action                   |
| ------------- | --------------------------------------------------------- | -------------------------------- |
| `/`           | Explain Mokly as a design tool for teams; lead to sign-up | Get started → `/sign-up`         |
| `/docs/…`     | Documentation for the CLI, authoring, catalogue and cloud | Read; search                     |
| `/changelog`  | Release notes from the installed package changelog        | Open the release on GitHub       |
| `/pricing`    | The open-source CLI and the plans of Mokly Cloud          | Start a 7-day trial → `/sign-up` |
| `/terms`      | Terms of Service for Mokly Cloud                          | Read; open another policy        |
| `/privacy`    | Privacy Policy for Mokly Cloud                            | Read; open another policy        |
| `/complaints` | How to make and follow a complaint                        | Read; contact Mokly              |
| `/security`   | Current service security controls and reporting guidance  | Read; report a concern           |

Every route also serves under its trailing-slash form and a `404.html` page
uses the shared layout. There are no other public routes.

The site owns the first segment of every route above and of its root asset
outputs. [Marketing site](./marketing-site.md#ownership) fixes how that
ownership reaches the origin router and the reserved workspace names.

## Get Started

**Get started →** in the header, the menu and the home hero links to the app's
relative path `/sign-up`, the cloud sign-up. Sending it to the Install guide
was rejected, because the site's main call to action is a cloud account.
**Docs →** beside the open-source CLI, in the home's open foundation and the
Open source plan of the pricing page, links to the relative path `/docs/`, the
documentation landing that the header's **Docs** opens. Naming it **Get
started** was rejected, because each link name opens one destination. The
home's **Download
for Mac** opens `https://github.com/mokly-ai/mokly-desktop/releases`, the
release list of the desktop app, because every desktop release is still a
pre-release. **GitHub** and **View on GitHub** open the public
`https://github.com/mokly-ai/mokly` repository.

The site links one application route, `/sign-up`. **Get started →**,
and **Create an account** and **Start a 7-day trial** on the pricing page, link
to it. The site has no **Sign in** link. The site build fails on a link to a
path that the site does not publish, unless [Site delivery](./site-delivery.md)
accepts the path as an application route. Decision 3 links the plan actions to
the app now. Sending them to the Plans and billing docs page until the cloud
launch was rejected, because the cloud features ship before go-live.

The site and the app share the production apex rather than separate hosts;
the [origin router](./origin-router.md) sends application paths to the app.
A PR site preview keeps its `pr-N.mokly-site.pages.dev` Pages alias, which
serves no application route; its bot comment gives the reviewer the app
address `https://pr-N.preview.D/sign-in`. An app preview is
`https://<label>.preview.D` and serves no site. Main-preview has no site.

## Shared Header And Footer

[Site chrome](./site-chrome.md) defines the header, the menu, the footer and
the scheme control that every page shares.

## Accessibility

- A depiction is a drawing of the design file or of a product that the reader
  looks at but does not use, such as the file title, the avatars, the cursors,
  the status bar, the demo app and the depicted Mokly screens. Every depiction
  is hidden from assistive technology and holds nothing that takes focus.
- Every animation honours reduced motion and then shows its finished state.

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

[Site home copy](./site-copy.md) defines the approved hero, the demo spread,
the Specs panel, the features and the open foundation.

## Pricing

[Site pricing](./site-pricing.md) defines `/pricing`: the open-source CLI and
the Free and Team plans of Mokly Cloud, the comparison and the questions.
[Billing](./billing.md) stays the one source of every plan fact. `pricing` is a
reserved workspace name through the GitHub-derived policy seed.

## Changelog

[Site changelog](./site-changelog.md) defines `/changelog`: every release in
the installed package's `CHANGELOG.md`, newest first, as the version history of
the depicted design file, and the Atom feed. [Site mockups](./site-mockups.md)
owns the depicted release facts.

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
- No invented claims: every number, release fact and product claim about Mokly
  comes from this repository or the installed package. The demo app is the
  one exception, under the source rule in [Boundary](#boundary).

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
do. Before the production domain goes live, one alignment pass compares every
ahead page and every [marked drawing](#boundary) with the deployed product, and
text that did not ship is removed or reworded.

These pages leave out, until they ship: the native iOS, Android and desktop
surfaces, catalogue isolation and access-grant mechanics, request-level
concurrency and audit records, and this repository's internal mockup
fixtures. The desktop app has one exception outside these pages: the home's
**Download for Mac** opens its published releases.

The Mokly packages are authoritative for CLI and viewer behavior, and the
cloud docs are authoritative for cloud behavior. The site may claim that the
cloud hosts the workspace `@mokly/viewer`. For a private
catalogue, it must not claim comparisons, the previous versions of removed
entries or the catalogue in its own tab until a credentialed transport closes
the limitation in [Viewer](./viewer.md#private-artifact-limit).

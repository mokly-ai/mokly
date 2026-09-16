# Public Site

This contract defines the public Mokly website: the marketing home, the
documentation, the changelog and the Terms and Privacy documents. The site is
built from this repository and deployed as static files. Mokly Cloud keeps
only the logged-in application and its sign-in and sign-up routes; the site
links to them and never calls the cloud API. Design tokens are in
[Site design](./site-design.md), the documentation architecture in
[Site docs](./site-docs.md), and build, tests and deployment in
[Site delivery](./site-delivery.md).

## Delivery Status

Approved target tracked by [Public Site And Docs](../../plans/public-site-and-docs.md).
The site is written ahead of the cloud product: it describes the product Mokly
is becoming and documents the cloud from its protocol docs. Pages marked
`status: ahead` are reconciled with shipped scope by the go-live alignment
pass below before the domain goes live.

## Boundary

- The site lives in the npm workspace package `site/`. The published
  `@mokly/mokly` package never depends on it and its tarball contains nothing
  from `site/`. The site may import `@mokly/mokly` from the workspace.
- Output is static HTML, CSS, JavaScript and images. No page calls an API at
  runtime, sets a cookie or loads a third-party script. Analytics is off; if
  enabled later it must be a cookie-free, build-time-configurable setting
  that defaults to disabled.
- Every value shown comes from a real source: the workspace package version,
  `CHANGELOG.md`, this repository's example catalogue, or the checked-in
  Markdown content. No invented customers, testimonials, counts, integrations
  or dates.

## Routes

| Route        | Purpose                                                   | Primary action              |
| ------------ | --------------------------------------------------------- | --------------------------- |
| `/`          | Explain Mokly as a design tool for teams; lead to sign-up | Get started → app sign-up   |
| `/docs/…`    | Documentation for the CLI, authoring, catalogue and cloud | Read; search                |
| `/changelog` | Release notes generated from `CHANGELOG.md`               | Open the release on GitHub  |
| `/terms`     | Service terms for Mokly Cloud                             | Navigate to Privacy or Home |
| `/privacy`   | Privacy policy for Mokly Cloud                            | Navigate to Terms or Home   |

Every route also serves under its trailing-slash form and a `404.html` page
uses the shared layout. There are no other public routes.

## App Origin Links

Sign in and Get started are application routes, not site routes. Every such
link resolves against one build-time setting:

| Setting           | Default                | Use                                   |
| ----------------- | ---------------------- | ------------------------------------- |
| `SITE_APP_ORIGIN` | `https://app.mokly.ai` | Origin of the Mokly Cloud application |

Sign in links to `<SITE_APP_ORIGIN>/sign-in`; Get started links to
`<SITE_APP_ORIGIN>/sign-up`. A malformed origin (not an absolute HTTP(S) URL
without path, query, fragment or userinfo) fails the build. Links carry no
tracking parameters.

## Shared Header And Footer

Every page renders the same header and footer around one `main` landmark.

- Brand: the Mokly mark beside the lowercase serif wordmark `mokly` with a
  green period. The brand links Home with the accessible name "Mokly home".
- Desktop header: brand, **Docs**, **Changelog**, **Sign in**, and a small
  rounded secondary button **Get started →**.
- Mobile header (below 768px): brand, **Docs**, **Sign in**. Changelog and
  Get started leave the header; there is no menu control.
- Footer: the brand with the line stating the Mokly CLI is open source under
  the MIT license, then three link columns in this reading order — Product
  (**Home**, **Docs**, **Changelog**), Account (**Sign in**,
  **Get started**) and Legal (**Terms**, **Privacy**).
- A skip link to `#main` is the first focusable element. The current route's
  header and footer links carry `aria-current="page"`; a docs page marks
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

Nothing on the page is labelled "coming soon" or "roadmap". Product nouns are
screen, publication, branch, pull request, catalogue, check. Internal nouns
(bundle, manifest, inventory, tarball, blob, worker, schema) never appear in
marketing or headline copy. Follow the copy rules below.

## Home Copy

Structure, top to bottom: hero with the rendered catalogue stage beside it,
three numbered features for browse, review and edit, and an open-foundation
closing with the three-step workflow. Mobile stacks copy, stage, features,
closing. Both hero actions repeat in the closing. The approved copy:

**Hero**

- Eyebrow: `A design tool for teams that ship`
- Heading, line one: `Design in your repository.`
- Heading, line two (accent): `Decide in the pull request.`
- Lead: `Your mockups are React components in Git. Browse every branch as
screens, review them with your team, and edit with an agent beside the
screen.`
- Primary action: **Get started** → app sign-up. Secondary action: **Read the
  docs** → `/docs`.
- Note under the actions: `Light and dark. Mobile and desktop.`

**Stage** (beside the hero, below it on mobile): a quiet framed panel showing a
real screen from this repository's example catalogue, rendered at build time.
Its head shows the pull request label and a green **Ready for review** status;
its foot names the screen. The label names a merged pull request from this
repository configured in the site and verified against `CHANGELOG.md`. The
screen itself is the document the example build produced, embedded in a
sandboxed frame, and the catalogue chrome around it names only what that
build's manifest states.

**Features** — heading `Browse, review, edit.` / accent `One place for all
of it.` Lead: `Every branch becomes a catalogue your whole team can open.`

- 01 BROWSE — `See every branch as screens.` — `Each branch and pull request
publishes a catalogue built from your real components. Changes shows what
moved, and the check on the pull request counts it.`
- 02 REVIEW — `Comment on the screen itself.` — `Pin a comment to the
component it is about and approve when it is right. The conversation stays
in step with the pull request review.`
- 03 EDIT — `Ask for the change beside the screen.` — `An agent edits the
mockup source in a live branch session. Click an element to bring it into
the conversation, then publish back to the branch.`

**Closing** — eyebrow `An open foundation`; heading `Your screens.` / accent
`Your building blocks.`; body `Author locally with the open-source Mokly CLI.
Keep your screens in Git and host the catalogue anywhere. The cloud adds
hosting, review and the agent; it never owns the source.` Then the two actions
and the three steps:

1. `Shape the next screen.` — `Author with React and your shared components.`
2. `Publish the branch.` — `Open the pull request check to review the screens
that changed.`
3. `Build from a shared decision.` — `Keep comments and approvals with the
pull request.`

Tone reference: short, plain, two-line headings with the second line in the
accent, one idea per sentence. Install commands appear only in the docs.

## Changelog

`/changelog` renders every release in `CHANGELOG.md` newest first. Each entry
shows the version as a **Mokly CLI `<version>`** label, the release date from
the heading, the grouped notes (breaking changes, features, bug fixes,
performance) with their links preserved, and one link to the GitHub compare or
release view from the heading. Entries whose heading has no link show no link.
If the file has no release headings, the page shows **Updates will appear
here**. The page also publishes an Atom feed at `/changelog.xml`, linked from
every page. The parser is typed and tested; it never guesses a date or invents
a title. A level-two heading that names a version but not a release date fails
the build rather than publishing a half-read release; a level-two heading that
names no version is prose the file keeps beside its releases and is skipped
with everything under it. Notes keep their links, code spans and the emphasis
the release tool writes around a commit scope.

## Terms And Privacy

Both documents are Markdown files under `site/src/content/legal/` rendered in
the readable document layout with navigation between the two policies and a
Home link. Until approved text exists the bodies are exactly:

- Terms: **Terms are being prepared**
- Privacy: **Privacy details are being prepared**

A date appears only when the file's frontmatter declares an approved
`effective` date. The service owner, legal entity, jurisdiction, contact and
retention commitments are not invented, and the MIT license is not reused as
service terms. Approved text must land before a live account flow asks users
to accept a policy.

## Copy Rules

The cloud repository's product copy contract applies in full; its rules are
restated here so this repository is self-contained:

- Write plainly, in the second person, about outcomes. Lead with what the
  reader can do; never lead with what Mokly lacks or say "not supported".
- Minimum necessary copy: no subtitle or paragraph added to fill space, no
  narration of system behavior, no repeated reassurance. Remove any sentence
  whose absence would not change what the reader understands or does.
- Headline copy uses product nouns; technical detail lives in reference docs
  where it is exact.
- No invented content: every number, release fact and product claim comes from
  this repository, the published package, or the cloud protocol docs.

## Ahead-Of-Release Pages

Docs pages written from the cloud protocol docs before the cloud ships carry
`status: ahead` in frontmatter. The status is never rendered. Every such page
opens with `{/* Source: mokly-cloud <path> */}` naming the cloud repository
document or documents it was written from. A test fixes the list below, checks
each citation and holds the whole of a section to one release status.

| Page                               | Written from                                              |
| ---------------------------------- | --------------------------------------------------------- |
| `cloud/overview`                   | `product-direction`, `protocol/product-navigation`        |
| `cloud/connect-a-repository`       | `protocol/product-navigation`                             |
| `cloud/branches-and-pull-requests` | `protocol/product-navigation`, `protocol/viewer`          |
| `cloud/sharing-and-access`         | `protocol/viewer`, `protocol/product-navigation`          |
| `cloud/organizations-and-roles`    | `protocol/product-navigation`                             |
| `cloud/settings`                   | `protocol/settings-dialog`, `protocol/product-navigation` |
| `review/comments`                  | `protocol/screen-comments`                                |
| `review/approvals`                 | `protocol/approvals`                                      |
| `review/pull-request-sync`         | `protocol/screen-comments`, `protocol/approvals`          |
| `review/agent-sessions`            | `product-direction`                                       |
| `review/click-to-reference`        | `product-direction`                                       |

Paths are relative to `docs/` in the cloud repository. Deliberately left out of
these pages, and to be reconsidered only when they ship: the withdrawn viewer
mockup representation, the native iOS, Android and desktop surfaces, catalogue
isolation and access-grant mechanics, request-level concurrency and audit
records, and the cloud repository's own mockup fixtures.

Go-live alignment checklist, run with the cloud repository before the domain
goes live:

1. For each `status: ahead` page, compare every route, field, label and
   behavior against the shipped cloud product; edit or remove text that did
   not ship; remove the status once aligned.
2. Confirm `SITE_APP_ORIGIN` and that `/sign-in` and `/sign-up` exist there.
3. Confirm the home copy claims only shipped phases or reword to shipped scope.
4. Replace the Terms and Privacy placeholders with approved text.
5. Confirm the cloud repository's Home, Docs and Changelog links point here.

## Decisions And Open Questions

| Question              | Decision                                                                    |
| --------------------- | --------------------------------------------------------------------------- |
| App origin            | `https://app.mokly.ai` by default; to be confirmed by the user              |
| Host and domain       | Cloudflare Pages recommended; production domain to be confirmed by the user |
| Mockups               | Ported into this repository's example design catalogue; see Site design     |
| Stage pull request    | A merged pull request from this repository, configured and verified         |
| Lighthouse thresholds | Performance 0.95, accessibility 1.0, best practices 0.95, SEO 0.95          |
| Analytics             | Off; any later provider must be cookie-free and default to disabled         |

Where a cloud protocol doc and this repository's code disagree about the CLI,
this repository's code is right. Known disagreements:

| Cloud document                            | Disagreement                                                                                                                                                                                                                     | How the site resolves it                                                                                 |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Docs-landing mockup and changelog fixture | Pins `@mokly/mokly@0.8.0` and links the former `futex-ai/mokabook` repository                                                                                                                                                    | The site reads the workspace version and the real `CHANGELOG.md`                                         |
| `product-direction`, `protocol/viewer`    | Name an `@mokly/viewer` package, component-instance identity and a frame inspector bridge that this repository has not released                                                                                                  | The viewer is described by what it does (Browse, Changes, search, viewport, scheme); no package is named |
| `protocol/screen-comments`                | Anchors comments to element paths from a negotiated bridge; exported screens here carry no instance markers or inspector script                                                                                                  | Comments are described as pinned to a screen, and to an element only where the screen can identify it    |
| `protocol/screen-comments` two-way sync   | Places a pull request comment from "the entry's exported `sourcePath`"; `mokly-manifest.json` is deliberately excluded from the upload and review metadata strips `sourcePath`, so nothing a publish uploads names a source file | The page says the comment goes on the file the screen came from without claiming the export carries it   |
| `protocol/product-navigation` onboarding  | Treats publishing as unreleased and defers upload syntax to a future contract                                                                                                                                                    | The CI and CLI sections document the shipped `mokly publish`, upload v1 and the composite action         |

The fourth row is the one that needs a decision before the review phase is
built: either the cloud reads the source path from somewhere this repository
actually uploads, or the export contract grows a public, non-source-inventory
way to name the file a screen came from.

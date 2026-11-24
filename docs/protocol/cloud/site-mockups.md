# Site Mockups

This is the visual-source sub-contract of [Site design](./site-design.md).

## Mockups

The eight site screens live in the dogfood catalogue's `Design › Site` folder,
with entry modules under `docs/mockups/src/entries/design/site/` and components
under `docs/mockups/src/screens/design/site/`; the mockups build writes each
screen's documents as
`mokly-static/static/mokly-generated/<path>/index.<viewport>[.dark].html`.
They are the visual source of truth, and refinements happen
here first, then in `apps/site`, because the catalogue is the design
specification the site is checked against; a drawing kept anywhere else would
drift from both. Git ignores those generated documents; commit their authored
sources.

| Entry path                              | Screen                                                                           |
| --------------------------------------- | -------------------------------------------------------------------------------- |
| `design/site/home`                      | Home with the hero, the demo spread, the feature frames and the open foundation  |
| `design/site/home/menu`                 | The home's `menu` state: the mobile menu open over it                            |
| `design/site/docs`                      | The Install guide between the Layers and Inspect panels                          |
| `design/site/docs/first-screen`         | The Your first screen guide with its HTML sample fence                           |
| `design/site/docs/first-screen-desktop` | The docs `first-screen-desktop` state: the HTML sample fence on its Desktop view |
| `design/site/docs/layers`               | The docs `layers` state: the mobile tree sheet open                              |
| `design/site/changelog`                 | Changelog with Version history and the depicted releases                         |
| `design/site/pricing`                   | Pricing with the plans, the comparison and the questions                         |
| `design/site/terms`                     | Terms of Service document                                                        |
| `design/site/privacy`                   | Privacy Policy document                                                          |
| `design/site/complaints`                | Complaints process                                                               |
| `design/site/security`                  | Security controls and reporting                                                  |
| `design/site/tour`                      | Home → Docs → Changelog → Pricing → four legal documents                         |

Every site entry records the shared related documents, declared once for all of
them. The pricing entry adds [Billing](./billing.md) and
[Billing plan gates](./billing-plan-gates.md), which hold its facts. One
configuration rule gives every site document the same stylesheet files.
File-derived paths place entries in Site; slug-derived folder titles suffice
without a `_folder.json` record. The tour is registered from
`docs/mockups/src/entries/design/site/tour.mockup.tsx`. Each screen is one
component rendering mobile and desktop views in light and dark. Every header
draws the closed menu control. The home's `menu` state draws the open menu over
the mobile home as an open dialog in place, with a scrim for the dimmed page,
because a static document has no top layer; the site draws the same dimming as
the dialog's backdrop. The docs `layers` state draws the open tree sheet in the
same way. The desktop views of both states match their screens, whose desktop
layouts hold the same destinations. Screens compose the shared site parts that
the [mockup authoring guide](../../mockups/README.md#key-code) names.

Controls are plain semantic elements — anchors, buttons, badges, radios and the
code panel's copy control — styled from the emitted tokens package values. Site
mockups and implementation reference only `--mk-*`; neither creates another
generated token stylesheet. Until their layout sheets are unified, the site and
mockup sheets are compared rule by rule at both compositions: every selector
both sides declare must declare the same values. Each difference that the
comparison allows is recorded with its reason beside
`docs/mockups/src/_tests_/design-site-parity.test.ts`, and a recorded
difference that disappears fails the comparison. The site declares each
container query exactly as the mockups do.

A fragment selects its composition from `data-site-viewport` on the root
element rather than a viewport width, so a mobile fragment depicts the mobile
composition at any preview width; the site implements the same rule as the
768px breakpoint. The desktop composition steps by preview width between 700px
and 1440px. Each action links the screen that owns its destination, and
[Site](./site.md#get-started) gives the destination of each action. An action
that opens `/sign-up`, **Get started**, **Create an account** and **Start a
7-day trial**, links the sign-up screen `product/account/sign-up`, which owns
the application's `/sign-up`. Each **Docs** links the documentation screen.
Destinations without an owning mockup — the other documentation pages, the
Plans and billing page, the Atom feed, previous and next — render as plain
text, the rule the rest of the design catalogue already follows.

Mockup copy comes from the approved home copy in
[Site home copy](./site-copy.md#home-copy) and from
[Site pricing](./site-pricing.md). Depicted release facts come from the
installed package changelog: every depicted version, date, note, upgrade note
and compare link is copied word for word from it. Each note of the newest
release and every depicted upgrade note is checked word for word against its
release's own section. The dates of Version history and the dates of the
release frames are each checked against the published headings. Changelog
entry metadata derives its version range from the first and last depicted
releases. Facts are labelled as fixtures in entry metadata, not in the screen.
The demo app and the people in the file are fictional, as the source rule of
[Site](./site.md#boundary) allows. Screens contain no implementation notes.

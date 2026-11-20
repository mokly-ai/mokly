# Site Mockups

This is the visual-source sub-contract of [Site design](./site-design.md).

## Mockups

The seven site screens live in the dogfood catalogue's `Design › Site` folder,
with entry modules under `docs/mockups/src/entries/design/site/` and components
under `docs/mockups/src/screens/design/site/`; the mockups build writes each
screen's documents as
`mokly-static/static/mokly-generated/<path>/index.<viewport>[.dark].html`.
They are the visual source of truth, and refinements happen
here first, then in `apps/site`, because the catalogue is the design
specification the site is checked against; a drawing kept anywhere else would
drift from both.

Git ignores those generated documents; commit their authored sources. The home
stage builds the mockups itself when its selected documents are absent, does
not refresh stale documents, and fails on an invalid catalogue index.
[Site delivery](./site-delivery.md#home-stage) owns that rule
and the exact error message.

| Entry path               | Screen                                                 |
| ------------------------ | ------------------------------------------------------ |
| `design/site/home`       | Home with hero, catalogue frame, modules and closing   |
| `design/site/home/menu`  | The home's `menu` state: the mobile menu open over it  |
| `design/site/docs`       | A docs page with the section tree, rail and search     |
| `design/site/changelog`  | Changelog with the release index and depicted releases |
| `design/site/terms`      | Terms of Service document                              |
| `design/site/privacy`    | Privacy Policy document                                |
| `design/site/complaints` | Complaints process                                     |
| `design/site/security`   | Security controls and reporting                        |
| `design/site/tour`       | Home → Docs → Changelog → four legal documents         |

Every site entry records the same related documents, declared once for all of
them, and one configuration rule gives every site document the same
stylesheet files. File-derived paths place entries in Site; slug-derived
folder titles suffice without a `_folder.json` record. The tour is registered
from `docs/mockups/src/entries/design/site/tour.mockup.tsx`. Each screen
is one component rendering mobile and desktop views in light and dark.
Every header draws the closed menu control. The home's `menu` state draws
the open menu over the mobile home as an open dialog in place, with a scrim
for the dimmed page, because a static document has no top layer; the site
draws the same dimming as the dialog's backdrop. Its desktop view matches
the home, whose header row lists the same destinations.
Screens compose the shared site parts that the
[mockup authoring guide](../../mockups/README.md#key-code) names.

Controls are plain semantic elements — anchors, buttons, badges and the code
panel's copy control — styled from the emitted tokens package values. Site mockups
and implementation reference only `--mk-*`; neither creates another generated
token stylesheet. Until their layout sheets are unified, the site and mockup
sheets are compared rule by rule at both compositions: every selector both
sides declare must declare the same values, and the differences that are
structural rather than drift are listed with their reason in
`docs/mockups/src/_tests_/design-site-parity.test.ts`.

A fragment selects its composition from `data-site-viewport` on the root
element rather than a viewport width, so a mobile fragment depicts the mobile
composition at any preview width; the site implements the same rule as the
768px breakpoint. **Get started** links to the documentation screen, which
depicts the Install guide that the site's **Get started** opens.
Destinations without an owning mockup — the other documentation pages,
previous and next — render as plain text, the rule the rest of the design
catalogue already follows.

Mockup copy comes from the approved home copy in
[Site home copy](./site-copy.md#home-copy); depicted release facts come from
the installed package changelog. Each note in the newest release stays
near-verbatim and is checked against that release's own section, and each
rendered release date is checked against its published heading. Changelog
entry metadata derives its version range from the first and last depicted
releases. Facts are labelled as fixtures in entry metadata, not in the
screen. The stage shows `product/account/project-created` and its approved
branch label inside the framed panel. Screens contain no implementation
notes.

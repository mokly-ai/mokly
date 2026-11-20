# Web Application

`packages/app` is the Expo application that serves Mokly Cloud's account entry and
its logged-in product. It targets the web. The account and settings surfaces
are DOM compositions over `@firna/ui` controls, so they render in a browser and
nowhere else. The desktop shell of [Desktop application](./desktop-app.md)
ships this export inside its package and serves it from its own origin; iOS
and Android host the hosted build in a web view with native chrome around it
and do not reuse these screens. Nothing here is portable to iOS or Android as
written.

The viewer is the application, so ordinary signed-in product routes resolve
into it. Account entry, onboarding and invitation acceptance are the full-page
handoffs outside it. The [architecture doc](../../architecture/cloud.md) places the app
among the other components and the three origins.

Read [Navigation](./product-navigation.md) for the route contract,
[Settings dialog](./settings-dialog.md) for the panes,
[Viewer](./viewer.md) for the host contract,
[Web product shell](./web-product-shell.md) for settings history, viewer
composition and outbound links,
[Shared controls](./shared-controls.md) and
[Design tokens](./design-tokens.md) for the control and token mapping, and
[REST](./rest-api.md) for the boundary it calls.

## Packages And Pins

Expo SDK 56 is the release whose peer set is the one
[Shared controls](./shared-controls.md#dependencies) installs. Every
package is pinned to an exact version in `packages/app/package.json`, as
[Repository TypeScript layout](./repository-typescript.md#application) says. The app uses
the single hoisted runtime of the root npm workspace, never a second copy.

## Document And Styling

The web target is a single-page build. Its document carries
`<meta name="robots" content="noindex">` and links the Folio stylesheets before
the application's own stylesheet. The Folio stylesheets have one source of
truth, `docs/mockups/styles`. Each catalogue build bundles it and links the
bundled copy. The application copies it before every start,
build and test, so the product and the catalogue can never drift. The
application's own stylesheet undoes the react-native-web root reset and holds
only the compositions that exist in the running product and not in the
catalogue, such as the live settings dialog's
grid; apart from that root reset, no selector appears in both the catalogue's
stylesheets and the application's, so no rule is settled by the linking
order. A control's appearance is asked for through its props and the theme
mapping; layout CSS never restyles a control.

Token custom properties are emitted into the document at runtime and carry
the desktop type ramp with the mobile ramp under the shared breakpoint,
because a running window resizes and a generated document does not. The
document root takes `folio-scope` and `data-color-scheme`. Controls come from
`@firna/ui` through the same theme mapping the catalogue uses, with the
package's live focus ring retained. The scheme is the reader's system
preference, light when the browser states none; the hosted viewer's interface
`theme` and the cloud chrome change in the same render and never disagree.

The app exposes no generated route list and no sitemap. An unmatched address
and the reserved `/_sitemap` address render the same Mokly recovery screen.

Production images require `EXPO_PUBLIC_MKC_API_ORIGIN` and
`EXPO_PUBLIC_MKC_APP_ORIGIN` and bake them into the browser bundle.
[Outbound links](./web-product-shell.md#outbound-links) defines the site-link
origins and the app-origin fallback. `MKC_APP_CONFIG` is release-time chart
JSON, not a browser configuration endpoint. It may assert the expected origins
and select an unprivileged port; startup fails if its origin/revision
assertions differ from the image's build metadata. Change origins by
rebuilding the app.

The Node static server mounts `dist` at `/`. Existing files resolve from that
root, every extensionless product route falls back to `index.html`, and missing
assets return 404. `/_health` is no-store and `/_config` returns the nonsecret
build origins and revision. Hashed assets are immutable, other files revalidate
and there is no server-side rendering. Every path is root-relative; the app
serves no path prefix.

## Routes

Expo Router owns one root-relative route tree. Static account, callback and
UUID resolver routes are siblings of the workspace segment, the
workspace owns the static `-` sentinel and the project segment, and static
matching wins before either dynamic segment.

| Route                                                 | Screen or resolution                                  |
| ----------------------------------------------------- | ----------------------------------------------------- |
| `/sign-in`, `/sign-up`                                | Account entry, preserving `returnTo`                  |
| `/auth/email`                                         | Link sent; resend or change the address               |
| `/auth/email/callback`                                | Consume `#token=`, then resume the stored destination |
| `/workspaces/:uuid/invitations/:uuid/accept`          | Accept the signed-in reader's invitation              |
| `/auth/preview/callback`                              | Exchange `#secret=`, then open the returned route     |
| `/auth/github/callback`, `/auth/github/install`       | Complete GitHub authorization or setup                |
| `/dashboard`                                          | Resolver: viewer, or the next setup step              |
| `/new`, `/new?installationId=:id`                     | Workspace onboarding, with an optional candidate      |
| `/install`, `/install?workspaceId=:uuid`              | Install the GitHub App for a workspace                |
| `/install?installationId=:id`                         | Connect a GitHub account to a workspace               |
| `/:workspace`                                         | Resolve that workspace's project viewer               |
| `/:workspace/-/new`                                   | Choose an installed repository and the config path    |
| `/:workspace/-/new/cli`                               | Create a project that publishes with the CLI          |
| `/:workspace/-/settings…`                             | Workspace settings                                    |
| `/:workspace/-/settings/github`                       | GitHub accounts settings pane                         |
| `/:workspace/:project/setup`                          | The finished project and the way into its viewer      |
| `/:workspace/:project` and its reference aliases      | The viewer route                                      |
| `/:workspace/:project/publications/:publicationId`    | One immutable publication                             |
| `/:workspace/:project/builds/:buildId`                | One build's details in the viewer stage               |
| `/:workspace/:project/settings…`, `/settings/account` | Settings routes                                       |
| `/workspaces/:uuid`, `/projects/:uuid/…`              | Replace UUID permalinks with current slug routes      |
| Any unmatched app path                                | Mokly not-found screen; one action opens `/dashboard` |

The workspace settings routes are `settings`, `settings/github`,
`settings/members` and `settings/billing`. The last is the durable form of the `billing` pane and the
address Stripe Checkout and the Customer Portal return to; its `checkout`
parameter is read and cleared as
[Settings dialog](./settings-dialog.md#history-and-entry-points) describes,
and the desktop redirect carries every other key the route arrived with. A
successful return stays in confirming or delayed confirmation until a billing
read reports Team; it never falls through to a second Upgrade offer while the
webhook catches up.

Branch and pull-request aliases resolve publications through the viewer. Every
matched route above is registered and terminal. The unmatched-address route
and the reserved `/_sitemap` route render the same recovery screen with no
framework copy, raw URL or sitemap link and read no product data. It shows one
recovery action to `/dashboard`; the dashboard resolver then chooses an
authorized project or onboarding.

`/dashboard` reads the reader's workspaces and projects and replaces itself with
the terminal destination; it never renders a product page of its own. The
project it reopens is the one the reader last opened, kept on the device and
always re-checked against the projects the API returns. A project the reader
cannot open returns them to `/dashboard`, which lands on an accessible project or on
onboarding, and the recovery never names the project.

## Session And API Client

[Web API client](./web-api-client.md) defines sessions, request credentials,
generated types and error handling.

## Product Shell

Settings history, unsaved-change protection, viewer host composition and
outbound links are specified in [Web product shell](./web-product-shell.md).

## Accessibility

Every screen owns one `main` landmark, one `h1` and a skip link. The dialog
moves focus into itself and returns it to the trigger, and the page beneath is
inert and hidden from assistive technology. Compact actions clear the 44px
touch target; pointer surfaces keep the control scale and widen the hit area
instead. Account entry stays usable at 320px with 200% text, without
horizontal overflow. Loading states keep their landmark, name the operation
and draw the layout that they wait for, and a running write names its
operation on the control that sent it, as the
[Wait and Write in progress](./folio-chrome.md#compositions) compositions
define.

Every error section announces itself as an alert and carries non-empty state
copy inside that alert, in one of three mutually exclusive forms: a visible
title, optionally with a visible message; a visible message alone; or, when it
has neither, a screen-reader-only announcement. A non-error state keeps its
optional title and message but never takes an announcement. The chosen form
renders non-whitespace copy. The announcement renders once inside the alert;
it is not an accessible label on the whole section and changes no visible
layout. The decorative glyph, the action text and the **Details** disclosure
are not state copy. The app and the mockup catalogue share this rule and the
state component that encodes it, and both test suites check every rendered
error alert for it, because an empty string or an empty node satisfies the
types without giving a screen reader any text.

# Product Direction

Mokly Cloud is heading toward a design tool for teams whose mockups are React
components committed to Git and authored increasingly by agents. The comparison
point is Figma: one place to browse, discuss, and edit screens, with the
difference that the source of truth stays in the team's repository and renders
locally with the open-source `@mokly/mokly` CLI. This document records that
direction so the initial scope does not close doors. It is not a contract; the
[protocol docs](./protocol/cloud/README.md) govern what is built now, and the archived
[initial scope plan](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/mokly-cloud-initial-scope.md)
is the historical record of that scope.

## Phases

1. **Publish and browse (initial scope).** `mokly publish` from CI, per-branch
   and per-pull-request hosted catalogues, a GitHub check with the Changes
   count, workspaces, projects, and a viewer built on the `@mokly/viewer`
   package with the cloud's branch and publication chrome around it.
2. **Review.** Comments pinned to component instances inside the viewer,
   approvals, and two-way sync with the pull request review. The drafted
   contracts are [Screen comments](./protocol/cloud/screen-comments.md) and
   [Approvals](./protocol/cloud/approvals.md), both deferred.
3. **Edit.** Live branch sessions running Mokly serve in a sandbox, an agent
   chat beside the viewer that edits the mockup source, click-to-reference an
   element in the conversation, and publish-from-session back to the branch.
4. **Native.** Desktop is an Electron shell under `apps/desktop` that ships
   the web build inside the app, serves it from its own origin so the product
   opens offline, and signs in through the browser, which hands a one-use
   grant to the shell through the `mokly` scheme. It exists for local mode: a
   checkout's unpublished screens in the same viewer, once the open-source
   package releases a serve contract for a host program. The contract is
   [Desktop application](./protocol/cloud/desktop-app.md). iOS and Android remain
   the Expo app against the same API, with the viewer hosted in a web view
   and native chrome around it.

**Cloud builds** are the implemented onboarding change between phases 1 and 2.
When builds are configured and automatic builds are on, Mokly Cloud publishes
the default branch and open same-repository pull requests for eligible
installation-linked projects. A team can publish without a CI workflow or
project token; the CI upload stays fully supported. Their one-shot sandbox is
the substrate phase 3's live sessions build on. The contract is
[Cloud builds](./protocol/cloud/cloud-builds.md).

## Product Foundations

- This repository's public website and documentation, written ahead of the
  cloud release against these phases and aligned to shipped behavior before
  go-live; see [Site](./protocol/cloud/site.md).

- Released `@mokly/viewer@0.19.0`: the Browse shell, rendered in the browser
  from the catalogue index and entry details, as a React component with
  host slots, an interface theme and controlled selection — every entry, its
  variants included, by its own path and a removed record by its snapshot — with
  search, tag, hover, pick and marker contracts, mounted bare by the CLI and
  with cloud panels by the app. Released `@mokly/ui@0.19.0` holds the shell's
  parts as presentational components, so mockups can draw the viewer without
  running it.
  The cloud hosts the workspace packages, and their private-artifact transport
  gap is defined in [Viewer](./protocol/cloud/viewer.md).
- Component-instance identity: stable per-screen instance keys in rendered
  markup and catalogue metadata, with source locations, so comments and agent
  references survive re-renders and edits.
- A frame adapter with a Mokly-owned frame probe script, so the viewer can see
  inside screens served from the sandbox catalogue origin.

## What The Initial Scope Must Not Preclude

- Publications stay immutable and content-addressed; a branch alias points at
  a publication, never the reverse.
- Every publication is served from its own sandbox origin; the app never
  renders publication HTML on its own origin.
- Uploaded catalogue files are stored unchanged, including instance markers
  and metadata the cloud does not read yet.
- The viewer is the application, not a route among pages: a thin host around
  `@mokly/viewer` whose slots carry workspace and project switching,
  branch switching, history, sharing, settings and the account menu. There is
  no project or workspace page, so review and chat panels are added to the
  same host without a second surface.
- Settings are panes of one dialog over the working page, so later features
  add panes rather than routes.
- The data model keeps a `plan` column and per-project grants; the archived
  [billing plan](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/billing.md)
  uses both, with the contract in [Billing](./protocol/cloud/billing.md).

## Deferred

Earlier changes left these ideas out. None is planned. The
[protocol docs](./protocol/cloud/README.md) define what ships until a change decides
otherwise.

- Annual or multi-currency prices, promotion codes and coupons, and a second
  trial.
- A seat kind chosen apart from role, and Collaborator permissions beyond
  reading, once the review phase lands.
- Plan-dependent publication retention, and per-plan build limits such as no
  builds on Free, or build minutes or more concurrency on Team.
- An `enterprise` plan with invoiced billing.
- Invoice history inside the app; the Stripe Customer Portal carries it.
- Moving existing subscribers to a replacement price.
- Syncing the Stripe webhook endpoint, Stripe Tax settings or the Customer
  Portal configuration from the repository.
- Server-side comparisons across branches; each upload's comparison has one
  base.
- Screenshot thumbnails of screens.

## Open Decisions

- Repository and licensing shape once the viewer API stabilizes: the CLI and
  viewer packages stay MIT; whether the cloud application lives in a public
  monorepo under a source-available license or stays private is undecided.

import type { Owner } from "../app-regions";

export const viewerPanelOwners = {
  // A project with nothing observed yet draws no rows and offers no retry, so
  // the panel alone answers for it.
  "product/viewer/switcher/no-branches": {
    region: "panel",
    files: ["viewer/panels/switcher.tsx"],
  },
  // What the bar calls the reader is the slot bar's, which no screen owns; the
  // stage this page answers for holds the catalogue, so its region is blank.
  // The bar is this page's whole subject: what the cloud calls a reader who
  // has not set a name. `slots.tsx` computes the values, `chrome.tsx` joins the
  // workspace and project and draws the control, and the stage below it
  // holds the catalogue.
  "product/viewer/standalone/account": {
    region: "bar",
    files: [
      "viewer/chrome.tsx",
      "screens/viewer/slots.tsx",
      "screens/viewer/more-menu.tsx",
    ],
  },
  // The account menu and the compact More menu with its account rows. No
  // application file draws them yet: Milestone 13 of the Canvas redesign
  // builds `viewer/account-menu.tsx`, and its arrival makes this owner name
  // the files that write the menus' labels.
  "product/viewer/standalone/account-menu": {
    region: "bar",
    pending: "viewer/account-menu.tsx",
  },
  // The settings dialog over the viewer, on the Members pane that its rail
  // opens, which the members pane's own parts draw. Nothing on it has
  // failed to load and no write has been refused, so neither shared answer is
  // drawn here, and the pane's own module writes only the waits and the
  // section headings, which no label on this page compares.
  "product/viewer/standalone/settings": {
    region: "pane",
    files: [
      "settings/panes/member-rows.tsx",
      "settings/panes/member-invite.tsx",
      "settings/panes/member-details.tsx",
    ],
  },
  // The bar in the Mac app is this page's whole subject: the cloud's slot
  // content starts after the window buttons. The same sources draw every
  // control on it as on the bar above.
  "product/viewer/standalone/mac-app": {
    region: "bar",
    files: [
      "viewer/chrome.tsx",
      "screens/viewer/slots.tsx",
      "screens/viewer/more-menu.tsx",
    ],
  },
  // A failed attempt is named by the classification Mokly kept, which is read
  // and worded in `failure.ts`; the card around it is the stage's own.
  "product/viewer/standalone/failed": {
    region: "stage",
    files: ["viewer/stage.tsx", "viewer/failure.ts"],
  },
  "product/viewer/standalone/version": {
    region: "stage",
    files: ["viewer/version-failure.tsx"],
  },
  // The route's project read draws the cloud frame over the stage's waiting
  // card: the viewer route names the read and passes the project route its
  // wait. The frame's heading names the read, ahead of the stage, whose card
  // holds only placeholders, so a declared sentence below compares the name.
  "product/viewer/standalone/project-loading": {
    region: "stage",
    files: ["screens/app/viewer-route.tsx"],
  },
  // The stage's other waits are chosen and named in `stage-view.tsx`, which
  // hands each one to the waiting card `stage-card.tsx` draws. While a
  // publication's address is read, `screens/viewer/slots.tsx` draws the
  // reference trigger's placeholder from `viewer/chrome-wait.tsx`; it has no
  // label to compare, so `viewer-reference-wait.test.ts` holds the bar.
  "product/viewer/standalone/publication-loading": {
    region: "stage",
    files: ["viewer/stage-view.tsx"],
  },
  "product/viewer/standalone/plan-loading": {
    region: "stage",
    files: ["viewer/stage-view.tsx"],
  },
  "product/viewer/standalone/uploading": {
    region: "stage",
    files: ["viewer/stage-view.tsx"],
  },
  "product/viewer/standalone/catalogue": {
    region: "stage",
    files: ["viewer/stage.tsx", "viewer/stage-view.tsx"],
  },
  "product/viewer/standalone/catalogue/comparison": {
    region: "stage",
    files: ["viewer/stage.tsx"],
  },
  // Likewise the offer a newer publication produces: the chrome writes it, and
  // it appears beside the publication the reader is already on.
  "product/viewer/standalone/latest": {
    region: "bar",
    files: [
      "viewer/chrome.tsx",
      "screens/viewer/slots.tsx",
      "screens/viewer/more-menu.tsx",
    ],
  },
  "product/viewer/pull-request": {
    region: "stage",
    files: ["viewer/stage.tsx", "viewer/stage-view.tsx"],
  },
  // The card a closed or merged pull request's alias shows: a title that names
  // how it closed, and the switcher.
  "product/viewer/pull-request/closed": {
    region: "stage",
    files: ["viewer/stage.tsx"],
  },
  "product/viewer/pull-request/closed/merged": {
    region: "stage",
    files: ["viewer/stage.tsx"],
  },
  // The card a fork's alias shows: the fact as its title and what the reader
  // can do as its line, which `fork-card.tsx` writes, and the switcher
  // `stage.tsx` already writes.
  "product/viewer/pull-request/fork": {
    region: "stage",
    files: ["viewer/fork-card.tsx", "viewer/stage.tsx"],
  },
  // A plan-refused pull request with nothing published shows the Team card a
  // branch shows, so the stage's own card and the shared role rule answer
  // for it, exactly as for `product/viewer/standalone/plan` and
  // `plan-reader`.
  "product/viewer/pull-request/plan": {
    region: "stage",
    files: ["viewer/stage.tsx", "components/plan-consequence.tsx"],
  },
  "product/viewer/pull-request/plan/reader": {
    region: "stage",
    files: ["viewer/stage.tsx"],
  },
  // The four panels the viewer's slots open arrived with Milestone 13, which
  // is what this table's liveness property was waiting for. Each delegates its
  // failed-load retry to the shared resource state, so both are answerable.
  "product/viewer/projects": {
    region: "panel",
    files: ["viewer/panels/projects.tsx", "components/resource-state.tsx"],
  },
  "product/viewer/switcher": {
    region: "panel",
    files: ["viewer/panels/switcher.tsx", "components/resource-state.tsx"],
  },
  "product/viewer/history": {
    region: "panel",
    files: ["viewer/panels/history.tsx", "components/resource-state.tsx"],
  },
  "product/viewer/share": {
    region: "panel",
    files: [
      "viewer/panels/share.tsx",
      "viewer/panels/share-link.tsx",
      "components/resource-state.tsx",
    ],
  },
  // The panel with nothing to compare draws only the link it can still offer,
  // so the link's own module answers for it: no load of its own fails on
  // this page.
  "product/viewer/share/catalogue": {
    region: "panel",
    files: ["viewer/panels/share-link.tsx"],
  },
} as const satisfies Record<string, Owner>;

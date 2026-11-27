import { createElement } from "react";
import type { ReactElement } from "react";

import type { Billing, Build, Installation, Workspace } from "../api/types";
import type { SettingsContextValue } from "../settings/context";

import { answers } from "./resource-doubles";

/**
 * The places of `write-failure-places.test.ts`: each screen or card that
 * draws the write-failure fragment, the reads it is answered with, and what
 * each of its controls reads once its write is refused. Each screen loads its
 * modules when it is drawn, after the test has pointed them at its doubles.
 */

const workspace: Workspace = {
  id: "01994f10-0000-7000-8000-000000000044",
  name: "Acme",
  slug: "acme",
  role: "owner",
  plan: "free",
  githubInstallationState: "connected",
  version: 1,
};

const seats: Billing["seats"] = [
  { kind: "editor", inUse: 3, unitAmountCents: 2000 },
  { kind: "collaborator", inUse: 1, unitAmountCents: 500 },
];

const free: Billing = {
  plan: "free",
  seats,
  subscription: null,
  manageable: true,
  checkoutAvailable: true,
};

const team: Billing = {
  plan: "team",
  seats,
  subscription: {
    status: "active",
    trialEnd: null,
    currentPeriodEnd: "2030-10-15T12:00:00Z",
    cancelAtPeriodEnd: false,
    paymentFailedAt: null,
  },
  manageable: true,
  checkoutAvailable: false,
};

const installation: Installation = {
  id: "01994f10-0000-7000-8000-000000000055",
  workspaceId: workspace.id,
  accountKind: "organization",
  state: "connected",
  account: "acme-org",
  manageUrl:
    "https://github.com/organizations/acme-org/settings/installations/1",
};

/** A settings pane in its host, with every exit a no-op. */
async function inSettings(pane: ReactElement): Promise<ReactElement> {
  const { SettingsProvider } = await import("../settings/context");
  const { DirtyProvider } = await import("../settings/dirty");
  const { signedIn } = await import("./write-failure-doubles");
  const value: SettingsContextValue = {
    session: signedIn,
    workspaces: [workspace],
    workspace,
    reload: () => undefined,
    replaceRoute: () => undefined,
    openPaneView: () => undefined,
    closePaneView: () => undefined,
    close: () => undefined,
    leaveTo: () => undefined,
    leaveBy: (go) => go(),
    leaveConfirmed: () => undefined,
    href: () => "",
    goToPane: () => undefined,
  };
  const settings = createElement(SettingsProvider, { value, children: pane });
  return createElement(DirtyProvider, null, settings);
}

/** The Billing pane, with the billing read answered with `billing`. */
async function billingPane(billing: Billing): Promise<ReactElement> {
  const { BillingPane } = await import("../settings/panes/billing-pane");
  answers.set("billing:", billing);
  return createElement(BillingPane, { workspace });
}

/** A build card for one build of a project that builds, read by its owner. */
async function buildCard(over: Partial<Build>): Promise<ReactElement> {
  const { BuildCard } = await import("../viewer/build-card");
  const { emptyLog } = await import("../viewer/build-log");
  const { building } = await import("./viewer/stage-view-fixtures");
  const { build } = await import("./viewer/build-fixtures");
  return createElement(BuildCard, {
    project: building,
    build: build(over),
    log: emptyLog,
    role: { kind: "owner" },
    onCancelled: () => undefined,
    onOpenBilling: () => undefined,
  });
}

/** One place, and what each of its controls reads once refused. */
export interface Place {
  name: string;
  screen: () => Promise<ReactElement>;
  /** Each control, by its test ID, with its label after the refusal. */
  controls: Record<string, string>;
}

export const places: Place[] = [
  {
    name: "Billing pane, Free: Upgrade to Team (checkout)",
    screen: () => billingPane(free),
    controls: { "upgrade-to-team": "Try again" },
  },
  {
    name: "Billing pane, Team: Manage billing (portal)",
    screen: () => billingPane(team),
    controls: { "manage-billing": "Try again" },
  },
  {
    name: "GitHub pane: Add GitHub account",
    screen: async () => {
      const { GitHubPane } = await import("../settings/panes/github-pane");
      answers.set("installations:", [installation]);
      return inSettings(createElement(GitHubPane, { workspace }));
    },
    controls: { "add-github-account": "Try again" },
  },
  {
    name: "GitHub pane: Remove",
    screen: async () => {
      const { RemoveInstallation } =
        await import("../settings/panes/github-remove");
      const close = () => undefined;
      return createElement(RemoveInstallation, {
        installation,
        onClose: close,
        onRemoved: close,
      });
    },
    controls: { "confirm-remove-github-account": "Try again" },
  },
  {
    name: "Desktop connect screen: Open Mokly and Use another account",
    screen: async () => {
      const { ConnectDesktopScreen } =
        await import("../screens/account/connect-desktop-screen");
      const challenge = "_-BU_nrgy23GXDr5th1SCfQ5hR20PQulmXM33xVGaOs";
      return createElement(ConnectDesktopScreen, {
        challenge,
        returnTo: undefined,
      });
    },
    controls: { "open-mokly": "Try again", "use-another-account": "Try again" },
  },
  {
    // The first render has no repository yet, so the control also refuses a
    // press; the fragment around it does not depend on that.
    name: "CLI form screen: Create project",
    screen: async () => {
      const { CliFormScreen } =
        await import("../screens/account/cli-form-screen");
      const { signedIn } = await import("./write-failure-doubles");
      return createElement(CliFormScreen, { user: signedIn.user, workspace });
    },
    controls: { "create-cli-project": "Try again" },
  },
  {
    name: "Build card, running: Cancel",
    screen: () => buildCard({}),
    controls: { "build-cancel": "Cancel" },
  },
  {
    name: "Build card, failed: Try again (request)",
    screen: () =>
      buildCard({
        state: "failed",
        canCancel: false,
        finishedAt: "2026-09-15T16:31:00Z",
        failure: { step: "install", cause: "exit", exitCode: 1 },
      }),
    controls: { "build-try-again": "Try again" },
  },
  {
    name: "Publish card: Publish this branch",
    screen: async () => {
      const { StagePublish } = await import("../viewer/publish-card");
      const { building } = await import("./viewer/stage-view-fixtures");
      const reference = { kind: "branch", name: "topic" } as const;
      return createElement(StagePublish, { project: building, reference });
    },
    controls: { "stage-publish": "Try again" },
  },
];

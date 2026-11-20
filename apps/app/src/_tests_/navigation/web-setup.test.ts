import assert from "node:assert/strict";
import { test } from "node:test";

import { createElement } from "react";
import type { ReactNode } from "react";

import type { Installation, Session, Workspace } from "../../api/types";
import { icons } from "../../components/icons";
import { appOrigin } from "../../config";
import type { SettingsContextValue } from "../../settings/context";
import { shellPage, tabAt, withWindow } from "../page-window";
import { answers } from "../resource-doubles";
import { draw, recordingPage } from "../server-render";

const workspace: Workspace = {
  id: "01994f10-0000-7000-8000-000000000044",
  name: "Acme",
  slug: "acme",
  role: "owner",
  plan: "free",
  githubInstallationState: "absent",
  version: 1,
};

const session: Session = {
  user: {
    id: "01994f10-0000-7000-8000-000000000011",
    name: "person@example.com",
    email: "person@example.com",
    githubConnected: false,
  },
  csrfToken: "csrf",
  workspaceIds: [workspace.id],
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

answers.set("installations:", [installation]);
answers.set("connect-workspaces", [workspace]);

/** What a pane gets from its host, with every exit a no-op. */
const settings: SettingsContextValue = {
  session,
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

/**
 * Each screen with a GitHub action, loaded through the doubles: the label the
 * action keeps, the glyph it carries in a browser tab, and the route on the
 * public app origin it opens in the desktop app's window.
 */
async function actions() {
  const { InstallScreen } =
    await import("../../screens/account/install-screen");
  const { ConnectScreen } =
    await import("../../screens/account/connect-screen");
  const { AccountPane } = await import("../../settings/panes/account-pane");
  const { GitHubPane } = await import("../../settings/panes/github-pane");
  const { SettingsProvider } = await import("../../settings/context");
  const { SessionProvider } = await import("../../session/context");
  const { DirtyProvider } = await import("../../settings/dirty");
  const pane = (child: ReactNode) =>
    createElement(
      SessionProvider,
      null,
      createElement(
        DirtyProvider,
        null,
        createElement(SettingsProvider, { value: settings, children: child }),
      ),
    );
  const user = session.user;
  return [
    {
      label: "Connect GitHub",
      own: icons.github,
      screen: pane(createElement(AccountPane)),
      path: "/settings/account",
    },
    {
      label: "Add GitHub account",
      own: icons.start,
      screen: pane(createElement(GitHubPane, { workspace })),
      path: "/acme/-/settings/github",
    },
    {
      label: "Install on GitHub",
      own: icons.github,
      screen: createElement(InstallScreen, { user, workspace }),
      path: "/install?workspaceId=" + workspace.id,
    },
    {
      label: "Continue on GitHub",
      own: icons.github,
      screen: createElement(ConnectScreen, { user, installationId: 42 }),
      path: "/install?installationId=42",
    },
    {
      label: "Continue on GitHub",
      own: icons.github,
      screen: createElement(ConnectScreen, {
        user,
        installationId: 42,
        workspaceId: workspace.id,
      }),
      path: "/install?workspaceId=" + workspace.id + "&installationId=42",
    },
  ];
}

test("each GitHub action in the window keeps its label and opens its own page on the web", async () => {
  for (const { label, own, screen, path } of await actions()) {
    const window = recordingPage(shellPage());
    const drawn = draw(window.page, screen).buttons.filter(
      (button) => button.label === label,
    );
    assert.equal(drawn.length, 1, label);
    assert.equal(drawn[0].icon, icons.external, label);
    withWindow(window.page, () => drawn[0].onPress?.());
    assert.deepEqual(
      window.opened,
      [[appOrigin + path, "_blank", "noopener,noreferrer"]],
      label,
    );
    assert.deepEqual(window.assigned, [], label);

    const browser = draw(recordingPage(tabAt()).page, screen).buttons.filter(
      (button) => button.label === label,
    );
    assert.equal(browser[0]?.icon, own, label + " in a browser tab");
  }
});

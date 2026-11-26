import type { Page } from "@playwright/test";

import { projectPathFor } from "../addresses";
import { expect, freshEmail, signIn, test } from "../harness";
import { createProject } from "../project-setup";

/**
 * Every settings wait draws the layout that it waits for, as Wait in
 * `folio-chrome.md` defines it: the dialog keeps its one heading and its rail,
 * the pane draws its own parts in their waiting forms, and the read is named
 * once, for screen readers. Each read is held here until its wait has been
 * seen.
 */

/** Hold every GET whose path matches until the test lets them go. */
async function holdReads(page: Page, path: RegExp) {
  const gate = Promise.withResolvers<void>();
  const arrived = Promise.withResolvers<void>();
  await page.route(
    (url) => path.test(url.pathname),
    async (route) => {
      if (route.request().method() !== "GET") return route.fallback();
      arrived.resolve();
      await gate.promise;
      return route.fallback();
    },
  );
  return { arrived: arrived.promise, release: () => gate.resolve() };
}

/** Open the dialog at one pane while `path`'s read is held. */
async function openHeld(page: Page, address: string, path: RegExp) {
  const read = await holdReads(page, path);
  await page.goto(address);
  await read.arrived;
  return read;
}

/** The dialog's one heading, which a wait keeps. */
async function expectTitle(page: Page, title: string): Promise<void> {
  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toHaveCount(1);
  await expect(heading).toHaveText(title);
}

/** The read's name, which screen readers hear inside the pane. */
function heardName(page: Page) {
  return page.getByRole("dialog").getByRole("main").getByRole("status");
}

const id = "[0-9a-f-]{36}";

test("the dialog draws the requested pane while the session loads", async ({
  page,
}) => {
  const email = freshEmail("settings-session-wait");
  await signIn(page, email);
  const projectId = await createProject(page, "Session Org");
  const viewer = await projectPathFor(page, projectId);
  const dialog = page.getByRole("dialog");

  // Before settings can read its scope: the rail an owner sees, with the
  // pane current, and the pane's own wait, whose session texts wait too.
  const session = await openHeld(
    page,
    `${viewer}?settings=account`,
    /^\/v1\/session$/,
  );
  await expectTitle(page, "Account");
  const rail = dialog.getByRole("navigation", { name: "Settings sections" });
  await expect(rail.getByRole("link")).toHaveCount(9);
  await expect(
    rail.getByRole("link", { name: "Account", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(heardName(page)).toHaveText("Loading settings…");
  await expect(dialog.getByText("Email", { exact: true })).toBeVisible();
  await expect(dialog.getByLabel("Name")).not.toBeEditable();
  await expect(
    dialog.getByRole("button", { name: "Save changes" }),
  ).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "Sign out" })).toBeDisabled();
  await expect(dialog.getByRole("button", { name: /GitHub/ })).toHaveCount(0);

  // The dialog stays mounted from the session's wait to the pane, so the
  // reader's place in it stays where it was.
  const close = dialog.getByRole("button", { name: "Close" });
  await close.focus();
  session.release();
  await expect(dialog.getByText(email)).toBeVisible();
  await expect(dialog.getByLabel("Name")).toBeEditable();
  await expect(close).toBeFocused();
});

test("settings waits draw the rail and the pane's own layout", async ({
  page,
}) => {
  await signIn(page, freshEmail("settings-waits"));
  const projectId = await createProject(page, "Waits Org");
  const viewer = await projectPathFor(page, projectId);
  const pane = (name: string) => `${viewer}?settings=${name}`;
  const dialog = page.getByRole("dialog");

  // The settings scope, for a pane asked for by its address: the rail an
  // owner sees, the pane current, and the pane's own wait, whose headings
  // keep their known words while the workspace's name waits.
  let read = await openHeld(page, pane("members"), /^\/v1\/workspaces$/);
  await expectTitle(page, "Members");
  const rail = dialog.getByRole("navigation", { name: "Settings sections" });
  await expect(rail.getByRole("link")).toHaveText([
    "Account",
    "Workspace",
    "GitHub accounts",
    "Members",
    "Billing",
    "Project",
    "Publishing tokens",
    "Access",
    "Delete project",
  ]);
  await expect(rail.getByRole("link", { name: "Members" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(heardName(page)).toHaveText("Loading settings…");
  await expect(dialog.getByText("People in")).toBeVisible();
  await expect(
    dialog.getByRole("heading", { name: /^People in / }),
  ).toHaveCount(0);
  await expect(dialog.getByLabel("Email")).not.toBeEditable();
  await expect(
    dialog.getByRole("button", { name: "Send invitation" }),
  ).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "Manage" })).toBeDisabled();
  read.release();
  await expect(dialog.getByLabel("Email")).toBeEditable();

  // The settings index while the scope loads: every pane named, and no row a
  // link yet, because where it leads needs the scope.
  read = await openHeld(page, pane(""), /^\/v1\/workspaces$/);
  await expectTitle(page, "Settings");
  await expect(heardName(page)).toHaveText("Loading settings…");
  await expect(dialog.getByText("Name, address and projects")).toBeVisible();
  const paneLinks = dialog.getByRole("listitem").getByRole("link");
  await expect(paneLinks).toHaveCount(0);
  read.release();
  await expect(paneLinks).toHaveCount(9);

  // The members read: the pane's headings name the workspace, one row stands
  // for the people, and the invite form and its controls wait.
  read = await openHeld(
    page,
    pane("members"),
    new RegExp(`^/v1/workspaces/${id}/members$`),
  );
  await expectTitle(page, "Members");
  await expect(heardName(page)).toHaveText("Loading members…");
  await expect(
    dialog.getByRole("heading", { name: /^People in / }),
  ).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Manage" })).toBeDisabled();
  await expect(dialog.getByLabel("Email")).not.toBeEditable();
  read.release();
  await expect(dialog.getByLabel("Email")).toBeEditable();

  // The accounts read: the heading and Add GitHub account wait in their own
  // places, because only a list with an account shows them.
  read = await openHeld(page, pane("github"), /^\/v1\/github\/installations$/);
  await expectTitle(page, "GitHub accounts");
  await expect(heardName(page)).toHaveText("Loading GitHub accounts…");
  await expect(
    dialog.getByRole("heading", { name: "Connected accounts" }),
  ).toHaveCount(0);
  await expect(
    dialog.getByRole("button", { name: "Add GitHub account" }),
  ).toHaveCount(0);
  read.release();
  await expect(
    dialog.getByRole("heading", { name: "Connected accounts" }),
  ).toBeVisible();

  // The tokens read.
  read = await openHeld(
    page,
    pane("tokens"),
    new RegExp(`^/v1/projects/${id}/tokens$`),
  );
  await expectTitle(page, "Publishing tokens");
  await expect(heardName(page)).toHaveText("Loading publishing tokens…");
  await expect(
    dialog.getByRole("button", { name: "Create token" }),
  ).toHaveCount(0);
  read.release();
  await expect(dialog.getByText("Create a publishing token")).toBeVisible();

  // The access read: both sections keep their headings, and Manage members,
  // whose label is known, waits disabled.
  read = await openHeld(
    page,
    pane("access"),
    new RegExp(`^/v1/projects/${id}/members$`),
  );
  await expectTitle(page, "Access");
  await expect(heardName(page)).toHaveText("Loading project access…");
  await expect(
    dialog.getByRole("heading", { name: "From the workspace" }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("heading", { name: "Project grants" }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Manage members" }),
  ).toBeDisabled();
  read.release();
  await expect(
    dialog.getByRole("button", { name: "Manage members" }),
  ).toBeEnabled();

  // The projects read waits in the Projects section only: the workspace's
  // own name and its Create project are there already.
  read = await openHeld(
    page,
    pane("workspace"),
    new RegExp(`^/v1/workspaces/${id}/projects$`),
  );
  await expectTitle(page, "Workspace");
  await expect(heardName(page)).toHaveText("Loading projects…");
  await expect(dialog.getByLabel("Workspace name")).toBeEditable();
  await expect(
    dialog.getByRole("button", { name: "Create project" }),
  ).toBeEnabled();
  read.release();
  await expect(heardName(page)).toHaveCount(0);

  // The billing read names itself where the plan will be.
  read = await openHeld(
    page,
    pane("billing"),
    new RegExp(`^/v1/workspaces/${id}/billing$`),
  );
  await expectTitle(page, "Billing");
  await expect(dialog.getByText("Loading billing…")).toBeVisible();
  await expect(dialog.getByText("Plan", { exact: true })).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Upgrade to Team" }),
  ).toHaveCount(0);
  read.release();
  await expect(
    dialog.getByRole("button", { name: "Upgrade to Team" }),
  ).toBeVisible();
});

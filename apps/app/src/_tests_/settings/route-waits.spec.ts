import type { Page } from "@playwright/test";

import { settingsPath } from "../../navigation/paths";
import {
  createProject,
  currentWorkspaceId,
  expect,
  freshEmail,
  projectPathFor,
  signIn,
  test,
  workspaceSettingsPathFor,
} from "../harness";

/**
 * A durable settings route on a wide surface hands over to the dialog over
 * the page that the reader belongs on. Until it has, it draws that dialog's
 * wait for the pane it names, as Stripe's Checkout and Customer Portal return
 * to the Billing route. Each read the hand-over needs is held here until the
 * wait has been seen. A rail entry whose address the route does not know yet
 * waits disabled, with no link.
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

/** Hold only the next GET whose path matches, until the test lets it go. */
async function holdNext(page: Page, path: RegExp) {
  const gate = Promise.withResolvers<void>();
  const arrived = Promise.withResolvers<void>();
  let held = false;
  await page.route(
    (url) => path.test(url.pathname),
    async (route) => {
      if (held || route.request().method() !== "GET") return route.fallback();
      held = true;
      arrived.resolve();
      await gate.promise;
      return route.fallback();
    },
  );
  return { arrived: arrived.promise, release: () => gate.resolve() };
}

test("a settings route on a wide surface draws the dialog's wait until it hands over", async ({
  page,
}) => {
  await signIn(page, freshEmail("route-waits"));
  const projectId = await createProject(page, "Route Org");
  const viewer = await projectPathFor(page, projectId);
  const workspaceId = await currentWorkspaceId(page);
  const billing = await workspaceSettingsPathFor(page, workspaceId, "billing");
  const dialog = page.getByRole("dialog");

  /** The dialog's wait for Billing, on the route that has not handed over. */
  async function expectBillingWait(): Promise<void> {
    await expect(page).toHaveURL((url) => url.pathname === billing);
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toHaveCount(1);
    await expect(heading).toHaveText("Billing");
    const rail = dialog.getByRole("navigation", { name: "Settings sections" });
    await expect(rail.getByRole("link")).toHaveCount(9);
    await expect(rail.getByRole("link", { name: "Billing" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(dialog.getByRole("main").getByRole("status")).toHaveText(
      "Loading settings…",
    );
    await expect(dialog.getByText("Plan", { exact: true })).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Upgrade to Team" }),
    ).toHaveCount(0);
  }

  // A reader who left Stripe's Checkout: the session read, the scope read
  // and the read of the page to hand over to each draw the same wait.
  const session = await holdReads(page, /^\/v1\/session$/);
  const scope = await holdReads(page, /^\/v1\/workspaces$/);
  const home = await holdReads(
    page,
    new RegExp(`^/v1/workspaces/${workspaceId}/projects$`),
  );
  await page.goto(`${billing}?checkout=cancelled`);
  await session.arrived;
  await expectBillingWait();
  session.release();
  await scope.arrived;
  await expectBillingWait();
  scope.release();
  await home.arrived;
  await expectBillingWait();
  home.release();

  // The dialog over the project's viewer takes over and draws the pane.
  await expect(page).toHaveURL(
    (url) =>
      url.pathname === viewer && url.searchParams.get("settings") === "billing",
  );
  await expect(
    dialog.getByRole("button", { name: "Upgrade to Team" }),
  ).toBeVisible();
});

test("a reader who closes the dialog while the route hands over stays where they went", async ({
  page,
}) => {
  await signIn(page, freshEmail("route-close"));
  const projectId = await createProject(page, "Route Close Org");
  const viewer = await projectPathFor(page, projectId);
  const workspaceId = await currentWorkspaceId(page);
  const billing = await workspaceSettingsPathFor(page, workspaceId, "billing");
  const dialog = page.getByRole("dialog");
  const projects = new RegExp(`^/v1/workspaces/${workspaceId}/projects$`);

  // The reader closes the dialog while the route reads where to hand over
  // to, and the home that Close leads to reads its own way there.
  const handOver = await holdNext(page, projects);
  await page.goto(billing);
  await handOver.arrived;
  await expect(dialog.getByRole("heading", { level: 1 })).toHaveText("Billing");
  const home = await holdNext(page, projects);
  await dialog.getByRole("button", { name: "Close" }).click();
  await home.arrived;

  // The route's answer arrives after the reader left, and takes them nowhere:
  // they land where Close leads, with no dialog.
  const answered = page.waitForResponse((response) =>
    projects.test(new URL(response.url()).pathname),
  );
  handOver.release();
  await answered;
  home.release();
  await expect(page).toHaveURL(
    (url) => url.pathname === viewer && !url.searchParams.has("settings"),
  );
  await expect(dialog).toHaveCount(0);
});

test("the billing route's wait leaves each project pane without a link until it hands over", async ({
  page,
}) => {
  await signIn(page, freshEmail("route-rail"));
  const projectId = await createProject(page, "Route Rail Org");
  const viewer = await projectPathFor(page, projectId);
  const workspaceId = await currentWorkspaceId(page);
  const billing = await workspaceSettingsPathFor(page, workspaceId, "billing");
  const members = await workspaceSettingsPathFor(page, workspaceId, "members");
  const dialog = page.getByRole("dialog");
  const rail = dialog.getByRole("navigation", { name: "Settings sections" });

  // The route names its workspace and no project, so while it reads where to
  // hand over to, a project pane has no address and a workspace pane has one.
  const handOver = await holdNext(
    page,
    new RegExp(`^/v1/workspaces/${workspaceId}/projects$`),
  );
  await page.goto(billing);
  await handOver.arrived;
  const tokens = rail.getByRole("link", { name: "Publishing tokens" });
  await expect(tokens).toBeDisabled();
  await expect(tokens).not.toHaveAttribute("href");
  await expect(rail.getByRole("link", { name: "Members" })).toHaveAttribute(
    "href",
    members,
  );
  // A reader can still press where the entry is drawn, which Playwright only
  // does for a disabled control when told to; the press leads nowhere.
  await tokens.click({ force: true });
  handOver.release();

  // The hand-over still opens the route's own pane.
  await expect(page).toHaveURL(
    (url) =>
      url.pathname === viewer && url.searchParams.get("settings") === "billing",
  );
  await expect(dialog.getByRole("heading", { level: 1 })).toHaveText("Billing");
});

test("the account route's wait gives a pane its link once the scope names it", async ({
  page,
}) => {
  await signIn(page, freshEmail("route-account"));
  const projectId = await createProject(page, "Route Account Org");
  const viewer = await projectPathFor(page, projectId);
  const workspaceId = await currentWorkspaceId(page);
  const members = await workspaceSettingsPathFor(page, workspaceId, "members");
  const dialog = page.getByRole("dialog");
  const rail = dialog.getByRole("navigation", { name: "Settings sections" });
  const entry = (name: string) => rail.getByRole("link", { name, exact: true });

  // The route's address names no workspace and no project, so while the
  // session loads only the reader's own Account has an address.
  const session = await holdReads(page, /^\/v1\/session$/);
  const handOver = await holdNext(
    page,
    new RegExp(`^/v1/workspaces/${workspaceId}/projects$`),
  );
  await page.goto(settingsPath({ pane: "account" }));
  await session.arrived;
  await expect(entry("Account")).toHaveAttribute("aria-current", "page");
  for (const name of ["Members", "Publishing tokens"]) {
    await expect(entry(name)).toBeDisabled();
    await expect(entry(name)).not.toHaveAttribute("href");
  }
  session.release();

  // The scope names the workspace while the route reads where to hand over
  // to, so its panes lead to their routes; the project's still wait.
  await handOver.arrived;
  await expect(entry("Members")).toHaveAttribute("href", members);
  await expect(entry("Publishing tokens")).toBeDisabled();
  handOver.release();

  // The hand-over still opens the route's own pane.
  await expect(page).toHaveURL(
    (url) =>
      url.pathname === viewer && url.searchParams.get("settings") === "account",
  );
  await expect(dialog.getByRole("heading", { level: 1 })).toHaveText("Account");
});

test("pressing the route's own pane while a Checkout return loads keeps the return", async ({
  page,
}) => {
  await signIn(page, freshEmail("route-checkout"));
  const projectId = await createProject(page, "Route Checkout Org");
  const viewer = await projectPathFor(page, projectId);
  const workspaceId = await currentWorkspaceId(page);
  const billing = await workspaceSettingsPathFor(page, workspaceId, "billing");
  const dialog = page.getByRole("dialog");

  // The reader presses Billing, the pane the route already draws, while
  // settings loads after Checkout.
  const scope = await holdReads(page, /^\/v1\/workspaces$/);
  await page.goto(`${billing}?checkout=success`);
  await scope.arrived;
  await dialog
    .getByRole("navigation", { name: "Settings sections" })
    .getByRole("link", { name: "Billing" })
    .click();
  scope.release();

  // The dialog over the project's viewer still has the return, and confirms
  // the subscription as a Checkout return does.
  await expect(page).toHaveURL(
    (url) =>
      url.pathname === viewer &&
      url.searchParams.get("settings") === "billing" &&
      url.searchParams.get("checkout") === "success",
  );
  await expect(dialog.getByText("Confirming your subscription…")).toBeVisible();
});

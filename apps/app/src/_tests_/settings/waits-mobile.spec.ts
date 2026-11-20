import type { Page } from "@playwright/test";

import { workspaceSettingsPathFor } from "../addresses";
import {
  currentWorkspaceId,
  expect,
  freshEmail,
  signIn,
  test,
} from "../harness";
import { createProject } from "../project-setup";

/**
 * On a compact surface each pane is a full-screen layer, and while the
 * session and then the settings scope load the layer draws the pane the
 * address asks for: its bar keeps the way back the pane will have, and the
 * pane draws its own wait.
 */

/** Hold every GET of one API path until the test lets them go. */
async function holdReads(page: Page, path: string) {
  const gate = Promise.withResolvers<void>();
  const arrived = Promise.withResolvers<void>();
  await page.route(
    (url) => url.pathname === path,
    async (route) => {
      if (route.request().method() !== "GET") return route.fallback();
      arrived.resolve();
      await gate.promise;
      return route.fallback();
    },
  );
  return { arrived: arrived.promise, release: () => gate.resolve() };
}

test("a compact layer keeps its bar and draws its pane while settings load", async ({
  page,
}) => {
  await signIn(page, freshEmail("layer-waits"));
  await createProject(page, "Layer Org");
  const members = await workspaceSettingsPathFor(
    page,
    await currentWorkspaceId(page),
    "members",
  );

  // A pane asked for by its address returns to the index, as it will once
  // the scope is known.
  let scope = await holdReads(page, "/v1/workspaces");
  await page.goto(members);
  await scope.arrived;
  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toHaveCount(1);
  await expect(heading).toHaveText("Members");
  await expect(page.getByRole("link", { name: "Settings" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Close" })).toHaveCount(0);
  await expect(page.getByRole("main").getByRole("status")).toHaveText(
    "Loading settings…",
  );
  await expect(page.getByLabel("Email")).not.toBeEditable();
  await expect(
    page.getByRole("button", { name: "Send invitation" }),
  ).toBeDisabled();
  scope.release();
  await expect(page.getByLabel("Email")).toBeEditable();
  await expect(page.getByRole("link", { name: "Settings" })).toBeVisible();

  // The index closes settings, and lists every pane an owner reaches, the
  // project's included, with Open as words until the scope is known.
  scope = await holdReads(page, "/v1/workspaces");
  await page.goto("/settings");
  await scope.arrived;
  await expect(heading).toHaveText("Settings");
  await expect(page.getByRole("button", { name: "Close" })).toBeVisible();
  await expect(
    page.getByText("Tokens that publish this project"),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Open" })).toHaveCount(0);
  scope.release();
  await expect(page.getByRole("link", { name: "Open" }).first()).toBeVisible();
});

test("a compact layer draws the requested pane while the session loads", async ({
  page,
}) => {
  const email = freshEmail("layer-session-wait");
  await signIn(page, email);

  // Before settings can read its scope: the pane's bar and heading, and its
  // own wait, whose session texts wait too.
  const session = await holdReads(page, "/v1/session");
  await page.goto("/settings/account");
  await session.arrived;
  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toHaveCount(1);
  await expect(heading).toHaveText("Account");
  const back = page.getByRole("link", { name: "Settings" });
  await expect(back).toBeVisible();
  await expect(page.getByRole("main").getByRole("status")).toHaveText(
    "Loading settings…",
  );
  await expect(page.getByText("Email", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Name")).not.toBeEditable();
  await expect(
    page.getByRole("button", { name: "Save changes" }),
  ).toBeDisabled();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeDisabled();
  await expect(page.getByRole("button", { name: /GitHub/ })).toHaveCount(0);

  // The layer stays mounted from the session's wait to the pane, so the
  // reader's place in it stays where it was.
  await back.focus();
  session.release();
  await expect(page.getByText(email)).toBeVisible();
  await expect(page.getByLabel("Name")).toBeEditable();
  await expect(back).toBeFocused();
});

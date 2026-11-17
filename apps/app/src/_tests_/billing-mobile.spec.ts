import { periodEndsOn, subscribe } from "./billing";
import {
  createProject,
  currentWorkspaceId,
  expect,
  failWith,
  freshEmail,
  open,
  workspaceSettingsPathFor,
  signIn,
  test,
} from "./harness";

/** The Billing pane as a full-screen route, which is also Stripe's return. */

test("the billing route is its own layer and returns to the index", async ({
  page,
}) => {
  await signIn(page, freshEmail("mobile-billing"));
  await createProject(page, "Mobile Billing");
  const workspaceId = await currentWorkspaceId(page);
  await subscribe(page, workspaceId, { status: "active", editors: 1 });
  await open(
    page,
    await workspaceSettingsPathFor(page, workspaceId, "billing"),
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { level: 1, name: "Billing" }),
  ).toBeVisible();
  await expect(page.locator(".fo-facts").first()).toContainText("Team");
  await expect(page.locator(".fo-facts").first()).toContainText(periodEndsOn);
  await expect(page.locator("main")).toHaveCount(1);
  await page.getByRole("link", { name: "Settings" }).click();
  await page.waitForURL((url) => url.pathname === "/settings");
  await expect(page.getByText("Plan, seats and payment")).toBeVisible();
});

test("the compact pane says billing opens soon where none is configured", async ({
  page,
}) => {
  await signIn(page, freshEmail("mobile-unavailable"));
  await createProject(page, "Mobile Soon");
  const workspaceId = await currentWorkspaceId(page);
  await failWith(
    page,
    "**/v1/workspaces/*/billing",
    "GET",
    "operation-unavailable",
  );
  await open(
    page,
    await workspaceSettingsPathFor(page, workspaceId, "billing"),
  );
  await expect(page.getByText("Billing opens soon.")).toBeVisible();
});

test("Stripe's return reaches the pane on a compact surface too", async ({
  page,
}) => {
  await signIn(page, freshEmail("mobile-return"));
  await createProject(page, "Mobile Return");
  const workspaceId = await currentWorkspaceId(page);
  const billing = await workspaceSettingsPathFor(page, workspaceId, "billing");
  await page.goto(billing + "?checkout=success");
  await expect(page.getByText("Confirming your subscription…")).toBeVisible();
  await subscribe(page, workspaceId, { status: "active", editors: 1 });
  await expect(page.locator(".fo-facts").first()).toContainText("Team");
  await expect(page).toHaveURL(new RegExp(billing + "$"));
});

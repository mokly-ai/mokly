import { projectPathFor, workspaceSettingsPathFor } from "../addresses";
import {
  currentWorkspaceId,
  expect,
  freshEmail,
  signIn,
  test,
} from "../harness";
import { createProject } from "../project-setup";

import { holdReads } from "./route-wait-reads";

test("switching panes during a Checkout return wait keeps the full query and confirms Billing", async ({
  page,
}) => {
  await signIn(page, freshEmail("route-checkout-switch"));
  const projectId = await createProject(page, "Route Checkout Switch Org");
  const viewer = await projectPathFor(page, projectId);
  const workspaceId = await currentWorkspaceId(page);
  const billing = await workspaceSettingsPathFor(page, workspaceId, "billing");
  const members = await workspaceSettingsPathFor(page, workspaceId, "members");
  const search = "?checkout=success&carried=one+two&carried=three%20four";
  const dialog = page.getByRole("dialog");
  const rail = dialog.getByRole("navigation", { name: "Settings sections" });

  // Keep the route waiting while the reader selects another pane. The Billing
  // read stays held later so its confirmation cannot finish before the check.
  const scope = await holdReads(page, /^\/v1\/workspaces$/);
  const confirmation = await holdReads(
    page,
    new RegExp(`^/v1/workspaces/${workspaceId}/billing$`),
  );
  try {
    await page.goto(billing + search);
    await scope.arrived;
    await rail.getByRole("link", { name: "Members", exact: true }).click();
    await expect(page).toHaveURL(
      (url) => url.pathname === members && url.search === search,
    );
    await expect(
      rail.getByRole("link", { name: "Billing", exact: true }),
    ).toHaveAttribute("href", billing + search);
    scope.release();

    // The query survives both the route change and the hand-over to the dialog.
    await expect(page).toHaveURL(
      (url) =>
        url.pathname === viewer && url.search === `${search}&settings=members`,
    );
    await rail.getByRole("link", { name: "Billing", exact: true }).click();
    await confirmation.arrived;
    await expect(
      dialog.getByText("Confirming your subscription…", { exact: true }),
    ).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Upgrade to Team" }),
    ).toHaveCount(0);
  } finally {
    scope.release();
    confirmation.release();
  }
});

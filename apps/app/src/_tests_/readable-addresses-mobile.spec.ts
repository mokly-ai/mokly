import { settingsPath } from "../navigation/paths";

import {
  createProject,
  expect,
  freshEmail,
  open,
  projectAddress,
  signIn,
  test,
  unloadGuard,
} from "./harness";
import {
  captureReadableAddress,
  uniqueSlug,
} from "./readable-addresses-support";

test("the nested project address editor keeps its draft and settles the saved value", async ({
  page,
}) => {
  await signIn(page, freshEmail("mobile-address"));
  const projectId = await createProject(page, "Mobile Address Org");
  const address = await projectAddress(page, projectId);
  await open(
    page,
    settingsPath({
      pane: "project",
      workspaceSlug: address.workspaceSlug,
      projectSlug: address.slug,
    }),
  );
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Project");
  await page.getByTestId("change-project-slug").click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Project address",
  );
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);

  const nextSlug = uniqueSlug("mobile-project");
  await page.getByLabel("Project slug").fill(nextSlug);
  await page.getByRole("link", { name: "Project" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Project");
  await page.getByTestId("change-project-slug").click();
  await expect(page.getByLabel("Project slug")).toHaveValue(nextSlug);

  const saved = page.waitForResponse(
    (answer) =>
      answer.url().endsWith(`/v1/projects/${projectId}`) &&
      answer.request().method() === "PATCH",
  );
  await page.getByTestId("save-project-slug").click();
  expect((await saved).ok()).toBe(true);
  await page.waitForURL(
    (url) => url.pathname === `/${address.workspaceSlug}/${nextSlug}/settings`,
  );
  await expect.poll(() => unloadGuard(page)).toBe(false);
  await page.getByTestId("change-project-slug").click();
  await expect(page.getByLabel("Project slug")).toHaveValue(nextSlug);
  await expect(page.getByTestId("save-project-slug")).toBeDisabled();
  await captureReadableAddress(page, "mobile-project-address");
});

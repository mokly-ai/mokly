import { branchPathFor, publicationPathFor } from "./addresses";
import { releaseBuild, test } from "./fake-build-api";
import { expect, freshEmail, open, signIn } from "./harness";
import { createProject } from "./project-setup";

test("a real API build publishes this branch and opens its catalogue", async ({
  page,
}) => {
  await signIn(page, freshEmail("real-build"));
  const projectId = await createProject(page, "Real Build Org");
  await open(page, await branchPathFor(page, projectId, "feature/catalogue"));
  await expect(
    page.getByRole("heading", { name: "No publications yet" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Publish this branch" }).click();
  await expect(page).toHaveURL(/\/builds\/[^/]+$/);
  const buildId = new URL(page.url()).pathname.split("/").at(-1);
  expect(buildId).toMatch(/^[0-9a-f-]{36}$/);
  await expect(
    page.getByRole("heading", { name: "Publishing this branch" }),
  ).toBeVisible();
  await expect(page.getByTestId("build-output")).toContainText(
    "Recorded build output",
  );
  const publishStep = page
    .getByRole("list", { name: "Steps" })
    .getByRole("listitem")
    .filter({ hasText: "Publish" });
  await expect(publishStep).toContainText("Running");
  await expect(page.getByTestId("build-cancel")).toBeVisible();
  await expect(page.getByTestId("viewer-publication")).toHaveText(
    "feature/catalogue",
  );

  await releaseBuild(buildId ?? "");
  await expect(
    page.getByRole("heading", { name: "Published this branch" }),
  ).toBeVisible();
  await expect(publishStep).toContainText("Done");
  await page.getByTestId("build-open-catalogue").click();
  await expect(page).toHaveURL(
    (url) =>
      /\/publications\/[^/]+$/.test(url.pathname) &&
      url.searchParams.get("view") === "changes",
  );
  await expect(
    page.getByRole("navigation", { name: "Catalogue" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "Mokly" }),
  ).toBeVisible();

  // This released fixture has no comparison. Browse can open its screens.
  const publicationId = new URL(page.url()).pathname.split("/").at(-1) ?? "";
  await open(page, await publicationPathFor(page, projectId, publicationId));
  await expect(
    page.getByRole("link", { name: /^Start( Changed)?$/ }),
  ).toBeVisible();
  await page.getByRole("link", { name: /^Start( Changed)?$/ }).click();
  await expect(
    page.getByRole("heading", { level: 2, name: "Start", exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("viewer-publication")).toHaveText(
    "feature/catalogue",
  );
});

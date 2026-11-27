import { expect, open, test } from "../harness";

import { makePublic, publishedViewerReady, publishedProject } from "./support";

test("a missing catalogue index shows the cloud card and Try again recovers", async ({
  page,
}) => {
  const made = await publishedProject(page, "catalogue-missing");
  await makePublic(page, made.projectId);
  const catalogue = new URL(made.catalogueUrl as string);
  let missing = true;
  let reads = 0;
  await page.route(
    (url) =>
      url.origin === catalogue.origin &&
      url.pathname === "/mokly-viewer/index.json",
    async (route) => {
      reads += 1;
      if (missing) await route.fulfill({ status: 404, body: "" });
      else await route.continue();
    },
  );

  await open(page, made.publicationPath);
  const card = page.locator(".fo-stage-card").getByRole("alert");
  await expect(card).toBeVisible();
  await expect(card).toContainText("This publication couldn’t open");
  await expect(page.locator(".fo-published-viewer")).toHaveCount(0);
  await expect(page.getByTestId("viewer-version-failure")).toHaveCount(0);
  expect(reads).toBe(1);

  missing = false;
  await card.getByRole("button", { name: "Try again", exact: true }).click();
  await publishedViewerReady(page);
  await expect(card).toHaveCount(0);
  await expect(page.getByTestId("viewer-version-failure")).toHaveCount(0);
  expect(reads).toBe(2);
});

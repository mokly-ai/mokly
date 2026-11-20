import { expect, open, test } from "../harness";

import { makePublic, publishedProject } from "./support";

test("the compact version card keeps cloud actions and one Reload", async ({
  page,
}) => {
  const made = await publishedProject(page, "compact-version", {
    branch: "main",
    detailVersion: 3,
  });
  await makePublic(page, made.projectId);
  await page.setViewportSize({ width: 320, height: 740 });
  await page.emulateMedia({ colorScheme: "dark" });
  await open(page, made.publicationPath + "?catalogueScreen=start");
  const card = page.getByTestId("viewer-version-failure");
  await expect(card).toBeVisible();
  await expect(card.locator(".fo-state-title")).toHaveText(
    "This catalogue needs a compatible viewer",
  );
  await expect(card.locator(".fo-state-detail")).toHaveCount(0);
  await expect(
    card.getByRole("button", { name: "Reload", exact: true }),
  ).toBeVisible();
  await expect(card.getByRole("button")).toHaveCount(1);
  await expect(card.locator("details")).not.toHaveAttribute("open");
  await expect(page.getByTestId("viewer-more")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

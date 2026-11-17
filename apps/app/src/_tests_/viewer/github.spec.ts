import { expect, failWith, freshEmail, open, signIn, test } from "../harness";

test("an unavailable installation offers another attempt", async ({ page }) => {
  await signIn(page, freshEmail("suspended"));
  await open(page, "/new");
  await page.getByLabel("Workspace name").fill("Suspended Wide Org");
  await page.getByRole("button", { name: "Create workspace" }).click();
  await page.waitForURL(/\/install/);

  await failWith(
    page,
    "**/v1/github/installations",
    "POST",
    "operation-unavailable",
  );
  await page.getByTestId("install-app").click();
  const refusal = page.getByTestId("install-refusal");
  await expect(refusal).toBeVisible();
  await expect(refusal).toContainText("App installation opens soon");
  // No retry helps, so the refusal invents no retry time.
  await expect(refusal).not.toContainText("Try again shortly.");
  await expect(page.getByTestId("install-app")).toHaveText("Try again");
});

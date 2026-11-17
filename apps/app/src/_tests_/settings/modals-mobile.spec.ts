import {
  createProject,
  expect,
  freshEmail,
  open,
  projectSettingsPathFor,
  signIn,
  test,
} from "../harness";
import { makeToken, rowMenu } from "./tokens";

/**
 * On a compact surface a row's three-dot menu and the questions it leads to
 * are bottom sheets over the full-screen layer, each titled for what it asks
 * about and each closed by its own way out.
 */
test("a row's menu opens as a sheet titled with the row's name", async ({
  page,
}) => {
  await signIn(page, freshEmail("sheet-menu"));
  const projectId = await createProject(page, "Sheet Org");
  await open(page, await projectSettingsPathFor(page, projectId, "tokens"));
  await makeToken(page, "Phone");
  await page.getByTestId("token-done").click();

  const trigger = rowMenu(page, "Phone");
  const target = (await trigger.boundingBox())!;
  expect(target.height).toBeGreaterThanOrEqual(44);
  await trigger.click();

  const sheet = page.getByRole("dialog", { name: "Phone", exact: true });
  await expect(sheet).toBeVisible();
  await expect(page.locator("#root")).toHaveAttribute("inert", "");
  await expect(
    sheet.getByRole("menu", { name: "Actions for Phone" }),
  ).toBeVisible();
  const viewport = page.viewportSize()!;
  const box = (await sheet.boundingBox())!;
  expect(Math.round(box.y + box.height)).toBe(viewport.height);
  expect(Math.round(box.width)).toBe(viewport.width);

  await sheet.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(sheet).toHaveCount(0);
  await expect(trigger).toBeFocused();

  // Choosing a row closes the menu before the question it opens.
  await trigger.click();
  await page.getByRole("menuitem", { name: "Revoke", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Phone", exact: true }),
  ).toHaveCount(0);
  const question = page.getByRole("dialog", { name: "Revoke Phone?" });
  await expect(question).toBeVisible();
  await expect(page.locator("#root")).toHaveAttribute("inert", "");
  await question.getByRole("button", { name: "Keep token" }).click();
  await expect(question).toHaveCount(0);
});

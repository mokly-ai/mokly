import {
  createProject,
  expect,
  freshEmail,
  openDialog,
  projectQueryPathFor,
  signIn,
  test,
} from "../harness";

/** The dialog's geometry under a window too short for its content. */

test("a pane taller than the frame scrolls inside the dialog body", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 700 });
  await signIn(page, freshEmail("scroll"));
  const projectId = await createProject(page, "Tall Org");
  await openDialog(
    page,
    await projectQueryPathFor(page, projectId, "settings=account"),
  );
  const body = page.locator(".fo-dialog-body");
  // The pane loads its own resources, so it reaches its full height a moment
  // after the dialog does; the overflow is asked for until it is there.
  await expect(page.getByLabel("Name", { exact: true })).toBeVisible();
  await expect
    .poll(() => body.evaluate((node) => node.scrollHeight - node.clientHeight))
    .toBeGreaterThan(0);
  const barBefore = await page.locator(".fo-dialog-bar").boundingBox();
  // The pane is still settling its own resources, and a render resets the
  // scroll, so ask again until it holds rather than reading once.
  await expect
    .poll(async () => {
      await body.evaluate((node) =>
        node.scrollTo({ top: node.scrollHeight, behavior: "instant" }),
      );
      return body.evaluate((node) => node.scrollTop);
    })
    .toBeGreaterThan(0);
  const barAfter = await page.locator(".fo-dialog-bar").boundingBox();
  expect(barAfter?.y).toBe(barBefore?.y);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Account");
});

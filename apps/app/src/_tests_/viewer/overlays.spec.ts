import { expect, open, test } from "../harness";

import { corrected, publishedViewerReady, publishedProject } from "./support";

test("invalid cloud values are corrected while package routes stay authoritative", async ({
  page,
}) => {
  const { publicationId, publicationPath: path } = await publishedProject(
    page,
    "urlstate",
  );
  await open(page, `${path}?view=diff&viewport=tablet&scheme=sepia&panel=none`);
  await corrected(page, /scheme=sepia/);
  await expect(page).toHaveURL(new RegExp(`publications/${publicationId}$`));
  const viewer = page.locator("[data-mokly-shell]");
  await expect(viewer).toHaveAttribute("data-mokly-color-scheme", "light");
  await expect(
    viewer.getByRole("heading", { level: 2, name: "Mokly" }),
  ).toBeVisible();

  // Routed-entry membership belongs to the package, which keeps the address
  // and draws its documented not-found state instead of the host rewriting it.
  await open(page, `${path}?catalogueScreen=not-a-screen`);
  await expect(page).toHaveURL(/catalogueScreen=not-a-screen/);
  await expect(
    page.getByRole("heading", { level: 2, name: "Item not found" }),
  ).toBeVisible();
  await open(page, `${path}?catalogueScreen=start`);
  await expect(page).toHaveURL(/catalogueScreen=start/);
  await expect(page.locator("[data-mokly-stage]")).toHaveAttribute(
    "data-viewport",
    "desktop",
  );
});

test("back and forward restore the panel the reader opened", async ({
  page,
}) => {
  const { publicationId, publicationPath } = await publishedProject(
    page,
    "restore",
  );
  await open(page, publicationPath);
  await publishedViewerReady(page);
  await page.getByTestId("viewer-history").click();
  await expect(page.getByTestId("viewer-panel-history")).toBeVisible();
  await expect(page).toHaveURL(/panel=history/);

  await page.goBack();
  await expect(page.getByTestId("viewer-panel-history")).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`publications/${publicationId}$`));

  await page.goForward();
  await expect(page.getByTestId("viewer-panel-history")).toBeVisible();

  // Close leaves the publication exactly where it was.
  await page.getByTestId("close-history").click();
  await expect(page.getByTestId("viewer-panel-history")).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`publications/${publicationId}$`));
});

test("opening and closing a panel leaves no step that does nothing", async ({
  page,
}) => {
  const { publicationId, projectPath } = await publishedProject(page, "stack");
  await open(page, projectPath);
  await expect(page).toHaveURL(new RegExp(`publications/${publicationId}$`));
  await publishedViewerReady(page);

  await page.getByTestId("viewer-history").click();
  await expect(page.getByTestId("viewer-panel-history")).toBeVisible();
  await page.getByTestId("close-history").click();
  await expect(page.getByTestId("viewer-panel-history")).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`publications/${publicationId}$`));

  // The panel's entry was undone rather than written over, so one press of
  // Back leaves the publication instead of retracing the same address.
  await page.goBack();
  await expect(page).not.toHaveURL(new RegExp(`publications/${publicationId}`));
});

test("only one overlay is open at a time", async ({ page }) => {
  const { publicationPath: path } = await publishedProject(page, "overlay");
  await open(page, path);
  await publishedViewerReady(page);
  await page.getByTestId("viewer-history").click();
  await expect(page.getByTestId("viewer-panel-history")).toBeVisible();
  // The page beneath a panel is inert, so the chrome's own triggers are out of
  // reach until it is dismissed.
  await expect(page.locator("#root")).toHaveAttribute("aria-hidden", "true");
  await expect(page.locator("#root")).toHaveAttribute("inert", "");

  // An address naming both still opens exactly one, and it is the dialog.
  await open(page, `${path}?panel=history&settings=`);
  await expect(page.getByTestId("settings-dialog")).toBeVisible();
  await expect(page.getByTestId("viewer-panel-history")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByRole("main")).toHaveCount(1);
});

test("closing the settings dialog returns focus to the trigger that opened it", async ({
  page,
}) => {
  const { publicationPath: path } = await publishedProject(page, "focus");
  await open(page, path);
  await publishedViewerReady(page);
  await page.getByTestId("viewer-settings").click();
  await expect(page.getByTestId("settings-dialog")).toBeVisible();
  await page.getByTestId("close-settings").click();
  await expect(page.getByTestId("settings-dialog")).toHaveCount(0);
  await expect(page.getByTestId("viewer-settings")).toBeFocused();

  // Every slot answers the same way, so a reader never loses their place.
  await page.getByTestId("viewer-history").click();
  await expect(page.getByTestId("viewer-panel-history")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("viewer-panel-history")).toHaveCount(0);
  await expect(page.getByTestId("viewer-history")).toBeFocused();
});

test("a settings address survives a viewer value the route corrects", async ({
  page,
}) => {
  const { publicationPath: path } = await publishedProject(
    page,
    "settings-kept",
  );
  // The scheme is not one this publication can honour, so the route corrects
  // it — and the dialog the same address asked for still opens.
  await open(page, `${path}?scheme=blue&settings=account`);
  await corrected(page, /scheme=blue/);
  // Everything below describes the address the route produced. Asserted before
  // the correction they would all hold of the address the reader asked for,
  // which is the one state that proves nothing.
  await expect(page).toHaveURL(/settings=account/);
  await expect(page.getByTestId("settings-dialog")).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 1, name: "Account" }),
  ).toBeVisible();
});

test("settings opens over the viewer and closes back onto its selection", async ({
  page,
}) => {
  const { publicationPath: path } = await publishedProject(page, "beneath");
  await open(page, `${path}?view=changes`);
  await publishedViewerReady(page);
  await page.getByTestId("viewer-settings").click();
  await expect(page.getByTestId("settings-dialog")).toBeVisible();
  await page.getByTestId("close-settings").click();
  await expect(page).toHaveURL(/view=changes/);
  await expect(page.getByRole("button", { name: /^Changes/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

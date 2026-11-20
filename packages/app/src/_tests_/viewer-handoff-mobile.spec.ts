import { expect, test } from "./harness";
import {
  holdCatalogueHandoff,
  openHeldViewer,
  openShareFromMore,
  releaseAccessDuringCompactPress,
} from "./viewer/compact-handoff";
import { publishedViewerReady, publishedProject } from "./viewer/support";

test("a late package slot does not take deliberately moved focus", async ({
  page,
}) => {
  const made = await publishedProject(page, "compact-focus-moved");
  const handoff = await holdCatalogueHandoff(page, made.catalogueUrl as string);
  await openHeldViewer(page, made.publicationPath, handoff.access.seen);
  const panel = await openShareFromMore(page);
  handoff.access.release();
  await expect.poll(handoff.catalogue.seen).toBe(true);
  await page.getByTestId("close-share").click();
  await expect(panel).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );

  const destination = page
    .getByRole("link", { name: "Skip to content" })
    .first();
  await destination.focus();
  expect(
    await destination.evaluate((element) => document.activeElement === element),
  ).toBe(true);
  handoff.catalogue.release();
  await expect(page.locator("[data-mokly-shell]")).toBeVisible();
  await expect(destination).toBeFocused();
  await expect(page.getByTestId("viewer-more")).not.toBeFocused();
});

test("a later pointer action cancels the package slot restore", async ({
  page,
}) => {
  const made = await publishedProject(page, "compact-pointer-moved");
  const handoff = await holdCatalogueHandoff(page, made.catalogueUrl as string);
  await openHeldViewer(page, made.publicationPath, handoff.access.seen);
  const panel = await openShareFromMore(page);
  handoff.access.release();
  await expect.poll(handoff.catalogue.seen).toBe(true);
  await page.getByTestId("close-share").click();
  await expect(panel).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // A press on the stage's pending card, away from every slot, while the
  // host still reads the index.
  await page.getByText("Opening the catalogue").click();
  handoff.catalogue.release();
  await expect(page.locator("[data-mokly-shell]")).toBeVisible();
  await expect(page.getByTestId("viewer-more")).not.toBeFocused();
});

test("a late package slot does not restore after leaving its path", async ({
  page,
}) => {
  const made = await publishedProject(page, "compact-path-left");
  const handoff = await holdCatalogueHandoff(page, made.catalogueUrl as string);
  await openHeldViewer(page, made.publicationPath, handoff.access.seen);
  const panel = await openShareFromMore(page);
  handoff.access.release();
  await expect.poll(handoff.catalogue.seen).toBe(true);
  await page.getByTestId("close-share").click();
  await expect(panel).toHaveCount(0);

  await page.evaluate(() => window.history.pushState({}, "", "/focus-left"));
  await expect(page).toHaveURL(/\/focus-left$/);
  handoff.catalogue.release();
  await expect(page.locator("[data-mokly-shell]")).toBeVisible();
  await expect(page.getByTestId("viewer-more")).not.toBeFocused();
});

test("a More press survives the package slot handoff", async ({ page }) => {
  const made = await publishedProject(page, "compact-more-handoff");
  const handoff = await holdCatalogueHandoff(page, made.catalogueUrl as string);
  await openHeldViewer(page, made.publicationPath, handoff.access.seen);
  const historyLength = await page.evaluate(() => window.history.length);
  const trigger = page.getByTestId("viewer-more");
  const previous = await trigger.elementHandle();
  expect(previous).not.toBeNull();
  const before = await trigger.boundingBox();
  expect(before).not.toBeNull();
  await page.mouse.move(
    (before?.x ?? 0) + (before?.width ?? 0) / 2,
    (before?.y ?? 0) + (before?.height ?? 0) / 2,
  );
  await page.mouse.down();
  await releaseAccessDuringCompactPress(
    page,
    previous as NonNullable<typeof previous>,
    handoff,
  );
  const after = await page.getByTestId("viewer-more").boundingBox();
  expect(after).not.toBeNull();
  await page.mouse.move(
    (after?.x ?? 0) + (after?.width ?? 0) / 2,
    (after?.y ?? 0) + (after?.height ?? 0) / 2,
  );
  await page.mouse.up();

  await expect.poll(handoff.catalogue.seen).toBe(true);
  handoff.catalogue.release();
  await publishedViewerReady(page);
  const menu = page.getByRole("menu", { name: "Viewer actions" });
  await expect(menu).toBeVisible();
  await expect(menu).toHaveCount(1);
  await menu.getByText("Share", { exact: true }).click();
  await expect(page.getByTestId("viewer-panel-share")).toBeVisible();
  expect(await page.evaluate(() => window.history.length)).toBe(
    historyLength + 1,
  );
});

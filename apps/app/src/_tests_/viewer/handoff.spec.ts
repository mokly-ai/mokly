import { expect, test } from "../harness";

import {
  holdPackageHandoff,
  openHeldPackage,
  releaseAccessDuringPress,
  finishPackageHandoff,
} from "./package-handoff";
import { publishedProject } from "./support";

test("a pointer press survives the package slot handoff", async ({ page }) => {
  const made = await publishedProject(page, "pointer-slot-handoff");
  const handoff = await holdPackageHandoff(page, made.catalogueUrl as string);
  await openHeldPackage(
    page,
    made.projectId,
    made.publicationId,
    handoff.access.seen,
  );

  const trigger = page.getByTestId("viewer-share");
  const historyLength = await page.evaluate(() => window.history.length);
  const previous = await trigger.elementHandle();
  expect(previous).not.toBeNull();
  const before = await trigger.boundingBox();
  expect(before).not.toBeNull();
  await page.mouse.move(
    (before?.x ?? 0) + (before?.width ?? 0) / 2,
    (before?.y ?? 0) + (before?.height ?? 0) / 2,
  );
  await page.mouse.down();

  await releaseAccessDuringPress(
    page,
    previous as NonNullable<typeof previous>,
    handoff,
  );
  const after = await page.getByTestId("viewer-share").boundingBox();
  expect(after).not.toBeNull();
  await page.mouse.move(
    (after?.x ?? 0) + (after?.width ?? 0) / 2,
    (after?.y ?? 0) + (after?.height ?? 0) / 2,
  );
  await page.mouse.up();

  const panel = page.getByTestId("viewer-panel-share");
  await expect(panel).toBeVisible();
  await expect(panel).toHaveCount(1);
  expect(await page.evaluate(() => window.history.length)).toBe(
    historyLength + 1,
  );
  await finishPackageHandoff(page, handoff);
  await expect(panel).toBeVisible();
  await expect(panel).toHaveCount(1);
});

test("a Space press survives the package slot handoff", async ({ page }) => {
  const made = await publishedProject(page, "space-slot-handoff");
  const handoff = await holdPackageHandoff(page, made.catalogueUrl as string);
  await openHeldPackage(
    page,
    made.projectId,
    made.publicationId,
    handoff.access.seen,
  );

  const trigger = page.getByTestId("viewer-share");
  const historyLength = await page.evaluate(() => window.history.length);
  const previous = await trigger.elementHandle();
  expect(previous).not.toBeNull();
  await trigger.focus();
  await expect(trigger).toBeFocused();
  await page.keyboard.down("Space");

  await releaseAccessDuringPress(
    page,
    previous as NonNullable<typeof previous>,
    handoff,
  );
  await page.keyboard.up("Space");

  const panel = page.getByTestId("viewer-panel-share");
  await expect(panel).toBeVisible();
  await expect(panel).toHaveCount(1);
  expect(await page.evaluate(() => window.history.length)).toBe(
    historyLength + 1,
  );
  await finishPackageHandoff(page, handoff);
  await expect(panel).toBeVisible();
  await expect(panel).toHaveCount(1);
});

test("an off-slot release cancels the held package handoff press", async ({
  page,
}) => {
  const made = await publishedProject(page, "cancel-slot-handoff");
  const handoff = await holdPackageHandoff(page, made.catalogueUrl as string);
  await openHeldPackage(
    page,
    made.projectId,
    made.publicationId,
    handoff.access.seen,
  );
  const historyLength = await page.evaluate(() => window.history.length);
  const trigger = page.getByTestId("viewer-share");
  const previous = await trigger.elementHandle();
  expect(previous).not.toBeNull();
  const before = await trigger.boundingBox();
  expect(before).not.toBeNull();
  await page.mouse.move(
    (before?.x ?? 0) + (before?.width ?? 0) / 2,
    (before?.y ?? 0) + (before?.height ?? 0) / 2,
  );
  await page.mouse.down();
  await releaseAccessDuringPress(
    page,
    previous as NonNullable<typeof previous>,
    handoff,
  );
  const viewport = page.viewportSize();
  await page.mouse.move(16, (viewport?.height ?? 900) - 16);
  await page.mouse.up();

  await finishPackageHandoff(page, handoff);
  await expect(page.getByTestId("viewer-panel-share")).toHaveCount(0);
  expect(await page.evaluate(() => window.history.length)).toBe(historyLength);
});

test("another key cancels a held Space handoff activation", async ({
  page,
}) => {
  const made = await publishedProject(page, "cancel-space-handoff");
  const handoff = await holdPackageHandoff(page, made.catalogueUrl as string);
  await openHeldPackage(
    page,
    made.projectId,
    made.publicationId,
    handoff.access.seen,
  );
  const historyLength = await page.evaluate(() => window.history.length);
  const trigger = page.getByTestId("viewer-share");
  const previous = await trigger.elementHandle();
  expect(previous).not.toBeNull();
  await trigger.focus();
  await page.keyboard.down("Space");
  await releaseAccessDuringPress(
    page,
    previous as NonNullable<typeof previous>,
    handoff,
  );
  await page.keyboard.press("Tab");
  await page.keyboard.up("Space");

  await finishPackageHandoff(page, handoff);
  await expect(page.getByTestId("viewer-panel-share")).toHaveCount(0);
  expect(await page.evaluate(() => window.history.length)).toBe(historyLength);
});

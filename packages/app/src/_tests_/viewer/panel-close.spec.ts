import type { Page } from "@playwright/test";

import { projectAddress } from "../addresses";
import { expect, freshEmail, open, signIn, test } from "../harness";
import { createProject } from "../project-setup";

import {
  openSettingsFromAccount,
  publishedProject,
  publishedViewerReady,
} from "./support";

/**
 * Mark the viewer screen's root element, so a later check can tell whether
 * the route kept it or drew a new one, which only a remount does.
 */
async function markViewer(page: Page): Promise<void> {
  await page
    .locator('[data-mkc-screen="viewer"]')
    .evaluate((root) => root.setAttribute("data-test-kept", ""));
}

async function expectViewerKept(page: Page): Promise<void> {
  await expect(page.locator("[data-test-kept]")).toHaveCount(1);
}

test("closing a panel or the settings dialog keeps the viewer beneath it", async ({
  page,
}) => {
  const made = await publishedProject(page, "panel-close");

  await test.step("closing a panel keeps the viewer beneath it", async () => {
    // The selection is the viewer's own query, which the router never wrote.
    await open(page, `${made.publicationPath}?view=changes`);
    await publishedViewerReady(page);
    await markViewer(page);

    await page.getByTestId("viewer-project").click();
    await expect(page.getByTestId("viewer-panel-projects")).toBeVisible();
    await page.getByTestId("close-projects").click();
    await expect(page.getByTestId("viewer-panel-projects")).toHaveCount(0);
    await expect(page).toHaveURL(/view=changes/);
    await expectViewerKept(page);

    // The browser's own Back and Forward over the panel's entry keep it too.
    await page.getByTestId("viewer-history").click();
    await expect(page.getByTestId("viewer-panel-history")).toBeVisible();
    await page.goBack();
    await expect(page.getByTestId("viewer-panel-history")).toHaveCount(0);
    await page.goForward();
    await expect(page.getByTestId("viewer-panel-history")).toBeVisible();
    await page.goBack();
    await expect(page.getByTestId("viewer-panel-history")).toHaveCount(0);
    await expect(page).toHaveURL(/view=changes/);
    await expectViewerKept(page);
  });

  await test.step("closing the settings dialog keeps the viewer beneath it", async () => {
    await open(page, made.publicationPath);
    await publishedViewerReady(page);
    await markViewer(page);

    await openSettingsFromAccount(page);
    await page.getByTestId("close-settings").click();
    await expect(page.getByTestId("settings-dialog")).toHaveCount(0);
    await expectViewerKept(page);

    await openSettingsFromAccount(page);
    await page.goBack();
    await expect(page.getByTestId("settings-dialog")).toHaveCount(0);
    await expectViewerKept(page);
  });
});

test("closing a panel keeps an unpublished project's viewer", async ({
  page,
}) => {
  await signIn(page, freshEmail("panel-close-empty"));
  const projectId = await createProject(page, "panel-close-empty Org");
  const address = await projectAddress(page, projectId);
  await open(page, address.path);
  await expect(page.getByTestId("viewer-project")).toBeVisible();
  await markViewer(page);

  await page.getByTestId("viewer-project").click();
  await expect(page.getByTestId("viewer-panel-projects")).toBeVisible();
  await page.getByTestId("close-projects").click();
  await expect(page.getByTestId("viewer-panel-projects")).toHaveCount(0);
  await expectViewerKept(page);
});

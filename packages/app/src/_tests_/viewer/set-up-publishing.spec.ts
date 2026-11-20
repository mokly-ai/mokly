import type { Page } from "@playwright/test";

import { siteLinks } from "../../config";
import { projectPathFor } from "../addresses";
import { expect, freshEmail, open, signIn, test } from "../harness";
import { appOrigin } from "../origins";
import { createProject } from "../project-setup";

/**
 * The CI setup guide Set up publishing opens. In a browser tab the public
 * site shares the page's origin, so the guide is on the app origin.
 */
const guide = siteLinks(appOrigin).publishFromCi;

/**
 * Press one Set up publishing action and prove that this tab went to the
 * guide: the page's own main frame navigates to it, and no other page opens.
 */
async function expectGuideInThisTab(page: Page, action: string): Promise<void> {
  const opened: string[] = [];
  const record = (other: Page) => void opened.push(other.url());
  page.context().on("page", record);
  const arrived = page.waitForRequest(
    (request) =>
      request.url() === guide &&
      request.isNavigationRequest() &&
      request.frame() === page.mainFrame(),
  );
  await page.getByTestId(action).click();
  await arrived;
  await page.waitForURL(guide);
  page.context().off("page", record);
  expect(opened, action + " opens no other page").toEqual([]);
  expect(page.context().pages()).toEqual([page]);
}

/**
 * The stage and the switcher of a project with nothing published both offer
 * Set up publishing to its administrator. While the publication read is
 * pending, the share panel prepares its link. Once the read answers with no
 * publication, the address closes the panel. Its offer is pressed in
 * `set-up-publishing.test.ts` instead.
 */
test("every Set up publishing action opens the CI setup guide in this tab", async ({
  page,
}) => {
  // The guide belongs to the public site, which this suite does not serve.
  await page.route(
    (url) => url.href === guide,
    (route) =>
      route.fulfill({
        contentType: "text/html",
        body: "<!doctype html><title>Publishing</title>",
      }),
  );
  await signIn(page, freshEmail("publishing-guide"));
  const projectId = await createProject(page, "Guide Org");
  const projectRoute = await projectPathFor(page, projectId);

  await open(page, projectRoute);
  await expect(page.getByText("No publications yet")).toBeVisible();
  await expectGuideInThisTab(page, "set-up-publishing");

  await open(page, `${projectRoute}?panel=switcher`);
  const switcher = page.getByTestId("viewer-panel-switcher");
  await expect(switcher.getByText("No branches yet")).toBeVisible();
  await expectGuideInThisTab(page, "switcher-set-up-publishing");
});

/** Shared actions of the live prop edit specs on the live shell fixture. */

import { expect, type Page, type Request } from "@playwright/test";

import { isRender } from "./live_shell_fixture.js";

/** The text that every stage frame shows, read through the parent page. */
export function frameTexts(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLIFrameElement>("#mb-main iframe")].map(
      (frame) => frame.contentDocument?.body?.innerText ?? "",
    ),
  );
}

/** The URL and text of one viewport's stage frame, read through the page. */
export function frameDocument(page: Page, viewport: "desktop" | "mobile") {
  return page
    .locator(`#mb-main iframe[data-workspace-frame="${viewport}"]`)
    .evaluate((frame: HTMLIFrameElement) => ({
      url: frame.contentDocument?.URL ?? "",
      text: frame.contentDocument?.body?.innerText ?? "",
    }));
}

/** The text of one viewport's stage frame. */
export async function frameText(
  page: Page,
  viewport: "desktop" | "mobile",
): Promise<string> {
  return (await frameDocument(page, viewport)).text;
}

/** Show the Props panel; a click on the selected tab would close it. */
export async function showProps(page: Page) {
  const tab = page.getByRole("tab", { name: "Props" });
  await expect(tab).toBeVisible();
  if ((await tab.getAttribute("aria-selected")) !== "true") await tab.click();
  return page.getByRole("tabpanel", { name: "Props" });
}

/**
 * Open the card's Props panel; `editable` waits for the live descriptor, and
 * `query` selects the route's views, for example `?viewport=desktop`.
 */
export async function openProps(
  page: Page,
  url: string,
  { editable = true, query = "" }: { editable?: boolean; query?: string } = {},
) {
  await page.goto(`${url}/view/card/${query}`);
  const props = await showProps(page);
  if (editable)
    await expect(props.getByRole("textbox", { name: "label" })).toBeEditable();
  return props;
}

/** Collect render requests; each visible view sends its own. */
export function renders(page: Page): Request[] {
  const seen: Request[] = [];
  page.on("request", (request) => {
    if (isRender(request)) seen.push(request);
  });
  return seen;
}

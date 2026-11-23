/** Shared actions of the live prop edit specs on the live shell fixture. */

import { expect, type Page, type Request } from "@playwright/test";

import { isRender } from "./live_shell_fixture.js";
import { openInspectFold } from "./workspace_actions.js";

/** The text that every stage frame shows, read through the parent page. */
export function frameTexts(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLIFrameElement>("#mb-main iframe")].map(
      (frame) => frame.contentDocument?.body?.innerText ?? "",
    ),
  );
}

/**
 * The URL and text of one viewport's stage frame, read through the page. On
 * the canvas, `scheme` picks the frame of that scheme.
 */
export function frameDocument(
  page: Page,
  viewport: "desktop" | "mobile",
  scheme?: "dark" | "light",
) {
  const own = scheme ? `[data-workspace-color-scheme="${scheme}"]` : "";
  return page
    .locator(`#mb-main iframe[data-workspace-frame="${viewport}"]${own}`)
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

/**
 * Open Inspect's Props, a folded section, and return its content; a press on
 * an open section's head would fold it. In the compact layout Inspect stands
 * in the panel's sheet. On a variant set, Props edits the row of the
 * selected frame, so while no frame is selected this chooses the routed
 * entry's own row in Variants.
 */
export async function showProps(page: Page) {
  const props = await openInspectFold(page, "props");
  const choose = props.getByText("Choose a variant to edit its props.");
  if (await choose.isVisible()) {
    await chooseRow(page, new URL(page.url()).pathname);
    await expect(choose).toBeHidden();
  }
  return props;
}

/**
 * Choose a row of a variant set in Inspect's Variants, which selects the
 * row's Light frame, so Props edits that row. `route` names the row by its
 * entry path or by its route, such as `/view/card/`.
 */
export async function chooseRow(page: Page, route: string): Promise<void> {
  const path = route.replace(/^\/view\/|\/$/gu, "");
  await page
    .locator(
      `[data-inspect-section="variants"] [data-inspect-variant="${path}"]`,
    )
    .click();
}

/**
 * Open the Props panel of the card, or of the entry that `path` names;
 * `editable` waits for the live descriptor, and `query` selects the route's
 * views, for example `?viewport=desktop`.
 */
export async function openProps(
  page: Page,
  url: string,
  {
    editable = true,
    path = "card",
    query = "",
  }: { editable?: boolean; path?: string; query?: string } = {},
) {
  await page.goto(`${url}/view/${path}/${query}`);
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

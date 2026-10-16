/**
 * The states of live prop edits in Serve, under the component controls and
 * shell delivery contracts: navigation cancels a pending edit, fields stay
 * read-only until the live descriptor installs, a failed descriptor offers
 * Try again, and a failed render keeps the last valid preview.
 */

import { expect, type Page, type Route } from "@playwright/test";

import { captureBrowserErrors } from "./browser_errors.js";
import { test } from "./browser_test.js";
import { isRender, serveLiveCatalogue } from "./live_shell_fixture.js";

/** The text that every stage frame shows, read through the parent page. */
function frameTexts(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLIFrameElement>("#mb-main iframe")].map(
      (frame) => frame.contentDocument?.body?.innerText ?? "",
    ),
  );
}

/** Show the Props panel; a click on the selected tab would close it. */
async function showProps(page: Page) {
  const tab = page.getByRole("tab", { name: "Props" });
  await expect(tab).toBeVisible();
  if ((await tab.getAttribute("aria-selected")) !== "true") await tab.click();
  return page.getByRole("tabpanel", { name: "Props" });
}

/** Open the card's Props panel; `editable` waits for the live descriptor. */
async function openProps(page: Page, url: string, editable = true) {
  await page.goto(`${url}/view/card/`);
  const props = await showProps(page);
  if (editable)
    await expect(props.getByRole("textbox", { name: "label" })).toBeEditable();
  return props;
}

test("navigation cancels a pending edit, and returning shows the saved props", async ({
  page,
}) => {
  const errors = captureBrowserErrors(page);
  const server = await serveLiveCatalogue();
  try {
    const props = await openProps(page, server.url);
    const held: Route[] = [];
    await page.route("**/mokly-viewer/components/render", (route) => {
      held.push(route);
    });
    const cancelled: string[] = [];
    page.on("requestfailed", (request) => {
      if (isRender(request)) cancelled.push(request.failure()?.errorText ?? "");
    });
    await props.getByRole("textbox", { name: "label" }).fill("Never shown");
    await expect.poll(() => held.length).toBe(2);
    await expect(page.getByText("Updating preview…").first()).toBeVisible();

    await page.locator('a[data-entry-id="home"][data-nav-row]').click();
    await expect(page.locator("#mb-main h2")).toHaveText("Home");
    await expect
      .poll(() => cancelled)
      .toEqual(["net::ERR_ABORTED", "net::ERR_ABORTED"]);
    await expect(page.getByText("Updating preview…")).toHaveCount(0);

    await page.goBack();
    await expect(page.locator("#mb-main h2")).toHaveText("Card");
    await showProps(page);
    await expect(props.getByRole("textbox", { name: "label" })).toHaveValue(
      "Hello",
    );
    await expect
      .poll(() => frameTexts(page))
      .toEqual([
        expect.stringContaining("Hello 1"),
        expect.stringContaining("Hello 1"),
      ]);
    expect(errors).toEqual([]);
  } finally {
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await server.close();
  }
});

test("fields stay read-only until the live descriptor installs", async ({
  page,
}) => {
  const errors = captureBrowserErrors(page);
  const server = await serveLiveCatalogue();
  try {
    let release!: () => void;
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/mokly-viewer/live.json", async (route) => {
      await released;
      await route.continue();
    });
    const props = await openProps(page, server.url, false);
    const label = props.getByRole("textbox", { name: "label" });
    await expect(props.getByText("Preparing to edit props…")).toBeVisible();
    await expect(label).toHaveValue("Hello");
    await expect(label).not.toBeEditable();
    await expect(
      props.getByRole("checkbox", { name: "active" }),
    ).toBeDisabled();
    release();
    await expect(label).toBeEditable();
    await expect(props.getByText("Preparing to edit props…")).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally {
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await server.close();
  }
});

test("a failed live descriptor offers Try again, which installs it", async ({
  page,
}) => {
  const errors = captureBrowserErrors(page);
  const server = await serveLiveCatalogue();
  try {
    let failing = true;
    await page.route("**/mokly-viewer/live.json", (route) =>
      failing ? route.fulfill({ status: 503, body: "" }) : route.continue(),
    );
    const props = await openProps(page, server.url, false);
    const label = props.getByRole("textbox", { name: "label" });
    await expect(props.getByText("Editing could not start.")).toBeVisible();
    await expect(label).not.toBeEditable();
    failing = false;
    await props.getByRole("button", { name: "Try again" }).click();
    await expect(label).toBeEditable();
    await expect(props.getByText("Editing could not start.")).toHaveCount(0);
    expect(errors.filter((error) => !/\b503\b/.test(error))).toEqual([]);
  } finally {
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await server.close();
  }
});

test("a failed render keeps the last valid preview, and Try again renders the edit", async ({
  page,
}) => {
  const errors = captureBrowserErrors(page);
  const server = await serveLiveCatalogue();
  try {
    const props = await openProps(page, server.url);
    const label = props.getByRole("textbox", { name: "label" });
    await label.fill("First");
    await expect
      .poll(() => frameTexts(page))
      .toEqual([
        expect.stringContaining("First 1"),
        expect.stringContaining("First 1"),
      ]);
    let failing = true;
    await page.route("**/mokly-viewer/components/render", (route) =>
      failing
        ? route.fulfill({
            status: 422,
            contentType: "application/json",
            body: JSON.stringify({ code: "render-failed", message: "failed" }),
          })
        : route.continue(),
    );
    await label.fill("Second");
    await expect(
      props.getByText("The preview could not be updated"),
    ).toBeVisible();
    expect(await frameTexts(page)).toEqual([
      expect.stringContaining("First 1"),
      expect.stringContaining("First 1"),
    ]);
    await expect(label).toHaveValue("Second");
    failing = false;
    await props.getByRole("button", { name: "Try again" }).click();
    await expect
      .poll(() => frameTexts(page))
      .toEqual([
        expect.stringContaining("Second 1"),
        expect.stringContaining("Second 1"),
      ]);
    await expect(
      props.getByText("The preview could not be updated"),
    ).toHaveCount(0);
    expect(errors.filter((error) => !/\b422\b/.test(error))).toEqual([]);
  } finally {
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await server.close();
  }
});

import { expect, test } from "@playwright/test";

import { startStaticFixture } from "./static_fixture.js";
import { chooseScheme, expectFrameSource } from "./workspace_actions.js";

let site: Awaited<ReturnType<typeof startStaticFixture>>;
test.beforeAll(async () => {
  site = await startStaticFixture();
});
test.afterAll(async () => {
  await site.close();
});

test("an isolated export contains a complete exact-file resource graph", async ({
  request,
}) => {
  for (const [filename, bytes] of site.files) {
    if (filename.startsWith(".")) continue;
    const response = await request.get(`${site.url}/${filename}`);
    expect(response.status(), filename).toBe(200);
    expect(await response.body(), filename).toEqual(bytes);
  }
  expect((await request.get(`${site.url}/view/screens/home`)).status()).toBe(
    404,
  );
  expect(
    (await request.get(`${site.url}/__mokly/diffs/review.json`)).status(),
  ).toBe(404);
});

test("aliases and frame activations retain canonical files, fragments, and history", async ({
  page,
  context,
}) => {
  const failures: string[] = [];
  page.on("response", (response) => {
    if (response.status() >= 400) failures.push(response.url());
  });
  await page.goto(`${site.url}/id/home/?fragment=home-mobile&ignored=1`);
  await expect(page).toHaveURL(
    `${site.url}/view/screens/home.html?fragment=home-mobile`,
  );
  await page
    .locator("html")
    .evaluate((root) => root.setAttribute("data-test-retained", "yes"));
  const link = page
    .frameLocator(".mbk-frame-mobile iframe")
    .getByRole("link", { name: "Details" });
  const popup = context.waitForEvent("page");
  await link.click({ modifiers: ["ControlOrMeta"] });
  const opened = await popup;
  await expect(opened).toHaveURL(
    `${site.url}/view/screens/details.html?fragment=details`,
  );
  await opened.close();
  await link.click();
  await expect(page).toHaveURL(
    `${site.url}/view/screens/details.html?fragment=details`,
  );
  await expect(page.locator("html")).toHaveAttribute(
    "data-test-retained",
    "yes",
  );
  await expect(
    page.locator('a[data-route="screens/details.html"]'),
  ).toHaveAttribute("aria-current", "page");
  await expect(page.locator(".mbk-frame-mobile iframe")).toHaveAttribute(
    "src",
    /#details$/,
  );
  await page.goBack();
  await expect(page.locator("#mb-main h2")).toHaveText("Home");
  await page.goForward();
  await expect(page.locator("#mb-main h2")).toHaveText("Details");
  expect(failures).toEqual([]);
});

test("static search, tags, Changes, details, and flows retain the existing shell", async ({
  page,
}) => {
  await page.goto(`${site.url}/view/screens/home.html`);
  await page.locator("[data-mokly-tag-toggle]").click();
  await page.locator('#mb-tag-picker [data-mokly-tag="forms"]').click();
  await expect(page.locator("[data-mokly-search]")).toHaveValue("tag:forms");
  await expect(
    page.locator('[data-route="user-flows/tour.html"]'),
  ).toBeHidden();
  await page.locator("[data-mokly-search]").fill("");
  await page.locator('[data-filter="changed"]').click();
  await expect(page.locator('[data-route="screens/home.html"]')).toBeVisible();
  await page.locator('[data-filter="all"]').click();
  await page.getByRole("tab", { name: "Details", exact: true }).click();
  await expect(
    page.getByRole("tabpanel", { name: "Details", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Details", exact: true }).click();
  await page.locator('[data-route="user-flows/tour.html"]').click();
  await expect(page.locator(".mbk-flow-screen iframe")).toHaveCount(2);
  await chooseScheme(page, "dark");
  for (const frame of await page.locator(".mbk-flow-screen iframe").all())
    await expectFrameSource(frame, /\.dark\.html$/);
});

test("static aliases contain a real screen with JavaScript disabled", async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto(`${site.url}/id/home/index.html`);
    await expect(page.locator("#mb-main h2")).toHaveText("Home");
    await expect(
      page.frameLocator(".mbk-frame-mobile iframe").locator("h1"),
    ).toHaveText("Current home");
    await page.locator('[data-route="screens/details.html"]').click();
    await expect(page).toHaveURL(`${site.url}/view/screens/details.html`);
  } finally {
    await context.close();
  }
});

test("keyboard, middle-click, and named frame targets use exact static routes", async ({
  page,
  context,
}) => {
  await page.goto(`${site.url}/view/screens/home.html`);
  await page
    .frameLocator(".mbk-frame-mobile iframe")
    .getByRole("link", { name: "Details", exact: true })
    .press("Enter");
  await expect(page).toHaveURL(
    `${site.url}/view/screens/details.html?fragment=details`,
  );
  for (const [name, button] of [
    ["Details", "middle"],
    ["New tab", "left"],
    ["Named tab", "left"],
  ] as const) {
    await page.goto(`${site.url}/view/screens/home.html`);
    const pending = context.waitForEvent("page");
    await page
      .frameLocator(".mbk-frame-mobile iframe")
      .getByRole("link", { name, exact: true })
      .click({ button });
    const opened = await pending;
    await expect(opened).toHaveURL(
      `${site.url}/view/screens/details.html?fragment=details`,
    );
    expect(await opened.evaluate(() => window.opener === null)).toBe(true);
    await opened.close();
  }
});

import { expect, test } from "@playwright/test";

test("native skip-link history preserves the view without refetching it", async ({
  page,
}) => {
  await page.goto("/");
  const requests: string[] = [];
  page.on("request", (request) => {
    if (
      request.resourceType() === "fetch" &&
      new URL(request.url()).pathname === "/"
    )
      requests.push(request.url());
  });
  const heading = page.locator("#mb-main h2");
  await heading.evaluate((element) =>
    element.setAttribute("data-retained", "true"),
  );
  await page.keyboard.press("Tab");
  await expect(page.locator(".mbk-skip-link")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/#mb-main$/);
  await expect(page.locator("#mb-main")).toBeFocused();

  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await page.goForward();
  await expect(page).toHaveURL(/\/#mb-main$/);
  await expect(heading).toHaveAttribute("data-retained", "true");
  expect(requests).toEqual([]);
});

test("same-document history leaves focus with the native fragment target", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => {
    const link = document.createElement("a");
    link.href = "#native-history-target";
    link.textContent = "Native history target";
    const target = document.createElement("div");
    target.id = "native-history-target";
    target.tabIndex = -1;
    document.body.append(link, target);
  });
  await page.getByRole("link", { name: "Native history target" }).click();
  await expect(page.locator("#native-history-target")).toBeFocused();

  await page.goBack();
  await page.goForward();

  await expect(page).toHaveURL(/\/#native-history-target$/);
  await expect(page.locator("#native-history-target")).toBeFocused();
});

test("variant entry history stays separate from native fragment history", async ({
  page,
}) => {
  const path = "/view/design/library/inspector/inspector/";
  await page.goto(path);
  await page.locator("html").evaluate((element) => {
    element.setAttribute("data-history-session", "retained");
  });
  const requests: string[] = [];
  page.on("request", (request) => {
    if (
      request.resourceType() === "fetch" &&
      new URL(request.url()).pathname === path
    )
      requests.push(new URL(request.url()).search);
  });
  const variants = page.getByRole("navigation", { name: "Saved variants" });
  const details = variants.getByRole("link", { name: "Details", exact: true });
  const props = variants.getByRole("link", { name: "Props", exact: true });
  await props.click();
  await page.locator(".mbk-skip-link").focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(
    /\/view\/design\/library\/inspector\/inspector\/props\/#mb-main$/,
  );
  await page.goBack();
  await expect(page).toHaveURL(
    /\/view\/design\/library\/inspector\/inspector\/props\/$/,
  );
  await expect(props).toHaveAttribute("aria-current", "page");
  await page.goBack();
  await expect(page).toHaveURL(
    /\/view\/design\/library\/inspector\/inspector\/$/,
  );
  await expect(details).toHaveAttribute("aria-current", "page");
  await page.goForward();
  await expect(props).toHaveAttribute("aria-current", "page");
  await page.goForward();
  await expect(page).toHaveURL(
    /\/view\/design\/library\/inspector\/inspector\/props\/#mb-main$/,
  );
  await expect(props).toHaveAttribute("aria-current", "page");
  await expect(page.locator("html")).toHaveAttribute(
    "data-history-session",
    "retained",
  );
  expect(requests).toEqual([]);
});

test("same-document Back cancels pending route metadata or screen navigation", async ({
  page,
}) => {
  await page.goto("/view/example/screens/welcome/");
  await page.locator(".mbk-skip-link").focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/welcome\/#mb-main$/);
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let markMetadataRequested = (): void => undefined;
  const metadataRequested = new Promise<void>((resolve) => {
    markMetadataRequested = resolve;
  });
  await page.route("**/view/example/screens/details/", async (route) => {
    markMetadataRequested();
    await gate;
    await route.continue();
  });
  const requests: string[] = [];
  page.on("request", (request) => {
    if (
      request.resourceType() === "fetch" &&
      request.url().endsWith("/view/example/screens/details/")
    )
      requests.push(request.url());
  });
  await page
    .locator("[data-mokly-view]")
    .evaluate((view) => view.setAttribute("data-route-owner", "retained"));
  await page
    .locator('a[data-nav-row][data-route="example/screens/details/index.html"]')
    .click();
  await metadataRequested;
  await expect(page).toHaveURL(/details\/$/);
  await expect(page.locator("#mb-main h2")).toHaveText("Details");
  await expect(page.locator("[data-mokly-view]")).toHaveAttribute(
    "data-route-owner",
    "retained",
  );
  expect(requests).toHaveLength(1);
  const aborted = page.waitForEvent("requestfailed", (request) =>
    request.url().endsWith("/view/example/screens/details/"),
  );
  try {
    await page.goBack();
  } finally {
    release();
  }
  await aborted;
  await expect(page).toHaveURL(/welcome\/#mb-main$/);
  await expect(page.locator("#mb-main h2")).toHaveText("Welcome");
  await expect(page.locator("[data-mokly-view]")).toHaveAttribute(
    "data-route-owner",
    "retained",
  );
});

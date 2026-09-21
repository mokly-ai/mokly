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

test("saved-variant query history stays separate from native fragment history", async ({
  page,
}) => {
  const path = "/view/design/library/inspector/inspector.html";
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
  const variant = page.getByLabel("Saved variant", { exact: true });
  await variant.selectOption("props");
  await page.locator(".mbk-skip-link").focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\?variant=props#mb-main$/);
  await page.goBack();
  await expect(page).toHaveURL(/\?variant=props$/);
  await expect(variant).toHaveValue("props");
  await page.goBack();
  await expect(variant).toHaveValue("details");
  await page.goForward();
  await expect(variant).toHaveValue("props");
  await page.goForward();
  await expect(page).toHaveURL(/\?variant=props#mb-main$/);
  await expect(variant).toHaveValue("props");
  await expect(page.locator("html")).toHaveAttribute(
    "data-history-session",
    "retained",
  );
  expect(requests).toEqual([]);
});

test("same-document Back cancels pending route metadata or screen navigation", async ({
  page,
}) => {
  await page.goto("/view/screens/welcome.html");
  await page.locator(".mbk-skip-link").focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/welcome\.html#mb-main$/);
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let markMetadataRequested = (): void => undefined;
  const metadataRequested = new Promise<void>((resolve) => {
    markMetadataRequested = resolve;
  });
  await page.route("**/view/screens/details.html", async (route) => {
    markMetadataRequested();
    await gate;
    await route.continue();
  });
  const requests: string[] = [];
  page.on("request", (request) => {
    if (
      request.resourceType() === "fetch" &&
      request.url().endsWith("/view/screens/details.html")
    )
      requests.push(request.url());
  });
  await page
    .locator("[data-mokly-view]")
    .evaluate((view) => view.setAttribute("data-route-owner", "retained"));
  await page
    .locator('a[data-nav-row][data-route="screens/details.html"]')
    .click();
  await metadataRequested;
  await expect(page).toHaveURL(/details\.html$/);
  await expect(page.locator("#mb-main h2")).toHaveText("Details");
  await expect(page.locator("[data-mokly-view]")).toHaveAttribute(
    "data-route-owner",
    "retained",
  );
  expect(requests).toHaveLength(1);
  const aborted = page.waitForEvent("requestfailed", (request) =>
    request.url().endsWith("/view/screens/details.html"),
  );
  try {
    await page.goBack();
  } finally {
    release();
  }
  await aborted;
  await expect(page).toHaveURL(/welcome\.html#mb-main$/);
  await expect(page.locator("#mb-main h2")).toHaveText("Welcome");
  await expect(page.locator("[data-mokly-view]")).toHaveAttribute(
    "data-route-owner",
    "retained",
  );
});

import { expect, test } from "@playwright/test";

import { startViewerPreviews } from "./removed_preview_fixture.js";

let host: Awaited<ReturnType<typeof startViewerPreviews>>;

test.beforeAll(async () => {
  test.setTimeout(240_000);
  host = await startViewerPreviews();
});
test.afterAll(async () => {
  await host?.close();
});

const stage = "[data-mokly-preview]";

for (const adapter of ["same-origin", "cross"]) {
  test(`an embedded viewer shows previous versions through the ${adapter} adapter`, async ({
    page,
  }) => {
    const requests: string[] = [];
    page.on("request", (request) => requests.push(request.url()));
    await page.goto(`${host.url}/viewer.html?adapter=${adapter}`);
    await expect(page.locator(`#viewer .mbk-previous`)).toHaveText(
      "Showing previous version",
    );
    await expect(page.frameLocator(`${stage} iframe`).locator("h1")).toHaveText(
      "Previous page",
    );
    await page.locator('#viewer a[data-route="screens/removed.html"]').click();
    await expect(
      page.frameLocator(`${stage} .mbk-frame-desktop iframe`).locator("h1"),
    ).toHaveText("Previous desktop screen");
    await expect(page.locator(`#viewer .mbk-diff-toolbar`)).toHaveCount(0);
    expect(
      requests.filter((url) => /\/__mokly\/diffs\/review\.json\?/.test(url)),
    ).toEqual([]);
    expect(
      await page.evaluate(
        () => (window as unknown as { frameMessages: string[] }).frameMessages,
      ),
    ).toEqual([]);
  });
}

test("a viewer selection change fences the previous request", async ({
  page,
}) => {
  let release = (): void => undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let handled = false;
  await page.route("**/pages/archive/removed.html.json", async (route) => {
    await held;
    await route.continue().catch(() => undefined);
    handled = true;
  });
  let settled = false;
  const settle = (request: { url(): string }): void => {
    if (request.url().includes("/pages/archive/removed.html.json"))
      settled = true;
  };
  page.on("requestfinished", settle);
  page.on("requestfailed", settle);
  await page.goto(`${host.url}/viewer.html?adapter=same-origin`);
  await expect(page.locator(".mbk-preview-status")).toHaveText(
    "Loading previous version…",
  );
  await page.locator('#viewer a[data-route="screens/removed.html"]').click();
  await expect(
    page.frameLocator(`${stage} .mbk-frame-desktop iframe`).locator("h1"),
  ).toHaveText("Previous desktop screen");
  release();
  await expect.poll(() => handled && settled).toBe(true);
  await expect(
    page.frameLocator(`${stage} .mbk-frame-desktop iframe`).locator("h1"),
  ).toHaveText("Previous desktop screen");
  await expect(page.locator(".mbk-preview-status")).toHaveCount(0);
});

test("several viewers on one page keep their own stages", async ({ page }) => {
  await page.goto(`${host.url}/viewer.html?adapter=same-origin`);
  await expect(page.frameLocator(`${stage} iframe`).locator("h1")).toHaveText(
    "Previous page",
  );
  await page.evaluate(() => {
    const frame = document.createElement("iframe");
    frame.id = "second";
    frame.style.cssText = "width:1200px;height:900px;border:0";
    frame.src = "/viewer.html?adapter=same-origin&entry=removed-screen";
    document.body.append(frame);
  });
  const second = page.frameLocator("#second");
  await expect(second.locator("#viewer .mbk-previous")).toHaveText(
    "Showing previous version",
  );
  await expect(page.frameLocator(`${stage} iframe`).locator("h1")).toHaveText(
    "Previous page",
  );
});

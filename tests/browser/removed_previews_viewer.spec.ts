import { expect, test, type Page } from "@playwright/test";

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

/** Every top-level document requested after a previous version is ready. */
function documentRequests(page: Page): string[] {
  const requested: string[] = [];
  page.on("request", (request) => {
    if (request.resourceType() === "document") requested.push(request.url());
  });
  return requested;
}

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

for (const adapter of ["same-origin", "cross"]) {
  test(`a previous version stays inert through the ${adapter} adapter`, async ({
    page,
  }) => {
    await page.goto(`${host.url}/viewer.html?adapter=${adapter}`);
    const preview = page.frameLocator(`${stage} iframe`);
    await expect(preview.locator("h1")).toHaveText("Previous page");
    const address = page.url();
    const documents = documentRequests(page);
    for (const label of [
      "Marked catalogue link",
      "Relative link",
      "Plain external link",
      "Download link",
      "Shadow link",
      "SVG link",
    ]) {
      await preview.getByText(label, { exact: true }).click();
      await expect(preview.locator("h1")).toHaveText("Previous page");
    }
    await preview.getByRole("button", { name: "Send" }).click();
    await preview.getByText("Marked catalogue link", { exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(preview.locator("h1")).toHaveText("Previous page");
    expect(documents).toEqual([]);
    expect(page.url()).toBe(address);
    expect(
      await page.evaluate(
        () => (window as unknown as { frameMessages: string[] }).frameMessages,
      ),
    ).toEqual([]);
  });
}

test("a cross-origin frame navigation restores the presentation", async ({
  page,
}) => {
  await page.goto(`${host.url}/viewer.html?adapter=cross`);
  const frame = page.locator(`${stage} iframe`);
  await expect(page.frameLocator(`${stage} iframe`).locator("h1")).toHaveText(
    "Previous page",
  );
  const source = await frame.getAttribute("data-mokly-preview-source");
  expect(source).not.toBeNull();
  await frame.evaluate((element, destination) => {
    const preview = element as HTMLIFrameElement;
    if (preview.contentWindow)
      preview.contentWindow.location.href = destination;
  }, `${host.frameOrigin}/view/screens/current.html`);
  await expect(page.frameLocator(`${stage} iframe`).locator("h1")).toHaveText(
    "Previous page",
  );
  await expect(frame).toHaveAttribute("data-mokly-preview-source", source!);
});

test("an embedded host CSP permits historical resources", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      /content security policy|violates the following directive/i.test(
        message.text(),
      )
    )
      consoleErrors.push(message.text());
  });
  await page.addInitScript(() => {
    const probe = window as unknown as { cspViolations: string[] };
    probe.cspViolations = [];
    document.addEventListener("securitypolicyviolation", (event) => {
      probe.cspViolations.push(
        `${event.effectiveDirective}:${event.blockedURI}`,
      );
    });
  });
  await page.goto(`${host.cspUrl}/viewer.html?adapter=cross`);
  const preview = page.frameLocator(`${stage} iframe`);
  await expect(preview.locator("h1")).toHaveText("Previous page");
  await expect(preview.locator("body")).toHaveCSS(
    "background-color",
    "rgb(244, 239, 228)",
  );
  const violations = await Promise.all(
    page
      .frames()
      .map((frame) =>
        frame.evaluate(
          () =>
            (window as unknown as { cspViolations?: string[] }).cspViolations ??
            [],
        ),
      ),
  );
  expect(violations.flat()).toEqual([]);
  expect(consoleErrors).toEqual([]);
});

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

import { expect, test } from "@playwright/test";

import { chooseScheme, expectFrameLoaded } from "./workspace_actions.js";

for (const viewport of ["mobile", "desktop"] as const) {
  test(`${viewport}: a superseded Dark response cannot replace the newer Light selection`, async ({
    page,
  }) => {
    await page.goto("/view/design/browse/appearance/states/light-only.html");
    await expect(page.locator("html")).toHaveAttribute(
      "data-mokly-hydrated",
      "",
    );
    const frame = page.locator(`.mbk-frame-${viewport} iframe`);
    await expect(frame).toHaveAttribute("data-mokly-frame-state", "ready");
    let release = () => {};
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    const dark = `**/light-only.${viewport}.dark.html`;
    await page.route(dark, async (route) => {
      await released;
      await route.continue();
    });

    try {
      const requested = page.waitForRequest(dark);
      await chooseScheme(page, "dark");
      const request = await requested;
      const finished = Promise.race([
        page.waitForEvent(
          "requestfinished",
          (candidate) => candidate === request,
        ),
        page.waitForEvent(
          "requestfailed",
          (candidate) => candidate === request,
        ),
      ]);
      await chooseScheme(page, "light");
      await expect(frame).toHaveAttribute("data-mokly-frame-state", "ready");
      release();
      await finished;
      await expectFrameLoaded(
        frame,
        new RegExp(`/light-only\\.${viewport}\\.html$`, "u"),
      );
    } finally {
      release();
    }
  });

  test(`${viewport}: Light replaces a Dark preview before its resources finish loading`, async ({
    page,
  }) => {
    await page.goto("/view/design/browse/appearance/states/light-only.html");
    await expect(page.locator("html")).toHaveAttribute(
      "data-mokly-hydrated",
      "",
    );
    const frame = page.locator(`.mbk-frame-${viewport} iframe`);
    await expect(frame).toHaveAttribute("data-mokly-frame-state", "ready");

    let release = () => {};
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/held-preview.css", async (route) => {
      await released;
      await route.fulfill({ body: "", contentType: "text/css" });
    });
    await page.route(`**/light-only.${viewport}.dark.html`, async (route) => {
      const response = await route.fetch();
      await route.fulfill({
        response,
        body: (await response.text()).replace(
          "</head>",
          '<link rel="stylesheet" href="/held-preview.css"></head>',
        ),
      });
    });

    try {
      await chooseScheme(page, "dark");
      await expect
        .poll(() =>
          frame.evaluate((element: HTMLIFrameElement) => ({
            path: element.contentWindow?.location.pathname,
            readyState: element.contentDocument?.readyState,
          })),
        )
        .toEqual({
          path: `/static/design/browse/appearance/states/light-only.${viewport}.dark.html`,
          readyState: "interactive",
        });

      await chooseScheme(page, "light");
      await expectFrameLoaded(
        frame,
        new RegExp(`/light-only\\.${viewport}\\.html$`, "u"),
      );
      await expect(frame).toHaveAttribute("data-mokly-frame-state", "ready");
      await expect(page.locator("body")).toHaveAttribute(
        "data-mokly-color-scheme",
        "light",
      );
    } finally {
      release();
    }
  });
}

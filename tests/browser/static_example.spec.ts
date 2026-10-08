import { expect } from "@playwright/test";

import { committedExportTest } from "./committed_export_fixture.js";
import { chooseViewport, expectFrameSource } from "./workspace_actions.js";

const test = committedExportTest({
  profile: "static-example",
  prefix: "mokly-static-export-",
  shellPath: "/view/example/screens/welcome/",
});

test("the owning example stays usable when HEAD is the unchanged baseline", async ({
  page,
  committedExport: { server },
}, info) => {
  const failures: string[] = [];
  page.on("response", (response) => {
    if (response.status() >= 400) failures.push(response.url());
  });
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(
      `${server.url}/view/example/screens/welcome/?fragment=welcome`,
    );
    await expect(page).toHaveURL(
      `${server.url}/view/example/screens/welcome/?fragment=welcome`,
    );
    await chooseViewport(page, width === 390 ? "mobile" : "desktop");
    await expect(page.locator("[data-workspace-status]")).toHaveText(
      "Unmodified",
    );
    await expect(page.locator(".mbk-diff-toolbar")).toBeHidden();
    const frames = page.locator("[data-current-screen] iframe");
    for (const frame of await frames.all()) {
      await expect(frame.contentFrame().locator("h1")).toHaveText(
        "Welcome to Mokly",
      );
      await frame
        .contentFrame()
        .locator("body")
        .evaluate(async () => {
          await document.fonts.ready;
        });
    }
    await page.screenshot({ path: info.outputPath(`${width}-Current.png`) });
  }
  expect(failures).toEqual([]);
  expect(
    server.requests.some((url) => url.includes("/mokly-viewer/events")),
  ).toBe(false);
});

test("the exported example discloses a screen's variants without a server", async ({
  page,
  committedExport: { server },
}) => {
  const list = page.locator(
    '[data-nav-disclosure="variants:example/screens/welcome"]',
  );
  const toggle = page
    .locator(".mbk-nav-leaf", {
      has: page.locator('a[data-entry-id="example/screens/welcome"]'),
    })
    .locator("[data-nav-variants-toggle]");
  const variantRow = page.locator(
    'a[data-nav-row][data-route="example/screens/welcome/empty/index.html"]',
  );
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${server.url}/view/example/screens/details/`);
  await expect(list).toBeHidden();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");

  await toggle.click();
  await expect(list).toBeVisible();
  await expect(variantRow).toBeVisible();

  await variantRow.click();
  await expect(page).toHaveURL(
    `${server.url}/view/example/screens/welcome/empty/`,
  );
  await expect(page.locator("#mb-main h2")).toHaveText(
    "Welcome, empty workspace",
  );
  await expect(variantRow).toHaveAttribute("aria-current", "page");
  await expect(page.getByLabel("Catalogue location").locator("a")).toHaveText([
    "Example",
    "Welcome",
  ]);
});

test("the exported example opens a Markdown document from each URL form", async ({
  page,
  committedExport: { server },
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const frame = page.locator(".mbk-stage-embed iframe");
  for (const form of ["/", "", "/index.html"]) {
    await page.goto(`${server.url}/view/example/workspace-guide${form}`);
    await expect(page).toHaveURL(`${server.url}/view/example/workspace-guide/`);
    await expect(page.locator("#mb-main h2")).toHaveText("Workspace guide");
    await expect(frame).toHaveAttribute("data-mokly-frame-state", "ready");
    await expect(
      page
        .frameLocator(".mbk-stage-embed iframe")
        .getByRole("heading", { name: "Workspace guide", exact: true }),
    ).toBeVisible();
  }
  await page.getByLabel("Appearance", { exact: true }).selectOption("dark");
  await expectFrameSource(
    frame,
    `${server.url}/static/mokly-generated/example/workspace-guide/index.dark.html`,
  );
});

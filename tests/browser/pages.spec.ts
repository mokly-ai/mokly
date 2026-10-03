import { expect, test } from "@playwright/test";

import { chooseViewport } from "./workspace_actions.js";

for (const width of [390, 1280]) {
  test(`catalogue guidance includes documents at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.locator("#mb-main")).toContainText(
      "choose an item from the navigation",
    );
    await expect(
      page.getByRole("searchbox", { name: "Search catalogue" }),
    ).toHaveAttribute("placeholder", "Search catalogue…");
    await page.goto("/view/missing-document.html");
    await expect(page.locator("#mb-main h2")).toHaveText("Item not found");
    await expect(page.locator("#mb-main")).toContainText(
      "choose another item from the navigation",
    );
    await page.getByRole("link", { name: "Go to the catalogue home" }).click();
    await expect(page.locator("#mb-main h2")).toHaveText("Mokly");
  });

  test(`document pages retain metadata, anchors and mixed navigation at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/view/example/getting-started/?fragment=next-steps");
    await expect(page.locator("#mb-main h2")).toHaveText("Getting started");
    const frame = page.locator(".mbk-stage-embed iframe");
    await expect(frame).toHaveCount(1);
    await expect(frame).toHaveAttribute(
      "src",
      /\/static\/example\/getting-started\/index.html#next-steps$/,
    );
    await expect(frame).toHaveAttribute("sandbox", "allow-same-origin");
    await expect(
      page.locator(
        "#mb-main [data-diff-screen], #mb-main [data-viewport-option], #mb-main [data-color-scheme-option]",
      ),
    ).toHaveCount(0);
    await expect(
      page.frameLocator(".mbk-stage-embed iframe").locator("#next-steps"),
    ).toBeVisible();
    await page.locator("[data-mokly-details] summary").click();
    await expect(page.locator("[data-mokly-details]")).not.toContainText(
      "example/getting-started/index.html",
    );
    await expect(page.locator("[data-mokly-details]")).toContainText(
      "documents",
    );
    await page.locator("[data-mokly-details] summary").click();
    if (width < 700)
      await page
        .getByRole("button", { name: "Open catalogue navigation" })
        .click();
    await expect(
      page.locator(
        '[data-nav-section="pages"] [data-nav-folder="folder:example"]',
      ),
    ).toHaveCount(1);
    await expect(
      page.locator('[data-entry-id="example/getting-started"]'),
    ).toHaveCount(1);
    const search = page.getByRole("searchbox", { name: "Search catalogue" });
    for (const query of [
      "example/getting-started",
      "Getting started",
      "tag:documents",
    ]) {
      await search.fill(query);
      await expect(
        page.locator('[data-entry-id="example/getting-started"]'),
      ).toBeVisible();
    }
    await search.fill("example/getting-started/index.html");
    await expect(
      page.locator('[data-entry-id="example/getting-started"]'),
    ).toBeHidden();
    await search.fill("");
    await page
      .locator('[data-nav-folder="folder:example/screens"] > summary')
      .click();
    await page.locator('[data-entry-id="example/screens/welcome"]').click();
    await expect(page.locator("#mb-main h2")).toHaveText("Welcome");
    if (width < 700) await chooseViewport(page, "mobile");
    const screenFrame =
      width < 700 ? ".mbk-frame-mobile iframe" : ".mbk-frame-desktop iframe";
    await page
      .frameLocator(screenFrame)
      .getByRole("link", { name: "Read the handbook" })
      .click();
    await expect(page).toHaveURL(
      /\/view\/example\/getting-started\/\?fragment=next-steps$/,
    );
    await page.goBack();
    await expect(page.locator("#mb-main h2")).toHaveText("Welcome");
    await page.goForward();
    await expect(frame).toHaveAttribute("src", /#next-steps$/);
  });
}

for (const viewport of ["mobile", "desktop"] as const) {
  test(`${viewport}: document designs navigate through their own details and drawer`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto("/view/design/browse/pages/view/");
    await chooseViewport(page, viewport);
    const frame = page.frameLocator(`.mbk-frame-${viewport} iframe`);
    await frame.locator(".ce-inspector-link").click();
    await expect(page).toHaveURL(/\/view\/design\/browse\/pages\/details\/$/);
    await expect(frame.locator(".mbk-details-body")).toContainText(
      "specs/catalogue.tsx",
    );
    await expect(frame.locator(".mbk-details-body")).not.toContainText(
      "Generated",
    );
    await frame.locator(".ce-inspector-link").click();
    await expect(page).toHaveURL(/\/view\/design\/browse\/pages\/view\/$/);
    if (viewport === "mobile") {
      await frame
        .getByRole("link", { name: "Open catalogue navigation" })
        .click();
      await expect(page).toHaveURL(
        /\/view\/design\/browse\/pages\/navigation\/$/,
      );
      await frame
        .getByRole("link", { name: "Close catalogue navigation" })
        .click();
      await expect(page).toHaveURL(/\/view\/design\/browse\/pages\/view\/$/);
    }
    await frame
      .getByRole("link", { name: "Open Welcome", exact: true })
      .click();
    await expect(page).toHaveURL(/\/view\/design\/browse\/views\/screen\/$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/view\/design\/browse\/pages\/view\/$/);
  });
}

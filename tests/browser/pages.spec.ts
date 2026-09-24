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
    await page.goto("/id/example-handbook?fragment=next-steps");
    await expect(page.locator("#mb-main h2")).toHaveText("Getting started");
    const frame = page.locator(".mbk-stage-embed iframe");
    await expect(frame).toHaveCount(1);
    await expect(frame).toHaveAttribute(
      "src",
      /\/static\/\.generated\/handbook.html#next-steps$/,
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
    await expect(page.locator("[data-mokly-details]")).toContainText(
      "handbook.html",
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
        '[data-nav-section="pages"] [data-nav-collection="collection:example"]',
      ),
    ).toHaveCount(1);
    await expect(
      page.locator('[data-entry-id="example-handbook"]'),
    ).toHaveCount(1);
    const search = page.getByRole("searchbox", { name: "Search catalogue" });
    for (const query of [
      "example-handbook",
      "Getting started",
      "handbook.html",
      "tag:documents",
    ]) {
      await search.fill(query);
      await expect(
        page.locator('[data-entry-id="example-handbook"]'),
      ).toBeVisible();
    }
    await search.fill("");
    await page
      .locator('[data-nav-collection="collection:example-screens"] > summary')
      .click();
    await page.locator('[data-entry-id="example-welcome"]').click();
    await expect(page.locator("#mb-main h2")).toHaveText("Welcome");
    if (width < 700) await chooseViewport(page, "mobile");
    const screenFrame =
      width < 700 ? ".mbk-frame-mobile iframe" : ".mbk-frame-desktop iframe";
    await page
      .frameLocator(screenFrame)
      .getByRole("link", { name: "Read the handbook" })
      .click();
    await expect(page).toHaveURL(/\/view\/handbook.html\?fragment=next-steps$/);
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
    await page.goto("/id/design-page-view");
    await chooseViewport(page, viewport);
    const frame = page.frameLocator(`.mbk-frame-${viewport} iframe`);
    await frame.locator(".ce-inspector-link").click();
    await expect(page).toHaveURL(
      /\/view\/design\/browse\/pages\/details\.html$/,
    );
    await expect(frame.locator(".mbk-details-body")).toContainText(
      "handbook.html",
    );
    await frame.locator(".ce-inspector-link").click();
    await expect(page).toHaveURL(/\/view\/design\/browse\/pages\/view\.html$/);
    if (viewport === "mobile") {
      await frame
        .getByRole("link", { name: "Open catalogue navigation" })
        .click();
      await expect(page).toHaveURL(
        /\/view\/design\/browse\/pages\/navigation\.html$/,
      );
      await frame
        .getByRole("link", { name: "Close catalogue navigation" })
        .click();
      await expect(page).toHaveURL(
        /\/view\/design\/browse\/pages\/view\.html$/,
      );
    }
    await frame
      .getByRole("link", { name: "Open Welcome", exact: true })
      .click();
    await expect(page).toHaveURL(
      /\/view\/design\/browse\/views\/screen\.html$/,
    );
    await page.goBack();
    await expect(page).toHaveURL(/\/view\/design\/browse\/pages\/view\.html$/);
  });
}

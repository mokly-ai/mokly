import { expect } from "@playwright/test";

import {
  detailsRow,
  hasMarker,
  markPage,
  tourRow,
  welcomeRow,
} from "./browse_assertions.js";
import { staticRequests } from "./static_delivery_assertions.js";
import { test } from "./static_test.js";
import {
  chooseScheme,
  chooseViewport,
  expectFrameSource,
} from "./workspace_actions.js";

for (const viewport of ["mobile", "desktop"] as const) {
  test(`${viewport}: copied static navigation, fragments, history and reload use exact routes`, async ({
    page,
  }) => {
    const requests = staticRequests(page);
    await page.goto("/view/example/screens/welcome/");
    await chooseViewport(page, viewport);
    await markPage(page);
    const next = page
      .frameLocator(`.mbk-frame-${viewport} iframe`)
      .getByRole("link", { name: "View details", exact: true });
    await next.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(
      /\/view\/example\/screens\/details\/\?fragment=details$/,
    );
    await expect(page.locator(detailsRow)).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expectFrameSource(
      page.locator(`.mbk-frame-${viewport} iframe`),
      /index\.(?:mobile|desktop)\.html#details$/,
    );
    expect(await hasMarker(page)).toBe(true);
    await page.goBack();
    await expect(page.locator("#mb-main h2")).toHaveText("Welcome");
    await page.goForward();
    await expect(page.locator("#mb-main h2")).toHaveText("Details");
    await page.reload();
    await expect(page.locator("#mb-main h2")).toHaveText("Details");
    await chooseScheme(page, "dark");
    await expectFrameSource(
      page.locator(`.mbk-frame-${viewport} iframe`),
      /\.dark\.html#details$/,
    );
    requests.assert();
  });
}

test("copied static search, folders, tags, details and flows retain the shell", async ({
  page,
}) => {
  const requests = staticRequests(page);
  await page.goto("/view/example/screens/welcome/");
  await markPage(page);
  await page.locator("[data-mokly-search]").fill("example/screens/details");
  await expect(page.locator(detailsRow)).toBeVisible();
  await expect(page.locator(welcomeRow)).toBeHidden();
  await page.locator("[data-mokly-search]").fill("");
  await page.locator("[data-mokly-tag-toggle]").click();
  await page
    .locator('[data-mokly-tag-picker] [data-mokly-tag="forms"]')
    .click();
  await expect(page.locator("[data-mokly-search]")).toHaveValue("tag:forms");
  await expect(page.locator(tourRow)).toBeHidden();
  await page.locator("[data-mokly-search]").fill("");
  await page.getByRole("tab", { name: "Details", exact: true }).click();
  await expect(
    page.getByRole("tabpanel", { name: "Details", exact: true }),
  ).toBeVisible();
  await page.locator(detailsRow).click();
  await expect(
    page.getByRole("tabpanel", { name: "Details", exact: true }),
  ).toBeVisible();
  await page.locator(tourRow).click();
  await expect(page.locator(".mbk-flow-screen iframe")).toHaveCount(2);
  await chooseScheme(page, "dark");
  for (const frame of await page.locator(".mbk-flow-screen iframe").all())
    await expectFrameSource(frame, /\.dark\.html$/);
  expect(await hasMarker(page)).toBe(true);
  requests.assert();
});

for (const suffix of ["/", "", "/index.html"]) {
  test(`copied Markdown direct URL ${suffix || "extensionless"} survives reload`, async ({
    page,
  }) => {
    const requests = staticRequests(page);
    await page.goto(`/view/example/workspace-guide${suffix}`);
    await expect(page.locator("#mb-main h2")).toHaveText("Workspace guide");
    await expect(
      page.frameLocator(".mbk-stage-embed iframe").locator("body"),
    ).toContainText("workspace");
    await page.reload();
    await expect(page.locator("#mb-main h2")).toHaveText("Workspace guide");
    requests.assert();
  });
}

test("copied component variants retain their fragment and read-only props after refresh", async ({
  page,
}) => {
  const requests = staticRequests(page);
  await page.goto("/view/example/components/action/disabled/?fragment=action");
  await expect(page.locator("#mb-main h2")).toContainText("Action");
  await page.getByRole("tab", { name: "Props", exact: true }).click();
  const props = page.getByRole("tabpanel", { name: "Props", exact: true });
  await expect(props).toContainText(
    "Open this catalogue locally to edit props.",
  );
  await expect(
    props.getByRole("heading", { name: "Saved props" }),
  ).toBeVisible();
  await expect(props).toContainText("disabled");
  await expect(
    page
      .getByRole("tabpanel", { name: "Props", exact: true })
      .locator("input, textarea, select"),
  ).toHaveCount(0);
  await page.reload();
  await expect(page).toHaveURL(/\/action\/disabled\/\?fragment=action$/);
  await expect(page.locator("#mb-main h2")).toContainText("Action");
  requests.assert();
});

test("copied Current never polls revisions, opens events or requests renders", async ({
  page,
  request,
  baseURL,
}) => {
  const response = await request.get(`${baseURL}/mokly-viewer/index.json`);
  expect(response.headers()["access-control-allow-origin"]).toBeUndefined();
  const index = await response.json();
  expect(index).not.toHaveProperty("live");
  expect(index.revision).toBe(0);
  expect(index.comparisonUrl).toBeNull();
  const requests = staticRequests(page);
  await page.goto("/view/example/screens/welcome/");
  await expect(page.locator("#mb-main h2")).toHaveText("Welcome");
  await page.clock.install();
  await page.clock.fastForward(120_000);
  await page.locator(detailsRow).click();
  await expect(page.locator("#mb-main h2")).toHaveText("Details");
  await chooseViewport(page, "desktop");
  expect(
    requests.urls.filter((url) => url.endsWith("/mokly-viewer/index.json")),
  ).toHaveLength(1);
  expect(requests.urls.filter((url) => url.includes("/diffs/"))).toEqual([]);
  requests.assert();
});

import { expect } from "@playwright/test";

import {
  detailsRow,
  hasMarker,
  markPage,
  tourRow,
  welcomeRow,
} from "./browse_assertions.js";
import {
  staticFramesLoaded,
  staticRequests,
} from "./static_delivery_assertions.js";
import { test } from "./static_test.js";
import { useCaseStepFrame, useCaseSteps } from "./use_case_steps.js";
import {
  canvasFrame,
  chooseScheme,
  chooseViewport,
  DOCUMENT_FRAME,
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
      .frameLocator(canvasFrame(viewport))
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
      page.locator(canvasFrame(viewport)),
      /index\.(?:mobile|desktop)\.html#details$/,
    );
    expect(await hasMarker(page)).toBe(true);
    await page.goBack();
    await expect(page.locator("#mb-main h2")).toHaveText("Welcome");
    await page.goForward();
    await expect(page.locator("#mb-main h2")).toHaveText("Details");
    await page.reload();
    await expect(page.locator("#mb-main h2")).toHaveText("Details");
    // Each canvas frame keeps its own scheme: the Dark frame shows the dark
    // document at the fragment whatever the appearance.
    await chooseScheme(page, "dark");
    await expectFrameSource(
      page.locator(canvasFrame(viewport, "dark")),
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
  await expect(useCaseSteps(page)).toHaveCount(2);
  // The use case keeps its own Light frames under Dark.
  await chooseScheme(page, "dark");
  for (const step of [1, 2])
    await expectFrameSource(
      useCaseStepFrame(page, step),
      /\/index\.desktop\.html$/,
    );
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
      page.frameLocator(DOCUMENT_FRAME).locator("body"),
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
  await page.clock.install();
  const requests = staticRequests(page);
  await page.goto("/view/example/screens/welcome/");
  await expect(page.locator("#mb-main h2")).toHaveText("Welcome");
  await staticFramesLoaded(page, "example/screens/welcome");
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

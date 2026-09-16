import { expect, test, type Page } from "@playwright/test";

import type { RunningServer } from "../../dist/server/http_types.js";

import { loadComparison } from "./comparison_actions.js";
import { selectedComparisonFixture } from "./selected_comparison_fixture.js";
import { chooseScheme, chooseViewport } from "./workspace_actions.js";

let server: RunningServer;
const cleanup: (() => Promise<void>)[] = [];
test.beforeAll(async () => {
  server = await selectedComparisonFixture({
    after: (dispose) => cleanup.push(dispose),
  });
});
test.afterAll(async () => {
  for (const dispose of cleanup.reverse()) await dispose();
});

function gate() {
  let resolve = () => {};
  const promise = new Promise<void>((ready) => {
    resolve = ready;
  });
  return { promise, resolve };
}

async function holdRenewal(page: Page) {
  const arrived = gate();
  const release = gate();
  const finished = gate();
  let requests = 0;
  await page.route("**/__generations/selected-*/review.json", async (route) => {
    if (route.request().method() !== "HEAD") {
      await route.continue();
      return;
    }
    requests++;
    const response = await route.fetch();
    arrived.resolve();
    await release.promise;
    await route.fulfill({ response }).catch(() => undefined);
    finished.resolve();
  });
  return {
    arrived: arrived.promise,
    release: release.resolve,
    finished: finished.promise,
    requests: () => requests,
  };
}

test("retained snapshots share one renewal and use the latest viewport, theme and mode", async ({
  page,
}) => {
  const metadata: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "GET" && request.url().includes("review.json"))
      metadata.push(request.url());
  });
  await page.goto(`${server.url}/view/screens/home.html`);
  await chooseViewport(page, "desktop");
  await loadComparison(page, "Overlay");
  await expect(
    page.frameLocator(".mb-pane--after iframe").locator("main"),
  ).toContainText("Updated screen");
  const original = await page
    .locator(".mb-pane--after iframe")
    .getAttribute("src");
  const originalMetadata = [...metadata];
  const pending = await holdRenewal(page);
  try {
    await chooseViewport(page, "mobile");
    await pending.arrived;
    await chooseScheme(page, "dark");
    await chooseViewport(page, "both");
    await page.getByRole("button", { name: "Difference", exact: true }).click();
    expect(pending.requests()).toBe(1);
    pending.release();
    await expect(page.locator(".mb-pane iframe")).toHaveCount(4);
    for (const viewport of ["mobile", "desktop"]) {
      const view = page.locator(`[data-diff-viewport="${viewport}"]`);
      await expect(view.locator(".mb-panes")).toHaveAttribute(
        "data-compare-mode",
        "difference",
      );
      await expect(view.locator(".mb-pane--after iframe")).toHaveAttribute(
        "src",
        original!.replace(/desktop\.html$/, `${viewport}.dark.html`),
      );
      await expect(
        view.locator(".mb-pane--after iframe").contentFrame().locator("main"),
      ).toContainText("Updated screen");
    }
    expect(metadata).toEqual(originalMetadata);
  } finally {
    pending.release();
  }
});

for (const destination of ["Current", "another screen"])
  test(`a pending renewal cannot replace ${destination}`, async ({ page }) => {
    await page.goto(`${server.url}/view/screens/home.html`);
    await chooseViewport(page, "desktop");
    await loadComparison(page, "Overlay");
    const pending = await holdRenewal(page);
    try {
      await chooseViewport(page, "mobile");
      await pending.arrived;
      if (destination === "Current")
        await page
          .getByRole("button", { name: "Current", exact: true })
          .click();
      else await page.locator('[data-route="components/action.html"]').click();
      pending.release();
      await pending.finished;
      await expect(page.locator("[data-diff-stage] iframe")).toHaveCount(0);
      await expect(page.locator("[data-current-screen]")).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Current", exact: true }),
      ).toHaveAttribute("aria-pressed", "true");
      if (destination === "another screen")
        await expect(page).toHaveURL(/\/view\/components\/action\.html/);
    } finally {
      pending.release();
    }
  });

test("renewal failure offers a retry that reacquires the selected comparison", async ({
  page,
}) => {
  await page.goto(`${server.url}/view/screens/home.html`);
  await chooseViewport(page, "desktop");
  await loadComparison(page, "Overlay");
  await page.route(
    "**/__generations/selected-*/review.json",
    (route) => route.abort("failed"),
    { times: 1 },
  );
  await chooseViewport(page, "mobile");
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  await expect(page.locator("[data-diff-stage] iframe")).toHaveCount(0);
  await loadComparison(page, "Try again");
  await expect(
    page.frameLocator(".mb-pane--before iframe").locator("main"),
  ).toContainText("Screen content");
  await expect(
    page.frameLocator(".mb-pane--after iframe").locator("main"),
  ).toContainText("Updated screen");
  await expect(page.locator(".mb-pane--after iframe")).toHaveAttribute(
    "src",
    /\.mobile\.html$/,
  );
});

test("a pending renewal cannot restore a previously selected saved variant", async ({
  page,
}) => {
  await page.goto(`${server.url}/view/components/action.html?variant=disabled`);
  await chooseViewport(page, "desktop");
  await loadComparison(page, "Side by side");
  await expect(
    page
      .frameLocator(".mb-pane--after iframe")
      .getByRole("button", { name: "Proceed", exact: true }),
  ).toBeDisabled();
  const pending = await holdRenewal(page);
  try {
    await chooseViewport(page, "mobile");
    await pending.arrived;
    await page
      .getByLabel("Saved variant", { exact: true })
      .selectOption("default");
    await expect(
      page
        .frameLocator(".mb-pane--after iframe")
        .getByRole("button", { name: "Proceed", exact: true }),
    ).toBeEnabled();
    pending.release();
    await pending.finished;
    await expect(page).toHaveURL(/variant=default/);
    await expect(
      page
        .frameLocator(".mb-pane--after iframe")
        .getByRole("button", { name: "Proceed", exact: true }),
    ).toBeEnabled();
  } finally {
    pending.release();
  }
});

test("new evidence cancels renewal in place and the next comparison uses fresh snapshots", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/__mokly/diffs/review.json")
      requests.push(request.url());
  });
  await page.goto(`${server.url}/view/screens/home.html`);
  await chooseViewport(page, "desktop");
  await loadComparison(page, "Overlay");
  const frame = page.locator(".mb-pane--after iframe");
  await expect(frame.contentFrame().locator("main")).toContainText(
    "Updated screen",
  );
  const snapshot = await frame.getAttribute("src");
  const root = page.locator("html");
  const version = Number(await root.getAttribute("data-mokly-update-version"));
  await root.evaluate((element) =>
    element.setAttribute("data-test-retained", "true"),
  );
  const pending = await holdRenewal(page);
  try {
    await chooseViewport(page, "mobile");
    await pending.arrived;
    server.publishUpdate({ kind: "evidence", version: version + 1 });
    await expect(root).toHaveAttribute(
      "data-mokly-update-version",
      String(version + 1),
    );
    await expect(root).toHaveAttribute("data-test-retained", "true");
    await expect(
      page.getByRole("button", { name: "Current", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    pending.release();
    await pending.finished;
    await expect(page.locator("[data-diff-stage] iframe")).toHaveCount(0);
    expect(requests).toHaveLength(1);
    await loadComparison(page, "Overlay");
    await expect(frame.contentFrame().locator("main")).toContainText(
      "Updated screen",
    );
    expect((await frame.getAttribute("src"))!.split("/snapshots/")[0]).not.toBe(
      snapshot!.split("/snapshots/")[0],
    );
    expect(requests).toHaveLength(2);
    expect(new URL(requests[1]!).searchParams.get("route")).toBe(
      "screens/home.html",
    );
  } finally {
    pending.release();
  }
});

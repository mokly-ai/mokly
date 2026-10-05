import { expect, test } from "@playwright/test";

import { startEvidenceFixture } from "../helpers/evidence_fixture.js";

test("evidence fetched for a previous route cannot replace the destination", async ({
  page,
}) => {
  const fixture = await startEvidenceFixture();
  const { server } = fixture;
  let release = () => {};
  try {
    await page.goto(`${server.url}/view/fixture/screens/home/`);
    await page
      .locator("html")
      .evaluate((root) => root.setAttribute("data-test-retained", "true"));
    let captured = () => {};
    const ready = new Promise<void>((resolve) => {
      captured = resolve;
    });
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/view/fixture/screens/home/", async (route) => {
      const response = await route.fetch();
      captured();
      await held;
      await route.fulfill({ response });
    });
    server.publishUpdate({
      kind: "evidence",
      changedEntries: ["fixture/screens/details"],
      changesStatus: "ready",
    });
    await ready;
    await page
      .locator('a[data-route="fixture/screens/details/index.html"]')
      .click();
    await expect(page).toHaveURL(`${server.url}/view/fixture/screens/details/`);
    release();
    await page.unrouteAll({ behavior: "wait" });
    await expect(page.locator("[data-workspace-status]")).toHaveText("Changed");
    await expect(
      page.getByRole("heading", { name: "Details", exact: true }),
    ).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute(
      "data-test-retained",
      "true",
    );
  } finally {
    release();
    await page.unrouteAll({ behavior: "wait" });
    await fixture.close();
  }
});

test("an older evidence response cannot overwrite the latest result", async ({
  page,
}) => {
  const fixture = await startEvidenceFixture();
  const { server } = fixture;
  let release = () => {};
  try {
    await page.goto(`${server.url}/view/fixture/screens/home/`);
    await page
      .locator("html")
      .evaluate((root) => root.setAttribute("data-test-retained", "true"));
    let captured = () => {};
    const ready = new Promise<void>((resolve) => {
      captured = resolve;
    });
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    let first = true;
    await page.route("**/view/fixture/screens/home/", async (route) => {
      if (!first) return route.continue();
      first = false;
      const response = await route.fetch();
      captured();
      await held;
      await route.fulfill({ response });
    });
    server.publishUpdate({
      kind: "evidence",
      changedEntries: ["fixture/screens/home"],
      changesStatus: "ready",
    });
    await ready;
    server.publishUpdate({
      kind: "evidence",
      changedEntries: [],
      changesStatus: "ready",
    });
    await expect(page.locator("html")).toHaveAttribute(
      "data-mokly-update-version",
      "3",
    );
    await expect(page.locator(".mbk-nav-filter-count")).toHaveText("0");
    release();
    await page.unrouteAll({ behavior: "wait" });
    await expect(page.locator(".mbk-nav-filter-count")).toHaveText("0");
    await expect(page.locator("html")).toHaveAttribute(
      "data-test-retained",
      "true",
    );
  } finally {
    release();
    await fixture.close();
  }
});

test("navigation and evidence responses converge on the current destination", async ({
  page,
}) => {
  const fixture = await startEvidenceFixture();
  const { server } = fixture;
  let release = () => {};
  try {
    await page.goto(`${server.url}/view/fixture/screens/home/`);
    await page
      .locator("html")
      .evaluate((root) => root.setAttribute("data-test-retained", "true"));
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    let captured = () => {};
    const ready = new Promise<void>((resolve) => {
      captured = resolve;
    });
    await page.route("**/view/fixture/screens/details/", async (route) => {
      const response = await route.fetch();
      captured();
      await held;
      await route.fulfill({ response });
    });
    await page
      .locator('a[data-route="fixture/screens/details/index.html"]')
      .click();
    await ready;
    server.publishUpdate({
      kind: "evidence",
      changedEntries: ["fixture/screens/details"],
      changesStatus: "ready",
    });
    release();
    await expect(page).toHaveURL(`${server.url}/view/fixture/screens/details/`);
    await expect(page.locator("[data-workspace-status]")).toHaveText("Changed");
    await expect(page.locator(".mbk-nav-filter-count")).toHaveText("1");
    await expect(page.locator("html")).toHaveAttribute(
      "data-test-retained",
      "true",
    );
    await expect(
      page.locator('a[data-route="fixture/screens/details/index.html"]'),
    ).toHaveAttribute("aria-current", "page");
  } finally {
    release();
    await page.unrouteAll({ behavior: "wait" });
    await fixture.close();
  }
});

test("reconnecting to newer evidence keeps the page, while missed content changes reload it", async ({
  page,
}) => {
  const fixture = await startEvidenceFixture();
  const { server } = fixture;
  let release = () => {};
  try {
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    let captured = () => {};
    const ready = new Promise<void>((resolve) => {
      captured = resolve;
    });
    await page.route("**/mokly-viewer/events", async (route) => {
      captured();
      await held;
      await route.continue();
    });
    await page.goto(`${server.url}/view/fixture/screens/home/`);
    await ready;
    await page
      .locator("html")
      .evaluate((root) => root.setAttribute("data-test-retained", "true"));
    await page.locator("[data-mokly-search]").fill("tour");
    server.publishUpdate({
      kind: "evidence",
      changedEntries: [],
      changesStatus: "ready",
    });
    release();
    await expect(page.locator(".mbk-nav-filter-count")).toHaveText("0");
    await expect(page.locator("html")).toHaveAttribute(
      "data-test-retained",
      "true",
    );
    await expect(page.locator("[data-mokly-search]")).toHaveValue("tour");
    server.publishUpdate();
    server.publishUpdate({
      kind: "evidence",
      changedEntries: [],
      changesStatus: "ready",
    });
    await expect(page.locator("html")).toHaveAttribute(
      "data-mokly-update-version",
      "4",
    );
    await expect(page.locator("html")).not.toHaveAttribute(
      "data-test-retained",
      "true",
    );
  } finally {
    release();
    await page.unrouteAll({ behavior: "wait" });
    await fixture.close();
  }
});

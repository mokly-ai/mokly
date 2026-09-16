import { expect, test } from "@playwright/test";

import type { MoklyViewerHandle, ViewerSelection } from "@mokly/viewer";

import { viewerFixture } from "../../packages/viewer/tests/browser_fixture.js";

import type {} from "./viewer_harness.js";
let fixture: Awaited<ReturnType<typeof viewerFixture>>;
test.beforeAll(async () => {
  fixture = await viewerFixture();
});
test.afterAll(async () => {
  await fixture.close();
});
test.beforeEach(async ({ page }) => {
  await page.goto(fixture.host.url);
  await page.waitForFunction(() => Boolean(window.viewerHarness));
});

test("uncontrolled selection, slots and handle lifecycle", async ({ page }) => {
  await page.evaluate(() => window.viewerHarness.start("one", { slots: true }));
  await page.waitForFunction(
    () => window.viewerHarness.get("one").ref.current !== null,
  );
  await expect(page.locator("#one .mbk-frag").first()).toHaveAttribute(
    "src",
    /\/static\/screens\/home.mobile.html/,
  );
  await page.getByText("Host start").click();
  await expect(page.getByText("Annotation")).toBeVisible();
  await page.evaluate(async () => {
    const host = window.viewerHarness.get("one");
    await host.ref.current.startPick();
    host.ref.current.cancelPick();
    host.ref.current.cancelPick();
    host.ref.current.select({ screenId: null });
  });
  await expect(page.getByText("Host home")).toBeVisible();
  expect(
    await page.evaluate(() =>
      window.viewerHarness
        .get("one")
        .events.filter((event) => event.name === "pick-end"),
    ),
  ).toHaveLength(1);
  for (const name of ["Host end", "Rail start", "Rail end", "Side panel"])
    await expect(page.getByText(name)).toBeVisible();
});

test("controlled proposals wait for the host and normalize search", async ({
  page,
}) => {
  await page.evaluate(() =>
    window.viewerHarness.start("one", { controlled: true }),
  );
  await page.waitForFunction(() =>
    Boolean(window.viewerHarness.get("one").ref.current),
  );
  await page.evaluate(() =>
    window.viewerHarness.get("one").ref.current.select({
      screenId: "action",
      search: "TAG:forms action",
      tags: ["forms"],
    }),
  );
  await expect(page.locator("#one h2")).toContainText("Home");
  await page.evaluate(() => {
    const host = window.viewerHarness.get("one");
    host.setSelection(
      host.events.find((event) => event.name === "selection")!
        .value as ViewerSelection,
    );
  });
  await expect(page.locator("#one h2")).toContainText("Action");
  expect(
    await page.evaluate(() =>
      window.viewerHarness
        .get("one")
        .events.filter((event) => event.name === "selection"),
    ),
  ).toHaveLength(1);
});

test("StrictMode replay and independent roots", async ({ page }) => {
  await page.evaluate(() => {
    window.viewerHarness.start("one", { strict: true });
    window.viewerHarness.start("two", { strict: true });
  });
  await page.waitForFunction(() =>
    Boolean(window.viewerHarness.get("two").ref.current),
  );
  await page.evaluate(() =>
    window.viewerHarness.get("one").ref.current.select({ screenId: "action" }),
  );
  await expect(page.locator("#one h2")).toContainText("Action");
  await expect(page.locator("#two h2")).toContainText("Home");
  expect(
    await page.evaluate(() =>
      window.viewerHarness
        .get("one")
        .events.filter((event) => event.name === "selection"),
    ),
  ).toHaveLength(1);
});

test("postMessage frames emit pick/hover/click and support imperative rejection", async ({
  page,
}) => {
  await page.evaluate(() => window.viewerHarness.start("one", { cross: true }));
  await page.waitForFunction(() =>
    Boolean(window.viewerHarness.get("one").ref.current),
  );
  await page.evaluate(async () => {
    const host = window.viewerHarness.get("one");
    await host.ref.current.startPick();
  });
  const frame = page.frameLocator('#one iframe[data-workspace-frame="mobile"]');
  await frame.getByText("Visible", { exact: true }).hover();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.viewerHarness
            .get("one")
            .events.filter((event) => event.name === "hover").length,
      ),
    )
    .toBeGreaterThan(0);
  await page.getByRole("heading", { name: "Home", exact: true }).hover();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.viewerHarness
            .get("one")
            .events.filter((event) => event.name === "hover")
            .at(-1)?.value,
      ),
    )
    .toEqual({ instance: null, boxes: [], frame: { entryId: "home" } });
  await frame.getByText("Visible", { exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.viewerHarness
            .get("one")
            .events.filter((event) => event.name === "pick-end").length,
      ),
    )
    .toBe(1);
  const results = await page.evaluate(async () => {
    const host = window.viewerHarness.get("one");
    const selected = host.events.find((event) => event.name === "click")!
      .value as {
      instance: Parameters<MoklyViewerHandle["highlightInstance"]>[0];
    };
    await host.ref.current.highlightInstance(selected.instance);
    await host.ref.current.scrollToInstance(selected.instance!);
    await host.ref.current.highlightInstance(null);
    try {
      await host.ref.current.scrollToInstance({
        ...selected.instance!,
        key: "f".repeat(64),
      });
    } catch {
      return host.events.map((event) => event.name);
    }
    return [];
  });
  expect(results).toEqual(
    expect.arrayContaining([
      "hover",
      "click",
      "pick-start",
      "pick-end",
      "error",
    ]),
  );
});

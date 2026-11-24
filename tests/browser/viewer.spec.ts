import { expect } from "@playwright/test";

import type { MoklyViewerHandle, ViewerSelection } from "@mokly/viewer";

import { viewerFixture } from "../../packages/viewer/tests/browser_fixture.js";

import { test } from "./browser_test.js";
import { startViewerPick } from "./viewer_pick.js";
import { clickRouteProbe, lastSelection } from "./viewer_route_probe.js";
import { canvasFrame } from "./workspace_actions.js";

import type {} from "./viewer_harness.js";
let fixture: Awaited<ReturnType<typeof viewerFixture>>;
test.beforeAll(async () => {
  fixture = await viewerFixture();
});
test.afterAll(async () => {
  await fixture?.close();
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
  // The first shown frame: the canvas shows the column of the selection's
  // viewport, Mobile.
  await expect(page.locator("#one .mbk-frag:visible").first()).toHaveAttribute(
    "src",
    /\/static\/mokly-generated\/home\/index.mobile.html/,
  );
  await page.getByText("Host start").click();
  await expect(page.getByText("Annotation")).toBeVisible();
  await startViewerPick(page);
  await page.evaluate(() => {
    const host = window.viewerHarness.get("one");
    host.ref.current.cancelPick();
    host.ref.current.cancelPick();
    host.ref.current.select({ screenPath: null });
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
      screenPath: "action",
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

test("controlled search keeps raw spacing through normalized prop echoes", async ({
  page,
}) => {
  await page.evaluate(() =>
    window.viewerHarness.start("one", { controlled: true, accept: true }),
  );
  const search = page.getByRole("searchbox", { name: "Search catalogue" });
  await search.pressSequentially("alpha beta ");
  await expect(search).toHaveValue("alpha beta ");
  expect(
    await page.evaluate(() => window.viewerHarness.get("one").props.selection),
  ).toEqual(expect.objectContaining({ search: "alpha beta", tags: [] }));
});

test("uncontrolled shell links apply valid axes independently on the same destination", async ({
  page,
}) => {
  await page.evaluate(() => window.viewerHarness.start("one"));
  // The root states the selection's preview scheme.
  const root = page.locator("#one .mbk[data-mokly-shell]");

  await clickRouteProbe(page, "/view/home/?viewport=desktop&scheme=invalid");
  await expect
    .poll(() => lastSelection(page))
    .toEqual(
      expect.objectContaining({ viewport: "desktop", colorScheme: "light" }),
    );
  await expect(root).toHaveAttribute("data-mokly-color-scheme", "light");

  await clickRouteProbe(
    page,
    "/view/home/?viewport=mobile&viewport=desktop&scheme=dark",
  );
  await expect
    .poll(() => lastSelection(page))
    .toEqual(
      expect.objectContaining({ viewport: "desktop", colorScheme: "dark" }),
    );
  await expect(root).toHaveAttribute("data-mokly-color-scheme", "dark");

  await clickRouteProbe(page, "/view/home/?viewport=invalid&scheme=invalid");
  expect(
    await page.evaluate(() =>
      window.viewerHarness
        .get("one")
        .events.filter((event) => event.name === "selection"),
    ),
  ).toHaveLength(2);
});

test("controlled shell-axis proposals stay inert until the host accepts them", async ({
  page,
}) => {
  await page.evaluate(() =>
    window.viewerHarness.start("one", { controlled: true }),
  );
  await clickRouteProbe(page, "/view/home/?viewport=desktop&scheme=dark", true);
  // The root states the shown selection's preview scheme.
  const root = page.locator("#one .mbk[data-mokly-shell]");
  await expect(root).toHaveAttribute("data-mokly-color-scheme", "light");

  const proposal = await page.evaluate(() =>
    window.viewerHarness
      .get("one")
      .events.find((event) => event.name === "selection"),
  );
  expect(proposal?.value).toEqual(
    expect.objectContaining({
      screenPath: "home",
      viewport: "desktop",
      colorScheme: "dark",
    }),
  );
  await page.evaluate(() => {
    const host = window.viewerHarness.get("one");
    host.setSelection(
      host.events.find((event) => event.name === "selection")!
        .value as ViewerSelection,
    );
  });
  await expect(root).toHaveAttribute("data-mokly-color-scheme", "dark");
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
    window.viewerHarness
      .get("one")
      .ref.current.select({ screenPath: "action" }),
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
  const frame = page.frameLocator(`#one ${canvasFrame("mobile")}`);
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
    .toEqual({ instance: null, boxes: [], frame: { entryPath: "home" } });
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

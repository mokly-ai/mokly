import { expect, test } from "@playwright/test";

import type { MoklyViewerProps } from "@mokly/viewer";

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

test("StrictMode replay retains one disposable resize controller", async ({
  page,
}) => {
  await page.evaluate(() =>
    window.viewerHarness.start("one", { strict: true }),
  );
  const handle = page.getByRole("separator", {
    name: "Resize navigation panel",
  });
  const before = Number(await handle.getAttribute("aria-valuenow"));
  await handle.press("ArrowRight");
  await expect(handle).toHaveAttribute("aria-valuenow", String(before + 16));
  const after = await page.evaluate(() => {
    const handle = document.querySelector<HTMLElement>(
      "[data-mokly-nav-resize]",
    )!;
    window.viewerHarness.remove("one");
    handle.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
    );
    return Number(handle.getAttribute("aria-valuenow"));
  });
  expect(after).toBe(before + 16);
});

test("callback exceptions preserve identity and are not viewer failures", async ({
  page,
}) => {
  await page.evaluate(() => window.viewerHarness.start("one"));
  await page.waitForFunction(() =>
    Boolean(window.viewerHarness.get("one").ref.current),
  );
  const result = await page.evaluate(async () => {
    const host = window.viewerHarness.get("one");
    const error = new Error("Host callback failed");
    host.props.onPickStart = () => {
      throw error;
    };
    host.props.slots = { topBarStart: "Callbacks installed" };
    host.render();
    while (
      document.querySelector('[data-mokly-slot="topBarStart"]')?.textContent !==
      "Callbacks installed"
    )
      await new Promise(requestAnimationFrame);
    try {
      await host.ref.current.startPick();
    } catch (caught) {
      host.ref.current.cancelPick();
      return {
        same: caught === error,
        errors: host.events.filter((event) => event.name === "error"),
      };
    }
    return null;
  });
  expect(result).toEqual({ same: true, errors: [] });
});

test("slot changes keep selection and overlay excludes shell controls", async ({
  page,
}) => {
  await page.evaluate(() => window.viewerHarness.start("one", { slots: true }));
  await page.waitForFunction(() =>
    Boolean(window.viewerHarness.get("one").ref.current),
  );
  const result = await page.evaluate(async () => {
    const host = window.viewerHarness.get("one");
    host.ref.current.select({ screenId: null });
    host.props.slots = { ...host.props.slots, emptyState: "Updated host home" };
    host.render();
    await new Promise(requestAnimationFrame);
    return document.querySelector<HTMLElement>(
      '[data-mokly-slot="emptyState"]',
    )!.hidden;
  });
  expect(result).toBe(false);
  await expect(page.getByText("Updated host home")).toBeVisible();
  await page.evaluate(() =>
    window.viewerHarness.get("one").ref.current.select({ screenId: "home" }),
  );
  const overlay = await page
    .locator('[data-mokly-slot="stageOverlay"]')
    .boundingBox();
  const preview = await page.locator("[data-workspace-preview]").boundingBox();
  expect(overlay).toEqual(preview);
});

test("slot-only rerenders retain an active pick", async ({ page }) => {
  await page.evaluate(() => window.viewerHarness.start("one", { slots: true }));
  await page.waitForFunction(() =>
    Boolean(window.viewerHarness.get("one").ref.current),
  );
  await page.evaluate(() =>
    window.viewerHarness.get("one").ref.current.startPick(),
  );
  const labels = page.locator("[data-mokly-label-layer] button");
  await expect.poll(() => labels.count()).toBeGreaterThan(0);
  const labelCount = await labels.count();
  await page.evaluate(async () => {
    const host = window.viewerHarness.get("one");
    host.props.slots = {
      ...host.props.slots,
      topBarStart: "Updated while picking",
    };
    host.render();
    await new Promise(requestAnimationFrame);
    await host.ref.current.startPick();
  });
  await expect(page.getByText("Updated while picking")).toBeVisible();
  await expect(labels).toHaveCount(labelCount);
  expect(
    await page.evaluate(() =>
      window.viewerHarness
        .get("one")
        .events.filter((event) => event.name === "pick-start"),
    ),
  ).toHaveLength(1);
});

test("source and adapter replacement end pick and remount; unmount is silent", async ({
  page,
}) => {
  await page.evaluate(() => window.viewerHarness.start("one"));
  await page.waitForFunction(() =>
    Boolean(window.viewerHarness.get("one").ref.current),
  );
  await page.evaluate(async () => {
    const host = window.viewerHarness.get("one");
    await host.ref.current.startPick();
    host.props = {
      ...host.props,
      catalogue: structuredClone(host.props.catalogue),
    } as MoklyViewerProps;
    host.render();
  });
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.viewerHarness
          .get("one")
          .events.filter((event) => event.name === "pick-end")
          .map((event) => event.value),
      ),
    )
    .toEqual([{ reason: "source-change" }]);
  await page.evaluate(async () => {
    const host = window.viewerHarness.get("one");
    await host.ref.current.startPick();
    host.props.frameAdapter = { ...host.props.frameAdapter! };
    host.render();
    await new Promise(requestAnimationFrame);
  });
  expect(
    await page.evaluate(() =>
      window.viewerHarness
        .get("one")
        .events.filter((event) => event.name === "pick-end")
        .map((event) => event.value),
    ),
  ).toEqual([{ reason: "source-change" }, { reason: "source-change" }]);
  await page.evaluate(async () => {
    const host = window.viewerHarness.get("one");
    await host.ref.current.startPick();
    host.events.length = 0;
    window.viewerHarness.remove("one");
  });
  expect(
    await page.evaluate(() => window.viewerHarness.get("one").events),
  ).toEqual([]);
});

test("styles and duplicate ids do not escape independent roots", async ({
  page,
}) => {
  const before = await page.evaluate(() => ({
    margin: getComputedStyle(document.body).margin,
    background: getComputedStyle(document.body).backgroundColor,
  }));
  await page.evaluate(() => {
    window.viewerHarness.start("one");
    window.viewerHarness.start("two");
  });
  await page.waitForFunction(() =>
    Boolean(window.viewerHarness.get("two").ref.current),
  );
  const result = await page.evaluate(() => {
    const ids = [...document.querySelectorAll("[id]")].map(
      (element) => element.id,
    );
    return {
      unique: new Set(ids).size === ids.length,
      margin: getComputedStyle(document.body).margin,
      background: getComputedStyle(document.body).backgroundColor,
    };
  });
  expect(result).toEqual({ unique: true, ...before });
});

test("inspector resizing changes only its mounted viewer root", async ({
  page,
}) => {
  await page.evaluate(() => {
    window.viewerHarness.start("one");
    window.viewerHarness.start("two");
  });
  const first = page.locator("#one [data-mokly-shell]");
  const second = page.locator("#two [data-mokly-shell]");
  await first.getByRole("tab", { name: "Details", exact: true }).click();
  await second.evaluate((root) => root.classList.add("mbk-inspector-resizing"));
  const divider = first.getByRole("separator", { name: "Resize inspector" });
  const box = await divider.boundingBox();
  if (!box) throw new Error("inspector divider bounds unavailable");

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect(first).toHaveClass(/mbk-inspector-resizing/);
  await expect(second).toHaveClass(/mbk-inspector-resizing/);
  await expect(page.locator("body")).not.toHaveClass(/mbk-inspector-resizing/);
  await page.mouse.up();

  await expect(first).not.toHaveClass(/mbk-inspector-resizing/);
  await expect(second).toHaveClass(/mbk-inspector-resizing/);
});

test("host accent overrides and interactive overlay stay within the viewer", async ({
  page,
}) => {
  await page.evaluate(() => {
    window.viewerHarness.start("one", { slots: true });
    document
      .getElementById("one")!
      .style.setProperty("--mokly-accent", "rgb(12, 34, 56)");
    document
      .getElementById("one")!
      .style.setProperty("--mokly-accent-contrast", "rgb(255, 255, 254)");
    document
      .getElementById("one")!
      .style.setProperty("--mokly-accent-soft", "rgb(232, 240, 244)");
  });
  await page.waitForFunction(() =>
    Boolean(window.viewerHarness.get("one").ref.current),
  );
  const tokens = await page.locator(".mokly-viewer").evaluate((root) => {
    const style = getComputedStyle(root);
    return [
      "--mokly-accent",
      "--mokly-accent-contrast",
      "--mokly-accent-soft",
    ].map((name) => style.getPropertyValue(name).trim());
  });
  expect(tokens).toEqual([
    "rgb(12, 34, 56)",
    "rgb(255, 255, 254)",
    "rgb(232, 240, 244)",
  ]);
  const current = page.locator('#one .mbk-nav-row[aria-current="page"]');
  await expect(current).toHaveCSS("color", "rgb(255, 255, 254)");
  expect(
    await current.evaluate(
      (row) => getComputedStyle(row, "::before").backgroundColor,
    ),
  ).toBe("rgb(12, 34, 56)");
  await expect(page.locator("#one .mbk-mark")).toHaveCSS(
    "color",
    "rgb(47, 89, 69)",
  );
  await expect(page.locator("#one .mbk-mark")).toHaveCSS(
    "background-color",
    "rgba(0, 0, 0, 0)",
  );
  await expect(page.locator("#one .mbk-mark-rules")).toHaveCSS(
    "stroke",
    "rgb(255, 255, 255)",
  );
  await expect(page.locator("#one .mbk-name")).toHaveCSS(
    "font-family",
    'Georgia, "Times New Roman", serif',
  );
  await page.evaluate(async () => {
    const host = window.viewerHarness.get("one");
    host.props.slots = {
      ...host.props.slots,
      stageOverlay: {
        content: "Interactive annotation",
        pointerEvents: "auto",
      },
    };
    host.render();
  });
  await expect(page.getByText("Interactive annotation")).toBeVisible();
  await expect(page.locator('[data-mokly-slot="stageOverlay"]')).toHaveCSS(
    "pointer-events",
    "auto",
  );
  await page.getByRole("button", { name: "Host start" }).click();
  expect(
    await page.evaluate(() =>
      window.viewerHarness
        .get("one")
        .events.filter((event) => event.name === "slot"),
    ),
  ).toHaveLength(1);
});

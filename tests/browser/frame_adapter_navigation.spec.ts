import { expect, test } from "@playwright/test";

import {
  crossOriginFixture,
  mountCrossFrame,
  type FrameTestWindow,
} from "./frame_adapter_fixture.js";

let fixture: Awaited<ReturnType<typeof crossOriginFixture>>;
test.beforeAll(async () => {
  fixture = await crossOriginFixture({
    body: '<MockLink to="action">Self</MockLink><MockLink to="action" target="_top">Top</MockLink><MockLink to="action" target="_parent">Parent</MockLink><MockLink to="action" target="_blank">Blank</MockLink><MockLink to="action" target="preview">Named</MockLink><a href="#local">Local</a><span id="local" />',
  });
});
test.afterAll(async () => {
  await fixture?.close();
});

test("cross-origin native activations report bounded targets and modifiers without navigation", async ({
  page,
}) => {
  await mountCrossFrame(page, fixture);
  const frame = page.frameLocator("#frame");
  const initial = page
    .frames()
    .find((child) => child.url().startsWith(fixture.frames.url))!
    .url();
  for (const [name, target] of [
    ["Self", { kind: "self" }],
    ["Top", { kind: "top" }],
    ["Parent", { kind: "parent" }],
    ["Blank", { kind: "blank" }],
    ["Named", { kind: "named", name: "preview" }],
  ] as const) {
    await page.evaluate(() => {
      (window as unknown as FrameTestWindow).frameEvents = [];
    });
    await frame.getByRole("link", { name, exact: true }).click();
    await expect
      .poll(() =>
        page.evaluate(() =>
          (window as unknown as FrameTestWindow).frameEvents.filter(
            (event) => event.type === "navigation",
          ),
        ),
      )
      .toEqual([
        {
          type: "navigation",
          navigation: { id: "action", activation: "primary", target },
        },
      ]);
  }
  for (const [options, activation] of [
    [{ modifiers: ["Control"] }, "modified"],
    [{ button: "middle" }, "middle"],
  ] as const) {
    await page.evaluate(() => {
      (window as unknown as FrameTestWindow).frameEvents = [];
    });
    await frame
      .getByRole("link", { name: "Self", exact: true })
      .click(
        "modifiers" in options
          ? { modifiers: [...options.modifiers] }
          : options,
      );
    await expect
      .poll(() =>
        page.evaluate(() =>
          (window as unknown as FrameTestWindow).frameEvents.filter(
            (event) => event.type === "navigation",
          ),
        ),
      )
      .toEqual([
        {
          type: "navigation",
          navigation: { id: "action", activation, target: { kind: "self" } },
        },
      ]);
  }
  expect(page.url()).toBe(`${fixture.host.url}/`);
  expect(page.context().pages()).toHaveLength(1);
  expect(
    page
      .frames()
      .find((child) => child.url().startsWith(fixture.frames.url))!
      .url(),
  ).toBe(initial);
  await page.evaluate(() => {
    (window as unknown as FrameTestWindow).frameEvents = [];
  });
  await frame.getByRole("link", { name: "Local", exact: true }).click();
  expect(
    page
      .frames()
      .find((child) => child.url().startsWith(fixture.frames.url))!
      .url(),
  ).toBe(`${initial}#local`);
  expect(
    await page.evaluate(() =>
      (window as unknown as FrameTestWindow).frameEvents.filter(
        (event) => event.type === "navigation",
      ),
    ),
  ).toEqual([]);
});

test("an unanswered request expires after five seconds and disposes pending work", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.addEventListener("message", (event) => {
      if (window.name !== "drop-inspector-requests") return;
      const message = JSON.parse(event.data) as { type: string };
      if (message.type === "list") event.stopImmediatePropagation();
    });
  });
  await mountCrossFrame(page, fixture);
  const child = page
    .frames()
    .find((frame) => frame.url().startsWith(fixture.frames.url))!;
  await child.evaluate(() => {
    window.name = "drop-inspector-requests";
  });
  const result = await page.evaluate(async () => {
    const state = window as unknown as FrameTestWindow;
    const started = performance.now();
    const code = await state.mounted
      .listInstanceBoundaries()
      .catch((error: { code: string }) => error.code);
    return {
      code,
      elapsed: performance.now() - started,
      after: await state.mounted
        .listInstanceBoundaries()
        .catch((error: { code: string }) => error.code),
    };
  });
  expect(result.code).toBe("timeout");
  expect(result.elapsed).toBeGreaterThanOrEqual(4900);
  expect(result.after).toBe("disposed");
  await expect(
    page.frameLocator("#frame").locator("[data-mokly-overlay]"),
  ).toHaveCount(0);
});

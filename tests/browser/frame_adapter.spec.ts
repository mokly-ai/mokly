import { expect, test } from "@playwright/test";

import type * as PostAdapter from "../../packages/viewer/dist/client/post_message_adapter.js";
import type { ComponentViewRecord } from "../../packages/viewer/dist/components/manifest_types.js";

import {
  crossOriginFixture,
  mountCrossFrame,
  type FrameTestWindow,
} from "./frame_adapter_fixture.js";

let fixture: Awaited<ReturnType<typeof crossOriginFixture>>;
test.beforeAll(async () => {
  fixture = await crossOriginFixture();
});
test.afterAll(async () => {
  await fixture?.close();
});

test("cross-origin handshake measures null/multi-root ranges and reuses highlight visuals", async ({
  page,
}) => {
  await mountCrossFrame(page, fixture);
  const boundaries = await page.evaluate(() =>
    (window as unknown as FrameTestWindow).mounted.listInstanceBoundaries(),
  );
  expect(boundaries).toHaveLength(fixture.usage.instances.length);
  const hidden = fixture.usage.instances.find(
    (item) => item.id === "hidden",
  )!.key;
  const multiple = fixture.usage.instances.find(
    (item) => item.id === "multiple",
  )!.key;
  expect(
    boundaries.find((item) => item.key === hidden)!.ranges[0]!.boxes,
  ).toEqual([]);
  expect(
    boundaries.find((item) => item.key === multiple)!.ranges[0]!.boxes.length,
  ).toBeGreaterThanOrEqual(3);
  const frame = page.frameLocator("#frame");
  await expect(page.locator("#frame")).toHaveAttribute(
    "sandbox",
    "allow-same-origin allow-scripts",
  );
  await expect(frame.locator("[data-mokly-overlay]")).toHaveCount(0);
  const button = frame.getByRole("button", { name: "Visible", exact: true });
  const bounds = (await button.boundingBox())!;
  const clip = {
    x: bounds.x + 2,
    y: bounds.y + 2,
    width: bounds.width - 4,
    height: bounds.height - 4,
  };
  const before = await page.screenshot({ clip });
  await page.evaluate(
    (key) =>
      (window as unknown as FrameTestWindow).mounted.highlight(
        [key],
        "highlight",
      ),
    fixture.usage.instances.find((item) => item.id === "action")!.key,
  );
  await expect(frame.locator("[data-mokly-overlay] mask")).toHaveCount(1);
  expect(await page.screenshot({ clip })).toEqual(before);
  await expect(
    frame.locator("[data-mokly-overlay] rect[stroke]").first(),
  ).toHaveAttribute("stroke", "#336249");
  await page.evaluate(() =>
    (window as unknown as FrameTestWindow).mounted.highlight([], "off"),
  );
  await expect(frame.locator("[data-mokly-overlay]")).toHaveCount(0);
});

test("cross-origin hover, click, scrolling and Escape produce bounded events", async ({
  page,
}) => {
  await mountCrossFrame(page, fixture);
  const state = () =>
    page.evaluate(() => (window as unknown as FrameTestWindow).frameEvents);
  const key = fixture.usage.instances.find((item) => item.id === "action")!.key;
  const frame = page.frameLocator("#frame");
  await page.evaluate(
    (key) =>
      (window as unknown as FrameTestWindow).mounted.highlight([key], "pick"),
    key,
  );
  await frame.getByRole("button", { name: "Visible", exact: true }).hover();
  await expect
    .poll(async () =>
      (await state()).some(
        (event) => event.type === "hover" && event.key === key,
      ),
    )
    .toBe(true);
  await frame.getByRole("button", { name: "Visible", exact: true }).click();
  await expect
    .poll(async () =>
      (await state()).some(
        (event) => event.type === "click" && event.key === key,
      ),
    )
    .toBe(true);
  await page.keyboard.press("Escape");
  await expect
    .poll(async () =>
      (await state()).some((event) => event.type === "pick-end"),
    )
    .toBe(true);
  await expect(frame.locator("[data-mokly-overlay]")).toHaveCount(0);
  await page.mouse.move(700, 500);
  await expect
    .poll(async () =>
      (await state()).some(
        (event) => event.type === "hover" && event.key === null,
      ),
    )
    .toBe(true);
  const scrollKey = fixture.usage.instances.find(
    (item) => item.id === "scroll",
  )!.key;
  await page.evaluate(
    (key) => (window as unknown as FrameTestWindow).mounted.scrollTo(key),
    scrollKey,
  );
  await expect(
    frame.getByRole("button", { name: "Scroll", exact: true }),
  ).toBeInViewport();
  await expect
    .poll(async () =>
      (await state()).some((event) => event.type === "geometry"),
    )
    .toBe(true);
});

test("logical navigation is host-owned and restores native activation after unsubscribe", async ({
  page,
}) => {
  await mountCrossFrame(page, fixture);
  const frame = page.frameLocator("#frame");
  await frame.getByRole("link", { name: "Open Action" }).click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as unknown as FrameTestWindow).frameEvents.some(
          (event) =>
            event.type === "navigation" && event.navigation.id === "action",
        ),
      ),
    )
    .toBe(true);
  await expect(frame.getByRole("link", { name: "Open Action" })).toBeVisible();
  expect(page.url()).toBe(`${fixture.host.url}/`);
  await page.evaluate(async () => {
    const state = window as unknown as FrameTestWindow;
    state.unsubscribe();
    await state.mounted.listInstanceBoundaries();
  });
  await frame.getByRole("link", { name: "Open Action" }).click();
  await expect(
    frame.getByRole("button", { name: "Continue", exact: true }),
  ).toBeVisible();
});

test("view swaps, disposal, and absent inspector timeouts discard old work", async ({
  page,
}) => {
  await mountCrossFrame(page, fixture);
  const outcome = await page.evaluate(
    async ({ origin, usageJson }) => {
      const usage = JSON.parse(usageJson) as ComponentViewRecord;
      const state = window as unknown as FrameTestWindow;
      const { postMessageAdapter } = (await import(
        `${location.origin}/__mokly/client/post_message_adapter.js`
      )) as typeof PostAdapter;
      const old = state.mounted;
      const pending = old
        .listInstanceBoundaries()
        .catch((error: { code: string }) => error.code);
      state.mounted = await postMessageAdapter({ frameOrigin: origin }).mount(
        document.querySelector<HTMLIFrameElement>("#frame")!,
        {
          url: new URL("/static/screens/home.desktop.html", origin),
          usage: { status: "ready", ...usage },
        },
      );
      const result = await pending;
      state.mounted.dispose();
      state.mounted.dispose();
      return {
        result,
        error: await state.mounted
          .listInstanceBoundaries()
          .catch((error: { code: string }) => error.code),
      };
    },
    { origin: fixture.frames.url, usageJson: JSON.stringify(fixture.usage) },
  );
  expect(outcome).toEqual({ result: "disposed", error: "disposed" });
  await expect(
    page.frameLocator("#frame").locator("[data-mokly-overlay]"),
  ).toHaveCount(0);
  const timeout = await page.evaluate(async (origin) => {
    const { postMessageAdapter } = (await import(
      `${location.origin}/__mokly/client/post_message_adapter.js`
    )) as typeof PostAdapter;
    return postMessageAdapter({ frameOrigin: origin })
      .mount(document.querySelector<HTMLIFrameElement>("#frame")!, {
        url: new URL("/static/silent.html", origin),
        usage: { status: "unavailable" },
      })
      .then(
        () => "unexpected",
        (error: { code: string }) => error.code,
      );
  }, fixture.frames.url);
  expect(timeout).toBe("timeout");
});

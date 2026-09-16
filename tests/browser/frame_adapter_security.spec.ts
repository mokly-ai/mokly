import { expect, test } from "@playwright/test";

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

test("inspector ignores wrong-origin/source/nonce, unknown fields and oversized requests", async ({
  page,
}) => {
  await mountCrossFrame(page, fixture);
  const child = page
    .frames()
    .find((frame) => frame.url().startsWith(fixture.frames.url))!;
  const nonce = await page.evaluate(
    () =>
      (window as unknown as FrameTestWindow).wire.find(
        (message) => message.type === "ready",
      )!.nonce as string,
  );
  const key = fixture.usage.instances[0]!.key;
  const request = {
    channel: "mokly-inspector",
    version: 1,
    nonce,
    type: "highlight",
    requestId: 100,
    keys: [key],
    mode: "pick",
  };
  await child.evaluate(
    ({ request, host }) => {
      for (const [data, origin, source] of [
        [JSON.stringify(request), "https://wrong.test", window.parent],
        [JSON.stringify(request), host, window],
        [
          JSON.stringify({ ...request, nonce: "f".repeat(32) }),
          host,
          window.parent,
        ],
        [JSON.stringify({ ...request, extra: true }), host, window.parent],
        [JSON.stringify({ ...request, version: 2 }), host, window.parent],
        [
          JSON.stringify({
            ...request,
            keys: Array(1025).fill(request.keys[0]),
          }),
          host,
          window.parent,
        ],
        [" ".repeat(262145), host, window.parent],
      ] as const)
        window.dispatchEvent(
          new MessageEvent("message", { data, origin, source }),
        );
    },
    { request, host: fixture.host.url },
  );
  await expect(
    page.frameLocator("#frame").locator("[data-mokly-overlay]"),
  ).toHaveCount(0);
  await page.evaluate(async () => {
    await (
      window as unknown as FrameTestWindow
    ).mounted.listInstanceBoundaries();
  });
  const replies = await page.evaluate(() =>
    (window as unknown as FrameTestWindow).wire.filter(
      (message) => message.requestId === 100,
    ),
  );
  expect(replies).toEqual([]);
  await page.evaluate(
    ({ request, origin }) =>
      document
        .querySelector<HTMLIFrameElement>("#frame")!
        .contentWindow!.postMessage(JSON.stringify(request), origin),
    { request, origin: fixture.frames.url },
  );
  await expect(
    page.frameLocator("#frame").locator("[data-mokly-overlay]"),
  ).toHaveCount(1);
  await page.evaluate(
    ({ request, origin }) =>
      document
        .querySelector<HTMLIFrameElement>("#frame")!
        .contentWindow!.postMessage(
          JSON.stringify({ ...request, keys: [], mode: "off" }),
          origin,
        ),
    { request, origin: fixture.frames.url },
  );
  await expect(
    page.frameLocator("#frame").locator("[data-mokly-overlay]"),
  ).toHaveCount(1);
  await page.evaluate(() =>
    (window as unknown as FrameTestWindow).mounted.dispose(),
  );
  await expect(
    page.frameLocator("#frame").locator("[data-mokly-overlay]"),
  ).toHaveCount(0);
});

test("host rejects forged frame events and accepts only its active subscribed session", async ({
  page,
}) => {
  await mountCrossFrame(page, fixture);
  const events = await page.evaluate((origin) => {
    const state = window as unknown as FrameTestWindow;
    state.frameEvents = [];
    const source =
      document.querySelector<HTMLIFrameElement>("#frame")!.contentWindow!;
    const nonce = state.wire.find((message) => message.type === "ready")!.nonce;
    const event = {
      channel: "mokly-inspector",
      version: 1,
      nonce,
      type: "geometry",
    };
    for (const [data, sender, from] of [
      [JSON.stringify(event), "https://wrong.test", source],
      [JSON.stringify(event), origin, window],
      [JSON.stringify({ ...event, nonce: "f".repeat(32) }), origin, source],
      [JSON.stringify({ ...event, extra: true }), origin, source],
      [" ".repeat(262145), origin, source],
    ] as const)
      window.dispatchEvent(
        new MessageEvent("message", { data, origin: sender, source: from }),
      );
    const ignored = state.frameEvents.length;
    window.dispatchEvent(
      new MessageEvent("message", {
        data: JSON.stringify({
          ...event,
          type: "click",
          key: "f".repeat(64),
          boxes: [],
        }),
        origin,
        source,
      }),
    );
    window.dispatchEvent(
      new MessageEvent("message", {
        data: JSON.stringify(event),
        origin,
        source,
      }),
    );
    return { ignored, accepted: state.frameEvents };
  }, fixture.frames.url);
  expect(events).toEqual({
    ignored: 0,
    accepted: [
      { type: "error", code: "invalid-message" },
      { type: "geometry" },
    ],
  });
});

test("loading the published script directly never starts inspection or navigation interception", async ({
  page,
}) => {
  await page.goto(`${fixture.frames.url}/static/screens/home.mobile.html`);
  const facts = await page.evaluate(() => ({
    maps: document.querySelectorAll("template[data-mokly-inspector]").length,
    overlays: document.querySelectorAll("[data-mokly-overlay]").length,
  }));
  expect(facts).toEqual({ maps: 1, overlays: 0 });
  await page.getByRole("link", { name: "Open Action" }).click();
  await expect(
    page.getByRole("button", { name: "Continue", exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(
    /\/static\/components\/action\.variants\/default\.mobile\.html$/,
  );
});

import { expect, test } from "@playwright/test";

import type * as LocalAdapter from "../../packages/viewer/dist/client/same_origin_adapter.js";
import type { ComponentViewRecord } from "../../packages/viewer/dist/components/manifest_types.js";

import {
  crossOriginFixture,
  type FrameTestWindow,
} from "./frame_adapter_fixture.js";

let fixture: Awaited<ReturnType<typeof crossOriginFixture>>;
test.beforeAll(async () => {
  fixture = await crossOriginFixture();
});
test.afterAll(async () => {
  await fixture?.close();
});

test("same-origin interface supports geometry, hover, click, scroll and disposal with scripts disabled", async ({
  page,
}) => {
  await page.goto(fixture.host.url);
  await page.evaluate(async (json) => {
    const { sameOriginAdapter } = (await import(
      `${location.origin}/__mokly/client/same_origin_adapter.js`
    )) as typeof LocalAdapter;
    const state = window as unknown as FrameTestWindow;
    state.frameEvents = [];
    state.mounted = await sameOriginAdapter().mount(
      document.querySelector<HTMLIFrameElement>("#frame")!,
      {
        url: new URL("/static/screens/home.mobile.html", location.origin),
        usage: {
          status: "ready",
          ...(JSON.parse(json) as ComponentViewRecord),
        },
      },
    );
    state.unsubscribe = state.mounted.subscribe((event) =>
      state.frameEvents.push(event),
    );
  }, JSON.stringify(fixture.usage));
  await expect(page.locator("#frame")).toHaveAttribute(
    "sandbox",
    "allow-same-origin",
  );
  const key = fixture.usage.instances.find((item) => item.id === "action")!.key;
  const frame = page.frameLocator("#frame");
  const boundaries = await page.evaluate(() =>
    (window as unknown as FrameTestWindow).mounted.listInstanceBoundaries(),
  );
  expect(boundaries).toHaveLength(fixture.usage.instances.length);
  await frame.getByRole("button", { name: "Visible", exact: true }).hover();
  await expect
    .poll(() =>
      page.evaluate(
        (key) =>
          (window as unknown as FrameTestWindow).frameEvents.some(
            (event) => event.type === "hover" && event.key === key,
          ),
        key,
      ),
    )
    .toBe(true);
  await frame.getByRole("button", { name: "Visible", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(
        (key) =>
          (window as unknown as FrameTestWindow).frameEvents.some(
            (event) => event.type === "click" && event.key === key,
          ),
        key,
      ),
    )
    .toBe(true);
  await page.evaluate(
    (key) => (window as unknown as FrameTestWindow).mounted.scrollTo(key),
    fixture.usage.instances.find((item) => item.id === "scroll")!.key,
  );
  await expect(
    frame.getByRole("button", { name: "Scroll", exact: true }),
  ).toBeInViewport();
  const result = await page.evaluate(async () => {
    const state = window as unknown as FrameTestWindow;
    const pending = state.mounted
      .listInstanceBoundaries()
      .catch((error: { code: string }) => error.code);
    state.mounted.dispose();
    state.mounted.dispose();
    return pending;
  });
  expect(result).toBe("disposed");
  await expect(frame.locator("[data-mokly-overlay]")).toHaveCount(0);
});

test("valid local logical navigation works without instance usage", async ({
  page,
}) => {
  await page.goto(fixture.host.url);
  await page.evaluate(async () => {
    const { sameOriginAdapter } = (await import(
      `${location.origin}/__mokly/client/same_origin_adapter.js`
    )) as typeof LocalAdapter;
    const state = window as unknown as FrameTestWindow;
    state.frameEvents = [];
    state.mounted = await sameOriginAdapter().mount(
      document.querySelector<HTMLIFrameElement>("#frame")!,
      {
        url: new URL("/static/screens/home.mobile.html", location.origin),
        usage: { status: "unavailable" },
      },
    );
    state.unsubscribe = state.mounted.subscribe((event) =>
      state.frameEvents.push(event),
    );
  });
  await page
    .frameLocator("#frame")
    .getByRole("link", { name: "Open Action" })
    .click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as unknown as FrameTestWindow).frameEvents.some(
          (event) => event.type === "navigation",
        ),
      ),
    )
    .toBe(true);
  expect(page.url()).toBe(`${fixture.host.url}/`);
});

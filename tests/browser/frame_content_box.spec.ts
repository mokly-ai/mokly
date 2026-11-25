import { expect } from "@playwright/test";

import { currentDocumentPath } from "@mokly/model";

import { viewRoute } from "../../packages/viewer/src/data.js";

import { test } from "./browser_test.js";
import {
  crossOriginFixture,
  mountCrossFrame,
  type FrameTestWindow,
} from "./frame_adapter_fixture.js";
import { mountLocalFrame } from "./frame_adapter_local_fixture.js";

let fixture: Awaited<ReturnType<typeof crossOriginFixture>>;
test.beforeAll(async () => {
  fixture = await crossOriginFixture({ failedStory: true });
});
test.afterAll(async () => {
  await fixture?.close();
});

test("both adapters measure the leaf component at the same size before and after scrolling", async ({
  page,
}) => {
  const action = fixture.details.current["action"]!;
  const view = action.views.find(
    (view) => view.viewport === "desktop" && view.colorScheme === "light",
  )!;
  expect(view.usage).toMatchObject({ status: "ready", instances: [] });
  const path = `/${currentDocumentPath(viewRoute("action", view.viewport, view.colorScheme))}`;
  // Direct adapter calls expose the measurement without host UI.
  const contentBox = () =>
    page.evaluate(() =>
      (window as unknown as FrameTestWindow).mounted.contentBox!(),
    );
  const boxes = [];
  for (const mount of [mountCrossFrame, mountLocalFrame]) {
    await mount(page, fixture, path, view.usage);
    const button = page
      .frameLocator("#frame")
      .getByRole("button", { name: "Continue" });
    await expect(button).toBeVisible();
    const buttonBox = await button.evaluate((element) => {
      const { x, y, width, height } = element.getBoundingClientRect();
      return { x, y, width, height };
    });
    const before = await contentBox();
    expect(buttonBox).toMatchObject({ width: 160, height: 40 });
    expect(before).toEqual({
      x: buttonBox.x,
      y: buttonBox.y,
      width: 160,
      height: 40,
    });
    // Shorten the iframe so that the leaf document can scroll.
    await page.locator("#frame").evaluate((frame) => {
      frame.style.height = "24px";
    });
    const scrollY = await button.evaluate((element) => {
      const win = element.ownerDocument.defaultView!;
      win.scrollTo(0, 16);
      return win.scrollY;
    });
    expect(scrollY).toBe(16);
    expect(await contentBox()).toEqual(before);
    boxes.push(before);
  }
  expect(boxes[1]).toEqual(boxes[0]);
});

test("a failed story has the same content box in desktop and narrow frames", async ({
  page,
}) => {
  const detail = fixture.failedStory!;
  const view = detail.views.find(
    (view) => view.viewport === "desktop" && view.colorScheme === "light",
  )!;
  const path = `/${currentDocumentPath(viewRoute(detail.entry.path, view.viewport, view.colorScheme))}`;
  await mountCrossFrame(page, fixture, path, view.usage);
  await expect(
    page.frameLocator("#frame").getByText("The Broken story couldn’t render"),
  ).toBeVisible();

  const boxes = [];
  for (const [width, height] of [
    [1280, 800],
    [320, 480],
  ]) {
    // The adapter harness has no controls for setting the frame dimensions.
    await page.locator("#frame").evaluate(
      (frame, { width, height }) => {
        frame.style.width = `${width}px`;
        frame.style.height = `${height}px`;
      },
      { width, height },
    );
    boxes.push(
      await page.evaluate(() =>
        (window as unknown as FrameTestWindow).mounted.contentBox!(),
      ),
    );
  }
  const [desktop, narrow] = boxes;
  expect(desktop).toMatchObject({ x: 0, y: 0, width: 360 });
  expect(desktop!.height).toBeGreaterThan(0);
  expect(desktop!.height).toBeLessThan(800);
  expect(narrow).toEqual(desktop);
});

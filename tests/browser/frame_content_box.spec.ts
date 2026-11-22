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
  fixture = await crossOriginFixture();
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

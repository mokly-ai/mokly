import { expect, type Locator, type Page } from "@playwright/test";

import { test } from "./browser_test.js";
import {
  crossOriginFixture,
  mountCrossFrame,
  type FrameTestWindow,
} from "./frame_adapter_fixture.js";
import { mountLocalFrame } from "./frame_adapter_local_fixture.js";

let fixture: Awaited<ReturnType<typeof crossOriginFixture>>;
test.beforeAll(async () => {
  fixture = await crossOriginFixture({
    body: '<button>Frame action</button><input aria-label="Frame value"/><div style={{height:1000}} />',
  });
});
test.afterAll(async () => fixture?.close());

const canvasEvents = (page: Page) =>
  page.evaluate(() =>
    (window as unknown as FrameTestWindow).frameEvents.filter(({ type }) =>
      type.startsWith("canvas-"),
    ),
  );

const frameReply = (page: Page) =>
  page.evaluate(() =>
    (window as unknown as FrameTestWindow).mounted.contentBox!(),
  );

async function wheelEvidence(page: Page, button: Locator, sameOrigin: boolean) {
  // Register from the host when the frame's own scripts are disabled.
  const target = sameOrigin ? page.locator("#frame") : button;
  return target.evaluateHandle((element) => {
    const events: { deltaY: number; prevented: boolean }[] = [];
    const doc =
      element instanceof HTMLIFrameElement
        ? element.contentDocument!
        : element.ownerDocument;
    doc.addEventListener("wheel", (event) => {
      events.push({ deltaY: event.deltaY, prevented: event.defaultPrevented });
    });
    return events;
  });
}

const point = { x: 125, y: 90 };

async function moveToFrame(page: Page) {
  const frame = (await page.locator("#frame").boundingBox())!;
  await page.mouse.move(frame.x + point.x, frame.y + point.y);
}

async function zoomWheel(page: Page, deltaY: number) {
  await page.keyboard.down("Control");
  try {
    await page.mouse.wheel(0, deltaY);
  } finally {
    await page.keyboard.up("Control");
  }
}

async function focusStops(page: Page) {
  // The fixture has only an iframe. Add host controls on both sides of it.
  await page.locator("#frame").evaluate((frame) => {
    const before = document.createElement("button");
    before.textContent = "Before frame";
    frame.before(before);
    const after = document.createElement("button");
    after.textContent = "After frame";
    frame.after(after);
  });
  return {
    before: page.getByRole("button", { name: "Before frame" }),
    after: page.getByRole("button", { name: "After frame" }),
  };
}

for (const [name, mount] of [
  ["cross-origin", mountCrossFrame],
  ["same-origin", mountLocalFrame],
] as const) {
  test(`${name} canvas opt-in forwards browser zoom, keys and focus`, async ({
    page,
  }) => {
    await mount(page, fixture, undefined, undefined, true);
    const frame = page.frameLocator("#frame");
    const button = frame.getByRole("button", { name: "Frame action" });
    const input = frame.getByRole("textbox", { name: "Frame value" });
    await expect(button).toBeVisible();
    const wheel = await wheelEvidence(page, button, name === "same-origin");
    const wheels = async () =>
      (await canvasEvents(page)).filter(
        (event) => event.type === "canvas-wheel",
      );
    const total = async () =>
      (await wheels()).reduce((sum, event) => sum + event.deltaY, 0);
    try {
      await moveToFrame(page);
      await zoomWheel(page, -120);
      await expect.poll(total).toBe(-120);
      for (const { deltaMode, x, y } of await wheels())
        expect({ deltaMode, x, y }).toEqual({ deltaMode: 0, ...point });
      await expect
        .poll(() => wheel.evaluate((events) => events.slice()))
        .toEqual([{ deltaY: -120, prevented: true }]);

      await page.mouse.wheel(0, 80);
      await expect
        .poll(() => wheel.evaluate((events) => events.at(-1)))
        .toEqual({ deltaY: 80, prevented: false });
      await expect
        .poll(() =>
          button.evaluate(
            (element) => element.ownerDocument.defaultView!.scrollY,
          ),
        )
        .toBeGreaterThan(0);
      // A second zoom wheel shows the sum after the plain wheel has dispatched.
      await zoomWheel(page, -60);
      await expect.poll(total).toBe(-180);
    } finally {
      await wheel.dispose();
    }

    const { before, after } = await focusStops(page);
    const focus = async () =>
      (await canvasEvents(page))
        .filter(({ type }) => type === "canvas-focus" || type === "canvas-blur")
        .at(-1);
    await before.focus();
    await expect.poll(focus).toEqual({ type: "canvas-blur" });
    await page.keyboard.press("Tab");
    await expect(button).toBeFocused();
    await expect.poll(focus).toEqual({ type: "canvas-focus", visible: true });
    await page.keyboard.press("=");
    const keys = async () =>
      (await canvasEvents(page)).filter(({ type }) => type === "canvas-key");
    await expect.poll(keys).toEqual([{ type: "canvas-key", key: "zoom-in" }]);
    await page.keyboard.press("Tab");
    await expect(input).toBeFocused();
    await page.keyboard.press("=");
    await expect(input).toHaveValue("=");
    await frameReply(page);
    expect(await keys()).toEqual([{ type: "canvas-key", key: "zoom-in" }]);
    await page.keyboard.press("Tab");
    await expect(after).toBeFocused();
    await expect.poll(focus).toEqual({ type: "canvas-blur" });
    await button.click();
    await expect.poll(focus).toEqual({ type: "canvas-focus", visible: false });
  });

  test(`${name} without canvas opt-in leaves Ctrl-wheel to the document`, async ({
    page,
  }) => {
    await mount(page, fixture);
    const button = page
      .frameLocator("#frame")
      .getByRole("button", { name: "Frame action" });
    await expect(button).toBeVisible();
    const wheel = await wheelEvidence(page, button, name === "same-origin");
    try {
      await moveToFrame(page);
      await zoomWheel(page, -120);
      await expect
        .poll(() => wheel.evaluate((events) => events.slice()))
        .toEqual([{ deltaY: -120, prevented: false }]);
      await frameReply(page);
      expect(await canvasEvents(page)).toEqual([]);
    } finally {
      await wheel.dispose();
    }
  });
}

test("a same-origin usage update keeps canvas input and reports the current focus", async ({
  page,
}) => {
  await mountLocalFrame(page, fixture, undefined, undefined, true);
  const button = page
    .frameLocator("#frame")
    .getByRole("button", { name: "Frame action" });
  await button.click();
  const focus = async () =>
    (await canvasEvents(page)).filter(({ type }) => type === "canvas-focus");
  await expect.poll(focus).toEqual([{ type: "canvas-focus", visible: false }]);
  // A usage update restarts the local runtime on the current frame document.
  await page.evaluate(() =>
    (window as unknown as FrameTestWindow).mounted.updateUsage!({
      status: "pending",
    }),
  );
  await expect.poll(focus).toEqual([
    { type: "canvas-focus", visible: false },
    { type: "canvas-focus", visible: false },
  ]);
  await page.keyboard.press("=");
  await expect
    .poll(async () => (await canvasEvents(page)).at(-1))
    .toEqual({ type: "canvas-key", key: "zoom-in" });
});

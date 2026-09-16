import { expect, test } from "@playwright/test";

import {
  crossOriginFixture,
  mountCrossFrame,
  type FrameTestWindow,
} from "./frame_adapter_fixture.js";

let fixture: Awaited<ReturnType<typeof crossOriginFixture>>;
test.beforeAll(async () => {
  fixture = await crossOriginFixture({
    body: '<action.Component label="Visible" />',
    actionRender:
      "(props) => <button style={{width:160,height:40}}>{props.label}</button>",
  });
});
test.afterAll(async () => fixture?.close());

for (const hostile of [
  "background",
  "universal-important",
  "inherited",
] as const) {
  test(`inspector preserves highlighted pixels under ${hostile} consumer styles`, async ({
    page,
  }) => {
    await mountCrossFrame(page, fixture);
    const child = page
      .frames()
      .find((frame) => frame.url().startsWith(fixture.frames.url))!;
    await child.addStyleTag({
      content:
        hostile === "background"
          ? "div { background: rgb(255, 0, 0) !important }"
          : hostile === "universal-important"
            ? "* { background-color: red !important; padding: 3px !important; border: 4px solid red !important; box-shadow: 0 0 20px red !important; color: purple !important } div { opacity: .6 !important; display: none !important; transform: translate(15px, 10px) !important; filter: blur(2px) !important }"
            : "html { color: red; fill: red; stroke: red; opacity: .8 } div { color: inherit; opacity: inherit; background: currentColor }",
    });
    const frame = page.frameLocator("#frame");
    const key = fixture.usage.instances.find(
      (item) => item.id === "action",
    )!.key;
    const button = frame.getByRole("button", { name: "Visible", exact: true });
    const bounds = (await button.boundingBox())!;
    const clip = {
      x: bounds.x + 6,
      y: bounds.y + 6,
      width: bounds.width - 12,
      height: bounds.height - 12,
    };
    const before = await page.screenshot({ clip });
    const surrounding = {
      x: bounds.x + bounds.width + 20,
      y: bounds.y + 6,
      width: 20,
      height: 20,
    };
    const undimmed = await page.screenshot({ clip: surrounding });
    await page.evaluate(
      (key) =>
        (window as unknown as FrameTestWindow).mounted.highlight([key], "pick"),
      key,
    );
    await expect(frame.locator("[data-mokly-overlay] mask")).toHaveCount(1);
    expect(await page.screenshot({ clip })).toEqual(before);
    expect(await page.screenshot({ clip: surrounding })).not.toEqual(undimmed);
    const style = await frame
      .locator("[data-mokly-overlay]")
      .evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          display: style.display,
          opacity: style.opacity,
          background: style.backgroundColor,
          padding: style.padding,
          transform: style.transform,
          filter: style.filter,
        };
      });
    expect(style).toEqual({
      display: "block",
      opacity: "1",
      background: "rgba(0, 0, 0, 0)",
      padding: "0px",
      transform: "none",
      filter: "none",
    });
    await button.hover({ timeout: 5_000 });
    await button.click({ timeout: 5_000 });
    await expect
      .poll(() =>
        page.evaluate(
          (key) =>
            (window as unknown as FrameTestWindow).frameEvents
              .filter(
                (event) =>
                  (event.type === "hover" || event.type === "click") &&
                  event.key === key,
              )
              .map((event) => event.type),
          key,
        ),
      )
      .toEqual(expect.arrayContaining(["hover", "click"]));
    await page.evaluate(() =>
      (window as unknown as FrameTestWindow).mounted.dispose(),
    );
    await expect(frame.locator("[data-mokly-overlay]")).toHaveCount(0);
    expect(await page.screenshot({ clip: surrounding })).toEqual(undimmed);
  });
}

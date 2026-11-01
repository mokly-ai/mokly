import { expect } from "@playwright/test";

import type { InstanceEvent } from "@mokly/viewer";

import { viewerFixture } from "../../packages/viewer/tests/browser_fixture.js";

import { test } from "./browser_test.js";
import type {} from "./viewer_harness.js";

let fixture: Awaited<ReturnType<typeof viewerFixture>>;
test.beforeAll(async () => {
  fixture = await viewerFixture({
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
  test(`shell preserves highlighted pixels under ${hostile} consumer styles`, async ({
    page,
  }) => {
    await page.goto(fixture.host.url);
    await page.waitForFunction(() => Boolean(window.viewerHarness));
    await page.evaluate(() =>
      window.viewerHarness.start("one", { cross: true }),
    );
    await expect(
      page.locator('iframe[data-workspace-frame="mobile"]'),
    ).toHaveAttribute("data-mokly-frame-state", "ready");
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
    const frame = page.frameLocator('iframe[data-workspace-frame="mobile"]');
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
        window.viewerHarness.get("one").ref.current.highlightInstance({
          screenPath: "home",
          viewport: "mobile",
          colorScheme: "light",
          key,
        }),
      key,
    );
    await expect(page.locator(".mbk-highlight-layer mask")).toHaveCount(1);
    await expect(frame.locator("[data-mokly-overlay]")).toHaveCount(0);
    expect(await page.screenshot({ clip })).toEqual(before);
    expect(await page.screenshot({ clip: surrounding })).not.toEqual(undimmed);
    const style = await page
      .locator(".mbk-highlight-layer")
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
    await button.hover({ timeout: 15_000 });
    await button.click({ timeout: 15_000 });
    await expect
      .poll(() =>
        page.evaluate(
          (key) =>
            window.viewerHarness
              .get("one")
              .events.filter(
                (event) =>
                  (event.name === "hover" || event.name === "click") &&
                  (event.value as InstanceEvent).instance?.key === key,
              )
              .map((event) => event.name),
          key,
        ),
      )
      .toEqual(expect.arrayContaining(["hover", "click"]));
    await page.evaluate(() =>
      window.viewerHarness.get("one").ref.current.highlightInstance(null),
    );
    await expect(page.locator(".mbk-highlight-layer")).toHaveCount(0);
    expect(await page.screenshot({ clip: surrounding })).toEqual(undimmed);
  });
}

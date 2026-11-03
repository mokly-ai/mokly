import { expect } from "@playwright/test";

import { test } from "./browser_test.js";
import {
  crossOriginFixture,
  mountCrossFrame,
  type FrameTestWindow,
} from "./frame_adapter_fixture.js";

let fixture: Awaited<ReturnType<typeof crossOriginFixture>>;
test.beforeAll(async () => {
  fixture = await crossOriginFixture({
    body: '<pane.Component moklyInstance="outer"><action.Component moklyInstance="inner" label="Nested" /></pane.Component>',
    paneRender:
      "(props) => <section style={{padding:12}}>{props.children}</section>",
  });
});
test.afterAll(async () => fixture?.close());

test("published hover and click select the innermost allowed instance", async ({
  page,
}) => {
  await mountCrossFrame(page, fixture);
  const outer = fixture.usage.instances.find(({ id }) => id === "outer")!.key;
  const inner = fixture.usage.instances.find(({ id }) => id === "inner")!.key;
  const button = page
    .frameLocator("#frame")
    .getByRole("button", { name: "Nested", exact: true });
  for (const [keys, mode, expected] of [
    [[], "off", inner],
    [[outer, inner], "highlight", inner],
    [[outer, inner], "pick", inner],
    [[outer], "pick", outer],
    [[], "highlight", null],
  ] as const) {
    // Direct adapter calls arrange inspection without adding host UI.
    await page.evaluate(
      async ({ keys, mode }) => {
        const state = window as unknown as FrameTestWindow;
        await state.mounted.highlight(keys, mode);
        state.frameEvents = [];
      },
      { keys: [...keys], mode },
    );
    await page.mouse.move(700, 500);
    await button.hover();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as unknown as FrameTestWindow).frameEvents
              .filter((event) => event.type === "hover")
              .at(-1)?.key,
        ),
      )
      .toBe(expected);
    await button.click();
    await page.evaluate(() =>
      (window as unknown as FrameTestWindow).mounted.listInstanceBoundaries(),
    );
    expect(
      await page.evaluate(() =>
        (window as unknown as FrameTestWindow).frameEvents
          .filter((event) => event.type === "click")
          .map((event) => event.key),
      ),
    ).toEqual(expected === null ? [] : [expected]);
  }
});

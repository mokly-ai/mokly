import { expect } from "@playwright/test";

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
    body: '<pane.Component moklyInstance="outer"><action.Component moklyInstance="inner" label="Nested" /></pane.Component>',
    paneRender:
      '(props) => <section aria-label="Outer instance" style={{padding:12}}>{props.children}</section>',
  });
});
test.afterAll(async () => fixture?.close());

for (const transport of ["same-origin", "postMessage"] as const) {
  test(`${transport} hover and click select the innermost allowed instance`, async ({
    page,
  }) => {
    if (transport === "postMessage") await mountCrossFrame(page, fixture);
    else await mountLocalFrame(page, fixture);
    const outer = fixture.usage.instances.find(({ id }) => id === "outer")!.key;
    const inner = fixture.usage.instances.find(({ id }) => id === "inner")!.key;
    const button = page
      .frameLocator("#frame")
      .getByRole("button", { name: "Nested", exact: true });
    const targets = {
      nested: button,
      outer: page
        .frameLocator("#frame")
        .getByRole("region", { name: "Outer instance", exact: true }),
    };
    await button.hover();
    for (const [keys, mode, target, expected] of [
      [[], "off", "nested", inner],
      [[outer, inner], "highlight", "nested", inner],
      [[outer, inner], "pick", "nested", inner],
      [[outer], "highlight", "nested", outer],
      [[outer], "pick", "nested", outer],
      [[inner], "highlight", "outer", null],
      [[inner], "pick", "outer", null],
      [[], "highlight", "nested", null],
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
      // Drain hover exit before checking null over an excluded instance.
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              (window as unknown as FrameTestWindow).frameEvents
                .filter((event) => event.type === "hover")
                .at(-1)?.key,
          ),
        )
        .toBe(null);
      await page.evaluate(() => {
        (window as unknown as FrameTestWindow).frameEvents = [];
      });
      const position = target === "outer" ? { position: { x: 4, y: 4 } } : {};
      await targets[target].hover(position);
      await expect
        .poll(() =>
          page.evaluate(() =>
            (window as unknown as FrameTestWindow).frameEvents
              .filter((event) => event.type === "hover")
              .at(-1),
          ),
        )
        .toMatchObject({
          key: expected,
          ...(expected === null ? { boxes: [] } : {}),
        });
      await targets[target].click(position);
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
}

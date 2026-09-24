import { expect, test } from "@playwright/test";

import type * as LocalAdapter from "../../packages/viewer/dist/client/same_origin_adapter.js";
import type { ComponentViewRecord } from "../../packages/viewer/dist/components/manifest_types.js";

import {
  crossOriginFixture,
  mountCrossFrame,
  type FrameTestWindow,
} from "./frame_adapter_fixture.js";

let fixture: Awaited<ReturnType<typeof crossOriginFixture>>;
test.beforeAll(async () => {
  fixture = await crossOriginFixture({
    body: '<div id="outer" style={{width:80,height:40,overflow:"hidden"}}><div id="inner" style={{width:60,height:30,overflow:"auto"}}><action.Component label="" /></div></div>',
    actionRender:
      '() => <button id="target" style={{position:"fixed",left:200,top:150,width:160,height:40}} />',
  });
});
test.afterAll(async () => fixture?.close());

for (const transport of ["same-origin", "postMessage"] as const) {
  for (const layout of [
    "viewport-fixed",
    "fixed-text",
    "transformed",
    "inner-scroll",
  ] as const) {
    test(`${transport} clips ${layout} against its real containing block`, async ({
      page,
    }) => {
      if (transport === "postMessage") await mountCrossFrame(page, fixture);
      else {
        await page.goto(fixture.host.url);
        await page.evaluate(async (json) => {
          const usage = JSON.parse(json) as ComponentViewRecord;
          const { sameOriginAdapter } = (await import(
            `${location.origin}/__mokly/client/same_origin_adapter.js`
          )) as typeof LocalAdapter;
          const frame = document.querySelector<HTMLIFrameElement>("#frame")!;
          frame.dataset["moklyGeneratedPrefix"] = ".generated";
          (window as unknown as FrameTestWindow).mounted =
            await sameOriginAdapter().mount(frame, {
              url: new URL(
                "/static/.generated/screens/home.mobile.html",
                location.origin,
              ),
              route: "screens/home.mobile.html",
              generatedPathPrefix: ".generated",
              usage: { status: "ready", ...usage },
            });
        }, JSON.stringify(fixture.usage));
      }
      const child = page
        .frames()
        .find((frame) =>
          frame.url().includes("/static/.generated/screens/home.mobile.html"),
        )!;
      const expected = await child.evaluate((layout) => {
        const outer = document.querySelector<HTMLElement>("#outer")!;
        const inner = document.querySelector<HTMLElement>("#inner")!;
        const target = document.querySelector<HTMLElement>("#target")!;
        let clip: HTMLElement | undefined;
        if (layout === "fixed-text") target.textContent = "Fixed text";
        if (layout === "transformed") {
          outer.style.cssText =
            "position:absolute;left:40px;top:60px;transform:translateX(20px);width:80px;height:60px;overflow:hidden";
          inner.style.cssText = "width:30px;height:10px;overflow:hidden";
          target.style.left = "20px";
          target.style.top = "20px";
          target.textContent = "Fixed text";
          clip = outer;
        }
        if (layout === "inner-scroll") {
          inner.style.cssText =
            "position:fixed;left:120px;top:140px;width:80px;height:50px;overflow:auto";
          target.style.cssText =
            "display:block;margin-top:80px;width:160px;height:40px";
          target.textContent = "Scrolled text";
          inner.scrollTop = 70;
          clip = inner;
        }
        const rect = target.getBoundingClientRect();
        const bounds = clip?.getBoundingClientRect();
        const x = Math.max(rect.left, bounds?.left ?? 0);
        const y = Math.max(rect.top, bounds?.top ?? 0);
        const right = Math.min(rect.right, bounds?.right ?? innerWidth);
        const bottom = Math.min(rect.bottom, bounds?.bottom ?? innerHeight);
        return { x, y, width: right - x, height: bottom - y };
      }, layout);
      const key = fixture.usage.instances.find(
        ({ id }) => id === "action",
      )!.key;
      const boxes = await page.evaluate(async (key) => {
        const boundaries = await (
          window as unknown as FrameTestWindow
        ).mounted.listInstanceBoundaries();
        return boundaries
          .find((item) => item.key === key)!
          .ranges.flatMap((range) => range.boxes);
      }, key);
      expect(boxes).toEqual([expected]);
      if (transport === "same-origin") {
        const local = await page.evaluate(
          async ({ usageJson, key }) => {
            const { localInspection } = (await import(
              `${location.origin}/__mokly/client/same_origin_adapter.js`
            )) as typeof LocalAdapter;
            return localInspection(
              document.querySelector<HTMLIFrameElement>("#frame")!,
              "screens/home.mobile.html",
              JSON.parse(usageJson) as ComponentViewRecord,
            )!.measure(new Set([key]));
          },
          { usageJson: JSON.stringify(fixture.usage), key },
        );
        expect(local).toEqual([{ key, ...expected }]);
      }
    });
  }
}

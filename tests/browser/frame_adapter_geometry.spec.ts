import { expect, test } from "@playwright/test";

import {
  crossOriginFixture,
  mountCrossFrame,
  type FrameTestWindow,
} from "./frame_adapter_fixture.js";

let fixture: Awaited<ReturnType<typeof crossOriginFixture>>;
test.beforeAll(async () => {
  fixture = await crossOriginFixture({
    body: '<div id="clip" style={{width:100,height:30,overflow:"hidden"}}><action.Component label="Clipped" /></div><div style={{position:"relative",height:60}}><action.Component moklyInstance="occluded" label="Covered" /><div id="cover" style={{position:"absolute",left:80,top:0,width:80,height:40,background:"red",zIndex:2}} /></div><div style={{height:700}} /><div id="inner" style={{height:80,overflow:"auto"}}><div style={{height:400}} /><action.Component moklyInstance="text" label="Text only" disabled /></div>',
    actionRender:
      "(props) => props.disabled ? props.label : <button style={{width:160,height:40}}>{props.label}</button>",
  });
});
test.afterAll(async () => {
  await fixture?.close();
});

test("cross-origin geometry clips overflow and subtracts sibling occlusion", async ({
  page,
}) => {
  await mountCrossFrame(page, fixture);
  const child = page
    .frames()
    .find((frame) => frame.url().startsWith(fixture.frames.url))!;
  const layout = await child.evaluate(() => {
    const clip = document.querySelector("#clip")!.getBoundingClientRect();
    const cover = document.querySelector("#cover")!.getBoundingClientRect();
    return { clip: clip.toJSON(), cover: cover.toJSON() };
  });
  const boundaries = await page.evaluate(() =>
    (window as unknown as FrameTestWindow).mounted.listInstanceBoundaries(),
  );
  const clipped = boundaries.find(
    ({ key }) =>
      key === fixture.usage.instances.find(({ id }) => id === "action")!.key,
  )!.ranges[0]!.boxes;
  expect(clipped.length).toBeGreaterThan(0);
  for (const box of clipped) {
    expect(box.x).toBeGreaterThanOrEqual(layout.clip.x);
    expect(box.y).toBeGreaterThanOrEqual(layout.clip.y);
    expect(box.x + box.width).toBeLessThanOrEqual(layout.clip.right);
    expect(box.y + box.height).toBeLessThanOrEqual(layout.clip.bottom);
  }
  const covered = boundaries.find(
    ({ key }) =>
      key === fixture.usage.instances.find(({ id }) => id === "occluded")!.key,
  )!.ranges[0]!.boxes;
  expect(covered.length).toBeGreaterThan(0);
  for (const box of covered)
    expect(box.x + box.width).toBeLessThanOrEqual(layout.cover.x);
});

test("scroll reveals a text-only first range inside nested scrolling content", async ({
  page,
}) => {
  await mountCrossFrame(page, fixture);
  const key = fixture.usage.instances.find(({ id }) => id === "text")!.key;
  await page.evaluate(
    (key) => (window as unknown as FrameTestWindow).mounted.scrollTo(key),
    key,
  );
  const boundaries = await page.evaluate(() =>
    (window as unknown as FrameTestWindow).mounted.listInstanceBoundaries(),
  );
  expect(
    boundaries.find((item) => item.key === key)!.ranges[0]!.boxes.length,
  ).toBeGreaterThan(0);
  const inner = page.frameLocator("#frame").locator("#inner");
  expect(await inner.evaluate((element) => element.scrollTop)).toBeGreaterThan(
    300,
  );
});

test("hover and geometry coalesce and overlay redraws settle", async ({
  page,
}) => {
  await mountCrossFrame(page, fixture);
  const key = fixture.usage.instances.find(({ id }) => id === "action")!.key;
  await page.evaluate(
    (key) =>
      (window as unknown as FrameTestWindow).mounted.highlight([key], "pick"),
    key,
  );
  const child = page
    .frames()
    .find((frame) => frame.url().startsWith(fixture.frames.url))!;
  const settle = () =>
    child.evaluate(async () => {
      for (let i = 0; i < 8; i++) await new Promise(requestAnimationFrame);
    });
  await settle();
  await page.evaluate(() => {
    (window as unknown as FrameTestWindow).frameEvents = [];
  });
  await settle();
  expect(
    await page.evaluate(
      () => (window as unknown as FrameTestWindow).frameEvents,
    ),
  ).toEqual([]);
  await child.evaluate(() => {
    const rect = document.querySelector("button")!.getBoundingClientRect();
    for (let i = 0; i < 200; i++) {
      document.dispatchEvent(new Event("scroll"));
      document.dispatchEvent(
        new MouseEvent("pointermove", {
          clientX: rect.x + 5,
          clientY: rect.y + 5,
        }),
      );
    }
  });
  await settle();
  const events = await page.evaluate(
    () => (window as unknown as FrameTestWindow).frameEvents,
  );
  expect(events.filter((event) => event.type === "geometry")).toHaveLength(1);
  expect(events.filter((event) => event.type === "hover")).toHaveLength(1);
  expect(events.find((event) => event.type === "hover")).toMatchObject({ key });
});

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
    body: `<action.Component label="Plain" />
      <div style={{width:80,height:20,overflow:"hidden"}}><action.Component moklyInstance="clipped" label="Clipped" /></div>
      <div style={{position:"relative",height:40}}><action.Component moklyInstance="covered" label="Covered" /><div style={{position:"absolute",inset:0,background:"red",zIndex:2}} /></div>
      <action.Component moklyInstance="text" label="Text only" disabled />
      <action.Component moklyInstance="multi" label="Multiple roots" hidden />`,
    actionRender:
      '(props) => props.disabled ? props.label : props.hidden ? <><span>First root</span><strong>Last root</strong></> : <button style={{boxSizing:"border-box",width:160,height:40,border:"2px solid",padding:"6px 12px"}}>{props.label}</button>',
  });
});
test.afterAll(async () => {
  await fixture?.close();
});

test("both adapters measure full box models through clipping and occlusion", async ({
  page,
}) => {
  const keys = ["action", "clipped", "covered", "text", "multi"].map(
    (id) => fixture.usage.instances.find((instance) => instance.id === id)!.key,
  );
  const results = [];
  for (const mount of [mountCrossFrame, mountLocalFrame]) {
    await mount(page, fixture);
    // Direct adapter calls expose frame measurements without host UI.
    const models = await page.evaluate(async (keys) => {
      const { mounted } = window as unknown as FrameTestWindow;
      return Promise.all(keys.map((key) => mounted.boxModel!(key)));
    }, keys);
    for (const model of models.slice(0, 3))
      expect(model).toMatchObject({
        box: { width: 160, height: 40 },
        border: { top: 2, right: 2, bottom: 2, left: 2 },
        padding: { top: 6, right: 12, bottom: 6, left: 12 },
      });
    expect(models.slice(3)).toEqual([null, null]);
    results.push(models);
  }
  expect(results[1]).toEqual(results[0]);
});

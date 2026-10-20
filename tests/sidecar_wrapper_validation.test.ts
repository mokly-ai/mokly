import assert from "node:assert/strict";
import test from "node:test";

import type { PageResult } from "../packages/mokly/src/generated/sidecar/PageResult.js";
import type { RenderResult } from "../packages/mokly/src/generated/sidecar/RenderResult.js";

import { startSidecar } from "./helpers/sidecar.js";
import {
  callbackConsumer,
  callbackEntry,
  describeCallbacks,
} from "./helpers/sidecar_callbacks.js";

const source = `
let calls = 0;
export const leaf = defineComponent({...metadata,path:'leaf',title:'Leaf',
  propSchema:{type:'object',additionalProperties:false,required:['count'],
    properties:{count:{type:'integer',minimum:1}}},
  props:{count:1},slots:['children'],
  render:({count,children})=>{calls++;return <b>{count}{children}</b>;}});
export const screen = defineScreen({...metadata,path:'screen',title:'Screen',
  render:({value})=><leaf.Component {...value}><i>Slot</i></leaf.Component>});
export const probe = definePage({...metadata,path:'probe',title:'Probe',
  render:()=> '<!doctype html><html><head></head><body>'+calls+'</body></html>'});
`;

test("dynamic wrapper props fail the profile before the adapter runs", async (context) => {
  const root = await callbackConsumer(context, source);
  const sidecar = startSidecar(context, root);
  await sidecar.call("hello");
  const { generation } = await describeCallbacks(sidecar, root);
  const params = {
    generation,
    handle: `${callbackEntry}#screen`,
    entry: { path: "screen", title: "Screen" },
    viewport: "mobile",
    colorScheme: "light",
  };
  for (const value of [
    { count: "wrong" },
    {},
    { count: 0 },
    { count: 2, extra: true },
  ]) {
    await assert.rejects(
      sidecar.call("renderScreen", { ...params, props: { value } }),
      (error: Error) => {
        assert.equal(Reflect.get(error, "code"), "render-failed");
        assert.match(error.message, /leaf/u);
        return true;
      },
    );
    const probe = await sidecar.call<PageResult>("renderPage", {
      generation,
      handle: `${callbackEntry}#probe`,
    });
    assert.match(probe.html, /<body>0<\/body>/u);
  }
  const valid = await sidecar.call<RenderResult>("renderScreen", {
    ...params,
    props: { value: { count: 2 } },
  });
  assert.match(valid.html, /<b>2/u);
  assert.match(valid.html, /<i>Slot<\/i>/u);
  assert.equal(valid.instances.length, 1);
  assert.deepEqual(valid.instances[0]!.props, { count: ["number", "2"] });
  const probe = await sidecar.call<PageResult>("renderPage", {
    generation,
    handle: `${callbackEntry}#probe`,
  });
  assert.match(probe.html, /<body>1<\/body>/u);
  await sidecar.call("shutdown");
});

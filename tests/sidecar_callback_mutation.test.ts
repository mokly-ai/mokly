import assert from "node:assert/strict";
import test from "node:test";

import type { Definitions } from "../packages/mokly/src/generated/sidecar/Definitions.js";
import type { PageResult } from "../packages/mokly/src/generated/sidecar/PageResult.js";
import type { RenderResult } from "../packages/mokly/src/generated/sidecar/RenderResult.js";

import { startSidecar } from "./helpers/sidecar.js";
import {
  callbackConsumer,
  callbackEntry,
  describeCallbacks,
} from "./helpers/sidecar_callbacks.js";

const source = `
const choices=['Before'];
const supplied={label:'Saved',nested:{text:'Nested'},choices};
const variant={...supplied,label:'Variant'};
const schema={type:'object',additionalProperties:false,required:['label','nested','choices'],properties:{
  label:{type:'string'},nested:{type:'object',additionalProperties:false,required:['text'],properties:{text:{type:'string'}}},
  choices:{type:'array',items:{type:'string',enum:choices}}}};
export const leaf=defineComponent({...metadata,path:'leaf',title:'Leaf',propSchema:schema,props:supplied,
  variants:[{slug:'saved',title:'Saved',props:variant}],
  render:props=>{const before=props.label+'|'+props.nested.text+'|'+props.choices[0];
    props.label='Mutated';props.nested.text='Mutated';props.choices[0]='Mutated';return <b>{before}</b>;}});
export const holder=defineComponent({...metadata,path:'holder',title:'Holder',
  propSchema:{type:'object',additionalProperties:false,properties:{}},slots:['children'],
  render:props=><section>{props.children}{props.children}</section>});
export const screen=defineScreen({...metadata,path:'screen',title:'Screen',
  render:()=> <holder.Component><leaf.Component {...supplied}/></holder.Component>});
export const probe=definePage({...metadata,path:'probe',title:'Probe',
  render:()=> '<!doctype html><html><head></head><body><pre>'+JSON.stringify({supplied,variant,schema})+'</pre></body></html>'});
`;

test(
  "adapter mutation cannot change captured props, schema aliases, or the next saved render",
  { timeout: 120_000 },
  async (context) => {
    const root = await callbackConsumer(context, source);
    const sidecar = startSidecar(context, root);
    await sidecar.call("hello");
    const { generation, definitions } = await describeCallbacks(sidecar, root);
    const leaf = definitions.components.find(
      (item) => item.handle === `${callbackEntry}#leaf`,
    )!;
    const expectedProps = {
      label: "Saved",
      nested: { text: "Nested" },
      choices: ["Before"],
    };
    const expectedVariant = { ...expectedProps, label: "Variant" };
    assert.deepEqual(leaf.props, expectedProps);
    assert.deepEqual(leaf.variants[0]!.props, expectedVariant);
    const params = {
      generation,
      handle: `${callbackEntry}#screen`,
      entry: { path: "screen", title: "Screen" },
      props: {},
      viewport: "mobile",
      colorScheme: "light",
    };
    const first = await sidecar.call<RenderResult>("renderScreen", params);
    const instances = first.instances.filter(
      (instance) => instance.componentPath === "leaf",
    );
    assert.equal(instances.length, 2);
    assert.equal(instances[0]!.key, instances[1]!.key);
    assert.equal(instances[0]!.propsKey, instances[1]!.propsKey);
    for (const instance of instances)
      assert.deepEqual(instance.props, {
        label: ["string", "Saved"],
        nested: ["object", [["text", ["string", "Nested"]]]],
        choices: ["array", [["string", "Before"]]],
      });
    assert.equal(
      first.html.match(/<b>Saved\|Nested\|Before<\/b>/gu)?.length,
      2,
    );
    assert.deepEqual(
      await sidecar.call<RenderResult>("renderScreen", params),
      first,
    );
    const saved = {
      ...params,
      handle: leaf.handle,
      entry: { path: "leaf/saved", title: "Saved" },
      props: { ...leaf.props, ...leaf.variants[0]!.props },
      slots: {},
      ignoreScope: "enabled",
    };
    const firstSaved = await sidecar.call<RenderResult>(
      "renderComponent",
      saved,
    );
    assert.match(firstSaved.html, /<b>Variant\|Nested\|Before<\/b>/u);
    assert.deepEqual(
      await sidecar.call<RenderResult>("renderComponent", saved),
      firstSaved,
    );
    assert.deepEqual(
      await sidecar.call<Definitions>("describe", { generation }),
      definitions,
    );
    const probe = await sidecar.call<PageResult>("renderPage", {
      generation,
      handle: `${callbackEntry}#probe`,
    });
    assert.deepEqual(JSON.parse(probe.html.match(/<pre>(.*?)<\/pre>/u)![1]!), {
      supplied: expectedProps,
      variant: expectedVariant,
      schema: leaf.propSchema,
    });
    await sidecar.call("shutdown");
  },
);

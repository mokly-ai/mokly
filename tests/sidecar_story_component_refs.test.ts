import assert from "node:assert/strict";
import test from "node:test";

import {
  storyMetas,
  storyUseFixture,
  withoutUsageMarkers,
} from "./helpers/story_use_render.js";

const components = `
import React, { createRef, forwardRef, memo } from "react";
export const ObjectRef = createRef();
export const CallbackRef = () => {};
function renderBody({ label, children }, ref) {
  const kind = ref === ObjectRef ? "object" : ref === CallbackRef ? "callback" : "other";
  return <b data-ref={kind}>{label}{children}</b>;
}
export const Forward = forwardRef((props, ref) => renderBody(props, ref));
export const MemoForward = memo(forwardRef(function Render(props, ref) {
  return renderBody(props, ref);
}));
export function Box({ children }) { return <section>{children}</section>; }
export function Recreate({ children }) {
  const child = React.Children.only(children);
  return <section><Forward key="copy" {...child.props} /></section>;
}
export class ClassView extends React.Component {
  render() { return <b>{this.props.children}</b>; }
}
export class FieldClass extends React.Component {
  render = () => <b>{this.props.children}</b>;
}
`;

const screen = `
import { cloneElement } from "react";
import { defineScreen } from "@mokly/mokly";
import { Box, CallbackRef, ClassView, FieldClass, Forward, MemoForward, ObjectRef, Recreate } from "./refs.js";
const saved = <Forward ref={ObjectRef} key="saved" label="Saved"><i>Saved child</i></Forward>;
const cases = {
  matched: () => <>
    <Forward ref={ObjectRef} key="repeat" label="First"><i key="icon">First child</i></Forward>
    <Forward ref={CallbackRef} key="repeat" label="Second"><i>Second child</i></Forward>
    <MemoForward ref={ObjectRef} key="repeat" label="Third"><i>Third child</i></MemoForward>
    <MemoForward ref={CallbackRef} key="repeat" label="Fourth"><i>Fourth child</i></MemoForward>
    {saved}
  </>,
  ambiguous: () => {
    const children = <i>Shared child</i>;
    return <>
      <Forward ref={ObjectRef} key="first" label="Shared">{children}</Forward>
      <Forward ref={ObjectRef} key="second" label="Shared">{children}</Forward>
    </>;
  },
  unmatched: () => {
    const element = <MemoForward ref={CallbackRef} evidence={{ id: "value" }} label="Clone" />;
    return cloneElement(element, { evidence: { id: "value" } });
  },
  projected: () => <Box><Forward ref={ObjectRef}><i>Nested child</i></Forward></Box>,
  projectedSaved: () => <Box>{saved}</Box>,
  recreated: () => <Recreate><Forward ref={CallbackRef}><i>Recreated child</i></Forward></Recreate>,
  ambiguousProjected: () => {
    const props = { ref: ObjectRef, children: <i>Shared child</i> };
    return <Box><Forward key="first" {...props} /><Forward key="second" {...props} /></Box>;
  },
  classes: () => <>
    <ClassView ref={ObjectRef}><i>Class child</i></ClassView>
    <FieldClass ref={CallbackRef}><i>Field class child</i></FieldClass>
  </>,
};
export default defineScreen({
  title: "Explicit refs", description: "", relatedDocs: [],
  render({ scenario }) { return cases[scenario](); },
});
`;

const matched = {
  instances: [
    ["Forward-repeat", false],
    ["Forward-repeat-2", true],
    ["MemoForward-repeat", false],
    ["MemoForward-repeat-2", true],
    ["Forward-saved", false],
  ],
  slots: [
    ["Forward-repeat", "children-icon", 1],
    ["Forward-repeat-2", "children-0", 1],
    ["MemoForward-repeat", "children-0", 1],
    ["MemoForward-repeat-2", "children-0", 1],
    ["Forward-saved", "children-0", 1],
  ],
  refs: ["object", "callback", "object", "callback", "object"],
};

for (const vite of [false, true]) {
  test(`${vite ? "Vite" : "esbuild"} records only uniquely matched forwardRef uses with explicit refs`, async (context) => {
    const fixture = await storyUseFixture(context, {
      "refs.tsx": components,
      "screen.mockup.tsx": screen,
      ...storyMetas("./refs.js", [
        "Box",
        "Forward",
        "MemoForward",
        "Recreate",
        "ClassView",
        "FieldClass",
      ]),
    });
    const plain = await fixture.compile(vite, false);
    const recorded = await fixture.compile(vite);
    for (const [scenario, expected] of [
      ["matched", matched],
      ["ambiguous", { instances: [], slots: [], refs: ["object", "object"] }],
      ["unmatched", { instances: [], slots: [], refs: ["callback"] }],
      [
        "projected",
        {
          instances: [
            ["Box", false],
            ["Forward", false],
          ],
          slots: [
            ["Box", "children-0", 1],
            ["Forward", "children-0", 1],
          ],
          nested: [["Forward", "entry", "children-0"]],
          refs: ["object"],
        },
      ],
      [
        "projectedSaved",
        {
          instances: [
            ["Box", false],
            ["Forward-saved", false],
          ],
          slots: [
            ["Box", "children-saved", 1],
            ["Forward-saved", "children-0", 1],
          ],
          nested: [["Forward-saved", "entry", "children-saved"]],
          refs: ["object"],
        },
      ],
      [
        "recreated",
        {
          instances: [
            ["Recreate", false],
            ["Forward-copy", false],
          ],
          slots: [
            ["Recreate", "children-0", 1],
            ["Forward-copy", "children-0", 1],
          ],
          nested: [["Forward-copy", "entry", "children-0"]],
          refs: ["callback"],
        },
      ],
      [
        "ambiguousProjected",
        {
          instances: [["Box", false]],
          slots: [
            ["Box", "children-first", 0],
            ["Box", "children-second", 0],
          ],
          refs: ["object", "object"],
        },
      ],
      ["classes", { instances: [], slots: [], refs: [] }],
      ["matched", matched],
    ] as const) {
      const props = { scenario };
      const result = await recorded.screen(props);
      const original = await plain.screen(props);
      const html = withoutUsageMarkers(result.html);
      assert.equal(html, original.html, scenario);
      assert.deepEqual(
        [...html.matchAll(/data-ref="([^"]*)"/gu)].map((match) => match[1]),
        expected.refs,
        scenario,
      );
      assert.deepEqual(
        result.instances.map(({ id, numbered = false }) => [id, numbered]),
        expected.instances,
        scenario,
      );
      const ids = new Map(result.instances.map(({ key, id }) => [key, id]));
      assert.deepEqual(
        result.slots.map(({ instanceKey, name, regionIds }) => [
          ids.get(instanceKey),
          name,
          regionIds.length,
        ]),
        expected.slots,
        scenario,
      );
      const slots = new Map(result.slots.map(({ key, name }) => [key, name]));
      assert.deepEqual(
        result.instances.flatMap(({ id, owner, slotKey }) =>
          slotKey ? [[id, owner.kind, slots.get(slotKey)]] : [],
        ),
        "nested" in expected ? expected.nested : [],
        scenario,
      );
    }
  });
}

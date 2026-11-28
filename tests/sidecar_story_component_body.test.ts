import assert from "node:assert/strict";
import test from "node:test";

import {
  storyMetas,
  storyUseFixture,
  withoutUsageMarkers,
} from "./helpers/story_use_render.js";

const components = `
import React, { useId, useState } from "react";
import { createPortal } from "react-dom";
import styled from "styled-components";
const styledBody = styled.p\`color: rgb(31, 47, 63);\`;
export const Tagged = styled.p\`font-weight: 700;\`;
export function StyledBody() {
  return styledBody.render({ children: "Styled in the body" }, null);
}
export function Hooks({ label }) {
  const [count, setCount] = useState(0);
  const id = useId();
  if (count < 2) setCount(count + 1);
  return <p id={id}>{label}:{count}</p>;
}
export function Boom() { throw new Error("product throw"); }
export function Portal() { return createPortal(<p>Portal</p>, { nodeType: 1 }); }
export class Boundary extends React.Component {
  static getDerivedStateFromError() { return { caught: true }; }
  state = { caught: false };
  render() { return this.state.caught ? <p>Caught</p> : this.props.children; }
}
`;

const screen = `
import { defineScreen } from "@mokly/mokly";
import { Boundary, Boom, Hooks, Portal, StyledBody, Tagged } from "./body.js";
const cases = {
  hooks: () => <main><span>Start</span><Hooks label="Count" /><span>End</span></main>,
  styles: () => <StyledBody />,
  tagged: () => <Tagged>Tagged</Tagged>,
  portal: () => <Portal />,
  boundary: () => <Boundary><Boom /></Boundary>,
};
export default defineScreen({
  title: "Body", description: "", relatedDocs: [],
  render({ scenario }) { return cases[scenario](); },
});
`;

for (const vite of [false, true]) {
  test(`${vite ? "Vite" : "esbuild"} keeps hooks, style owners, and product errors in component bodies`, async (context) => {
    const fixture = await storyUseFixture(context, {
      "body.tsx": components,
      "screen.mockup.tsx": screen,
      ...storyMetas("./body.js", [
        "Hooks",
        "StyledBody",
        "Boom",
        "Portal",
        "Boundary",
        "Tagged",
      ]),
      "Errors.stories.tsx": `import { Boundary, Boom } from "./body.js";
        export default { title: "Errors" };
        export const Fails = { render: () => <Boundary><Boom /></Boundary> };`,
    });
    const plain = await fixture.compile(vite, false);
    const recorded = await fixture.compile(vite);
    const hooks = await recorded.screen({ scenario: "hooks" });
    assert.match(hooks.html, />Count:2<\/p>/u);
    assert.equal(
      withoutUsageMarkers(hooks.html),
      (await plain.screen({ scenario: "hooks" })).html,
    );
    assert.deepEqual(
      hooks.instances.map(({ id }) => id),
      ["Hooks"],
    );
    assert.deepEqual(
      hooks.markers.map(({ payload }) => payload.kind),
      ["instance"],
    );
    const styles = await recorded.screen({ scenario: "styles" });
    const original = await plain.screen({ scenario: "styles" });
    assert.equal(withoutUsageMarkers(styles.html), original.html);
    assert.deepEqual(
      styles.styles.map(({ css }) => css),
      original.styles.map(({ css }) => css),
    );
    assert.deepEqual(
      styles.styles
        .flatMap(({ attribution }) => attribution ?? [])
        .filter(({ css }) => css.includes("rgb(31, 47, 63)"))
        .map(({ owners }) => owners),
      [["StyledBody"]],
    );
    const tagged = await recorded.screen({ scenario: "tagged" });
    assert.equal(
      withoutUsageMarkers(tagged.html),
      (await plain.screen({ scenario: "tagged" })).html,
    );
    assert.deepEqual(
      tagged.instances.map(({ id }) => id),
      ["Tagged"],
    );
    for (const compiler of [plain, recorded]) {
      await assert.rejects(compiler.screen({ scenario: "portal" }), {
        code: "render-failed",
        message: /Portals are not currently supported/u,
      });
      await assert.rejects(compiler.screen({ scenario: "boundary" }), {
        code: "render-failed",
        message: /product throw/u,
      });
    }
    assert.deepEqual(await recorded.story("Errors.stories.tsx#Fails"), {
      storyId: "Errors.stories.tsx#Fails",
      name: "Fails",
      reason: "product throw",
    });
  });
}

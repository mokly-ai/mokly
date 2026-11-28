import assert from "node:assert/strict";
import test from "node:test";

import {
  storyUseFixture,
  withoutUsageMarkers,
} from "./helpers/story_use_render.js";

const components = `
import { Children } from "react";
import { Slottable } from "@radix-ui/react-slot";

function select(children, type, filter) {
  const elements = Children.toArray(children);
  const matches = elements.filter((child) => child.type === type);
  return <nav data-matches={matches.length}>{filter ? matches : elements}</nav>;
}

export function Tabs({ children, filter }) {
  return select(children, "a", filter);
}
export function InstalledTabs({ children, filter }) {
  return select(children, Slottable, filter);
}
`;

const screen = `
import { Slottable } from "@radix-ui/react-slot";
import { defineScreen } from "@mokly/mokly";
import { InstalledTabs, Tabs } from "./Tabs.js";

export default defineScreen({
  title: "Types", description: "", relatedDocs: [],
  render({ filter }) {
    return <>
      <Tabs filter={filter} icon={<i />} data={{ icon: <i /> }}><a href="/docs">Docs</a></Tabs>
      <InstalledTabs filter={filter}><Slottable><b>Installed</b></Slottable></InstalledTabs>
    </>;
  },
});
`;

function metas(disabled: boolean) {
  return {
    ...(disabled
      ? {
          ".storybook/preview.ts": `export default { parameters: { mokly: { contentSlots: false } } };`,
          "a/ZTabs.stories.tsx": `import { Tabs } from "../Tabs.js";
            export default { title: "Alias", component: Tabs, parameters: { mokly: { contentSlots: true } } };
            export const Main = { render: () => <Tabs /> };`,
        }
      : {}),
    "InstalledTabs.stories.tsx": `import { InstalledTabs } from "./Tabs.js";
      export default { title: "InstalledTabs", component: InstalledTabs };
      export const Main = { render: () => <InstalledTabs /> };`,
    "z/Tabs.stories.tsx": `import { Tabs } from "../Tabs.js";
      export default { title: "Tabs", component: Tabs ${disabled ? ", parameters: { mokly: { contentSlots: true } }" : ""} };
      export const Main = { render: () => <Tabs /> ${disabled ? ", parameters: { mokly: { contentSlots: false } }" : ""} };
      export const Later = { render: () => <Tabs />, parameters: { mokly: { contentSlots: ${!disabled ? "false" : "true"} } } };`,
  };
}

for (const vite of [false, true]) {
  test(`${vite ? "Vite" : "esbuild"} contentSlots preserves supplied element types and selects the first entry path`, async (context) => {
    const files = { "Tabs.tsx": components, "screen.mockup.tsx": screen };
    const disabled = await storyUseFixture(context, {
      ...files,
      ...metas(true),
    });
    const plain = await disabled.compile(vite, false);
    const recorded = await disabled.compile(vite);
    const off = await recorded.screen({ filter: true });
    assert.equal(
      withoutUsageMarkers(off.html),
      '<nav data-matches="1"><a href="/docs">Docs</a></nav><nav data-matches="1"><b>Installed</b></nav>',
    );
    assert.equal(
      withoutUsageMarkers(off.html),
      (await plain.screen({ filter: true })).html,
    );
    assert.deepEqual(
      off.instances.map(({ id, componentPath }) => [id, componentPath]),
      [
        ["Tabs", "Tabs"],
        ["InstalledTabs", "InstalledTabs"],
      ],
    );
    assert.deepEqual(off.slots, []);
    assert.deepEqual(off.instances[0]?.props, {
      data: ["object", [["icon", ["string", "mokly:element"]]]],
      filter: ["boolean", true],
    });

    const defaults = await storyUseFixture(context, {
      ...files,
      ...metas(false),
    });
    const on = await (await defaults.compile(vite)).screen({ filter: false });
    assert.equal(
      withoutUsageMarkers(on.html),
      '<nav data-matches="0"><a href="/docs">Docs</a></nav><nav data-matches="0"><b>Installed</b></nav>',
    );
    assert.deepEqual(
      on.slots
        .map(({ name, regionIds }) => [name, regionIds.length])
        .toSorted(),
      [
        ["children-0", 1],
        ["children-0", 1],
        ["data-icon", 0],
        ["icon-0", 0],
      ],
    );
  });
}

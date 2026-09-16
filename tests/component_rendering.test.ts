import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import { checkCompilation } from "../dist/build/check.js";
import { compileCatalogue } from "../dist/build/compile.js";
import { writeCompilation } from "../dist/build/transaction.js";
import { validateComponentRanges } from "../dist/components/ranges.js";
import { loadConfig } from "../dist/config/load.js";
import { decodeProps } from "../packages/viewer/dist/components/codec.js";

import { componentEntrySource } from "./helpers/component_fixture.js";
import { createFixture, removeFixture } from "./helpers/fixture.js";

const renderer = `import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
export default function render(input) {
  const css = '.action{border-radius:12px}';
  const html = '<!doctype html><html><head><style>' + css + '</style></head><body>' + renderToStaticMarkup(input.node) + '</body></html>';
  return { html, styles: [{ startOffset: html.indexOf(css), endOffset: html.indexOf(css) + css.length, componentIds: ["action"] }], resources: [{ path: "action.css", componentIds: ["action"] }] };
}`;

test("component style ownership rebases through generated headers while preserving rendered CSS", async (t) => {
  const fixture = await createFixture(componentEntrySource(), {
    extraConfig: 'renderer: "renderer.tsx",',
  });
  t.after(() => removeFixture(fixture));
  await fs.writeFile(path.join(fixture.root, "renderer.tsx"), renderer);
  await fs.writeFile(
    path.join(fixture.mockupsDir, "action.css"),
    ".action{color:green}",
  );
  const config = await loadConfig(fixture.root);
  const result = await compileCatalogue(config);
  const screen = result.manifest.entries.find(
    (entry) => entry.kind === "screen",
  )!;
  const view = screen.componentViews![0]!;
  const html = result.outputs.get(screen.fragments.mobile)!;
  assert.equal(
    html.slice(view.styles[0]!.startOffset, view.styles[0]!.endOffset),
    ".action{border-radius:12px}",
  );
  assert.deepEqual(view.resources, [
    { path: "action.css", componentIds: ["action"] },
  ]);
  await writeCompilation(result, config);
  checkCompilation(await compileCatalogue(config), config);
  await fs.writeFile(
    path.join(fixture.root, "renderer.tsx"),
    renderer.replace('componentIds: ["action"]', 'componentIds: ["unknown"]'),
  );
  await assert.rejects(compileCatalogue(config), /owners must render/);
  assert.equal(
    await fs.readFile(
      path.join(fixture.mockupsDir, screen.fragments.mobile),
      "utf8",
    ),
    html,
  );
});

test("slot forwarding preserves its original caller and scope through an intermediate component", async (t) => {
  const source = componentEntrySource({
    extra: `const forward = defineComponent({ ...metadata, id: "forward", title: "Forward", description: "Forwarded content", route: "components/forward.html", propSchema: { kind: "object", properties: {} }, slots: ["children"], render: (props) => <pane.Component>{props.children}</pane.Component>, variants: [{ id: "default", title: "Default", props: { children: <strong>Saved</strong> } }] });`,
    exports: "action.entry, pane.entry, forward.entry,",
    body: '<forward.Component><action.Component label="Screen slot" /></forward.Component>',
  });
  const fixture = await createFixture(source);
  t.after(() => removeFixture(fixture));
  const result = await compileCatalogue(await loadConfig(fixture.root));
  const screen = result.manifest.entries.find(
    (entry) => entry.kind === "screen",
  )!;
  const view = screen.componentViews![0]!;
  const forwarded = view.slots.find((slot) => slot.sourceSlotKey)!;
  assert.deepEqual(forwarded.owner, { kind: "entry" });
  const child = view.instances.find((instance) => instance.slotKey)!;
  assert.equal(child.slotKey, forwarded.sourceSlotKey);
  assert.deepEqual(child.owner, { kind: "entry" });
  assert.deepEqual(decodeProps(child.props), { label: "Screen slot" });
});

test("component boundaries support multi-root text and reject removed or physically reparented records", async (t) => {
  const fixture = await createFixture(
    componentEntrySource({
      actionRender:
        "(props) => <>Prefix<strong>{props.label}</strong>Suffix</>",
    }),
  );
  t.after(() => removeFixture(fixture));
  const result = await compileCatalogue(await loadConfig(fixture.root));
  const screen = result.manifest.entries.find(
    (entry) => entry.kind === "screen",
  )!;
  const view = screen.componentViews![0]!;
  const html = result.outputs.get(screen.fragments.mobile)!;
  const ranges = validateComponentRanges(html, view.ranges);
  assert.ok(
    ranges.some((range) =>
      /Prefix<strong>.*<\/strong>Suffix/.test(
        html.slice(range.contentStart, range.contentEnd),
      ),
    ),
  );
  assert.throws(
    () =>
      validateComponentRanges(
        html.replace("<!--mokly-component:end:r-0-->", ""),
        view.ranges,
      ),
    /component boundar/,
  );
  const moved = structuredClone(view.ranges);
  Object.assign(moved[1]!, { parentId: undefined });
  assert.throws(() => validateComponentRanges(html, moved), /moved/);
});

test("renderer mutations cannot change captured props or the next saved render", async (t) => {
  const fixture = await createFixture(
    componentEntrySource({
      actionRender:
        '(props) => { const before = props.label; props.label = "Mutated"; return <button>{before}</button>; }',
    }),
  );
  t.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const first = await compileCatalogue(config);
  const second = await compileCatalogue(config);
  assert.deepEqual(first, second);
  const action = first.manifest.entries.find(
    (entry) => entry.kind === "component" && entry.id === "action",
  )!;
  assert.ok(action.kind === "component");
  assert.deepEqual(decodeProps(action.variants[0]!.props), {
    label: "Continue",
  });
  const screen = first.manifest.entries.find(
    (entry) => entry.kind === "screen",
  )!;
  assert.ok(
    screen
      .componentViews![0]!.instances.filter(
        (instance) => instance.componentId === "action",
      )
      .every((instance) => decodeProps(instance.props).label !== "Mutated"),
  );
});

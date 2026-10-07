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
import { viewRoute } from "../packages/viewer/dist/data.js";

import { componentEntrySource } from "./helpers/component_fixture.js";
import { createFixture, removeFixture } from "./helpers/fixture.js";
import { textOutput } from "./helpers/generated_text.js";

const renderer = `import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
export default function render(input) {
  const css = '.action{border-radius:12px}';
  const html = '<!doctype html><html><head><style>' + css + '</style></head><body>' + renderToStaticMarkup(input.node) + '</body></html>';
  return html;
}`;

test("component render keeps head styles without manifest ownership records", async (t) => {
  const fixture = await createFixture(componentEntrySource(), {
    extraConfig: 'renderer: "renderer.tsx",',
  });
  t.after(() => removeFixture(fixture));
  await fs.writeFile(path.join(fixture.root, "renderer.tsx"), renderer);
  const config = await loadConfig(fixture.root);
  const result = await compileCatalogue(config);
  const screen = result.manifest.entries.find(
    (entry) => entry.kind === "screen",
  )!;
  const view = screen.componentViews![0]!;
  const mobileView = viewRoute(screen.path, "mobile", "light");
  const html = textOutput(result.outputs, mobileView)!;
  assert.match(html, /\.action\{border-radius:12px\}/);
  assert.deepEqual(Object.keys(view).sort(), [
    "colorScheme",
    "instances",
    "ranges",
    "slots",
    "viewport",
  ]);
  await writeCompilation(result, config);
  checkCompilation(await compileCatalogue(config), config);
  await fs.writeFile(
    path.join(fixture.root, "renderer.tsx"),
    renderer.replace(
      "return html;",
      'return { html, styles: [{ startOffset: 0, endOffset: 10, componentIds: ["unknown"] }] };',
    ),
  );
  await assert.rejects(
    compileCatalogue(config),
    /renderer must return a string/,
  );
  assert.equal(
    await fs.readFile(path.join(config.generatedDir, mobileView), "utf8"),
    html,
  );
});

test("slot forwarding preserves its original caller and scope through an intermediate component", async (t) => {
  const source = componentEntrySource({
    extra: `const forward = defineComponent({ ...metadata, path: "forward", title: "Forward", description: "Forwarded content", propSchema: { kind: "object", properties: {} }, slots: ["children"], render: (props) => <pane.Component>{props.children}</pane.Component>, variants: [{ slug: "default",  title: "Default", props: { children: <strong>Saved</strong> } }] });`,
    exports: "...action.entries, ...pane.entries, ...forward.entries,",
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
  const html = textOutput(
    result.outputs,
    viewRoute(screen.path, "mobile", "light"),
  )!;
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
    (entry) => entry.kind === "component" && entry.path === "action/default",
  )!;
  assert.ok(action.kind === "component" && "variantOf" in action);
  if (action.kind !== "component" || !("variantOf" in action))
    throw new Error("Missing action variant");
  assert.deepEqual(decodeProps(action.props), {
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

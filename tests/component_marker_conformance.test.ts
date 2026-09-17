import assert from "node:assert/strict";
import { test } from "node:test";

import { parse, type DefaultTreeAdapterMap } from "parse5";

import { compileCatalogue } from "../dist/build/compile.js";
import { loadConfig } from "../dist/config/load.js";
import type { ComponentViewRecord } from "../packages/viewer/dist/components/manifest_types.js";

import { componentEntrySource } from "./helpers/component_fixture.js";
import { createFixture, removeFixture } from "./helpers/fixture.js";

function assertMarkers(html: string, view: ComponentViewRecord): void {
  const starts: string[] = [];
  const ends: string[] = [];
  const stack: string[] = [];
  const ranges = new Map(view.ranges.map((record) => [record.id, record]));
  const contents = new Map<string, { start: number; end?: number }>();
  function visit(node: DefaultTreeAdapterMap["node"]): void {
    if ("attrs" in node)
      assert.ok(
        node.attrs.every(
          (attr) => !attr.name.startsWith("data-mokly-component-"),
        ),
      );
    if (
      node.nodeName === "#comment" &&
      "data" in node &&
      node.data.startsWith("mokly-component:")
    ) {
      const match = /^mokly-component:(start|end):(r-[0-9]+)$/.exec(node.data);
      assert.ok(match);
      const id = match[2]!;
      const record = ranges.get(id);
      assert.ok(record, `unrecorded marker ${id}`);
      const location = node.sourceCodeLocation!;
      if (match[1] === "start") {
        assert.equal(record.parentId, stack.at(-1));
        starts.push(id);
        stack.push(id);
        contents.set(id, { start: location.endOffset });
      } else {
        assert.equal(stack.pop(), id);
        ends.push(id);
        contents.get(id)!.end = location.startOffset;
      }
    }
    if ("childNodes" in node) node.childNodes.forEach(visit);
    if ("content" in node) visit(node.content);
  }
  visit(parse(html, { sourceCodeLocationInfo: true }));
  assert.deepEqual(stack, []);
  assert.deepEqual(
    starts,
    view.ranges.map((range) => range.id),
  );
  assert.deepEqual([...ends].sort(), [...starts].sort());
  assert.equal(new Set(starts).size, starts.length);
  assert.equal(new Set(ends).size, ends.length);
  for (const instance of view.instances) {
    const placements = view.ranges.filter(
      (range) =>
        range.target.kind === "instance" &&
        range.target.instanceKey === instance.key,
    );
    assert.ok(placements.length >= 1, `${instance.id} has no range`);
    for (const placement of placements) {
      const { start, end } = contents.get(placement.id)!;
      assert.ok(end !== undefined);
      if (instance.id === "hidden") assert.equal(start, end);
      if (instance.componentId === "action" && instance.id !== "hidden")
        assert.match(
          html.slice(start, end),
          /^Prefix<strong>.*<\/strong>Suffix$/,
        );
    }
    if (instance.id === "slotted") assert.equal(placements.length, 2);
  }
}

test("each recorded range in every screen/variant view has exactly one matched pair, including replay, null, nested and multi-root output", async (t) => {
  const fixture = await createFixture(
    componentEntrySource({
      actionRender:
        "(props) => props.hidden ? null : <>Prefix<strong>{props.label}</strong>Suffix</>",
      paneRender:
        '(props) => <section>{props.children}<aside>{props.children}</aside><action.Component label="Nested" /></section>',
      body: '<pane.Component><action.Component moklyInstance="slotted" label="Slot" /><action.Component moklyInstance="hidden" label="Empty" hidden /></pane.Component><action.Component label="Root" />',
    }),
    { extraConfig: 'colorSchemes: ["light", "dark"],' },
  );
  t.after(() => removeFixture(fixture));
  const compilation = await compileCatalogue(await loadConfig(fixture.root));
  let count = 0;
  for (const entry of compilation.manifest.entries) {
    const targets =
      entry.kind === "screen"
        ? [entry]
        : entry.kind === "component"
          ? entry.variants
          : [];
    for (const target of targets)
      for (const view of target.componentViews ?? []) {
        const route = (
          view.colorScheme === "dark" ? target.darkFragments! : target.fragments
        )[view.viewport];
        assertMarkers(compilation.outputs.get(route)!, view);
        count++;
      }
  }
  assert.equal(count, 16);
});

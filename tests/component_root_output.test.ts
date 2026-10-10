import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { validateComponentRanges } from "../dist/components/ranges.js";
import { loadConfig } from "../dist/config/load.js";
import {
  generatedViews,
  validateComponentViewRecord,
} from "../packages/viewer/dist/data.js";

import { componentEntrySource } from "./helpers/component_fixture.js";
import { createFixture, removeFixture } from "./helpers/fixture.js";
import { textOutput } from "./helpers/generated_text.js";

for (const render of [
  "(props) => <><button>{props.label}</button><span>Tail</span></>",
  "() => null",
  '() => "Text only"',
])
  test(`saved component roots enclose only their render output: ${render}`, async (t) => {
    const fixture = await createFixture(
      componentEntrySource({ actionRender: render }),
      {
        extraConfig: 'renderer: "renderer.tsx",',
      },
    );
    t.after(() => removeFixture(fixture));
    await fs.writeFile(
      path.join(fixture.root, "renderer.tsx"),
      `import { renderToStaticMarkup } from "react-dom/server";
export default (input) => '<html><head></head><body><main class="frame">' + renderToStaticMarkup(input.node) + '</main></body></html>';`,
    );
    const result = await compileCatalogue(await loadConfig(fixture.root));
    for (const entry of result.manifest.entries) {
      for (const view of generatedViews(entry)) {
        const html = textOutput(result.outputs, view.path)!;
        const ranges = validateComponentRanges(html, view.usage?.ranges ?? []);
        const roots = ranges.filter(
          (range) => range.record.target.kind === "root",
        );
        assert.equal(roots.length, entry.kind === "component" ? 1 : 0);
        if (entry.kind !== "component") continue;
        const root = roots[0]!;
        assert.equal(root.record.parentId, undefined);
        assert.ok(root.start > html.indexOf('<main class="frame">'));
        assert.ok(root.end <= html.lastIndexOf("</main>"));
        assert.ok(
          !view.usage!.instances.some(
            (instance) =>
              instance.componentId === "action" &&
              entry.path.startsWith("action/"),
          ),
        );
        for (const range of ranges.filter(
          (range) => range.record.id !== root.record.id,
        ))
          assert.ok(range.start > root.start && range.end < root.end);
      }
    }
  });

test("root-only Review-ignore remains valid and does not create an instance", async (t) => {
  const fixture = await createFixture(
    componentEntrySource({
      exports: "...action.entries,",
      body: '<action.Component label="Go" />',
    }),
    {
      extraConfig: 'renderer: "renderer.tsx",',
    },
  );
  t.after(() => removeFixture(fixture));
  await fs.writeFile(
    path.join(fixture.root, "renderer.tsx"),
    `import { renderToStaticMarkup } from "react-dom/server";
export default (input) => '<html><head></head><body>' + (input.entry.kind === 'component' ? '<!--mokly-review-ignore:start:root-->' : '') + renderToStaticMarkup(input.node) + (input.entry.kind === 'component' ? '<!--mokly-review-ignore:end:root-->' : '') + '</body></html>';`,
  );
  const result = await compileCatalogue(await loadConfig(fixture.root));
  const view = generatedViews(
    result.manifest.entries.find((entry) => entry.path === "action/default")!,
  )[0]!;
  assert.deepEqual(
    view.usage!.ranges.map((range) => range.target),
    [{ kind: "root" }],
  );
  assert.deepEqual(view.usage!.instances, []);
});

test("current root validation requires one unparented root only on saved component views", () => {
  const empty = {
    viewport: "mobile" as const,
    colorScheme: "light" as const,
    instances: [],
    slots: [],
    ranges: [],
    styles: [],
    resources: [],
  };
  assert.throws(
    () =>
      validateComponentViewRecord(empty, new Map(), "saved", {
        rootId: "action",
      }),
    /root/,
  );
  const root = { id: "r-0", target: { kind: "root" as const } };
  assert.doesNotThrow(() =>
    validateComponentViewRecord(
      { ...empty, ranges: [root] },
      new Map(),
      "saved",
      { rootId: "action" },
    ),
  );
  assert.throws(
    () =>
      validateComponentViewRecord(
        { ...empty, ranges: [root] },
        new Map(),
        "screen",
        {},
      ),
    /root/,
  );
  assert.throws(
    () =>
      validateComponentViewRecord(
        { ...empty, ranges: [root, { ...root, id: "r-1" }] },
        new Map(),
        "saved",
        { rootId: "action" },
      ),
    /root/,
  );
  assert.throws(
    () =>
      validateComponentViewRecord(empty, new Map(), "historical", {
        rootId: "action",
        historicalUsage: true,
      }),
    /root/,
  );
});

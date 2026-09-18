import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { loadConfig } from "../dist/config/load.js";
import { classifyComponents } from "../dist/review/component_classification.js";
import { mayProjectCallerSlotFromTemplate } from "../dist/review/component_fast_path_eligibility.js";
import { generatedViews } from "../packages/viewer/dist/components/views.js";

import { componentEntrySource } from "./helpers/component_fixture.js";
import { createFixture, removeFixture } from "./helpers/fixture.js";

const image = '<img loading="lazy" src="../image.svg" />';
const templateCases = [
  {
    name: "receiver template",
    paneRender: "(props) => <template>{props.children}</template>",
    body: `<pane.Component>${image}</pane.Component>`,
  },
  {
    name: "outer template",
    body: `<template><pane.Component>${image}</pane.Component></template>`,
  },
  {
    name: "forwarded template",
    paneRender:
      "(props) => <template><pane2.Component>{props.children}</pane2.Component></template>",
    body: `<pane.Component>${image}</pane.Component>`,
    extra:
      'const pane2 = defineComponent({ ...metadata, id: "pane2", title: "Pane2", description: "Forwarding receiver", route: "components/pane2.html", propSchema: { kind: "object", properties: {} }, slots: ["children"], render: (props) => <section>{props.children}</section>, variants: [{id: "default", title: "Default", props: {children: <b>Saved</b>}}] });',
    exports: "action.entry, pane.entry, pane2.entry,",
  },
] as const;

for (const templateCase of templateCases)
  for (const generatedOutput of ["committed", "derived"] as const)
    test(`${templateCase.name} caller slots use complete ${generatedOutput} comparison`, async (t) => {
      const fixture = await createFixture(componentEntrySource(templateCase));
      t.after(() => removeFixture(fixture));
      await fs.writeFile(path.join(fixture.mockupsDir, "image.svg"), "image");
      const config = await loadConfig(fixture.root);
      const compilation = await compileCatalogue(config);
      const files = (content: string) => ({
        read: async (route: string) => {
          const value =
            compilation.outputs.get(route) ??
            (route === "image.svg" ? content : undefined);
          assert.notEqual(value, undefined, route);
          return Buffer.from(value!);
        },
        readIfExists: async (route: string) =>
          route === "image.svg" ? Buffer.from(content) : undefined,
      });
      const classify = (useFastPath: boolean) =>
        classifyComponents({
          before: compilation.manifest,
          after: compilation.manifest,
          beforeReader: files("base image"),
          afterReader: files("head image"),
          config: { ...config, generatedOutput },
          changedPaths:
            generatedOutput === "committed" ? ["mockups/image.svg"] : [],
          baseCommit: "a".repeat(40),
          baseRef: "main",
          useFastPath,
        });
      const [optimized, complete] = await Promise.all([
        classify(true),
        classify(false),
      ]);
      assert.deepEqual(optimized, complete);
      const screenChange = optimized.changes.find(
        (change) => change.kind === "screen" && change.after?.id === "home",
      );
      assert.ok(screenChange);
      assert.ok(
        screenChange.reasons.some((reason) =>
          generatedOutput === "committed"
            ? reason.kind === "dependency" &&
              reason.path === "mockups/image.svg"
            : reason.kind === "material",
        ),
      );
    });

test("template-slot eligibility recognizes serialized boundaries and ownership", async (t) => {
  const fixture = await createFixture(componentEntrySource());
  t.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const compilation = await compileCatalogue(config);
  const screen = compilation.manifest.entries.find(
    (entry) => entry.kind === "screen",
  );
  assert.ok(screen);
  const view = generatedViews(screen)[0]!;
  const usage = view.usage;
  const html = compilation.outputs.get(view.path);
  assert.ok(usage);
  assert.ok(usage.slots.some((slot) => slot.owner.kind === "entry"));
  assert.notEqual(html, undefined);
  assert.equal(mayProjectCallerSlotFromTemplate(html!, usage), false);
  for (const source of [
    "<template></template>",
    '<TeMpLaTe   data-kind="nested"><template></template></TeMpLaTe>',
    "<main><template data-unrelated></template><section>slot</section></main>",
  ])
    assert.equal(mayProjectCallerSlotFromTemplate(source, usage), true);
  assert.equal(
    mayProjectCallerSlotFromTemplate("<template></template>", {
      ...usage,
      slots: usage.slots.map((slot) => ({
        ...slot,
        owner: { kind: "instance", instanceKey: slot.instanceKey },
      })),
    }),
    false,
  );
  assert.equal(
    mayProjectCallerSlotFromTemplate("<template></template>", undefined),
    false,
  );
});

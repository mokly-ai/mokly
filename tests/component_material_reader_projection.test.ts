import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { loadConfig } from "../dist/config/load.js";
import { ComponentDependencyPolicy } from "../dist/review/component_metadata.js";
import { prepareComponentProjection } from "../dist/review/component_projection_resources.js";
import { ComponentMaterialReader } from "../dist/review/component_resources.js";
import { compareComponentView } from "../dist/review/component_view.js";
import { ResourceComparison } from "../dist/review/resource_comparison.js";
import { generatedViews } from "../packages/viewer/dist/components/views.js";

import { componentEntrySource } from "./helpers/component_fixture.js";
import { createFixture, removeFixture } from "./helpers/fixture.js";
import { textOutput } from "./helpers/generated_text.js";

test("projected discovery applies root-specific ownership before reading", async (t) => {
  const image = '<img loading="lazy" src="../image.svg" />';
  const source = componentEntrySource({
    paneRender:
      "(props) => <select><pane2.Component>{props.children}</pane2.Component></select>",
    paneVariants: `[{ id: "default", title: "Default", props: { children: ${image} } }]`,
    body: `<pane.Component>${image}</pane.Component>`,
    extra:
      'const pane2 = defineComponent({ ...metadata, id: "pane2", title: "Pane2", description: "Nested receiver", route: "components/pane2.html", propSchema: { kind: "object", properties: {} }, slots: ["children"], render: (props) => <section>{props.children}</section>, variants: [{ id: "default", title: "Default", props: { children: <b>Saved</b> } }] });',
    exports: "action.entry, pane.entry, pane2.entry,",
  }).replace(
    'id: "pane", title:',
    'id: "pane", dependencies: ["mockups/image.svg", "mockups/components/image.svg"], ownedDependencies: ["mockups/image.svg", "mockups/components/image.svg"], title:',
  );
  const fixture = await createFixture(source);
  t.after(() => removeFixture(fixture));
  await fs.writeFile(path.join(fixture.mockupsDir, "image.svg"), "image");
  await fs.mkdir(path.join(fixture.mockupsDir, "components"));
  await fs.writeFile(
    path.join(fixture.mockupsDir, "components/image.svg"),
    "image",
  );
  const config = await loadConfig(fixture.root);
  const compilation = await compileCatalogue(config);
  for (const id of ["home", "pane"] as const) {
    const entry = compilation.manifest.entries.find((item) => item.id === id);
    assert.ok(entry);
    const view = generatedViews(entry)[0];
    assert.ok(view);
    assert.ok(view.usage?.slots.some((slot) => slot.owner.kind === "entry"));
    const reads: string[] = [];
    const materialReader = () =>
      new ComponentMaterialReader({
        read: async (route) => {
          reads.push(route);
          const content =
            textOutput(compilation.outputs, route) ??
            (route.endsWith("image.svg") ? "image" : undefined);
          assert.notEqual(content, undefined, route);
          return Buffer.from(content!);
        },
      });
    const beforeReader = materialReader();
    const afterReader = materialReader();
    const changed = new Set([
      "mockups/image.svg",
      "mockups/components/image.svg",
    ]);
    const context = {
      beforeReader,
      afterReader,
      dependencies: new ComponentDependencyPolicy(
        compilation.manifest,
        compilation.manifest,
        [],
      ),
      changed,
      prefix: "mockups",
      resources: new ResourceComparison(
        beforeReader,
        afterReader,
        changed,
        "mockups",
      ),
    };
    const html = await beforeReader.text(view.path);
    const prepared = prepareComponentProjection(
      context,
      view,
      view,
      html,
      html,
      id === "pane" ? "pane" : undefined,
    );
    assert.match(prepared.projected.before, /image\.svg/u);
    assert.equal(
      prepared.excluded(id === "pane" ? "components/image.svg" : "image.svg"),
      id === "home",
    );
    const comparison = await compareComponentView(
      context,
      view,
      view,
      id === "pane" ? "pane" : undefined,
    );
    const imageReads = reads.filter((route) => route.endsWith("image.svg"));
    if (id === "home") assert.deepEqual(imageReads, []);
    else {
      assert.ok(imageReads.length > 0);
      assert.ok(
        comparison.reasons.some(
          (reason) =>
            reason.kind === "dependency" &&
            reason.path === "mockups/components/image.svg",
        ),
      );
    }
  }
});

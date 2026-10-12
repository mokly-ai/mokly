import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { loadConfig } from "../dist/config/load.js";
import { prepareComponentProjection } from "../dist/review/component_projection_resources.js";
import { ComponentMaterialReader } from "../dist/review/component_resources.js";
import { compareComponentView } from "../dist/review/component_view.js";
import { catalogueLinkNormalizer } from "../dist/review/moves/links.js";
import { ResourceComparison } from "../dist/review/resource_comparison.js";
import { reviewViews as generatedViews } from "../dist/review/views.js";

import { componentEntrySource } from "./helpers/component_fixture.js";
import { createFixture, removeFixture } from "./helpers/fixture.js";
import { textOutput } from "./helpers/generated_text.js";

for (const receiver of ["template", "select"] as const)
  test(`full comparison applies root-specific ownership before reading projected ${receiver} copies`, async (t) => {
    const image = '<img loading="lazy" src="../../image.svg" />';
    const componentImage =
      '<img loading="lazy" src="../../../pane/default/image.svg" />';
    const source = componentEntrySource({
      paneRender: `(props) => <${receiver}><pane2.Component>{props.children}</pane2.Component></${receiver}>`,
      paneVariants: `[{ slug: "default", title: "Default", props: { children: ${componentImage} } }]`,
      body: `<pane.Component>${image}</pane.Component>`,
      extra:
        'const pane2 = defineComponent({ ...metadata, path: "pane2", title: "Pane2", description: "Nested receiver", propSchema: { kind: "object", properties: {} }, slots: ["children"], render: (props) => <section>{props.children}</section>, variants: [{ slug: "default", title: "Default", props: { children: <b>Saved</b> } }] });',
      exports: "...action.entries, ...pane.entries, ...pane2.entries,",
    });
    const fixture = await createFixture(source);
    t.after(() => removeFixture(fixture));
    await fs.writeFile(path.join(fixture.mockupsDir, "image.svg"), "image");
    await fs.mkdir(path.join(fixture.mockupsDir, "pane/default"), {
      recursive: true,
    });
    await fs.writeFile(
      path.join(fixture.mockupsDir, "pane/default/image.svg"),
      "image",
    );
    const config = await loadConfig(fixture.root);
    const compilation = await compileCatalogue(config);
    for (const id of ["home", "pane"] as const) {
      const entry = compilation.manifest.entries.find(
        (item) => item.path === (id === "pane" ? "pane/default" : id),
      );
      assert.ok(entry);
      const view = generatedViews(entry)[0];
      assert.ok(view?.usage);
      view.usage = {
        ...view.usage,
        resources: [
          {
            path: id === "pane" ? "pane/default/image.svg" : "image.svg",
            componentIds: ["pane"],
          },
        ],
      };
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
        "mockups/pane/default/image.svg",
      ]);
      const context = {
        componentAware: true,
        links: catalogueLinkNormalizer(
          compilation.manifest.entries,
          compilation.manifest.entries,
          [],
        ),
        beforeReader,
        afterReader,
        changed,
        prefix: "mockups",
        resources: new ResourceComparison(
          beforeReader,
          afterReader,
          changed,
          "mockups",
          undefined,
          undefined,
          true,
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
        prepared.excluded(
          id === "pane" ? "pane/default/image.svg" : "image.svg",
        ),
        id === "home",
      );
      const comparison = await compareComponentView(
        { ...context, useFastPath: false },
        view,
        view,
        id === "pane" ? "pane" : undefined,
      );
      const imageReads = reads.filter((route) => route.endsWith("image.svg"));
      if (id === "home" || receiver === "select") {
        assert.deepEqual(imageReads, []);
        assert.deepEqual(comparison.reasons, []);
      } else {
        assert.ok(imageReads.length > 0);
        assert.ok(
          comparison.reasons.some(
            (reason) =>
              reason.kind === "dependency" &&
              reason.path === "mockups/pane/default/image.svg",
          ),
        );
      }
    }
  });

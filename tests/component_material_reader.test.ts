import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { loadConfig } from "../dist/config/load.js";
import {
  runWithTimings,
  type TimingEvent,
} from "../dist/diagnostics/timings.js";
import { prepareComponentProjection } from "../dist/review/component_projection_resources.js";
import { ComponentMaterialReader } from "../dist/review/component_resources.js";
import { compareComponentView } from "../dist/review/component_view.js";
import { ResourceComparison } from "../dist/review/resource_comparison.js";
import { generatedViews } from "../packages/viewer/dist/components/views.js";

import { componentEntrySource } from "./helpers/component_fixture.js";
import { componentReviewFixture } from "./helpers/component_review_fixture.js";
import { createFixture, removeFixture } from "./helpers/fixture.js";

test("prefetch retains empty files and discovers resources only when requested", async () => {
  const reads: string[] = [];
  const reader = new ComponentMaterialReader({
    readMany: async (routes) =>
      new Map(
        routes.map((route) => {
          if (route === "view.html") return [route, Buffer.alloc(0)];
          reads.push(route);
          assert.equal(route, "used.css");
          return [route, Buffer.from('@import "./used.css";')];
        }),
      ),
    read: async (route) => {
      reads.push(route);
      assert.equal(route, "used.css");
      return Buffer.from('@import "./used.css";');
    },
  });
  await reader.prefetch(["view.html"]);
  assert.equal(await reader.text("view.html"), "");
  assert.deepEqual(reads, []);
  for (let index = 0; index < 2; index++)
    assert.deepEqual(
      await reader.resources(
        "view.html",
        '<link rel="stylesheet" href="used.css"><link rel="stylesheet" href="excluded.css"><link rel="prefetch" href="hint.css">',
        (route) => route === "excluded.css",
      ),
      new Set(["used.css"]),
    );
  assert.deepEqual(reads, ["used.css"]);
});

test("prefetch rejects an omitted view instead of falling back to unvalidated bytes", async () => {
  const reader = new ComponentMaterialReader({
    readMany: async () => new Map(),
    read: async () => assert.fail("An incomplete batch must fail"),
  });
  await assert.rejects(reader.prefetch(["missing.html"]), {
    code: "review-invalid",
    message: /missing.html: batch reader omitted the file/,
  });
});

test("resource discovery caches each document and exclusion policy", async () => {
  const reader = new ComponentMaterialReader({
    read: async () => Buffer.from(""),
  });
  const events: TimingEvent[] = [];
  const html = '<link rel="stylesheet" href="used.css">';
  const excluded = (route: string) => route === "excluded.css";
  await runWithTimings(
    true,
    "test",
    async () => {
      await reader.resources("view.html", html);
      await reader.resources("view.html", html);
      await reader.resources("view.html", html, excluded);
      await reader.resources("view.html", html, excluded);
    },
    { write: (event) => events.push(event) },
  );
  assert.equal(
    events.filter(
      (event) =>
        event.stage === "review.resource-graph" && event.event === "start",
    ).length,
    2,
  );
});

test("resource discovery digest separates content, routes, and exclusion identities", async () => {
  const reader = new ComponentMaterialReader({
    read: async () => Buffer.from(""),
  });
  const events: TimingEvent[] = [];
  const first = (route: string) => route.endsWith("first.svg");
  const second = (route: string) => route.endsWith("second.svg");
  const same = '<img src="same.svg">';
  const pair = '<img src="first.svg"><img src="second.svg">';
  await runWithTimings(
    true,
    "test",
    async () => {
      assert.deepEqual(
        await reader.resources("one/view.html", same),
        new Set(["one/same.svg"]),
      );
      assert.deepEqual(
        await reader.resources("one/view.html", same),
        new Set(["one/same.svg"]),
      );
      assert.deepEqual(
        await reader.resources("one/view.html", '<img src="different.svg">'),
        new Set(["one/different.svg"]),
      );
      assert.deepEqual(
        await reader.resources("two/view.html", same),
        new Set(["two/same.svg"]),
      );
      assert.deepEqual(
        await reader.resources("one/view.html", pair, first),
        new Set(["one/second.svg"]),
      );
      assert.deepEqual(
        await reader.resources("one/view.html", pair, first),
        new Set(["one/second.svg"]),
      );
      assert.deepEqual(
        await reader.resources("one/view.html", pair, second),
        new Set(["one/first.svg"]),
      );
    },
    { write: (event) => events.push(event) },
  );
  assert.equal(
    events.filter(
      (event) =>
        event.stage === "review.resource-graph" && event.event === "start",
    ).length,
    5,
  );
});

test("fall-through views reuse actual discovery in derived mode", async (t) => {
  const fixture = await componentReviewFixture(t, (source) => source);
  const screen = fixture.after.manifest.entries.find(
    (entry) => entry.kind === "screen",
  );
  assert.ok(screen);
  const view = generatedViews(screen)[0];
  assert.ok(view);
  const source = fixture.after.outputs.get(view.path);
  assert.notEqual(source, undefined);
  const document = `${source}<img src="../image.svg">`;

  const discoveryCount = async (compareResourceBytes: boolean) => {
    const events: TimingEvent[] = [];
    const reader = () =>
      new ComponentMaterialReader({
        read: async (route) =>
          Buffer.from(route === view.path ? document : "same image bytes"),
      });
    const beforeReader = reader();
    const afterReader = reader();
    const comparison = await runWithTimings(
      true,
      "test",
      () =>
        compareComponentView(
          {
            beforeReader,
            afterReader,
            changed: new Set(["mockups/image.svg"]),
            prefix: "mockups",
            resources: new ResourceComparison(
              beforeReader,
              afterReader,
              new Set(["mockups/image.svg"]),
              "mockups",
            ),
            compareResourceBytes,
          },
          view,
          view,
        ),
      { write: (event) => events.push(event) },
    );
    assert.equal(comparison.comparisonPath, "complete");
    return events.filter(
      (event) =>
        event.stage === "review.resource-graph" && event.event === "start",
    ).length;
  };

  assert.equal(await discoveryCount(false), 4);
  assert.equal(await discoveryCount(true), 4);
});

test("projected discovery applies root-specific rendered resource ownership before reading", async (t) => {
  const image = '<img loading="lazy" src="../image.svg" />';
  const source = componentEntrySource({
    paneRender:
      "(props) => <select><pane2.Component>{props.children}</pane2.Component></select>",
    paneVariants: `[{ id: "default", title: "Default", props: { children: ${image} } }]`,
    body: `<pane.Component>${image}</pane.Component>`,
    extra:
      'const pane2 = defineComponent({ ...metadata, id: "pane2", title: "Pane2", description: "Nested receiver", route: "components/pane2.html", propSchema: { kind: "object", properties: {} }, slots: ["children"], render: (props) => <section>{props.children}</section>, variants: [{ id: "default", title: "Default", props: { children: <b>Saved</b> } }] });',
    exports: "action.entry, pane.entry, pane2.entry,",
  });
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
    const generated = generatedViews(entry)[0];
    assert.ok(generated?.usage);
    assert.ok(
      generated.usage.slots.some((slot) => slot.owner.kind === "entry"),
    );
    const view = {
      ...generated,
      usage: {
        ...generated.usage,
        resources: [
          ...generated.usage.resources,
          {
            path: id === "pane" ? "components/image.svg" : "image.svg",
            componentIds: ["pane"],
          },
        ],
      },
    };
    const reads: string[] = [];
    const materialReader = () =>
      new ComponentMaterialReader({
        read: async (route) => {
          reads.push(route);
          const content =
            compilation.outputs.get(route) ??
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

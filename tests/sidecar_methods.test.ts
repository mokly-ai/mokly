import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import type { BundleResult } from "../packages/mokly/src/generated/sidecar/BundleResult.js";
import type { CssResult } from "../packages/mokly/src/generated/sidecar/CssResult.js";
import type { Definitions } from "../packages/mokly/src/generated/sidecar/Definitions.js";
import type { PageResult } from "../packages/mokly/src/generated/sidecar/PageResult.js";
import type { RenderResult } from "../packages/mokly/src/generated/sidecar/RenderResult.js";
import type { RenderStoryResult } from "../packages/mokly/src/generated/sidecar/RenderStoryResult.js";

import {
  bundleParams,
  installBindings,
  cssParams,
  startSidecar,
} from "./helpers/sidecar.js";

test("sidecar bundles, describes and renders every entry kind", async (context) => {
  const sidecar = startSidecar(context);
  // The sidecar reports the version of the package that contains it.
  const { version } = JSON.parse(
    await fs.readFile(
      new URL("../packages/mokly/package.json", import.meta.url),
      "utf8",
    ),
  );
  assert.deepEqual(await sidecar.call("hello"), { version });
  const bundle = await sidecar.call<BundleResult>("bundle", bundleParams());
  assert.match(bundle.generation, /^[a-f0-9]{64}$/);
  assert.ok(
    bundle.modules.find((module) => module.path === "control.module.css"),
  );
  await sidecar.call("cssModules", {
    generation: bundle.generation,
    classMaps: { "control.module.css": { control: "scoped-control" } },
  });
  const definitions = await sidecar.call<Definitions>("describe", {
    generation: bundle.generation,
  });
  assert.deepEqual(definitions.diagnostics, []);
  assert.equal(definitions.screens[0]?.handle, "screen.mockup.tsx#screen");
  assert.equal(definitions.components[0]?.element, "test-control");
  assert.equal(definitions.components[0]?.sourcePath, "component.mockup.tsx");
  assert.equal(definitions.stories[0]?.props.action, undefined);
  assert.equal(definitions.stories[0]?.argTypes.label?.name, "Button label");
  const parent = definitions.components.find(
    (component) => component.handle === "button.stories.tsx#default",
  );
  assert.deepEqual(parent?.props, { label: "Primary" });
  assert.equal(parent?.argTypes?.label?.name, "Button label");
  await installBindings(sidecar, bundle.generation);
  const axes = {
    generation: bundle.generation,
    viewport: "mobile",
    colorScheme: "dark",
  };
  const component = await sidecar.call<RenderResult>("renderComponent", {
    ...axes,
    handle: "component.mockup.tsx#control",
    entry: { path: "components/control", title: "Control" },
    props: { label: "Now" },
    slots: { children: { kind: "placeholder", token: "opaque" } },
    ignoreScope: "enabled",
  });
  assert.match(component.html, /class="scoped-control"/);
  assert.match(
    component.html,
    /<mokly-slot name="children" token="opaque" ignore-scope="disabled"><\/mokly-slot>/,
  );
  assert.match(component.html, /<!--mokly-ignore:start id="chrome"-->/);
  assert.ok(
    component.styles.some(
      (style) => style.css === ".inline-control{color:red}",
    ),
  );
  assert.deepEqual(component.resources, ["font.woff2"]);
  const screen = await sidecar.call<RenderResult>("renderScreen", {
    ...axes,
    handle: "screen.mockup.tsx#screen",
    entry: { path: "screen", title: "Screen" },
    props: { label: "Edited" },
  });
  assert.match(
    screen.html,
    /<!--mokly-instance:start id="r-1" path="components\/control"/,
  );
  assert.match(
    screen.html,
    /<!--mokly-slot:start id="r-\d+" instance="r-1" name="children"-->/,
  );
  assert.match(screen.html, /<!--mokly-link:start/);
  assert.match(screen.html, /<!--mokly-ignore:start id="inside"-->/);
  assert.ok(!screen.html.includes("data-mokly-boundary"));
  const story = await sidecar.call<RenderResult>("renderStory", {
    ...axes,
    storyId: "button.stories.tsx#Primary",
    props: { label: "Overlay" },
  });
  assert.equal(story.html, "<button>Overlay callback</button>");
  assert.deepEqual(story.resources, []);
  const page = await sidecar.call<PageResult>("renderPage", {
    generation: bundle.generation,
    handle: "page.mockup.ts#default",
  });
  assert.match(page.html, /^<!doctype html>/);
  assert.ok(!page.html.includes("data-renderer"));
  const css = await sidecar.call<CssResult>("processCss", {
    ...cssParams(),
    postcss: "postcss.mjs",
    sourcePath: "input.css",
    text: ".a {color: red}",
  });
  assert.match(css.text, /order: 1/);
  assert.ok(
    css.dependencies.some((dependency) => dependency.kind === "directory"),
  );
  assert.ok(
    css.dependencies.some(
      (dependency) =>
        dependency.glob === "**/*.html" && dependency.plugin === "fixture",
    ),
  );
  await sidecar.call("dispose", { generation: bundle.generation });
  assert.equal(await sidecar.call("shutdown"), null);
});

test("definition links created during evaluation resolve in page attributes", async (context) => {
  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  const bundle = await sidecar.call<BundleResult>(
    "bundle",
    bundleParams({
      entryFiles: ["definition-links.mjs"],
      renderer: null,
      storiesFiles: [],
    }),
  );
  await sidecar.call("cssModules", {
    generation: bundle.generation,
    classMaps: {},
  });
  await installBindings(sidecar, bundle.generation);
  const page = await sidecar.call<PageResult>("renderPage", {
    generation: bundle.generation,
    handle: "definition-links.mjs#source",
  });
  assert.match(page.html, /href="mock:destination#résumé"/);
  assert.ok(!page.html.includes("mokly-reference"));
  await sidecar.call("shutdown");
});

test("describe names only the stories file whose collection fails", async (context) => {
  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  const file = "describe-failure.stories.tsx";
  const { generation } = await sidecar.call<BundleResult>(
    "bundle",
    bundleParams({
      entryFiles: ["page.mockup.ts"],
      renderer: null,
      storiesFiles: ["button.stories.tsx", file],
    }),
  );
  await sidecar.call("cssModules", { generation, classMaps: {} });
  await assert.rejects(sidecar.call("describe", { generation }), {
    code: "bundle-failed",
    message: `${file}: fixture story args failed`,
  });
});

test("stories left out by tags cannot render", async (context) => {
  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  const { generation } = await sidecar.call<BundleResult>(
    "bundle",
    bundleParams({
      entryFiles: [],
      renderer: null,
      storiesFiles: ["no-included.stories.tsx"],
    }),
  );
  await sidecar.call("cssModules", { generation, classMaps: {} });
  await installBindings(sidecar, generation);
  for (const exportName of ["HiddenDev", "HiddenMokly"]) {
    await assert.rejects(
      sidecar.call("renderStory", {
        generation,
        storyId: `no-included.stories.tsx#${exportName}`,
        props: {},
        viewport: "mobile",
        colorScheme: "light",
      }),
      { code: "render-failed" },
    );
  }
});

test("portable stories and parent views receive viewport and color globals", async (context) => {
  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  const bundled = await sidecar.call<BundleResult>(
    "bundle",
    bundleParams({
      entryFiles: [],
      renderer: null,
      storiesFiles: ["globals.stories.tsx"],
    }),
  );
  await sidecar.call("cssModules", {
    generation: bundled.generation,
    classMaps: {},
  });
  await installBindings(sidecar, bundled.generation);
  for (const storyId of [
    "globals.stories.tsx#Primary",
    "globals.stories.tsx#default",
  ]) {
    const rendered = await sidecar.call<RenderStoryResult>("renderStory", {
      generation: bundled.generation,
      props: { label: "Overlay" },
      viewport: "mobile",
      colorScheme: "dark",
      storyId,
    });
    assert.ok("html" in rendered);
    assert.equal(
      rendered.html,
      '<section data-viewport="mobile" data-scheme="dark"><button>Overlay</button></section>',
    );
  }
  await sidecar.call("shutdown");
});

test("preview decorators apply once and stay isolated between interleaved generations", async (context) => {
  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  const generations: string[] = [];
  for (const name of ["a", "b"]) {
    const { generation } = await sidecar.call<BundleResult>(
      "bundle",
      bundleParams({
        sourceRoot: new URL(
          `./fixtures/sidecar/preview-${name}`,
          import.meta.url,
        ).pathname,
        entryFiles: [],
        renderer: null,
        storiesFiles: ["entry.stories.tsx"],
      }),
    );
    await sidecar.call("cssModules", { generation, classMaps: {} });
    await installBindings(sidecar, generation);
    generations.push(generation);
  }
  for (const index of [0, 1, 0]) {
    const generation = generations[index]!;
    const expected = `<div data-preview="${index === 0 ? "a" : "b"}"><button>Story</button></div>`;
    const axes = {
      generation,
      props: {},
      viewport: "mobile",
      colorScheme: "light",
    };
    for (const storyId of [
      "entry.stories.tsx#Primary",
      "entry.stories.tsx#default",
    ]) {
      const result = await sidecar.call<RenderStoryResult>("renderStory", {
        ...axes,
        storyId,
      });
      assert.ok("html" in result);
      assert.equal(result.html, expected);
    }
  }
});

import assert from "node:assert/strict";
import test from "node:test";

import type { BundleResult } from "../packages/mokly/src/generated/sidecar/BundleResult.js";
import type { RenderResult } from "../packages/mokly/src/generated/sidecar/RenderResult.js";

import {
  bundleParams,
  installBindings,
  startSidecar,
} from "./helpers/sidecar.js";

async function prepare(
  sidecar: ReturnType<typeof startSidecar>,
  directory: string,
) {
  const { generation } = await sidecar.call<BundleResult>(
    "bundle",
    bundleParams({
      sourceRoot: new URL(`./fixtures/sidecar/${directory}/`, import.meta.url)
        .pathname,
      entryFiles: [],
      renderer: null,
      storiesFiles: ["entry.stories.tsx"],
    }),
  );
  await sidecar.call("cssModules", { generation, classMaps: {} });
  await installBindings(sidecar, generation);
  return generation;
}

function renderStory(
  sidecar: ReturnType<typeof startSidecar>,
  generation: string,
  name = "Prepared",
  viewport = "mobile",
  colorScheme = "light",
) {
  return sidecar.call<RenderResult>("renderStory", {
    generation,
    storyId: `entry.stories.tsx#${name}`,
    props: {},
    viewport,
    colorScheme,
  });
}

function renderFirstStoryPage(
  sidecar: ReturnType<typeof startSidecar>,
  generation: string,
) {
  return sidecar.call<RenderResult>("renderComponent", {
    generation,
    handle: "entry.stories.tsx#default",
    entry: { path: "entry", title: "Setup" },
    slots: {},
    ignoreScope: "enabled",
    props: {},
    viewport: "mobile",
    colorScheme: "light",
  });
}

test("story loaders prepare data for every render of the first story", async (context) => {
  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  const generation = await prepare(sidecar, "story-setup-loader");
  assert.equal(
    (await renderStory(sidecar, generation)).html,
    "<output>Loaded 1:mobile:light</output>",
  );
  assert.equal(
    (await renderStory(sidecar, generation, "Prepared", "desktop", "dark"))
      .html,
    "<output>Loaded 2:desktop:dark</output>",
  );
  assert.equal(
    (await renderFirstStoryPage(sidecar, generation)).html,
    "<output>Loaded 3:mobile:light</output>",
  );
});

test("beforeEach prepares renders and cleans up before the next story loads without play or afterEach", async (context) => {
  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  const generation = await prepare(sidecar, "story-setup-before-each");
  assert.equal(
    (await renderStory(sidecar, generation)).html,
    "<output>ready|load:unset,setup</output>",
  );
  assert.equal(
    (await renderStory(sidecar, generation, "Next")).html,
    "<output>ready|load:unset,setup,cleanup,load:clean,setup</output>",
  );
  assert.equal(
    (await renderFirstStoryPage(sidecar, generation)).html,
    "<output>ready|load:unset,setup,cleanup,load:clean,setup,cleanup,load:clean,setup</output>",
  );
});

test("beforeAll stays active for repeated renders and cleans up before another generation loads", async (context) => {
  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  const first = await prepare(sidecar, "story-setup-before-all/a");
  const second = await prepare(sidecar, "story-setup-before-all/b");
  for (const [generation, expected] of [
    [first, "<output>a|a:setup</output>"],
    [second, "<output>b|a:setup,a:cleanup,b:setup</output>"],
    [first, "<output>a|a:setup,a:cleanup,b:setup,b:cleanup,a:setup</output>"],
  ] as const) {
    assert.equal((await renderStory(sidecar, generation)).html, expected);
    assert.equal((await renderStory(sidecar, generation)).html, expected);
    assert.equal(
      (await renderFirstStoryPage(sidecar, generation)).html,
      expected,
    );
  }
});

test("a throwing beforeAll fails every story render with its first error and runs once", async (context) => {
  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  const generation = await prepare(sidecar, "story-setup-failure");
  for (const name of ["Prepared", "Next", "Prepared"]) {
    await assert.rejects(renderStory(sidecar, generation, name), {
      code: "render-failed",
      message: /beforeAll failed on attempt 1/,
    });
  }
  const healthy = await prepare(sidecar, "story-setup-failure/healthy");
  assert.equal(
    (await renderStory(sidecar, healthy)).html,
    "<button>Healthy</button>",
  );
  await assert.rejects(renderFirstStoryPage(sidecar, generation), {
    code: "render-failed",
    message: /beforeAll failed on attempt 1/,
  });
});

test("loader, beforeEach, render, and beforeEach cleanup errors fail the render", async (context) => {
  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  const generation = await prepare(sidecar, "story-setup-errors");
  for (const [name, message] of [
    ["LoaderFailure", /loader failed/],
    ["BeforeEachFailure", /beforeEach failed/],
    ["RenderFailure", /render failed/],
  ] as const) {
    await assert.rejects(renderStory(sidecar, generation, name), {
      code: "render-failed",
      message,
    });
  }
  assert.equal(
    (await renderStory(sidecar, generation, "CleanupFailure")).html,
    "<button>Ready</button>",
  );
  await assert.rejects(renderStory(sidecar, generation, "Prepared"), {
    code: "render-failed",
    message: /beforeEach cleanup failed/,
  });
});

test("a throwing beforeAll cleanup fails one render and runs once before the next setup", async (context) => {
  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  const first = await prepare(sidecar, "story-setup-cleanup");
  const second = await prepare(sidecar, "story-setup-cleanup/next");
  assert.equal(
    (await renderStory(sidecar, first)).html,
    "<button>Ready</button>",
  );
  await assert.rejects(renderStory(sidecar, second), {
    code: "render-failed",
    message: /beforeAll cleanup failed/,
  });
  assert.equal(
    (await renderStory(sidecar, second)).html,
    "<button>Next setup</button>",
  );
});

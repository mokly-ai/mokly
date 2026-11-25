import assert from "node:assert/strict";
import test from "node:test";

import { startSidecar } from "./helpers/sidecar.js";
import {
  callStory,
  prepare,
  renderScreen,
  renderStory,
} from "./helpers/storybook_setup.js";

async function assertStoryFailure(
  sidecar: ReturnType<typeof startSidecar>,
  generation: string,
  exportName: string,
  name: string,
  reason: string,
) {
  const render = callStory(sidecar, generation, exportName);
  await assert.doesNotReject(render);
  assert.deepEqual(await render, {
    storyId: `entry.stories.tsx#${exportName}`,
    name,
    reason,
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
    (await renderStory(sidecar, generation, "Prepared", {}, "desktop", "dark"))
      .html,
    "<output>Loaded 2:desktop:dark</output>",
  );
  assert.equal(
    (await renderStory(sidecar, generation, "default")).html,
    "<output>Loaded 3:mobile:light</output>",
  );
});

test("story loaders, beforeEach hooks, and markup use edited args and omit unset keys", async (context) => {
  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  const generation = await prepare(sidecar, "story-setup-args");
  const edited = await renderStory(sidecar, generation, "Prepared", {
    label: "Edited",
    note: "Edited note",
  });
  const unset = await renderStory(sidecar, generation, "Prepared", {
    label: "Edited",
  });
  assert.deepEqual(
    [edited.html, unset.html],
    [
      "<output>loader=Edited/Edited note hook=Edited/Edited note markup=Edited/Edited note</output>",
      "<output>loader=Edited/absent hook=Edited/absent markup=Edited/absent</output>",
    ],
  );
});

test("beforeEach prepares markup and cleans up after each render without play or afterEach", async (context) => {
  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  const generation = await prepare(sidecar, "story-setup-before-each", [
    "screen.mockup.tsx",
  ]);
  const setup = "load:unset,setup:addon,setup:preview,setup:meta,setup:story";
  const clean = "cleanup:story,cleanup:meta,cleanup:preview,cleanup:addon";
  assert.equal(
    (await renderStory(sidecar, generation)).html,
    `<output>story|${setup}</output>`,
  );
  assert.equal(
    (await renderScreen(sidecar, generation)).html,
    `<output>unset|${setup},${clean}</output>`,
  );
  assert.equal(
    (await renderStory(sidecar, generation, "Next")).html,
    `<output>story|${setup},${clean},${setup}</output>`,
  );
  assert.equal(
    (await renderStory(sidecar, generation, "default")).html,
    `<output>story|${setup},${clean},${setup},${clean},${setup}</output>`,
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
      (await renderStory(sidecar, generation, "default")).html,
      expected,
    );
  }
});

test("a throwing beforeAll fails every story render with its first error and runs once", async (context) => {
  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  const generation = await prepare(sidecar, "story-setup-failure");
  for (const name of ["Prepared", "Next", "Prepared"]) {
    await assertStoryFailure(
      sidecar,
      generation,
      name,
      name,
      "beforeAll failed on attempt 1",
    );
  }
  const healthy = await prepare(sidecar, "story-setup-failure/healthy");
  assert.equal(
    (await renderStory(sidecar, healthy)).html,
    "<button>Healthy</button>",
  );
  assert.deepEqual(await callStory(sidecar, generation, "default"), {
    storyId: "entry.stories.tsx#Prepared",
    name: "Prepared",
    reason: "beforeAll failed on attempt 1",
  });
});

for (const { name, directory } of [
  {
    name: "beforeAll fills dark view globals before the first story render",
    directory: "story-setup-view-globals",
  },
  {
    name: "beforeAll runs before the render reads a preview parameters getter",
    directory: "story-setup-parameters-getter",
  },
]) {
  test(name, async (context) => {
    const sidecar = startSidecar(context);
    await sidecar.call("hello");
    const generation = await prepare(sidecar, directory);
    const first = await renderStory(
      sidecar,
      generation,
      "Prepared",
      {},
      "mobile",
      "dark",
    );
    const repeat = await renderStory(
      sidecar,
      generation,
      "Prepared",
      {},
      "mobile",
      "dark",
    );
    assert.deepEqual(
      [first.html, repeat.html],
      ["<output>ready</output>", "<output>ready</output>"],
    );
  });
}

test("loader, beforeEach, and markup errors fail the render and release completed setup", async (context) => {
  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  const generation = await prepare(sidecar, "story-setup-errors", [
    "screen.mockup.tsx",
  ]);
  for (const [exportName, name, message] of [
    ["LoaderFailure", "Loader Failure", "loader failed"],
    ["BeforeEachFailure", "Before Each Failure", "beforeEach failed"],
    ["RenderFailure", "Render Failure", "render failed"],
  ] as const) {
    await assertStoryFailure(sidecar, generation, exportName, name, message);
  }
  assert.equal(
    (await renderScreen(sidecar, generation)).html,
    "<output>setup:meta,cleanup:meta,setup:meta,setup:legacy,cleanup:legacy,cleanup:meta</output>",
  );
});

test("throwing beforeEach cleanups fail their own render and each cleanup runs once", async (context) => {
  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  const generation = await prepare(sidecar, "story-setup-errors", [
    "screen.mockup.tsx",
  ]);
  const next = await prepare(sidecar, "story-setup-failure/healthy");
  await assertStoryFailure(
    sidecar,
    generation,
    "CleanupFailure",
    "Cleanup Failure",
    "beforeEach cleanup failed",
  );
  const trace =
    "setup:meta,setup:earlier,setup:later,render,cleanup:later,cleanup:earlier,cleanup:meta";
  assert.equal(
    (await renderScreen(sidecar, generation)).html,
    `<output>${trace}</output>`,
  );
  assert.equal(
    (await renderStory(sidecar, generation)).html,
    "<button>Ready</button>",
  );
  assert.equal(
    (await renderStory(sidecar, next)).html,
    "<button>Healthy</button>",
  );
  assert.equal(
    (await renderScreen(sidecar, generation)).html,
    `<output>${trace},setup:meta,render,cleanup:meta</output>`,
  );
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
  await assertStoryFailure(
    sidecar,
    second,
    "Prepared",
    "Prepared",
    "beforeAll cleanup failed",
  );
  assert.equal(
    (await renderStory(sidecar, second)).html,
    "<button>Next setup</button>",
  );
});

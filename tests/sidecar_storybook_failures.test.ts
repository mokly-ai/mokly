import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { sidecarFixture, startSidecar } from "./helpers/sidecar.js";
import { callStory, prepare, renderStory } from "./helpers/storybook_setup.js";

const directory = "story-render-failures";

test("reserved story markers and Mokly-coded render errors stay fatal", async (context) => {
  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  const generation = await prepare(sidecar, directory);
  await assert.rejects(callStory(sidecar, generation, "ReservedMarker"), {
    code: "render-failed",
    message: /forged or duplicate Mokly marker/u,
  });
  await assert.rejects(callStory(sidecar, generation, "UnknownLink"), {
    code: "unknown-link-definition",
    message: /referenced definition Unregistered/u,
  });
});

test("repeated registered component instances keep their rendered story output and take distinct ids", async (context) => {
  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  const generation = await prepare(sidecar, directory, [
    "component.mockup.tsx",
  ]);
  const result = await renderStory(sidecar, generation, "DuplicateInstance");
  assert.match(result.html, />First<\/\w+>[\s\S]*>Second<\/\w+>/u);
  assert.deepEqual(
    result.instances.map(({ id, numbered }) => [id, numbered]),
    [
      ["same", undefined],
      ["same-2", true],
    ],
  );
});

test("a non-data prop of a registered component stops a story render", async (context) => {
  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  const generation = await prepare(sidecar, directory, [
    "component.mockup.tsx",
  ]);
  await assert.rejects(callStory(sidecar, generation, "NonDataProp"), {
    code: "render-failed",
    message: /\/label: value is not plain data/u,
  });
});

test("an error from a registered component's render gives a failed story result", async (context) => {
  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  const generation = await prepare(sidecar, directory, [
    "component.mockup.tsx",
  ]);
  assert.deepEqual(await callStory(sidecar, generation, "ComponentError"), {
    storyId: "entry.stories.tsx#ComponentError",
    name: "Component Error",
    reason: "Badge render failed",
  });
});

test("renderComponent rejects a Storybook story handle", async (context) => {
  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  const generation = await prepare(sidecar, directory);
  await assert.rejects(
    sidecar.call("renderComponent", {
      generation,
      handle: "entry.stories.tsx#default",
      entry: { path: "entry", title: "Render failures" },
      slots: {},
      ignoreScope: "enabled",
      props: {},
      viewport: "mobile",
      colorScheme: "light",
    }),
    {
      code: "render-failed",
      message: /entry\.stories\.tsx export default \(mobile, light\)/u,
    },
  );
});

test("unreadable thrown values and lone surrogates give failed story results", async (context) => {
  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  const generation = await prepare(sidecar, directory);
  const cases = [
    ["NullPrototype", "Null Prototype", "Unknown error"],
    ["NonStringMessage", "Non String Message", "Unknown error"],
    ["LoneSurrogate", "Lone Surrogate", "Invalid \uFFFD text"],
  ] as const;
  const results = await Promise.allSettled(
    cases.map(([exportName]) => callStory(sidecar, generation, exportName)),
  );
  assert.deepEqual(
    results,
    cases.map(([exportName, name, reason]) => ({
      status: "fulfilled",
      value: { storyId: `entry.stories.tsx#${exportName}`, name, reason },
    })),
  );
});

test("story reasons remove absolute paths and retain their delimiters", async (context) => {
  const home = String.raw`C:\Users\John Smith`;
  const homeFile = String.raw`${home}\AppData\x`;
  const sidecar = startSidecar(context, undefined, {
    ...process.env,
    HOME: home,
    USERPROFILE: home,
    TMPDIR: "/tmp",
  });
  await sidecar.call("hello");
  const generation = await prepare(sidecar, directory);
  const source = path.join(sidecarFixture, directory, "src", "data.json");
  const outside = path.resolve(
    path.parse(source).root,
    "elsewhere",
    "secret.json",
  );
  const vite = "http://localhost:6006/@fs/";
  const cases = [
    [`Could not open <${source}>`, "Could not open <src/data.json>"],
    [`Could not open <${outside}>`, "Could not open <…>"],
    [`Could not open [${outside}]`, "Could not open […]"],
    [`Could not open «${outside}»`, "Could not open «…»"],
    [
      `Could not open ${vite}${source.replaceAll("\\", "/").replace(/^\//u, "")}`,
      `Could not open ${vite}src/data.json`,
    ],
    [
      `Could not open ${vite}${pathToFileURL(source).href}`,
      `Could not open ${vite}src/data.json`,
    ],
    [`Could not open ${vite}opt/tooling/input.json`, `Could not open ${vite}…`],
    ["Could not open /@fs/opt/tooling/input.json", "Could not open /@fs/…"],
    [
      `Could not open ${path.join(path.dirname(source), "tmp", "x.json")}`,
      "Could not open src/tmp/x.json",
    ],
    ["open './tmp/cache.json'", "open './tmp/cache.json'"],
    ["https://example.com/tmp/x", "https://example.com/tmp/x"],
    ["Could not open local:///tmp/x.json", "Could not open local:///…"],
    [`Could not open @${source}`, "Could not open @src/data.json"],
    [`Could not open @${pathToFileURL(outside).href}`, "Could not open @…"],
    [`Could not open ${homeFile}`, "Could not open …"],
    [`Could not open ${vite}${homeFile}`, `Could not open ${vite}…`],
    [
      `Could not open @${pathToFileURL(homeFile, { windows: true }).href}`,
      "Could not open @…",
    ],
    [
      `Could not open @${path.join(os.tmpdir(), "logs", "error.txt")}`,
      "Could not open @…",
    ],
    ["Found </div>", "Found </div>"],
  ] as const;
  const reasons = [];
  for (const [input] of cases) {
    const result = await callStory(sidecar, generation, "Message", {
      text: input,
    });
    assert.ok("reason" in result);
    reasons.push(result.reason);
  }
  assert.deepEqual(
    reasons,
    cases.map(([, expected]) => expected),
  );
});

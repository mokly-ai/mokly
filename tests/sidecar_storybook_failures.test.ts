import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { sidecarFixture, startSidecar } from "./helpers/sidecar.js";
import { callStory, prepare } from "./helpers/storybook_setup.js";

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

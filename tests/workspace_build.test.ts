/** The package steps that `npm run build` runs, skips, and orders. */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";

import {
  BUILD_RECORDS,
  runWorkspaceBuild,
} from "../scripts/build/workspace-build.mjs";

const NATIVE = "cargo xtask build-native";
const directories: Record<string, string> = {
  "@mokly/ui": "packages/ui",
  "@mokly/model": "packages/model",
  "@mokly/frame": "packages/frame",
  "@mokly/viewer": "packages/viewer",
  "@mokly/mokly": "packages/mokly",
};
const reads: Record<string, string[]> = {
  "@mokly/frame": ["packages/model/dist/index.js"],
  "@mokly/viewer": [
    "packages/ui/dist/index.js",
    "packages/frame/dist/index.js",
  ],
  "@mokly/mokly": ["packages/viewer/dist/index.d.ts"],
};

async function write(root: string, file: string, text: string) {
  await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
  await fs.writeFile(path.join(root, file), text);
}

async function read(root: string, file: string) {
  return fs.readFile(path.join(root, file), "utf8");
}

/** A checkout with the sources and the test files of every package. */
async function checkout(t: TestContext) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-build-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  for (const file of ["package.json", "package-lock.json", "CHANGELOG.md"])
    await write(root, file, `${file}\n`);
  for (const directory of Object.values(directories)) {
    await write(root, `${directory}/src/index.ts`, `${directory} code\n`);
    await write(root, `${directory}/src/types.ts`, `${directory} types\n`);
    await write(root, `${directory}/tests/a.test.ts`, "test\n");
  }
  await write(root, "docs/guides/a.md", "guide\n");
  await write(root, "docs/protocol/cloud/a.md", "cloud\n");
  return root;
}

/**
 * A package build writes its code and declarations from its sources and
 * from the outputs that it reads; the shim also copies the guides. Record
 * the start and the end of each command.
 */
function builder(root: string, failing?: string) {
  const events: string[] = [];
  const run = async (command: readonly string[]) => {
    const name = command.at(-1) ?? "";
    const directory = directories[name];
    if (!directory) {
      events.push(`run ${command.join(" ")}`);
      return 0;
    }
    events.push(`start ${name}`);
    await new Promise((resolve) => setImmediate(resolve));
    if (name === failing) {
      events.push(`fail ${name}`);
      return 1;
    }
    const upstream = await Promise.all(
      (reads[name] ?? []).map((file) => read(root, file)),
    );
    await write(
      root,
      `${directory}/dist/index.js`,
      [await read(root, `${directory}/src/index.ts`), ...upstream].join(""),
    );
    await write(
      root,
      `${directory}/dist/index.d.ts`,
      await read(root, `${directory}/src/types.ts`),
    );
    if (name === "@mokly/mokly") {
      await write(root, `${directory}/docs/guides/a.md`, "copy\n");
      await write(root, `${directory}/CHANGELOG.md`, "copy\n");
    }
    events.push(`end ${name}`);
    return 0;
  };
  const reports: string[] = [];
  return {
    events,
    reports,
    build: { run, report: reports.push.bind(reports) },
  };
}

/** The package steps that a build ran, in start order. */
function built(events: string[]) {
  return events
    .filter((event) => event.startsWith("start "))
    .map((event) => event.slice("start ".length));
}

test("a first build runs each package after the packages that it reads", async (t) => {
  const root = await checkout(t);
  const { events, build } = builder(root);
  assert.deepEqual(await runWorkspaceBuild(root, build), []);
  assert.ok(events.includes(`run ${NATIVE}`));
  assert.deepEqual(built(events).sort(), Object.keys(directories).sort());
  const order = (event: string) => events.indexOf(event);
  for (const [later, earlier] of [
    ["@mokly/frame", "@mokly/model"],
    ["@mokly/viewer", "@mokly/ui"],
    ["@mokly/viewer", "@mokly/frame"],
    ["@mokly/mokly", "@mokly/viewer"],
  ] as const)
    assert.ok(
      order(`start ${later}`) > order(`end ${earlier}`),
      `${later} starts after ${earlier} ends`,
    );
  assert.ok(
    order(`start @mokly/model`) < order(`end @mokly/ui`),
    "the UI and model builds run at the same time",
  );
});

const changes: {
  name: string;
  change: (root: string) => Promise<void>;
  rebuilt: string[];
}[] = [
  { name: "no change", change: async () => {}, rebuilt: [] },
  {
    name: "a changed package test",
    change: (root) => write(root, "packages/ui/tests/a.test.ts", "changed\n"),
    rebuilt: [],
  },
  {
    name: "a changed cloud protocol page",
    change: (root) => write(root, "docs/protocol/cloud/a.md", "changed\n"),
    rebuilt: [],
  },
  {
    name: "changed viewer code with the same declarations",
    change: (root) => write(root, "packages/viewer/src/index.ts", "changed\n"),
    rebuilt: ["@mokly/viewer"],
  },
  {
    name: "changed viewer declarations",
    change: (root) => write(root, "packages/viewer/src/types.ts", "changed\n"),
    rebuilt: ["@mokly/viewer", "@mokly/mokly"],
  },
  {
    name: "changed model code",
    change: (root) => write(root, "packages/model/src/index.ts", "changed\n"),
    rebuilt: ["@mokly/model", "@mokly/frame", "@mokly/viewer"],
  },
  {
    name: "a new model source file",
    change: (root) => write(root, "packages/model/src/new.ts", "new\n"),
    rebuilt: ["@mokly/model"],
  },
  {
    name: "a changed guide",
    change: (root) => write(root, "docs/guides/a.md", "changed\n"),
    rebuilt: ["@mokly/mokly"],
  },
  {
    name: "a changed lockfile",
    change: (root) => write(root, "package-lock.json", "changed\n"),
    rebuilt: Object.keys(directories),
  },
  {
    name: "a removed output that the build writes again",
    change: (root) => fs.rm(path.join(root, "packages/ui/dist/index.js")),
    rebuilt: ["@mokly/ui"],
  },
  {
    name: "a changed output",
    change: (root) => write(root, "packages/frame/dist/index.js", "edited\n"),
    rebuilt: ["@mokly/frame"],
  },
  {
    name: "a damaged record",
    change: (root) =>
      write(root, `${BUILD_RECORDS}/mokly-model.json`, "{damaged"),
    rebuilt: ["@mokly/model"],
  },
];

for (const scenario of changes) {
  test(`after ${scenario.name}, a build runs only the changed steps`, async (t) => {
    const root = await checkout(t);
    assert.deepEqual(await runWorkspaceBuild(root, builder(root).build), []);
    await scenario.change(root);
    const { events, reports, build } = builder(root);
    assert.deepEqual(await runWorkspaceBuild(root, build), []);
    assert.ok(events.includes(`run ${NATIVE}`));
    assert.deepEqual(built(events).sort(), [...scenario.rebuilt].sort());
    assert.deepEqual(
      reports.filter((line) => line.endsWith(" is up to date")).length,
      5 - scenario.rebuilt.length,
    );
  });
}

test("a failed step keeps no record and starts no step that reads it", async (t) => {
  const root = await checkout(t);
  const failed = builder(root, "@mokly/model");
  assert.deepEqual(await runWorkspaceBuild(root, failed.build), [
    "@mokly/model",
  ]);
  assert.deepEqual(built(failed.events).sort(), ["@mokly/model", "@mokly/ui"]);
  const retried = builder(root);
  assert.deepEqual(await runWorkspaceBuild(root, retried.build), []);
  assert.deepEqual(built(retried.events).sort(), [
    "@mokly/frame",
    "@mokly/model",
    "@mokly/mokly",
    "@mokly/viewer",
  ]);
});

test("a failed native build fails the build", async (t) => {
  const root = await checkout(t);
  const { build } = builder(root);
  const result = await runWorkspaceBuild(root, {
    ...build,
    run: (command) =>
      command[0] === "cargo" ? Promise.resolve(101) : build.run(command),
  });
  assert.deepEqual(result, ["native"]);
});

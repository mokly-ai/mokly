import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import type { ReadStorybookReply } from "../packages/mokly/src/generated/sidecar/ReadStorybookReply.js";

import { completed, consumer, serve } from "./helpers/mokly_serve.js";
import { bundleParams, startSidecar } from "./helpers/sidecar.js";
import { build, write } from "./helpers/static_changes.js";
import { command } from "./helpers/static_publication.js";

const story =
  "export default { render: () => null }; export const Primary = {};";
const config = '{"roots":[{"storybook":".storybook"}]}';

for (const [api, importLine, call] of [
  ["readFileSync", 'import { readFileSync } from "node:fs";', "readFileSync"],
  [
    "promises.readFile",
    'import { readFile } from "node:fs/promises";',
    "await readFile",
  ],
] as const) {
  test(`Serve protects and watches the target of a Storybook ${api} link`, async (context) => {
    const root = await consumer(context, {
      "mokly.config.json": config,
      ".storybook/main.mjs": `${importLine}
        const file = new URL("./selection.txt", import.meta.url);
        export default { stories: [${call}(file, "utf8")] };`,
      "settings/selection.txt": "../first",
      "first/one.stories.tsx": story,
      "second/two.stories.tsx": story,
    });
    await fs.symlink(
      "../settings/selection.txt",
      path.join(root, ".storybook/selection.txt"),
    );
    const running = await serve(context, root, process.env, [], true);
    const url = await running.ready();
    const initial = await completed(url, running.signal, "one");
    assert.equal(
      (
        await fetch(`${url}/static/settings/selection.txt`, {
          signal: running.signal,
        })
      ).status,
      404,
    );
    await write(root, "settings/selection.txt", "../second");
    const updated = await completed(url, running.signal, "two", fetch, {
      afterRevision: initial.index.revision,
    });
    assert.deepEqual(
      updated.index.components.map(({ path }: { path: string }) => path),
      ["two"],
    );
    await running.close();
    const { index } = await build(
      root,
      ["--no-changes"],
      "plain",
      context.signal,
    );
    assert.deepEqual(
      index.components.map(({ path }) => path),
      ["two"],
    );
    await write(
      root,
      "mokly.config.json",
      '{"roots":[{"storybook":".storybook"},{"dir":"specs"}]}',
    );
    await write(
      root,
      "specs/check.screen.html",
      '---\ntitle: Check\n---\n<a href="../../settings/selection.txt">Selection</a>',
    );
    const denied = await command(
      root,
      "build",
      ["--no-changes"],
      "plain",
      {},
      context.signal,
    ).result;
    assert.equal(denied.code, 1, denied.stderr);
    assert.match(denied.stderr, /protected target .*settings\/selection\.txt/);
  });
}

const readHandle = `
  const handle = await open(new URL("./selection.txt", import.meta.url));
  const selected = await handle.readFile("utf8");
  await handle.close();`;

test("Storybook main records file handles and streams before delivering bytes", async (context) => {
  const root = await consumer(context, {
    ".storybook/main.mjs": `import { open } from "node:fs/promises";
      import { createReadStream, openSync, closeSync, readSync } from "node:fs";
      const file = (name) => new URL(name, import.meta.url);
      ${readHandle}
      let streamed = "";
      for await (const chunk of createReadStream(file("./stream.txt"), "utf8")) streamed += chunk;
      const fd = openSync(file("./part.txt"), 0);
      const first = Buffer.alloc(1);
      readSync(fd, first, 0, 1, null);
      closeSync(fd);
      const writeOnly = await open(file("./written.txt"), "w+");
      await writeOnly.writeFile("written during main");
      await writeOnly.close();
      export default { stories: [selected + streamed + first.toString()] };`,
    ".storybook/selection.txt": "../",
    ".storybook/stream.txt": "stor",
    ".storybook/part.txt": "y content beyond the partial read",
    "story/one.stories.tsx": story,
  });
  const sidecar = startSidecar(context, root);
  await sidecar.call("hello");
  const reply = await sidecar.call<ReadStorybookReply>("readStorybook", {
    sourceRoot: root,
    configurationDirectory: ".",
    folder: ".storybook",
    repositoryRoots: [],
    moduleResolution: bundleParams().moduleResolution,
  });
  assert.ok("inputs" in reply, JSON.stringify(reply));
  assert.equal(reply.entries[0]?.directory, "./story");
  for (const [name, text] of [
    ["selection", "../"],
    ["stream", "stor"],
    ["part", "y content beyond the partial read"],
  ] as const) {
    assert.equal(
      reply.inputs[`.storybook/${name}.txt`],
      createHash("sha256").update(text).digest("hex"),
    );
  }
  assert.equal(reply.inputs[".storybook/written.txt"], undefined);
  await sidecar.call("shutdown");
});

test("Serve rediscovers stories after editing an input read through a handle", async (context) => {
  const root = await consumer(context, {
    "mokly.config.json": config,
    ".storybook/main.mjs": `import { open } from "node:fs/promises";
      ${readHandle}
      export default { stories: [selected] };`,
    ".storybook/selection.txt": "../first",
    "first/one.stories.tsx": story,
    "second/two.stories.tsx": story,
  });
  const running = await serve(context, root, process.env, [], true);
  const url = await running.ready();
  const initial = await completed(url, running.signal, "one");
  await write(root, ".storybook/selection.txt", "../second");
  const updated = await completed(url, running.signal, "two", fetch, {
    afterRevision: initial.index.revision,
  });
  assert.deepEqual(
    updated.index.components.map(({ path }: { path: string }) => path),
    ["two"],
  );
  await running.close();
});

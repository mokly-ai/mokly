import assert from "node:assert/strict";
import test from "node:test";

import { completed, consumer, serve } from "./helpers/mokly_serve.js";
import { build, git, write } from "./helpers/static_changes.js";

const story = `
export default { render: () => <output>Card</output> };
export const Primary = {};
`;

test("Build and eager Serve discover stories with the base commit's own main file", async (context) => {
  const main = (selected: string) => `
import { DEFAULT_FILES_PATTERN } from "storybook/internal/common";
export default { stories: [{ directory: "../${selected}", files: DEFAULT_FILES_PATTERN }] };
`;
  const root = await consumer(context, {
    ".gitignore": "node_modules/\n.context/\n",
    "mokly.config.json":
      '{"roots":[{"storybook":".storybook"}],"review":{"base":"fixture-base"}}',
    ".storybook/main.ts": main("history"),
    "history/archived.stories.tsx": story.replace("Card", "Archived card"),
    "current/current.stories.tsx": story.replace("Card", "Current card"),
  });
  for (const args of [
    ["init", "-q"],
    ["config", "user.name", "Mokly Test"],
    ["config", "user.email", "test@example.com"],
    ["add", "."],
    ["commit", "-qm", "base discovery"],
    ["branch", "fixture-base"],
  ])
    await git(root, ...args);
  const base = await git(root, "rev-parse", "HEAD");
  await write(root, ".storybook/main.ts", main("current"));
  await git(root, "add", ".storybook/main.ts");
  await git(root, "commit", "-qm", "head discovery");
  const running = await serve(context, root, process.env, [], false, 3);
  const url = await running.ready();
  const served = await completed(url, running.signal, "current", fetch, {
    baseCommit: base,
    requireReady: true,
  });
  assert.deepEqual(
    served.index.removedEntries.map(
      ({ entry }: { entry: { path: string } }) => entry.path,
    ),
    ["archived"],
  );
  assert.deepEqual(
    served.index.components.map(({ path }: { path: string }) => path),
    ["current"],
  );
  await running.close();

  const { index, stderr } = await build(root, [], "plain", context.signal);
  assert.equal(index.baseCommit, base, stderr);
  assert.deepEqual(
    index.components.map(({ path }) => path),
    ["current"],
  );
  assert.deepEqual(
    index.removedEntries.map(({ entry }) => entry.path),
    ["archived"],
  );
});

test("Serve rediscovers stories after edits to main and its local imports", async (context) => {
  const main = (tail: string) => `
import { directory } from "./selection";
export default { stories: [directory${tail}] };
`;
  const root = await consumer(context, {
    "mokly.config.json": '{"roots":[{"storybook":".storybook"}]}',
    ".storybook/main.ts": main(""),
    ".storybook/selection.ts": 'export const directory = "../first";',
    "first/one.stories.tsx": story,
    "second/two.stories.tsx": story,
    "third/three.stories.tsx": story,
  });
  const running = await serve(context, root, process.env, [], true);
  const url = await running.ready();
  const initial = await completed(url, running.signal, "one");
  assert.deepEqual(
    initial.index.components.map(({ path }: { path: string }) => path),
    ["one"],
  );
  await write(root, ".storybook/main.ts", main(', "../second"'));
  const added = await completed(url, running.signal, "two", fetch, {
    afterRevision: initial.index.revision,
  });
  assert.deepEqual(
    added.index.components.map(({ path }: { path: string }) => path).sort(),
    ["one", "two"],
  );
  await write(
    root,
    ".storybook/selection.ts",
    'export const directory = "../third";',
  );
  const moved = await completed(url, running.signal, "three", fetch, {
    afterRevision: added.index.revision,
  });
  assert.deepEqual(
    moved.index.components.map(({ path }: { path: string }) => path).sort(),
    ["three", "two"],
  );
  await running.close();
});

test("Serve rediscovers stories when a higher-priority main file appears", async (context) => {
  const root = await consumer(context, {
    "mokly.config.json": '{"roots":[{"storybook":".storybook"}]}',
    ".storybook/main.ts": 'export default { stories: ["../first"] };',
    "first/one.stories.tsx": story,
    "second/two.stories.tsx": story,
  });
  const running = await serve(context, root, process.env, [], true);
  const url = await running.ready();
  const initial = await completed(url, running.signal, "one");
  await write(
    root,
    ".storybook/main.js",
    'export default { stories: ["../second"] };',
  );
  const updated = await completed(url, running.signal, "two", fetch, {
    afterRevision: initial.index.revision,
  });
  assert.deepEqual(
    updated.index.components.map(({ path }: { path: string }) => path),
    ["two"],
  );
  await running.close();
});

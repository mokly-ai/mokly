import assert from "node:assert/strict";
import test from "node:test";

import { completed, consumer, serve } from "./helpers/mokly_serve.js";
import { build, write } from "./helpers/static_changes.js";
import { command } from "./helpers/static_publication.js";

const config =
  '{"roots":[{"storybook":".storybook","path":"library","transparent":["layout"]}]}';
const story = `
export default { render: () => <output>Story</output> };
export const Primary = {};
`;

for (const nestedFirst of [false, true]) {
  test(`folder exclusions cover every Storybook entry with nested entry first=${nestedFirst}`, async (context) => {
    const entries = [
      "../stories/overview.stories.tsx",
      "../stories/admin/*.stories.tsx",
    ];
    const root = await consumer(context, {
      "mokly.config.json": config,
      ".storybook/main.ts": `export default { stories: ${JSON.stringify(nestedFirst ? entries.toReversed() : entries)} };`,
      "stories/_folder.json":
        '{"title":"Storybook stories","exclude":["admin/hidden.stories.tsx"]}',
      "stories/overview.stories.tsx": story,
      "stories/admin/hidden.stories.tsx": story,
      "stories/admin/visible.stories.tsx": story,
    });
    const { index } = await build(
      root,
      ["--no-changes", "--strict"],
      "plain",
      context.signal,
    );
    assert.deepEqual(index.components.map(({ path }) => path).sort(), [
      "library/overview",
      "library/visible",
    ]);
  });
}

test("a Storybook folder record takes its path from the deepest entry", async (context) => {
  const root = await consumer(context, {
    "mokly.config.json": config,
    ".storybook/main.ts":
      'export default { stories: ["../src/**/*.mdx", "../src/components/**/*.stories.tsx"] };',
    "src/components/_folder.json": '{"title":"Components"}',
    "src/components/card.stories.tsx": story,
  });
  const { index } = await build(
    root,
    ["--no-changes", "--strict"],
    "plain",
    context.signal,
  );
  assert.deepEqual(
    index.components.map(({ path }) => path),
    ["library/card"],
  );
  assert.deepEqual(
    index.tree.flatMap((node) =>
      node.kind === "folder" ? [[node.path, node.title]] : [],
    ),
    [["library", "Components"]],
  );
});

for (const [name, files, prefix, folder] of [
  ["an overlapping entry", "**/*.stories.tsx", "library", "library/components"],
  ["an MDX-only entry", "**/*.mdx", undefined, "components"],
] as const) {
  test(`a Storybook folder record follows stories owned by the outer entry with ${name}`, async (context) => {
    const root = await consumer(context, {
      "mokly.config.json": JSON.stringify({
        roots: [{ storybook: ".storybook", path: prefix }],
      }),
      ".storybook/main.ts": `export default { stories: ["../src/**/*.stories.tsx", "../src/components/${files}"] };`,
      "src/components/_folder.json": '{"title":"Components","order":["card"]}',
      "src/components/card.stories.tsx": story,
      "src/components/guide.mdx": "# Guide",
    });
    const { index } = await build(
      root,
      ["--no-changes", "--strict"],
      "plain",
      context.signal,
    );
    assert.deepEqual(
      index.components.map(({ path }) => path),
      [`${folder}/card`],
    );
    const parent = index.tree.find((node) => node.path === prefix);
    const nodes = parent?.kind === "folder" ? parent.children : index.tree;
    assert.deepEqual(
      nodes.flatMap((node) =>
        node.kind === "folder" ? [[node.path, node.title, node.order]] : [],
      ),
      [[folder, "Components", ["card"]]],
    );
  });
}

test("Build expands Storybook entries in order and selects only supported stories", async (context) => {
  const root = await consumer(context, {
    "mokly.config.json": config,
    ".storybook/main.ts": `
export default { stories: [
  "../packages/ui/section/card.stories.@(ts|tsx)",
  { directory: "../packages/ui", files: "**/extra?(One|Two).stories.tsx" },
  { directory: "../packages/ui", files: "**/{card,hidden}.stories.tsx" },
  "../packages/ui/?(section|layout)/optional.stories.tsx",
  "../examples",
  "../single/only.stories.tsx",
  "../missing/**/*.stories.tsx",
] };`,
    "packages/ui/section/card.stories.tsx": story,
    "packages/ui/section/hidden.stories.tsx": story,
    "packages/ui/section/_folder.json":
      '{"title":"Selected stories","exclude":["hidden.stories.tsx"]}',
    "packages/ui/layout/extra.stories.tsx": story,
    "packages/ui/layout/extraOne.stories.tsx": story,
    "packages/ui/layout/extraThree.stories.tsx": story,
    "packages/ui/layout/optional.stories.tsx": story,
    "packages/ui/optional.stories.tsx": story,
    "examples/sample.stories.js":
      "export default { render: () => null }; export const Primary = {};",
    "examples/guide.mdx": "# Guide",
    "examples/ignored.stories.mjs":
      "throw new Error('not a supported story file')",
    "single/only.stories.tsx": story,
    "single/ignored.stories.tsx": story,
  });
  const { index } = await build(
    root,
    ["--no-changes", "--strict"],
    "plain",
    context.signal,
  );
  assert.deepEqual(index.components.map(({ path }) => path).sort(), [
    "library/card",
    "library/extra",
    "library/extraOne",
    "library/only",
    "library/optional",
    "library/sample",
  ]);
  assert.deepEqual(
    index.tree.flatMap((node) =>
      node.kind === "folder" ? [[node.path, node.title]] : [],
    ),
    [["library", "Selected stories"]],
  );
});

test("Build reads a bare Storybook group as alternatives", async (context) => {
  const root = await consumer(context, {
    "mokly.config.json": config,
    ".storybook/main.ts":
      'export default { stories: ["../specs/(atoms|molecules)/*.stories.tsx"] };',
    "specs/atoms/card.stories.tsx": story,
    "specs/molecules/panel.stories.tsx": story,
    "specs/other/hidden.stories.tsx": story,
  });
  const { index } = await build(
    root,
    ["--no-changes"],
    "plain",
    context.signal,
  );
  assert.deepEqual(index.components.map(({ path }) => path).sort(), [
    "library/atoms/card",
    "library/molecules/panel",
  ]);
});

test("Serve watches a story with an omitted optional glob group", async (context) => {
  const root = await consumer(context, {
    "mokly.config.json": config,
    ".storybook/main.ts":
      'export default { stories: ["../specs/**/extra?(One|Two).stories.tsx"] };',
    "specs/extraOne.stories.tsx": story,
  });
  const running = await serve(context, root, process.env, [], true);
  const url = await running.ready();
  const initial = await completed(url, running.signal, "library/extraOne");
  await write(root, "specs/extra.stories.tsx", story);
  const updated = await completed(url, running.signal, "library/extra", fetch, {
    afterRevision: initial.index.revision,
  });
  assert.deepEqual(
    updated.index.components.map(({ path }: { path: string }) => path).sort(),
    ["library/extra", "library/extraOne"],
  );
  await running.close();
});

for (const [name, main, diagnostic] of [
  [
    "a failed load",
    'throw new Error("main could not load");',
    /main\.ts.*main could not load/,
  ],
  ["a missing main file", undefined, /main\.\*.*no main file found/],
  [
    "a missing stories array",
    "export default {};",
    /main\.ts.*expected a stories array/,
  ],
  [
    "an unsupported extglob",
    'export default { stories: ["../specs/*(one|two).stories.tsx"] };',
    /main\.ts.*stories\[0\].*unsupported extglob \*/,
  ],
  [
    "a directory outside the repository",
    'export default { stories: ["../../outside/*.stories.tsx"] };',
    /main\.ts.*stories\[0\].*outside repoRoot/,
  ],
] as const) {
  test(`Build reports ${name} in a Storybook folder as config-invalid`, async (context) => {
    const root = await consumer(context, {
      "mokly.config.json": config,
      ".storybook/preview.js": "export default {};",
      ...(main !== undefined && { ".storybook/main.ts": main }),
    });
    const result = await command(
      root,
      "build",
      ["--no-changes"],
      "plain",
      {},
      context.signal,
    ).result;
    assert.equal(result.code, 1, result.stderr);
    assert.match(result.stderr, /\[mokly\/config-invalid\].*\.storybook\//);
    assert.match(result.stderr, diagnostic);
  });
}

test("Build names configured roots when a Storybook entry overlaps another root", async (context) => {
  const root = await consumer(context, {
    "mokly.config.json":
      '{"roots":[{"storybook":".storybook"},{"dir":"specs"}]}',
    ".storybook/main.ts":
      'export default { stories: ["../absent/*.stories.tsx", "../specs"] };',
    "specs/card.stories.tsx": story,
  });
  const { code, stderr } = await command(
    root,
    "build",
    ["--no-changes"],
    "plain",
    {},
    context.signal,
  ).result;
  assert.equal(code, 1, stderr);
  assert.match(
    stderr,
    /\[mokly\/config-invalid\] file specs\/card\.stories\.tsx is matched by roots\[0\] and roots\[1\]/,
  );
});

test("Build names the Storybook folder when none of its entries select a story", async (context) => {
  const root = await consumer(context, {
    "mokly.config.json": config,
    ".storybook/main.ts":
      'export default { stories: ["../absent/*.stories.tsx", "../specs"] };',
    "specs/note.mdx": "# Not a story",
  });
  const { code, stderr } = await command(
    root,
    "build",
    ["--no-changes"],
    "plain",
    {},
    context.signal,
  ).result;
  assert.equal(code, 1, stderr);
  assert.match(
    stderr,
    /\[mokly\/config-invalid\] root matches no file: \.storybook; not searched: absent/,
  );
});

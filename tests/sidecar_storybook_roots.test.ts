import assert from "node:assert/strict";
import test from "node:test";

import { consumer } from "./helpers/mokly_serve.js";
import { build } from "./helpers/static_changes.js";
import { command } from "./helpers/static_publication.js";

const config =
  '{"roots":[{"storybook":".storybook","path":"library","transparent":["layout"]}]}';
const story = `
export default { render: () => <output>Story</output> };
export const Primary = {};
`;

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

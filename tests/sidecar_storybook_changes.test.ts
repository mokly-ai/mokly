import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { consumer } from "./helpers/mokly_serve.js";
import { build, git, write } from "./helpers/static_changes.js";

test("Changes renders a story with the Storybook folder of each checkout", async (context) => {
  const config = (storybook: string) =>
    JSON.stringify({
      roots: [{ dir: "packages/ui/src", storybook }],
      review: { base: "fixture-base" },
    });
  const root = await consumer(context, {
    ".gitignore": "node_modules/\n.context/\n",
    "mokly.config.json": config("packages/ui/.storybook"),
    "packages/ui/src/card.stories.tsx": `
export default { render: (_args, { globals }) => <output>{globals.label}</output> };
export const Primary = {};
`,
    "packages/ui/.storybook/preview.ts":
      'export default { initialGlobals: { label: "base folder" } };',
    "storybook/preview.ts":
      'export default { initialGlobals: { label: "head folder" } };',
  });
  for (const args of [
    ["init", "-q"],
    ["config", "user.name", "Mokly Test"],
    ["config", "user.email", "test@example.com"],
    ["add", "."],
    ["commit", "-qm", "base Storybook folder"],
    ["branch", "fixture-base"],
  ])
    await git(root, ...args);
  const base = await git(root, "rev-parse", "HEAD");
  await write(root, "mokly.config.json", config("storybook"));
  await git(root, "add", "mokly.config.json");
  await git(root, "commit", "-qm", "head Storybook folder");
  const { index, output, stderr } = await build(
    root,
    [],
    "plain",
    context.signal,
  );
  assert.equal(index.baseCommit, base, stderr);
  assert.ok(index.comparisonUrl, stderr);
  for (const [side, label] of [
    ["before", "base folder"],
    ["after", "head folder"],
  ] as const) {
    const markup: string = await fs.readFile(
      path.join(
        output,
        index.comparisonUrl,
        "snapshots",
        side,
        "mokly-generated/card/index.mobile.html",
      ),
      "utf8",
    );
    assert.ok(markup.includes(`<output>${label}</output>`), side);
  }
});

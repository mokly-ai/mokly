import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { component, htmlScreen } from "./fixtures/vite_stylesheets.js";
import { consumer } from "./helpers/mokly_serve.js";
import { build, git, write } from "./helpers/static_changes.js";

const packagePreview = "styles/packages/ui/dot-storybook/preview.tsx.css";
const story = `
export default { render: () => <p className="preview-theme">Story</p> };
export const Primary = {};
`;

for (const vite of [false, true]) {
  const adapter = vite ? "Vite" : "esbuild";
  test(`${adapter} lists only the changed folder's stories in Changes after a preview CSS edit`, async (context) => {
    const root = await consumer(context, {
      ".gitignore": "node_modules/\n.context/\n",
      "mokly.config.json": JSON.stringify({
        vite,
        review: { base: "fixture-base" },
        roots: [
          { dir: "packages/ui/specs", storybook: "packages/ui/.storybook" },
          { dir: "specs" },
        ],
      }),
      "packages/ui/specs/package.stories.tsx":
        story + "export const Alternate = {};",
      "packages/ui/.storybook/preview.tsx": 'import "./theme.css";',
      "packages/ui/.storybook/theme.css": ".preview-theme {color: teal}",
      "specs/default.stories.tsx": story,
      ".storybook/preview.tsx": 'import "./global.css";',
      ".storybook/global.css": ".preview-theme {color: purple}",
      "specs/home.screen.html": htmlScreen,
      "specs/card.mockup.tsx": component("", "<p>Card</p>"),
    });
    for (const args of [
      ["init", "-q"],
      ["config", "user.name", "Mokly Test"],
      ["config", "user.email", "test@example.com"],
      ["add", "."],
      ["commit", "-qm", "base preview styles"],
      ["branch", "fixture-base"],
    ])
      await git(root, ...args);
    await write(
      root,
      "packages/ui/.storybook/theme.css",
      ".preview-theme {color: maroon}",
    );
    await git(root, "commit", "-qam", "edit package preview CSS");
    const { index, output, stderr } = await build(
      root,
      [],
      "plain",
      context.signal,
    );
    assert.equal(index.changesStatus, "ready", stderr);
    assert.deepEqual(
      [...index.screens, ...index.components].flatMap(({ path, changes }) =>
        changes?.status === "ready" && changes.included
          ? [[path, changes.kind]]
          : [],
      ),
      [
        ["package", "changed"],
        ["package/Alternate", "changed"],
      ],
    );
    assert.ok(index.comparisonUrl, stderr);
    for (const [side, color] of [
      ["before", "teal"],
      ["after", "maroon"],
    ] as const) {
      const css = await fs.readFile(
        path.join(
          output,
          index.comparisonUrl,
          "snapshots",
          side,
          "mokly-generated",
          packagePreview,
        ),
        "utf8",
      );
      assert.match(
        css,
        new RegExp(`\\.preview-theme\\s*\\{[^}]*color: ${color}`, "u"),
      );
    }
  });
}

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { writeCompilation } from "../dist/build/transaction.js";
import { loadConfig } from "../dist/config/load.js";
import { compareReview } from "../dist/review/compare.js";

import { componentEntrySource } from "./helpers/component_fixture.js";
import { componentGit } from "./helpers/component_review_fixture.js";
import { createFixture, removeFixture } from "./helpers/fixture.js";

for (const owned of [false, true])
  test(`head styling infers ownership from matching markup; owned=${owned}`, async (t) => {
    const source = componentEntrySource().replace(
      "<button data-viewport=",
      '<button className="action" data-viewport=',
    );
    const fixture = await createFixture(source, {
      extraConfig: 'renderer: "renderer.tsx",',
    });
    t.after(() => removeFixture(fixture));
    const renderer = (color: string) =>
      `import { renderToStaticMarkup } from "react-dom/server"; export default (input) => { const css = '${owned ? ".action" : ".action, body"}{color:${color}}'; return '<html><head><style>' + css + '</style></head><body>' + renderToStaticMarkup(input.node) + '</body></html>'; };`;
    await fs.writeFile(
      path.join(fixture.root, "renderer.tsx"),
      renderer("red"),
    );
    const config = await loadConfig(fixture.root);
    const before = await compileCatalogue(config);
    await fs.writeFile(
      path.join(fixture.root, "renderer.tsx"),
      renderer("green"),
    );
    const after = await compileCatalogue(config);
    await writeCompilation(after, config);
    const git = componentGit(before, ["renderer.tsx"]);
    const { result } = await compareReview(after, config, git, "main");
    assert.equal(result.schemaVersion, 7);
    if (result.schemaVersion !== 7) return;
    assert.deepEqual(
      result.changes.map((entry) => entry.after!.path),
      owned ? ["action"] : ["action", "pane", "home"],
    );
  });

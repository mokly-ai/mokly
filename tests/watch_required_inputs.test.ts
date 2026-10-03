import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { loadConfig } from "../dist/config/load.js";
import type { ResolvedConfig } from "../dist/config/types.js";
import { classifyWatchPath } from "../dist/server/watch_events.js";
import { isPackageOwnedIgnoredWatchPath } from "../dist/server/watch_paths.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";

test("exact CSS, package, configuration and entry inputs survive denied directory names", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const loaded = await loadConfig(fixture.root);
  const inputs = [
    "dist/entries/new.mockup.tsx",
    "packages/ui/dist/theme.css",
    "vendor/dist/button.css",
    "shared/dist/config-helper.ts",
  ];
  const config: ResolvedConfig = {
    ...loaded,
    entryGlobs: ["dist/entries/**/*.mockup.tsx"],
    entryModules: [path.join(fixture.root, inputs[0]!)],
    sourceFiles: [inputs[1]!, inputs[2]!],
    configSourceFiles: [inputs[3]!],
  };
  for (const relative of inputs) {
    const absolute = path.join(fixture.root, relative);
    await fs.promises.mkdir(path.dirname(absolute), { recursive: true });
    await fs.promises.writeFile(absolute, "/* source */\n");
    assert.equal(
      classifyWatchPath({ path: absolute, kind: "change" }, config),
      relative === inputs[3] ? "reconfigure" : "rebuild",
      relative,
    );
    assert.equal(isPackageOwnedIgnoredWatchPath(absolute, config), false);
    assert.equal(
      isPackageOwnedIgnoredWatchPath(
        path.dirname(absolute),
        config,
        fs.statSync(path.dirname(absolute)),
      ),
      false,
      `${relative} ancestor`,
    );
  }
});

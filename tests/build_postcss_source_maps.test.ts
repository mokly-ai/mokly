import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { removeFixture } from "./helpers/fixture.js";
import {
  compileFixture,
  entryStyle,
  styleFixture,
} from "./helpers/imported_styles_fixture.js";
import {
  brokenInlineMap,
  oversizedIndexedMap,
  unsupportedSiblingMap,
  withSourceMap,
} from "./helpers/source_map_comments.js";

const noopConfig =
  'export default { plugins: [{ postcssPlugin: "mokly-noop", Once() {} }] };';

for (const module of [false, true])
  for (const [name, url] of [
    ["a broken inline map", brokenInlineMap],
    ["an indexed map offset above 10,000,000 lines", oversizedIndexedMap],
    ["a bad sibling map file", "fixture.map"],
  ] as const)
    test(`consumer PostCSS ignores ${name} in ${module ? "a CSS Module" : "plain CSS"}`, async (context) => {
      const fixture = await styleFixture(
        withSourceMap(".card{color:red}", url),
        { extraConfig: 'postcss: "postcss.config.mjs",', module },
      );
      context.after(() => removeFixture(fixture));
      await fs.writeFile(
        path.join(fixture.root, "postcss.config.mjs"),
        noopConfig,
      );
      if (url === "fixture.map")
        await fs.writeFile(
          path.join(fixture.entriesDir, "fixture.map"),
          unsupportedSiblingMap,
        );
      const stylesheet = (await compileFixture(fixture)).outputs.get(
        entryStyle,
      );
      assert.ok(typeof stylesheet === "string");
      assert.match(
        stylesheet,
        module ? /\.mokly_[a-f0-9]{12}_card\b/ : /\.card\b/,
      );
    });

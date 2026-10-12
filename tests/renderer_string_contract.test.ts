import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { loadConfig } from "../dist/config/load.js";
import { MoklyError } from "../dist/errors.js";

import { componentEntrySource } from "./helpers/component_fixture.js";
import { createFixture, removeFixture } from "./helpers/fixture.js";

const invalidRenderer = "export default () => ({ html: 7 });";

for (const [name, source, entry] of [
  ["screen-only", undefined, "details"],
  ["component-aware", componentEntrySource(), "action/default"],
] as const)
  test(`${name} renderers reject results without HTML text with view context`, async (t) => {
    const fixture = await createFixture(source, {
      extraConfig: 'renderer: "renderer.tsx",',
    });
    t.after(() => removeFixture(fixture));
    await fs.writeFile(
      path.join(fixture.root, "renderer.tsx"),
      invalidRenderer,
    );
    await assert.rejects(
      compileCatalogue(await loadConfig(fixture.root)),
      (error: unknown) => {
        assert.ok(error instanceof MoklyError);
        assert.equal(error.code, "build-invalid");
        assert.match(
          error.message,
          new RegExp(
            `renderer must return a string or an object with html for ${entry} \\(mobile, light\\)`,
          ),
        );
        return true;
      },
    );
  });

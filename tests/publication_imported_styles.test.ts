import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { writeCompilation } from "../dist/build/transaction.js";
import { loadConfig } from "../dist/config/load.js";
import { buildPreview } from "../scripts/preview/catalogue.mjs";

import { removeFixture } from "./helpers/fixture.js";
import { styleFixture, entryStyle } from "./helpers/imported_styles_fixture.js";

for (const mode of ["committed", "derived"] as const) {
  test(`${mode} publication captures generated CSS and scoped binary assets without private inputs`, async (context) => {
    const fixture = await styleFixture(
      '.entry { background: url("./node_modules/@fontsource/demo/files/font.woff2"); }',
    );
    context.after(() => removeFixture(fixture));
    if (mode === "derived")
      await fs.writeFile(
        fixture.configPath,
        (await fs.readFile(fixture.configPath, "utf8")).replace(
          '"committed"',
          '"derived"',
        ),
      );
    const font = path.join(
      fixture.entriesDir,
      "node_modules/@fontsource/demo/files/font.woff2",
    );
    await fs.mkdir(path.dirname(font), { recursive: true });
    await fs.writeFile(font, Buffer.from([0, 255, 3]));
    const config = await loadConfig(fixture.root);
    const compiled = await compileCatalogue(config);
    await writeCompilation(compiled, config);
    const stylesheet = path.join(fixture.mockupsDir, entryStyle);
    const asset = path.join(
      fixture.mockupsDir,
      "mokly-generated/assets/entries/node_modules/@fontsource/demo/files/font.woff2",
    );
    if (mode === "derived") {
      await fs.writeFile(stylesheet, "stale CSS");
      await fs.writeFile(asset, "stale binary");
      await fs.writeFile(
        path.join(fixture.mockupsDir, "mokly-generated/styles/stray.css"),
        ".stray {}",
      );
    }
    const output = path.join(fixture.root, ".context/published");
    await buildPreview(config, output);
    assert.equal(
      await fs.readFile(path.join(output, "static", entryStyle), "utf8"),
      compiled.outputs.get(entryStyle),
    );
    assert.deepEqual(
      await fs.readFile(
        path.join(output, "static", path.relative(fixture.mockupsDir, asset)),
      ),
      Buffer.from([0, 255, 3]),
    );
    assert.equal(
      await fs
        .stat(path.join(output, "static/mokly-generated/styles/stray.css"))
        .then(
          () => true,
          () => false,
        ),
      false,
    );
    assert.equal(
      await fs.stat(path.join(output, "static/entries/fixture.css")).then(
        () => true,
        () => false,
      ),
      false,
    );
  });
}

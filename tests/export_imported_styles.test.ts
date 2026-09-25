import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { loadConfig } from "../dist/config/load.js";
import { capturePublicFiles } from "../dist/export/public_files.js";
import { exportCatalogue } from "../dist/export/run.js";

import { directoryFiles } from "./helpers/export_fixture.js";
import { removeFixture } from "./helpers/fixture.js";
import { styleFixture } from "./helpers/imported_styles_fixture.js";

for (const mode of ["committed", "derived"] as const) {
  test(`${mode} export retains generated asset routes containing dist and target`, async (context) => {
    const fixture = await styleFixture(
      '.entry { background: url("./node_modules/leaflet/dist/a.png"); src: url("./target/b.woff"); }',
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
    for (const [name, bytes] of [
      ["node_modules/leaflet/dist/a.png", [0, 255]],
      ["target/b.woff", [12, 25]],
    ] as const) {
      const input = path.join(fixture.entriesDir, name);
      await fs.mkdir(path.dirname(input), { recursive: true });
      await fs.writeFile(input, Buffer.from(bytes));
    }
    await exportCatalogue(await loadConfig(fixture.root), {
      outDir: "site",
      noChanges: true,
    });
    const files = await directoryFiles(path.join(fixture.root, "site"));
    assert.deepEqual(
      files.get(
        "static/mokly-generated/assets/entries/node_modules/leaflet/dist/a.png",
      ),
      Buffer.from([0, 255]),
    );
    assert.deepEqual(
      files.get("static/mokly-generated/assets/entries/target/b.woff"),
      Buffer.from([12, 25]),
    );
  });
  test(`${mode} export captures scoped CSS assets without shipping private inputs`, async (context) => {
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
    const source = path.join(
      fixture.entriesDir,
      "node_modules/@fontsource/demo/files/font.woff2",
    );
    await fs.mkdir(path.dirname(source), { recursive: true });
    await fs.writeFile(source, Buffer.from([0, 255, 12]));
    const config = await loadConfig(fixture.root);
    await exportCatalogue(config, { outDir: "site", noChanges: true });
    const files = await directoryFiles(path.join(fixture.root, "site"));
    const route =
      "static/mokly-generated/assets/entries/node_modules/@fontsource/demo/files/font.woff2";
    assert.deepEqual(files.get(route), Buffer.from([0, 255, 12]));
    assert.match(
      String(
        files.get(
          "static/mokly-generated/styles/entries/fixture.mockup.tsx.css",
        ),
      ),
      /@fontsource/,
    );
    assert.equal(files.has("static/entries/fixture.css"), false);
    assert.equal(files.has("static/entries/fixture.mockup.tsx"), false);
  });
}

test("derived public capture never adopts stray reserved files from disk", async (context) => {
  const fixture = await styleFixture(".entry{color:red}");
  context.after(() => removeFixture(fixture));
  await fs.writeFile(
    fixture.configPath,
    (await fs.readFile(fixture.configPath, "utf8")).replace(
      '"committed"',
      '"derived"',
    ),
  );
  const config = await loadConfig(fixture.root);
  const stale = path.join(
    fixture.mockupsDir,
    "mokly-generated/styles/stray.css",
  );
  await fs.mkdir(path.dirname(stale), { recursive: true });
  await fs.writeFile(stale, ".stale{}");
  const captured = await capturePublicFiles(config, new Map());
  assert.equal(captured.has("mokly-generated/styles/stray.css"), false);
});

test("remote protocol-relative CSS assets are external throughout export", async (context) => {
  const fixture = await styleFixture(
    '.entry{background:url("//cdn.example.test/a.png")}',
  );
  context.after(() => removeFixture(fixture));
  await exportCatalogue(await loadConfig(fixture.root), {
    outDir: "site",
    noChanges: true,
  });
  const files = await directoryFiles(path.join(fixture.root, "site"));
  assert.match(
    String(
      files.get("static/mokly-generated/styles/entries/fixture.mockup.tsx.css"),
    ),
    /\/\/cdn\.example\.test\/a\.png/,
  );
});

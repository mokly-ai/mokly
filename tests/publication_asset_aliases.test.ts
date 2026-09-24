import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { buildPreview } from "../scripts/preview/catalogue.mjs";

import { changedFixture } from "./helpers/changed_fixture.js";
import { validEntrySource } from "./helpers/fixture.js";

const image = '<svg xmlns="http://www.w3.org/2000/svg" width="20"/>';
const source = validEntrySource({
  body: '<link rel="stylesheet" href="../../assets/theme.css" /><img src="../../assets/image.svg" alt="Logo" />',
});

for (const includeChanges of [false, true]) {
  test(`publication copies only referenced assets, not aliases (changes: ${includeChanges})`, async (context) => {
    const fixture = await changedFixture(context);
    await fs.promises.mkdir(path.join(fixture.mockupsDir, "assets"));
    await fs.promises.writeFile(
      path.join(fixture.mockupsDir, "assets/image.svg"),
      image,
    );
    await fs.promises.writeFile(
      path.join(fixture.mockupsDir, "assets/theme.css"),
      'body { background: url("image.svg"); }',
    );
    for (const [name, target] of [
      ["image.svg", "assets/image.svg"],
      ["theme.css", "assets/theme.css"],
      ["images", "assets"],
      ["cycle", "."],
      ["dangling.svg", "missing.svg"],
      ["metadata.json", "mokly-manifest.json"],
      ["source.txt", fixture.entryPath],
    ] as const)
      await fs.promises.symlink(target, path.join(fixture.mockupsDir, name));
    await fs.promises.writeFile(fixture.entryPath, source);
    await fixture.build();
    const output = path.join(fixture.root, ".context/published");
    await buildPreview(
      fixture.config,
      output,
      includeChanges ? { includeChanges: true, base: "HEAD" } : {},
    );
    for (const route of ["assets/image.svg"]) {
      const target = path.join(output, "static", route);
      assert.equal((await fs.promises.lstat(target)).isFile(), true, route);
      assert.equal(await fs.promises.readFile(target, "utf8"), image, route);
    }
    for (const route of ["assets/theme.css"])
      assert.match(
        await fs.promises.readFile(path.join(output, "static", route), "utf8"),
        /image\.svg/,
      );
    for (const route of [
      "cycle",
      "dangling.svg",
      "image.svg",
      "images",
      "metadata.json",
      "source.txt",
      "theme.css",
    ])
      assert.equal(
        fs.existsSync(path.join(output, "static", route)),
        false,
        route,
      );
  });

  test(`publication validates copied resources before replacing output (changes: ${includeChanges})`, async (context) => {
    const fixture = await changedFixture(context);
    const output = path.join(fixture.root, ".context/published");
    const options = includeChanges
      ? { includeChanges: true as const, base: "HEAD" }
      : {};
    await buildPreview(fixture.config, output, options);
    const before = await fs.promises.readFile(
      path.join(output, "index.html"),
      "utf8",
    );
    await fs.promises.writeFile(
      path.join(fixture.mockupsDir, "image.svg"),
      image,
    );
    await fs.promises.writeFile(
      fixture.entryPath,
      validEntrySource({ body: '<img src="../../image.svg" alt="Logo" />' }),
    );
    await fixture.build();
    const original = fs.promises.writeFile;
    let removed = false;
    context.mock.method(
      fs.promises,
      "writeFile",
      async (...args: Parameters<typeof original>) => {
        await original.apply(fs.promises, args);
        if (String(args[0]).endsWith("/static/image.svg")) {
          removed = true;
          await fs.promises.unlink(String(args[0]));
        }
      },
    );
    await assert.rejects(
      buildPreview(fixture.config, output, options),
      /published resource|exported resource/,
    );
    assert.equal(removed, true);
    assert.equal(
      await fs.promises.readFile(path.join(output, "index.html"), "utf8"),
      before,
    );
  });
}

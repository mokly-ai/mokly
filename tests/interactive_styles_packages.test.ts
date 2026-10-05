import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import { DocumentService } from "../dist/server/demand/service.js";

import {
  acceptedStyles,
  compileLiveStyles,
  interactiveStylesFixture,
} from "./helpers/interactive_styles.js";

for (const specifier of [
  "installed-style/card.module.css",
  "installed-style",
]) {
  test(`Live uses the accepted CSS exports for ${specifier}`, async (t) => {
    const fixture = await interactiveStylesFixture();
    t.after(() => fixture.remove());
    const directory = path.join(fixture.root, "node_modules/installed-style");
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(
      path.join(directory, "package.json"),
      JSON.stringify({
        name: "installed-style",
        version: "1.0.0",
        type: "module",
        exports: {
          ".": "./index.js",
          "./card.module.css": "./card.module.css",
        },
      }),
    );
    await fs.writeFile(
      path.join(directory, "index.js"),
      'export { default, card } from "./card.module.css"; import "./plain.css";',
    );
    await fs.writeFile(
      path.join(directory, "card.module.css"),
      ".card { color: fixture-color; }",
    );
    await fs.writeFile(
      path.join(directory, "plain.css"),
      "main { padding: 10px; }",
    );
    await fs.writeFile(
      fixture.entryPath,
      (await fs.readFile(fixture.entryPath, "utf8")).replace(
        "./card.module.css",
        specifier,
      ),
    );
    const runtime = await acceptedStyles(fixture.root);
    const documents = new DocumentService(runtime);
    t.after(() => documents.close());
    const html = (await documents.read("home/index.desktop.html")).html;
    const name = html.match(/data-module="([^"]+)"/)?.[1];
    assert.ok(name);
    const code = await compileLiveStyles(runtime);
    assert.ok(code.includes(name), "package CSS Module bindings match Static");
    assert.ok(
      !runtime.manifest.sourceFiles.some((source) =>
        source.startsWith("node_modules/"),
      ),
    );
    assert.ok(
      runtime.interactiveSources!.files.some((file) =>
        file.paths.includes("node_modules/installed-style/card.module.css"),
      ),
    );
  });
}

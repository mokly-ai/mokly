import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { loadConfig } from "../dist/config/load.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";

test("build rejects missing and non-portable HTML resource URLs", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  await configureRenderer(fixture.root, fixture.configPath);
  const config = await loadConfig(fixture.root);
  const cases = [
    ["src", '<img src="../../assets/missing.png">'],
    [
      "srcset",
      '<img srcset="data:image/png;base64,AA== 1x, ../../assets/missing.png 2x">',
    ],
    ["script", '<script src="../../assets/missing.js"></script>'],
    [
      "inline CSS",
      '<div style="background:url(../../assets/missing.png)"></div>',
    ],
    [
      "style block",
      "<style>body{background:url(../../assets/missing.png)}</style>",
    ],
    ["root absolute", '<img src="/assets/missing.png">'],
    ["escaping", '<img src="../../../outside.png">'],
  ] as const;

  for (const [label, markup] of cases) {
    await writeRenderer(fixture.root, markup);
    await assert.rejects(
      () => compileCatalogue(config),
      /missing target|protected target|root-absolute link|escapes mockupsDir/,
      label,
    );
  }
});

test("build validates transitive CSS imports and URLs", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const assets = path.join(fixture.mockupsDir, "assets");
  await fs.promises.mkdir(assets, { recursive: true });
  await fs.promises.writeFile(
    path.join(assets, "theme.css"),
    '@import "nested.css";\nbody{background:url("image.png")}\n',
  );
  await fs.promises.writeFile(path.join(assets, "nested.css"), "body{}\n");
  await fs.promises.writeFile(path.join(assets, "image.png"), "image\n");
  await configureRenderer(fixture.root, fixture.configPath);
  await writeRenderer(
    fixture.root,
    '<link rel="stylesheet" href="../../assets/theme.css"><svg><filter id="blur"></filter></svg><div style="filter:url(#blur)"></div>',
  );
  const config = await loadConfig(fixture.root);

  await compileCatalogue(config);
  await fs.promises.rm(path.join(assets, "image.png"));
  await assert.rejects(() => compileCatalogue(config), /missing target/);
});

async function configureRenderer(
  root: string,
  configPath: string,
): Promise<void> {
  await fs.promises.writeFile(
    configPath,
    'export default { entriesDir: "entries", mockupsDir: "mockups", renderer: "renderer.ts", repoRoot: "." };\n',
  );
  await writeRenderer(root, "<main>Ready</main>");
}

async function writeRenderer(root: string, markup: string): Promise<void> {
  await fs.promises.writeFile(
    path.join(root, "renderer.ts"),
    `export default function render() { return ${JSON.stringify(`<!doctype html><html><body>${markup}</body></html>`)}; }\n`,
  );
}

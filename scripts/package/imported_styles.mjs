import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

import { consumerPackage } from "./consumer_package.mjs";
import { copyFixture, installConsumer, runBin } from "./fixture.mjs";

/** Build a real installed consumer with scoped CSS, a binary asset and local PostCSS. */
export async function smokeImportedStylesConsumer(context) {
  const root = path.join(context.workingRoot, "imported-styles-consumer");
  await copyFixture(path.join(context.fixturesRoot, "esm"), root);
  await installConsumer(
    root,
    context.archivePath,
    consumerPackage("packed-styles-consumer", context, true),
  );
  const configPath = path.join(root, "mokly.config.ts");
  await fs.writeFile(
    configPath,
    (await fs.readFile(configPath, "utf8")).replace(
      "export default defineConfig({",
      'export default defineConfig({\n  generatedOutput: "committed",\n  postcss: "postcss.config.mjs",',
    ),
  );
  await fs.writeFile(
    path.join(root, "postcss.config.mjs"),
    `export default { plugins: [{ postcssPlugin: "packed-local", Once(root) {
      root.append({ selector: ".packed-plugin", nodes: [{ prop: "display", value: "block" }] });
    } }] };`,
  );
  const entryPath = path.join(root, "entries/catalogue.mockup.tsx");
  await fs.writeFile(
    entryPath,
    `import styles from "./packed.module.css";\n` +
      (await fs.readFile(entryPath, "utf8")).replace(
        'data-fixture="esm-desktop"',
        'data-fixture="esm-desktop" className={styles.hero}',
      ),
  );
  await fs.writeFile(
    path.join(root, "entries/packed.module.css"),
    '.hero{background-image:url("./tiny.png")}',
  );
  const bytes = Buffer.from([0, 255, 42]);
  await fs.writeFile(path.join(root, "entries/tiny.png"), bytes);
  await runBin(root, ["build"]);
  await runBin(root, ["check"]);
  const stylesheet = await fs.readFile(
    path.join(
      root,
      "mockups/mokly-generated/styles/entries/catalogue.mockup.tsx.css",
    ),
    "utf8",
  );
  assert.match(stylesheet, /mokly_[\w-]+_hero/u);
  assert.match(stylesheet, /packed-plugin/u);
  assert.match(stylesheet, /assets\/entries\/tiny\.png/u);
  assert.deepEqual(
    await fs.readFile(
      path.join(root, "mockups/mokly-generated/assets/entries/tiny.png"),
    ),
    bytes,
  );
  assert.match(
    await fs.readFile(
      path.join(root, "mockups/screens/home.desktop.html"),
      "utf8",
    ),
    /mokly-generated\/styles\/entries\/catalogue\.mockup\.tsx\.css/u,
  );
}

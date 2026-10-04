import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import { build } from "esbuild";

import { interactiveSourceCapture } from "../dist/build/interactive_source_capture.js";
import { installedSourceImporter } from "../dist/build/interactive_source_paths.js";
import { loadConfig } from "../dist/config/load.js";

import { installedStylesFixture } from "./helpers/installed_styles.js";
import {
  acceptedStyles,
  compileLiveStyles,
} from "./helpers/interactive_styles.js";

for (const request of ["package-name", "relative"] as const) {
  test(`installed ${request} requests record only saved stylesheet targets`, async (t) => {
    const fixture = await installedStylesFixture(request);
    t.after(() => fixture.remove());
    const runtime = await acceptedStyles(fixture.root);
    const sources = runtime.interactiveSources!;
    const prefix = request === "relative" ? "./" : "installed-style/";
    assert.deepEqual(
      sources.resolutions.filter(
        ({ importer }) => importer.type === "installed",
      ),
      ["card.module.css", "plain.css"].map((stylesheet) => ({
        attributes: [],
        importer: {
          type: "installed",
          path: "node_modules/installed-style/index.js",
        },
        kind: "import-statement",
        specifier: `${prefix}${stylesheet}`,
        target: `node_modules/installed-style/${stylesheet}`,
      })),
    );
    assert.ok(
      !sources.files.some(({ paths }) =>
        paths.some((file) => file.endsWith("index.js")),
      ),
    );
    const original = await fs.readFile(
      path.join(fixture.directory, "index.js"),
      "utf8",
    );
    await fs.writeFile(
      path.join(fixture.directory, "index.js"),
      `${original}\nimport { marker } from "./helper.js"; console.log(marker);`,
    );
    await fs.writeFile(
      path.join(fixture.directory, "helper.js"),
      'export const marker = "installed-live-code";',
    );
    assert.match(await compileLiveStyles(runtime), /installed-live-code/);
    const next = await acceptedStyles(fixture.root);
    assert.ok(
      !next.interactiveSources!.resolutions.some(
        ({ importer, target }) =>
          importer.type === "installed" && !target.endsWith(".css"),
      ),
    );
    assert.ok(
      !next.interactiveSources!.files.some(({ paths }) =>
        paths.some((file) => file.endsWith("helper.js")),
      ),
    );
    await fs.writeFile(
      path.join(fixture.directory, "helper.js"),
      'export const marker = "changed-installed-code";',
    );
    const code = await compileLiveStyles(next);
    assert.match(code, /changed-installed-code/);
    assert.doesNotMatch(code, /installed-live-code/);
  });
}

test("installed requests ignore later stylesheet export metadata before resolution", async (t) => {
  const fixture = await installedStylesFixture();
  t.after(() => fixture.remove());
  const runtime = await acceptedStyles(fixture.root);
  const expected = await compileLiveStyles(runtime);
  const metadataPath = path.join(fixture.directory, "package.json");
  const metadata = JSON.parse(await fs.readFile(metadataPath, "utf8"));
  metadata.exports["./card.module.css"] = "./replacement.module.css";
  await fs.writeFile(metadataPath, JSON.stringify(metadata));
  await fs.writeFile(
    path.join(fixture.directory, "replacement.module.css"),
    ".card {color: blue} .replacement {color: green}",
  );
  await fs.rm(path.join(fixture.directory, "card.module.css"));
  assert.equal(await compileLiveStyles(runtime), expected);
  assert.match(
    await compileLiveStyles(await acceptedStyles(fixture.root)),
    /mokly_[a-f0-9]{12}_replacement/,
  );
});

test("extensionless installed exports replay saved stylesheet requests", async (t) => {
  const fixture = await installedStylesFixture();
  t.after(() => fixture.remove());
  const metadataPath = path.join(fixture.directory, "package.json");
  const metadata = JSON.parse(await fs.readFile(metadataPath, "utf8"));
  metadata.exports["./card"] = "./card.module.css";
  metadata.exports["./plain"] = "./plain.css";
  await fs.writeFile(metadataPath, JSON.stringify(metadata));
  await fs.writeFile(
    path.join(fixture.directory, "index.js"),
    'export { default, card } from "installed-style/card"; import "installed-style/plain";',
  );
  const runtime = await acceptedStyles(fixture.root);
  assert.deepEqual(
    runtime
      .interactiveSources!.resolutions.filter(
        ({ importer }) => importer.type === "installed",
      )
      .map(({ specifier }) => specifier),
    ["installed-style/card", "installed-style/plain"],
  );
  await fs.rm(path.join(fixture.directory, "card.module.css"));
  await fs.rm(path.join(fixture.directory, "plain.css"));
  assert.match(await compileLiveStyles(runtime), /mokly_[a-f0-9]{12}_card/);
});

for (const layout of [
  "pnpm",
  "importer symlink",
  "repository symlink",
] as const) {
  test(`installed importer normalization matches both builds with ${layout}`, async (t) => {
    const fixture = await installedStylesFixture();
    t.after(() => fixture.remove());
    let root = fixture.root;
    let physicalDirectory = fixture.directory;
    if (layout === "pnpm") {
      physicalDirectory = path.join(
        fixture.root,
        "node_modules/.pnpm/installed-style@1.0.0/node_modules/installed-style",
      );
      await fs.mkdir(path.dirname(physicalDirectory), { recursive: true });
      await fs.rename(fixture.directory, physicalDirectory);
      await fs.symlink(
        path.relative(path.dirname(fixture.directory), physicalDirectory),
        fixture.directory,
      );
    } else if (layout === "importer symlink") {
      await fs.rename(
        path.join(fixture.directory, "index.js"),
        path.join(fixture.directory, "implementation.js"),
      );
      await fs.symlink(
        "implementation.js",
        path.join(fixture.directory, "index.js"),
      );
    } else {
      root = `${fixture.root}-alias`;
      await fs.symlink(fixture.root, root);
      t.after(() => fs.rm(root));
      const physicalImporter = path.join(fixture.directory, "index.js");
      const logicalImporter = path.join(
        root,
        "node_modules/installed-style/index.js",
      );
      assert.deepEqual(
        installedSourceImporter(physicalImporter, root),
        installedSourceImporter(logicalImporter, root),
      );
    }
    const runtime = await acceptedStyles(root);
    const installed = runtime.interactiveSources!.resolutions.filter(
      ({ importer }) => importer.type === "installed",
    );
    assert.equal(installed.length, 2);
    assert.ok(
      installed.every(
        ({ importer }) =>
          importer.type === "installed" &&
          importer.path === "node_modules/installed-style/index.js",
      ),
    );
    await fs.rm(path.join(physicalDirectory, "card.module.css"));
    await fs.rm(path.join(physicalDirectory, "plain.css"));
    assert.match(await compileLiveStyles(runtime), /mokly_[a-f0-9]{12}_card/);
  });
}

test("installed records require loader-saved stylesheet modules even when repository requests reserve their paths", async (t) => {
  const fixture = await installedStylesFixture();
  t.after(() => fixture.remove());
  const capture = interactiveSourceCapture(await loadConfig(fixture.root));
  const entry = path.join(fixture.root, "consumer.ts");
  await fs.writeFile(
    entry,
    'import "installed-style/plain.css"; import styles, { card } from "installed-style"; console.log(styles, card);',
  );
  await build({
    absWorkingDir: fixture.root,
    bundle: true,
    entryPoints: [entry],
    write: false,
    plugins: [
      capture.plugin,
      {
        name: "selectively-record-test-css",
        setup(pluginBuild) {
          pluginBuild.onLoad({ filter: /\.css$/ }, ({ path: file }) => {
            const contents = file.endsWith(".module.css")
              ? 'export default {}; export const card = "saved";'
              : "";
            if (file.endsWith(".module.css"))
              capture.recordStylesheet(file, contents);
            return { contents, loader: "js" };
          });
        },
      },
    ],
  });
  const sources = capture.candidate.seal();
  assert.deepEqual(
    sources.resolutions
      .filter(({ importer }) => importer.type === "installed")
      .map(({ target }) => target),
    ["node_modules/installed-style/card.module.css"],
  );
});

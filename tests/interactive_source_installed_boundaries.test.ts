import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import { validEntrySource } from "./helpers/fixture.js";
import { installedStylesFixture } from "./helpers/installed_styles.js";
import {
  acceptedStyles,
  compileLiveStyles,
} from "./helpers/interactive_styles.js";

for (const request of ["package-name", "relative"] as const) {
  test(`installed ${request} empty modules stay pinned after stylesheet deletion`, async (t) => {
    const fixture = await installedStylesFixture(request);
    t.after(() => fixture.remove());
    const prefix = request === "relative" ? "./" : "installed-style/";
    await fs.writeFile(
      path.join(fixture.directory, "index.js"),
      `export { default } from "${prefix}card.module.css"; import "${prefix}plain.css";`,
    );
    await fs.writeFile(
      fixture.entryPath,
      `import styles from "installed-style";\n${validEntrySource({ body: "<span className={styles.card}>Empty stylesheets</span>" })}`,
    );
    await fs.writeFile(
      fixture.configPath,
      (await fs.readFile(fixture.configPath, "utf8")).replace(
        'interactive: "serve",',
        'interactive: "serve", moduleResolution: { loaders: { ".css": "empty" } },',
      ),
    );
    const accepted = await acceptedStyles(fixture.root);
    assert.equal(
      accepted.interactiveSources!.resolutions.filter(
        ({ importer }) => importer.type === "installed",
      ).length,
      2,
    );
    for (const [stylesheet, contents] of [
      ["card.module.css", "export default {};"],
      ["plain.css", ""],
    ] as const) {
      const module = accepted.interactiveSources!.files.find(({ paths }) =>
        paths.includes(`node_modules/installed-style/${stylesheet}`),
      );
      assert.ok(module);
      assert.equal(Buffer.from(module.bytes).toString(), contents);
      await fs.rm(path.join(fixture.directory, stylesheet));
    }
    assert.match(await compileLiveStyles(accepted), /Empty stylesheets/);
  });
}

for (const stylesheet of ["card.module.css", "plain.css"] as const) {
  test(`the Node graph rejects installed ${stylesheet} outside repoRoot`, async (t) => {
    const fixture = await installedStylesFixture();
    t.after(() => fixture.remove());
    const externalRoot = `${fixture.root}-external`;
    await fs.mkdir(externalRoot);
    t.after(() => fs.rm(externalRoot, { recursive: true, force: true }));
    const original = path.join(fixture.directory, stylesheet);
    const external = path.join(externalRoot, stylesheet);
    await fs.rename(original, external);
    await fs.symlink(external, original);
    await assert.rejects(acceptedStyles(fixture.root), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal((error as { code?: string }).code, "build-invalid");
      assert.match(error.message, /CSS import is outside repoRoot/);
      return true;
    });
  });
}

for (const request of ["package-name", "relative"] as const) {
  test(`an outside-root installed importer of confined ${request} CSS stays unrecorded`, async (t) => {
    const fixture = await installedStylesFixture(request);
    t.after(() => fixture.remove());
    const externalRoot = `${fixture.root}-external`;
    const externalDirectory = path.join(
      externalRoot,
      "node_modules/installed-style",
    );
    await fs.mkdir(externalDirectory, { recursive: true });
    t.after(() => fs.rm(externalRoot, { recursive: true, force: true }));
    const original = path.join(fixture.directory, "index.js");
    const external = path.join(externalDirectory, "index.js");
    await fs.rename(original, external);
    await fs.symlink(external, original);
    const accepted = await acceptedStyles(fixture.root);
    assert.equal(
      accepted.interactiveSources!.resolutions.some(
        ({ importer }) => importer.type === "installed",
      ),
      false,
    );
    const expected = await compileLiveStyles(accepted);
    await fs.writeFile(
      path.join(fixture.directory, "card.module.css"),
      ":global() { invalid: css; }",
    );
    assert.equal(await compileLiveStyles(accepted), expected);
    await fs.rm(path.join(fixture.directory, "card.module.css"));
    if (request === "relative") {
      assert.equal(await compileLiveStyles(accepted), expected);
    } else {
      await assert.rejects(compileLiveStyles(accepted), (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal((error as { code?: string }).code, "interactive-bundle");
        assert.equal((error as { reason?: string }).reason, undefined);
        assert.match(
          error.message,
          /Could not resolve "installed-style\/card.module.css"/,
        );
        return true;
      });
    }
  });
}

test("browser-only installed CSS outside repoRoot cannot load from disk", async (t) => {
  const fixture = await installedStylesFixture();
  t.after(() => fixture.remove());
  const externalRoot = `${fixture.root}-external`;
  await fs.mkdir(externalRoot);
  t.after(() => fs.rm(externalRoot, { recursive: true, force: true }));
  const external = path.join(externalRoot, "escaped.module.css");
  await fs.writeFile(external, ".card { color: red; }");
  await fs.symlink(
    external,
    path.join(fixture.directory, "escaped.module.css"),
  );
  await fs.writeFile(
    path.join(fixture.directory, "browser.js"),
    'export { default, card } from "installed-style/escaped.module.css";',
  );
  const metadataFile = path.join(fixture.directory, "package.json");
  const metadata = JSON.parse(await fs.readFile(metadataFile, "utf8"));
  metadata.exports["."] = { browser: "./browser.js", node: "./index.js" };
  metadata.exports["./escaped.module.css"] = "./escaped.module.css";
  await fs.writeFile(metadataFile, JSON.stringify(metadata));
  await assert.rejects(compileLiveStyles(await acceptedStyles(fixture.root)), {
    code: "interactive-bundle",
    reason: "source-not-captured",
    module: "node_modules/installed-style/escaped.module.css",
  });
});

test("empty opt-out for an extensionless outside-root stylesheet cannot create a Live capture", async (t) => {
  const fixture = await installedStylesFixture();
  t.after(() => fixture.remove());
  const externalRoot = `${fixture.root}-external`;
  const externalDirectory = path.join(
    externalRoot,
    "node_modules/installed-style",
  );
  await fs.mkdir(externalDirectory, { recursive: true });
  t.after(() => fs.rm(externalRoot, { recursive: true, force: true }));
  const original = path.join(fixture.directory, "card.module.css");
  const external = path.join(externalDirectory, "card.module.css");
  await fs.rename(original, external);
  await fs.symlink(external, original);
  const metadataFile = path.join(fixture.directory, "package.json");
  const metadata = JSON.parse(await fs.readFile(metadataFile, "utf8"));
  metadata.exports["./card"] = "./card.module.css";
  await fs.writeFile(metadataFile, JSON.stringify(metadata));
  await fs.writeFile(
    path.join(fixture.directory, "index.js"),
    'export { default } from "installed-style/card";',
  );
  await fs.writeFile(
    fixture.entryPath,
    `import styles from "installed-style";\n${validEntrySource({ body: "<span className={styles.card}>Empty stylesheet</span>" })}`,
  );
  await fs.writeFile(
    fixture.configPath,
    (await fs.readFile(fixture.configPath, "utf8")).replace(
      'interactive: "serve",',
      'interactive: "serve", moduleResolution: { loaders: { ".css": "empty" } },',
    ),
  );
  const accepted = await acceptedStyles(fixture.root);
  assert.ok(
    !accepted.interactiveSources!.resolutions.some(
      ({ importer }) => importer.type === "installed",
    ),
  );
  await assert.rejects(compileLiveStyles(accepted), {
    code: "interactive-bundle",
    reason: "source-not-captured",
    module: "node_modules/installed-style/card.module.css",
  });
});

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import {
  installedStylesFixture,
  installedStyleModule,
} from "./helpers/installed_styles.js";
import {
  acceptedStyles,
  compileLiveStyles,
} from "./helpers/interactive_styles.js";

for (const selector of ["browser condition", "browser field"] as const) {
  for (const target of [
    "captured",
    "uncaptured",
    "deleted bare",
    "deleted relative",
  ] as const) {
    test(`${selector} selects an unrecorded installed importer with ${target} CSS`, async (t) => {
      const fixture = await installedStylesFixture();
      t.after(() => fixture.remove());
      const metadataFile = path.join(fixture.directory, "package.json");
      const metadata = JSON.parse(await fs.readFile(metadataFile, "utf8"));
      if (selector === "browser condition") {
        metadata.exports["."] = { browser: "./browser.js", node: "./index.js" };
        metadata.exports["./browser-only.module.css"] =
          "./browser-only.module.css";
      } else {
        delete metadata.exports;
        metadata.main = "./index.js";
        metadata.browser = "./browser.js";
      }
      await fs.writeFile(metadataFile, JSON.stringify(metadata));
      let browser = installedStyleModule(
        target === "deleted relative" ? "./" : "installed-style/",
      );
      if (target === "uncaptured") {
        browser = browser.replace("card.module.css", "browser-only.module.css");
        await fs.writeFile(
          path.join(fixture.directory, "browser-only.module.css"),
          ".card { color: green; }",
        );
      }
      await fs.writeFile(
        path.join(fixture.directory, "browser.js"),
        `${browser}\nconsole.log("browser-selected-code");`,
      );
      const accepted = await acceptedStyles(fixture.root);
      assert.ok(
        !accepted.interactiveSources!.resolutions.some(
          ({ importer }) =>
            importer.type !== "entry" && importer.path.endsWith("browser.js"),
        ),
      );
      assert.ok(
        !accepted.interactiveSources!.files.some(({ paths }) =>
          paths.some((file) => file.endsWith("browser.js")),
        ),
      );
      if (target === "deleted bare" || target === "deleted relative")
        await fs.rm(path.join(fixture.directory, "card.module.css"));
      else if (target === "captured")
        await fs.writeFile(
          path.join(fixture.directory, "card.module.css"),
          ":global() { invalid: css; }",
        );
      if (target === "uncaptured") {
        await assert.rejects(compileLiveStyles(accepted), {
          code: "interactive-bundle",
          reason: "source-not-captured",
          module: "node_modules/installed-style/browser-only.module.css",
        });
      } else if (target === "deleted bare") {
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
      } else {
        const code = await compileLiveStyles(accepted);
        assert.match(code, /browser-selected-code/);
        assert.match(code, /mokly_[a-f0-9]{12}_card/);
      }
    });
  }
}

for (const request of ["package-name", "relative"] as const) {
  test(`an installed ${request} request for existing uncaptured CSS fails with the typed diagnostic`, async (t) => {
    const fixture = await installedStylesFixture(request);
    t.after(() => fixture.remove());
    const accepted = await acceptedStyles(fixture.root);
    const metadataFile = path.join(fixture.directory, "package.json");
    const metadata = JSON.parse(await fs.readFile(metadataFile, "utf8"));
    metadata.exports["./unrecorded.module.css"] = "./unrecorded.module.css";
    await fs.writeFile(metadataFile, JSON.stringify(metadata));
    await fs.writeFile(
      path.join(fixture.directory, "unrecorded.module.css"),
      ":global() { invalid: css; }",
    );
    await fs.writeFile(
      path.join(fixture.directory, "index.js"),
      installedStyleModule(
        request === "relative" ? "./" : "installed-style/",
      ).replace("card.module.css", "unrecorded.module.css"),
    );
    await assert.rejects(compileLiveStyles(accepted), {
      code: "interactive-bundle",
      reason: "source-not-captured",
      module: "node_modules/installed-style/unrecorded.module.css",
    });
  });
}

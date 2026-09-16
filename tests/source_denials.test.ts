import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { validateGeneratedOutputPaths } from "../dist/build/output_paths.js";
import { generatedOwnershipDenial } from "../dist/build/ownership.js";
import { isAuthoringSource } from "../dist/build/source_inventory.js";
import { loadConfig } from "../dist/config/load.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";

for (const aliases of ["all", "exclusions", "none"] as const) {
  test(`listed inputs take precedence over public exclusions in ${aliases} mode`, async (t) => {
    const fixture = await createFixture();
    t.after(() => removeFixture(fixture));
    const candidate = path.join(fixture.mockupsDir, "README.md");
    await fs.writeFile(candidate, "An imported authoring input");
    const config = {
      ...(await loadConfig(fixture.root)),
      sourceFiles: ["mockups/README.md"],
    };
    assert.deepEqual(isAuthoringSource(candidate, config, aliases), {
      kind: "listed",
    });
  });
}

test("source policy identifies entries, reserved names, listed inputs and matched exclusion globs", async (t) => {
  const fixture = await createFixture(undefined, {
    extraConfig: 'publicExclude: ["internal/**"],',
  });
  t.after(() => removeFixture(fixture));
  await fs.writeFile(path.join(fixture.mockupsDir, "helper.html"), "Source");
  await fs.writeFile(path.join(fixture.mockupsDir, "README.md"), "Private");
  await fs.symlink("../entries", path.join(fixture.mockupsDir, "source-alias"));
  await fs.symlink("README.md", path.join(fixture.mockupsDir, "alias.txt"));
  const config = {
    ...(await loadConfig(fixture.root)),
    sourceFiles: ["mockups/helper.html"],
  };
  for (const [name, reason] of [
    ["source-alias/page.html", { kind: "entries" }],
    ["page.source.html", { kind: "reserved" }],
    ["helper.html", { kind: "listed" }],
    ["internal/page.html", { kind: "exclusion", glob: "internal/**" }],
    ["alias.txt", { kind: "exclusion", glob: "**/README.*" }],
  ] as const) {
    assert.deepEqual(
      isAuthoringSource(path.join(config.mockupsDir, name), config),
      reason,
      name,
    );
  }
  assert.deepEqual(isAuthoringSource(fixture.entryPath, config), {
    kind: "entries",
  });
  assert.equal(
    isAuthoringSource(path.join(config.mockupsDir, "public.css"), config),
    undefined,
  );
  assert.equal(
    isAuthoringSource(
      path.join(config.mockupsDir, "alias.txt"),
      config,
      "none",
    ),
    undefined,
  );
});

test("generated-route denials distinguish source roots, reserved names, listed inputs and internal metadata", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  await fs.writeFile(path.join(fixture.mockupsDir, "helper.html"), "Source");
  await fs.symlink("../entries", path.join(fixture.mockupsDir, "source-alias"));
  await fs.writeFile(
    path.join(fixture.mockupsDir, "mokly-manifest.json"),
    "{}",
  );
  await fs.symlink(
    "mokly-manifest.json",
    path.join(fixture.mockupsDir, "metadata.html"),
  );
  const config = {
    ...(await loadConfig(fixture.root)),
    sourceFiles: ["mockups/helper.html"],
  };
  for (const [route, cause] of [
    ["source-alias/page.html", /authored source root.*entriesDir/],
    ["page.source.html", /reserved source basename/],
    ["helper.html", /authoring input.*sourceFiles/],
    ["metadata.html", /internal catalogue metadata/],
  ] as const) {
    assert.throws(
      () => validateGeneratedOutputPaths([route], config),
      (error: Error) => {
        assert.match(error.message, cause);
        assert.ok(error.message.includes(route));
        return true;
      },
    );
    if (route !== "metadata.html")
      assert.match(
        generatedOwnershipDenial(path.join(config.mockupsDir, route), config)!,
        cause,
      );
  }
});

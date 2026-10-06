import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { validateGeneratedOutputPaths } from "../packages/mokly/dist/build/output_paths.js";
import { generatedOwnershipDenial } from "../packages/mokly/dist/build/ownership.js";
import { isAuthoringSource } from "../packages/mokly/dist/build/source_inventory.js";
import { loadConfig } from "../packages/mokly/dist/config/load.js";

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
    ["source-alias/fixture.mockup.tsx", { kind: "entries" }],
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

test("generated-route denials retain source causes through canonical output aliases", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  for (const directory of ["entry-alias", "reserved", "listed", "metadata"])
    await fs.mkdir(path.join(fixture.mockupsDir, directory));
  await fs.writeFile(
    path.join(fixture.mockupsDir, "private.source.html"),
    "Source",
  );
  await fs.writeFile(
    path.join(fixture.mockupsDir, "listed/index.html"),
    "Source",
  );
  await fs.writeFile(
    path.join(fixture.mockupsDir, "mokly-manifest.json"),
    "{}",
  );
  await fs.symlink(
    "../../entries/fixture.mockup.tsx",
    path.join(fixture.mockupsDir, "entry-alias/index.html"),
  );
  await fs.symlink(
    "../private.source.html",
    path.join(fixture.mockupsDir, "reserved/index.html"),
  );
  await fs.symlink(
    "../mokly-manifest.json",
    path.join(fixture.mockupsDir, "metadata/index.html"),
  );
  const config = {
    ...(await loadConfig(fixture.root)),
    sourceFiles: ["mockups/listed/index.html"],
  };
  for (const [route, cause] of [
    ["entry-alias/index.html", /source file matched by roots/],
    ["reserved/index.html", /reserved source basename/],
    ["listed/index.html", /authoring input.*sourceFiles/],
    ["metadata/index.html", /internal catalogue metadata/],
  ] as const) {
    assert.throws(
      () => validateGeneratedOutputPaths([route], config),
      (error: Error) => {
        assert.match(error.message, cause);
        assert.ok(error.message.includes(route));
        return true;
      },
    );
    if (route !== "metadata/index.html")
      assert.match(
        generatedOwnershipDenial(path.join(config.mockupsDir, route), config)!,
        cause,
      );
  }
});

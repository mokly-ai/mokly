import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { parseArguments } from "../dist/cli/arguments.js";
import {
  defineRoot,
  folder,
  mockLink,
  reviewMaterialKey,
  screen,
} from "../dist/index.js";

import { repositoryRoot } from "./helpers/fixture.js";
import { GUIDE_PATHS } from "./helpers/guides.js";

const execFileAsync = promisify(execFile);

test("public helpers retain stable authoring semantics", () => {
  assert.equal(mockLink("account-home"), "mock:account-home");
  assert.equal(
    mockLink("account-home", "billing-section"),
    "mock:account-home#billing-section",
  );
  for (const invalid of [
    "account-home#billing-section",
    "account-home%23billing-section",
    "mock:account-home",
    "AccountHome",
  ]) {
    assert.throws(() => mockLink(invalid), /expected kebab-case/);
  }
  assert.throws(() => mockLink("account-home", "#billing"), /fragment/);
  assert.throws(() => mockLink("account-home", "billing section"), /fragment/);
  assert.equal(
    reviewMaterialKey({ beta: 2, alpha: 1 }),
    reviewMaterialKey({ alpha: 1, beta: 2 }),
  );
  const definitions = defineRoot({
    children: [
      folder({
        children: [
          screen({
            description: "Nested screen",
            desktop: "desktop",
            id: "nested-screen",
            mobile: "mobile",
            slug: "screen",
            title: "Screen",
          }),
        ],
        segment: "group",
        title: "Group",
      }),
    ],
    path: "screens",
  });
  assert.deepEqual(
    definitions.map((entry) => entry.id),
    ["nested-screen"],
  );
  assert.equal(
    definitions[0]?.kind === "screen" ? definitions[0].route : "",
    "screens/group/screen.html",
  );
  assert.deepEqual(definitions[0]?.navPath, ["Group"]);

  const rooted = defineRoot({
    children: [
      screen({
        description: "Rooted screen",
        desktop: "desktop",
        id: "rooted-screen",
        mobile: "mobile",
        slug: "rooted",
        title: "Rooted screen",
      }),
    ],
    navPath: ["Visible root"],
    path: "screens",
  });
  assert.deepEqual(
    rooted.map(({ id }) => id),
    ["rooted-screen"],
  );
  assert.deepEqual(rooted[0]?.navPath, ["Visible root"]);
});

test("public link helpers reject non-string runtime values", () => {
  for (const invalid of [null, true, 42, ["account-home"]]) {
    assert.throws(
      () => mockLink(invalid as never),
      /expected kebab-case/,
      String(invalid),
    );
  }
  for (const invalid of [true, 42, ["billing-section"]]) {
    assert.throws(
      () => mockLink("account-home", invalid as never),
      /fragment/,
      String(invalid),
    );
  }
});

test("CLI defaults to watched serve and rejects misplaced options", () => {
  assert.deepEqual(parseArguments([]), {
    command: "serve",
    help: false,
    version: false,
  });
  assert.equal(
    parseArguments(["serve", "--no-watch", "--port", "0"]).watch,
    false,
  );
  assert.throws(
    () => parseArguments(["build", "--port", "1234"]),
    /belong to serve/,
  );
  assert.throws(
    () => parseArguments(["serve", "--update-version", "2"]),
    /reserved for the watched server child/,
  );
  assert.throws(
    () => parseArguments(["serve", "--strict-port"]),
    /reserved for the watched server child/,
  );
  assert.throws(() => parseArguments(["unknown"]), /unknown command/);
});

test("packed package contains only the declared public surface", async () => {
  const { stdout } = await execFileAsync(
    "npm",
    ["pack", "--dry-run", "--json", "--ignore-scripts"],
    {
      cwd: repositoryRoot,
      maxBuffer: 16 * 1024 * 1024,
    },
  );
  const report = JSON.parse(stdout) as Array<{
    files: Array<{ path: string }>;
  }>;
  const files = new Set(report[0]?.files.map((file) => file.path));
  assert.ok(files.has("dist/index.js"));
  assert.ok(files.has("dist/index.d.ts"));
  assert.ok(files.has("dist/cli/bin.js"));
  assert.ok(files.has("dist/cli/publish.js"));
  assert.ok(files.has("docs/protocol/mokly-upload.md"));
  assert.ok(files.has("docs/protocol/mokly-export-ownership.md"));
  assert.ok(files.has("docs/protocol/fixtures/export-ownership-v1.json"));
  for (const guidePath of GUIDE_PATHS) assert.ok(files.has(guidePath));
  assert.equal(
    [...files].filter((file) => file.startsWith("docs/guides/")).length,
    30,
  );
  assert.ok(files.has("README.md"));
  for (const excluded of ["examples/", "plans/", "site/", "tests/"])
    assert.equal(
      [...files].some((file) => file.startsWith(excluded)),
      false,
      `${excluded} must stay outside the package`,
    );
  const bin = await fs.promises.readFile(
    path.join(repositoryRoot, "dist/cli/bin.js"),
    "utf8",
  );
  assert.ok(bin.startsWith("#!/usr/bin/env node"));
});

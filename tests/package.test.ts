import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { parseArguments } from "../dist/cli/arguments.js";
import {
  defineFolder,
  defineScreen,
  mockLink,
  reviewMaterialKey,
} from "../dist/index.js";
import { entryRoute } from "../packages/viewer/dist/data.js";

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
    "account.home",
  ]) {
    assert.throws(() => mockLink(invalid), /expected a complete path/);
  }
  assert.throws(() => mockLink("account-home", "#billing"), /fragment/);
  assert.throws(() => mockLink("account-home", "billing section"), /fragment/);
  assert.equal(
    reviewMaterialKey({ beta: 2, alpha: 1 }),
    reviewMaterialKey({ alpha: 1, beta: 2 }),
  );
  const screen = defineScreen({
    slug: "invoice",
    path: "account/invoice",
    title: "Invoice",
    description: "An invoice",
    relatedDocs: [],
    mobile: "Invoice",
    desktop: "Invoice",
  });
  assert.equal(entryRoute(screen.path!), "account/invoice/index.html");
  assert.equal(
    defineFolder({ path: "account", title: "My account" }).path,
    "account",
  );
  assert.equal(mockLink("./invoice"), "mock:./invoice");
  assert.equal(mockLink("Account/Invoice"), "mock:Account/Invoice");
});

test("public link helpers reject non-string runtime values", () => {
  for (const invalid of [null, true, 42, ["account-home"]]) {
    assert.throws(
      () => mockLink(invalid as never),
      /expected a complete path/,
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
  assert.ok(files.has("docs/protocol/mokly-upload-exchange.md"));
  assert.ok(files.has("docs/protocol/mokly-upload-validation.md"));
  assert.ok(files.has("docs/protocol/mokly-export-ownership.md"));
  assert.ok(files.has("docs/protocol/fixtures/export-ownership-v2.json"));
  assert.ok(files.has("docs/protocol/fixtures/upload-plan-v1.json"));
  for (const guidePath of GUIDE_PATHS) assert.ok(files.has(guidePath));
  assert.ok(files.has("docs/guides/authoring/styles.md"));
  assert.equal(
    [...files].filter((file) => file.startsWith("docs/guides/")).length,
    31,
  );
  assert.ok(files.has("README.md"));
  for (const excluded of ["examples/", "plans/", "scripts/", "site/", "tests/"])
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

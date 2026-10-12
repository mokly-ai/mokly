import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { writeCompilation } from "../dist/build/transaction.js";
import { PlainReporter } from "../dist/cli/reporter/plain.js";
import { run } from "../dist/cli/run.js";
import { loadConfig } from "../dist/config/load.js";

import { createExportFixture } from "./helpers/export_fixture.js";
import { startFakeReceiver } from "./helpers/fake_receiver.js";
import { createFixture, removeFixture } from "./helpers/fixture.js";
import { memoryTerminal } from "./helpers/terminal.js";

const renderer = (
  resources: string,
) => `import {renderToStaticMarkup} from "react-dom/server";
export default (input) => ({html:'<html><head></head><body>' + renderToStaticMarkup(input.node) + '</body></html>', resources:${resources}});`;

test("generated stylesheet owner warnings keep one identity before and after disk publication", async (t) => {
  const fixture = await createFixture(undefined, {
    extraConfig: 'renderer: "renderer.tsx",',
  });
  t.after(() => removeFixture(fixture));
  await fs.appendFile(fixture.entryPath, '\nimport "./entry.css";');
  await fs.writeFile(
    path.join(fixture.entriesDir, "entry.css"),
    ".unused{color:red}",
  );
  const route = "mokly-generated/styles/entries/fixture.mockup.tsx.css";
  await fs.writeFile(
    path.join(fixture.root, "renderer.tsx"),
    renderer(
      JSON.stringify([
        { path: route, componentIds: ["invalid owner"] },
        { path: route, componentIds: null },
      ]),
    ),
  );
  const config = await loadConfig(fixture.root);
  const before = await compileCatalogue(config);
  await writeCompilation(before, config);
  const after = await compileCatalogue(config);
  assert.deepEqual(before.diagnostics, after.diagnostics);
  assert.ok(before.diagnostics!.length > 0);
  for (const warning of before.diagnostics!) {
    assert.equal(warning.code, "ignored-stylesheet-resource-owner");
    assert.equal(
      warning.message,
      `Stylesheet ownership for "${route}" is ignored. Changes follow the elements that each changed rule matches.`,
    );
  }
  assert.equal(
    new Set(before.diagnostics!.map((warning) => JSON.stringify(warning))).size,
    before.diagnostics!.length,
  );
});

test("Build, Check, export and publish warn once per CSS file and route without owners", async (t) => {
  const fixture = await createExportFixture();
  t.after(() => fixture.close());
  await fs.writeFile(
    path.join(fixture.mockupsDir, "unlinked.CSS"),
    ".unused{color:red}",
  );
  await fs.writeFile(
    fixture.configPath,
    (await fs.readFile(fixture.configPath, "utf8")).replace(
      "defineConfig({",
      'defineConfig({renderer:"renderer.tsx",',
    ),
  );
  await fs.writeFile(
    path.join(fixture.root, "renderer.tsx"),
    renderer(
      JSON.stringify([
        { path: "unlinked.CSS", componentIds: null },
        { path: "unlinked.CSS", componentIds: ["invalid owner"] },
        { path: "unlinked.CSS", componentIds: [] },
      ]),
    ),
  );
  await fs.writeFile(path.join(fixture.root, ".gitignore"), "site/\n");
  const receiver = await startFakeReceiver(t);
  const outputs: string[][] = [];
  for (const command of [
    ["build"],
    ["check"],
    ["export", "--out", "site"],
    [
      "publish",
      "--no-changes",
      "--out",
      "published",
      "--endpoint",
      receiver.endpoint,
      "--token",
      "fixture-token",
      "--repository",
      "github.com/example/catalogue",
    ],
  ]) {
    if (command[0] === "publish") {
      await fixture.git("add", "-A");
      await fixture.git(
        "commit",
        "-qm",
        "test: commit CSS owner warning fixture",
      );
    }
    const terminal = memoryTerminal({
      isTTY: false,
      env: { ...process.env, MOKLY_OUTPUT: "plain", NO_COLOR: "1" },
    });
    const reporter = new PlainReporter(terminal.environment);
    try {
      assert.equal(
        await run(
          [...command, "--config", fixture.configPath],
          fixture.root,
          terminal.environment,
          reporter,
        ),
        0,
        terminal.stderr(),
      );
    } finally {
      reporter.close();
    }
    const warnings = terminal
      .stderr()
      .trim()
      .split("\n")
      .filter((line) => line.includes("Stylesheet ownership"));
    assert.ok(warnings.length > 0);
    assert.equal(new Set(warnings).size, warnings.length);
    assert.ok(
      warnings.every(
        (line) =>
          line.includes('"unlinked.CSS"') &&
          line.endsWith(
            "is ignored. Changes follow the elements that each changed rule matches.",
          ),
      ),
    );
    outputs.push(warnings);
  }
  for (const warnings of outputs) assert.deepEqual(warnings, outputs[0]);
});

import assert from "node:assert/strict";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import {
  parseArguments,
  validateInteractiveArguments,
} from "../dist/cli/arguments.js";
import { loadConfig } from "../dist/config/load.js";
import { resolveConfig } from "../dist/config/validate.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";

test("interactive config defaults off and accepts only off or serve", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  const input = {
    entriesDir: "entries",
    mockupsDir: "mockups",
    repoRoot: ".",
  };

  assert.equal(resolveConfig(input, fixture.configPath).interactive, "off");
  assert.equal(
    resolveConfig({ ...input, interactive: "serve" }, fixture.configPath)
      .interactive,
    "serve",
  );
  assert.throws(
    () =>
      resolveConfig(
        { ...input, interactive: "export" as "off" },
        fixture.configPath,
      ),
    { code: "config-invalid" },
  );
});

test("Live CLI values are serve-only, canonical and config-gated", () => {
  assert.deepEqual(
    parseArguments([
      "serve",
      "--interactive-port=0",
      "--interactive-origin=https://catalogue.example:8443",
    ]),
    {
      command: "serve",
      help: false,
      interactiveOrigin: "https://catalogue.example:8443",
      interactivePort: 0,
      version: false,
    },
  );
  for (const origin of [
    "ftp://catalogue.example",
    "https://user@catalogue.example",
    "https://catalogue.example/",
    "https://catalogue.example/path",
    "https://catalogue.example?query=1",
    "https://catalogue.example#fragment",
    "https://catalogue.example:443",
  ])
    assert.throws(
      () => parseArguments(["serve", `--interactive-origin=${origin}`]),
      /canonical HTTP\(S\) origin/,
    );
  for (const argv of [
    ["serve", "--interactive-port=-1"],
    ["serve", "--interactive-port=65536"],
    ["build", "--interactive-port=4101"],
    ["check", "--interactive-origin=http://localhost:4101"],
  ])
    assert.throws(() => parseArguments(argv), { code: "cli-invalid" });

  const args = parseArguments(["serve", "--interactive-port=4101"]);
  assert.throws(() => validateInteractiveArguments(args, "off"), {
    code: "cli-invalid",
  });
  assert.doesNotThrow(() => validateInteractiveArguments(args, "serve"));
});

test("build bytes are identical for off and serve", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);

  const off = await compileCatalogue({ ...config, interactive: "off" });
  const serve = await compileCatalogue({ ...config, interactive: "serve" });

  assert.deepEqual(serve.manifest, off.manifest);
  assert.deepEqual(serve.outputs, off.outputs);
});

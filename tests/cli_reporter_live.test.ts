import assert from "node:assert/strict";
import test from "node:test";

import { PlainReporter } from "../dist/cli/reporter/plain.js";
import { RichReporter } from "../dist/cli/reporter/rich.js";

import { memoryTerminal } from "./helpers/terminal.js";

const ESCAPE = String.fromCharCode(27);
const ANSI = new RegExp(`${ESCAPE}\\[[0-9;]*[A-Za-z]`, "g");

test("Serve reporters announce the private Live origin", () => {
  const plainTerminal = memoryTerminal({ isTTY: false });
  new PlainReporter(plainTerminal.environment).serveReady({
    base: "origin/main",
    configPath: "mokly.config.ts",
    generatedOutput: "committed",
    interactiveOrigin: "https://live.example.test",
    url: "http://127.0.0.1:4173",
    version: "0.10.0",
    watch: true,
  });
  assert.equal(
    plainTerminal.stdout(),
    "Mokly listening at http://127.0.0.1:4173 (watching)\n" +
      "Mokly Live at https://live.example.test\n",
  );

  const richTerminal = memoryTerminal({ columns: 48, isTTY: true });
  new RichReporter(richTerminal.environment).serveReady({
    base: "origin/main",
    configPath: "mokly.config.ts",
    generatedOutput: "committed",
    interactiveOrigin: "https://live.example.test",
    url: "http://127.0.0.1:4173",
    version: "0.10.0",
    watch: false,
  });
  assert.match(
    richTerminal.stdout(),
    /Live frames {2}https:\/\/live\.example\.test/,
  );
  assert.ok(
    richTerminal
      .stdout()
      .split("\n")
      .every((line) => line.replace(ANSI, "").length <= 48),
  );
});

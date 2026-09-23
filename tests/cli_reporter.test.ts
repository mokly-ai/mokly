import assert from "node:assert/strict";
import test from "node:test";

import { PlainReporter } from "../dist/cli/reporter/plain.js";
import { RichReporter } from "../dist/cli/reporter/rich.js";
import { selectOutputMode } from "../dist/cli/reporter/select.js";
import {
  formatDuration,
  truncateTerminalLine,
} from "../dist/cli/reporter/terminal.js";
import { MoklyError } from "../dist/errors.js";

import { memoryTerminal } from "./helpers/terminal.js";

const ESCAPE = String.fromCharCode(27);
const ANSI = new RegExp(`${ESCAPE}\\[[0-9;]*[A-Za-z]`, "g");

test("output mode selection keeps diagnostics and automation plain", () => {
  assert.equal(
    selectOutputMode(["serve", "--debug-timings"], true, {
      MOKLY_OUTPUT: "rich",
    }),
    "plain",
  );
  assert.equal(selectOutputMode([], true, { MOKLY_OUTPUT: "plain" }), "plain");
  assert.equal(
    selectOutputMode([], false, { MOKLY_OUTPUT: "rich", CI: "1" }),
    "rich",
  );
  assert.equal(selectOutputMode([], true, { CI: "true" }), "plain");
  assert.equal(selectOutputMode([], true, {}), "rich");
  assert.equal(selectOutputMode([], false, {}), "plain");
  assert.equal(selectOutputMode([], true, { MOKLY_OUTPUT: "other" }), "rich");
});

test("plain reporter retains every stable successful command string", () => {
  const terminal = memoryTerminal({ isTTY: false });
  const reporter = new PlainReporter(terminal.environment);
  reporter.write("Mokly listening at http://127.0.0.1:4173 (watching)\n");
  reporter.write("Mokly listening at http://127.0.0.1:4173\n");
  reporter.summary(
    "Generated 278 Mokly files.\n",
    "Generated 278 files in generated",
    5_900,
  );
  reporter.write("Mokly output is valid and untracked (278 files).\n");
  reporter.write("Mokly output is current (278 files).\n");
  reporter.write(
    "Exported Mokly to site.\nDeploy this directory at your site's root with your hosting provider.\n",
  );
  reporter.write("Published Mokly catalogue.\n");
  reporter.renderError(
    new MoklyError("build-invalid", "broken entry"),
    (value) => value,
  );
  assert.equal(
    terminal.stdout(),
    "Mokly listening at http://127.0.0.1:4173 (watching)\n" +
      "Mokly listening at http://127.0.0.1:4173\n" +
      "Generated 278 Mokly files.\n" +
      "Mokly output is valid and untracked (278 files).\n" +
      "Mokly output is current (278 files).\n" +
      "Exported Mokly to site.\n" +
      "Deploy this directory at your site's root with your hosting provider.\n" +
      "Published Mokly catalogue.\n",
  );
  assert.equal(terminal.stderr(), "[mokly/build-invalid] broken entry\n");
});

test("rich reporter clears one spinner before durable output and bounds lines", () => {
  const terminal = memoryTerminal({ columns: 32, isTTY: true });
  const reporter = new RichReporter(terminal.environment);
  const phase = reporter.startPhase("Rendering an unusually long catalogue");
  phase.succeed("Catalogue rendered");
  reporter.summary("plain\n", "Generated 278 files in a long directory", 5_940);
  reporter.close();
  assert.ok(terminal.stdout().includes(`\r${ESCAPE}[2K`));
  for (const line of terminal.stdout().split(/[\r\n]/)) {
    const visible = line.replace(ANSI, "");
    assert.ok(visible.length <= 32, JSON.stringify(visible));
  }
  assert.match(terminal.stdout(), /Catalogue rendered/);
  assert.match(terminal.stdout(), /Generated 278 files/);
});

test("rich reporter colours only success ticks when stdout supports colour", () => {
  const terminal = memoryTerminal({ env: {}, isTTY: true });
  const reporter = new RichReporter(terminal.environment);
  const phase = reporter.startPhase("Loading configuration");
  phase.succeed("Configuration loaded");
  reporter.summary("plain\n", "Generated 278 files", 5_940);
  reporter.close();

  const greenTick = `${ESCAPE}[32m✔${ESCAPE}[39m`;
  assert.equal(terminal.stdout().split(greenTick).length - 1, 2);
  assert.doesNotMatch(
    terminal.stdout(),
    new RegExp(`${ESCAPE}\\[32m✔ Configuration loaded`),
  );
});

test("rich reporter preserves a green success tick when its line is truncated", () => {
  const terminal = memoryTerminal({ columns: 20, env: {}, isTTY: true });
  const reporter = new RichReporter(terminal.environment);
  reporter.summary("plain\n", "Generated 278 files in a long directory", 5_940);
  reporter.close();

  const output = terminal.stdout();
  assert.ok(output.includes(`${ESCAPE}[32m✔${ESCAPE}[39m`));
  assert.equal(output.replace(ANSI, ""), "  ✔ Generated 278 f…\n");
});

test("rich Serve makes its URL the sole content of a bordered panel", () => {
  const terminal = memoryTerminal({ columns: 80, isTTY: true });
  const reporter = new RichReporter(terminal.environment);
  reporter.serveReady({
    base: "origin/main",
    configPath: "examples/basic/mokly.config.ts",
    url: "http://127.0.0.1:4173",
    version: "0.10.0",
    watch: true,
  });
  assert.equal(
    terminal.stdout(),
    "  mokly 0.10.0  comparing against origin/main\n" +
      "  examples/basic/mokly.config.ts\n" +
      "\n" +
      `  ┌${"─".repeat(25)}┐\n` +
      "  │  http://127.0.0.1:4173  │\n" +
      `  └${"─".repeat(25)}┘\n` +
      "  watching entries, renderer and styles · press h for shortcuts\n" +
      "\n",
  );
});

test("rich Serve keeps snapshot and non-interactive status secondary", () => {
  const snapshotTerminal = memoryTerminal({ columns: 80, isTTY: true });
  const snapshotReporter = new RichReporter(snapshotTerminal.environment);
  snapshotReporter.serveReady({
    base: "origin/main",
    configPath: "mokly.config.ts",
    url: "http://127.0.0.1:4173",
    version: "0.10.0",
    watch: false,
  });
  assert.match(snapshotTerminal.stdout(), /\n {2}snapshot\n\n$/);
  assert.doesNotMatch(snapshotTerminal.stdout(), /press h/);

  const watchedTerminal = memoryTerminal({
    columns: 80,
    inputTTY: false,
    isTTY: true,
  });
  const watchedReporter = new RichReporter(watchedTerminal.environment);
  watchedReporter.serveReady({
    base: "origin/main",
    configPath: "mokly.config.ts",
    url: "http://127.0.0.1:4173",
    version: "0.10.0",
    watch: true,
  });
  assert.match(
    watchedTerminal.stdout(),
    /\n {2}watching entries, renderer and styles\n\n$/,
  );
  assert.doesNotMatch(watchedTerminal.stdout(), /press h/);
});

test("rich Serve contracts its URL panel to a narrow terminal", () => {
  const terminal = memoryTerminal({ columns: 24, isTTY: true });
  const reporter = new RichReporter(terminal.environment);
  reporter.serveReady({
    base: "origin/main",
    configPath: "mokly.config.ts",
    url: "http://127.0.0.1:4173",
    version: "0.10.0",
    watch: false,
  });
  const lines = terminal.stdout().split("\n");
  assert.deepEqual(lines.slice(3, 6), [
    `  ┌${"─".repeat(20)}┐`,
    "  │  http://127.0.0.…  │",
    `  └${"─".repeat(20)}┘`,
  ]);
  assert.ok(lines.every((line) => line.length <= 24));
});

test("terminal helpers format durations and width deterministically", () => {
  assert.equal(formatDuration(0), "0ms");
  assert.equal(formatDuration(312.4), "312ms");
  assert.equal(formatDuration(4_949), "4.9s");
  assert.equal(formatDuration(123_000), "2m 03s");
  assert.equal(truncateTerminalLine("0123456789", 8), "0123456…");
  assert.equal(truncateTerminalLine("short", 8), "short");
  assert.equal(
    truncateTerminalLine(`${ESCAPE}[36m0123456789${ESCAPE}[39m`, 8),
    `${ESCAPE}[36m0123456…${ESCAPE}[0m`,
  );
});

test("rich error rendering redacts secrets before writing", () => {
  const terminal = memoryTerminal({ isTTY: true });
  const reporter = new RichReporter(terminal.environment);
  reporter.renderError(
    new MoklyError("upload-failed", "token fixture-secret was rejected"),
    (value) => value.replaceAll("fixture-secret", "[REDACTED]"),
  );
  assert.doesNotMatch(terminal.stderr(), /fixture-secret/);
  assert.match(terminal.stderr(), /catalogue could not be published/i);
  assert.match(terminal.stderr(), /\[mokly\/upload-failed\]/);
});

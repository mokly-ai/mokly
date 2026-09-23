import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { parseArguments } from "../dist/cli/arguments.js";
import {
  browserCommand,
  openServedBrowser,
  type BrowserOpener,
} from "../dist/cli/browser.js";
import { PlainReporter } from "../dist/cli/reporter/plain.js";
import { RichReporter } from "../dist/cli/reporter/rich.js";
import { ServeShortcuts } from "../dist/cli/reporter/shortcuts.js";

import {
  createFixture,
  removeFixture,
  repositoryRoot,
} from "./helpers/fixture.js";
import { memoryTerminal } from "./helpers/terminal.js";

const cli = path.join(repositoryRoot, "dist/cli/bin.js");

test("serve --open is accepted only by the public Serve command", () => {
  assert.equal(parseArguments(["serve", "--open"]).open, true);
  assert.equal(parseArguments(["--open"]).open, true);
  for (const command of [
    "build",
    "check",
    "export",
    "publish",
    "__serve-child",
  ])
    assert.throws(() => parseArguments([command, "--open"]), /cli-invalid/);
  assert.throws(
    () => parseArguments(["serve", "--open=true"]),
    /unknown option/,
  );
});

test("rich watched shortcuts dispatch every supported key and ignore others", async () => {
  const terminal = memoryTerminal({ isTTY: true });
  const reporter = new RichReporter(terminal.environment);
  const actions: string[] = [];
  const shortcuts = new ServeShortcuts(terminal.environment, reporter, {
    clear: () => actions.push("clear"),
    close: () => actions.push("close"),
    help: () => actions.push("help"),
    open: async () => {
      actions.push("open");
    },
    rebuild: () => actions.push("rebuild"),
  });
  assert.equal(shortcuts.start(), true);
  assert.equal(terminal.stdin.isRaw, true);
  terminal.stdin.emit("data", Buffer.from("orchx"));
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(actions, ["open", "rebuild", "clear", "help"]);
  terminal.stdin.emit("data", Buffer.from("q"));
  terminal.stdin.emit("data", Buffer.from("\u0003"));
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(actions.slice(4), ["close", "close"]);
  shortcuts.close();
  assert.equal(terminal.stdin.isRaw, false);
  assert.equal(terminal.stdin.listenerCount("data"), 0);
});

test("shortcuts do not claim plain, non-TTY, or ended stdin", () => {
  for (const options of [
    { isTTY: false, inputTTY: true },
    { isTTY: true, inputTTY: false },
    { isTTY: true, inputTTY: true, inputEnded: true },
  ]) {
    const terminal = memoryTerminal(options);
    const reporter = options.isTTY
      ? new RichReporter(terminal.environment)
      : new PlainReporter(terminal.environment);
    const shortcuts = new ServeShortcuts(terminal.environment, reporter, {
      clear() {},
      close() {},
      help() {},
      async open() {},
      rebuild() {},
    });
    assert.equal(shortcuts.start(), false);
    assert.equal(terminal.stdin.listenerCount("data"), 0);
    assert.equal(terminal.stdin.isRaw, false);
  }
});

test("browser commands are platform-specific and opening failures are warnings", async () => {
  assert.deepEqual(browserCommand("darwin", "http://127.0.0.1:4173"), {
    args: ["http://127.0.0.1:4173"],
    command: "open",
  });
  assert.deepEqual(browserCommand("linux", "http://127.0.0.1:4173"), {
    args: ["http://127.0.0.1:4173"],
    command: "xdg-open",
  });
  assert.deepEqual(browserCommand("win32", "http://127.0.0.1:4173"), {
    args: ["/d", "/s", "/c", "start", "", "http://127.0.0.1:4173"],
    command: "cmd.exe",
  });
  const terminal = memoryTerminal({ isTTY: true });
  const reporter = new RichReporter(terminal.environment);
  let opened = "";
  assert.equal(
    await openServedBrowser(
      {
        async open(url) {
          opened = url;
        },
      },
      reporter,
      "http://127.0.0.1:4173",
    ),
    true,
  );
  assert.equal(opened, "http://127.0.0.1:4173");
  const opener: BrowserOpener = {
    async open() {
      throw new Error("synthetic opener failure");
    },
  };
  assert.equal(
    await openServedBrowser(opener, reporter, "http://127.0.0.1:4173"),
    false,
  );
  assert.match(terminal.stderr(), /Could not open the browser/);
  assert.doesNotMatch(terminal.stderr(), /synthetic opener failure/);
});

test(
  "plain Serve with piped stdin exits promptly on SIGINT",
  { timeout: 15_000 },
  async (t) => {
    const fixture = await createFixture();
    t.after(() => removeFixture(fixture));
    const child = spawn(
      process.execPath,
      [
        "--import",
        "tsx",
        "--import",
        pathToFileURL(
          path.join(
            repositoryRoot,
            "tests/helpers/serve_ready_signal_preload.ts",
          ),
        ).href,
        cli,
        "serve",
        "--config",
        fixture.configPath,
        "--port",
        "0",
      ],
      {
        cwd: fixture.root,
        env: { ...process.env, MOKLY_OUTPUT: "plain" },
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
    t.after(() => {
      if (child.exitCode === null && child.signalCode === null)
        child.kill("SIGKILL");
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.stdin.on("error", () => undefined);
    for (let attempt = 0; attempt < 300; attempt++) {
      if (stdout.includes("MOKLY_TEST_READY_REPORT_BLOCKED")) break;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    assert.match(stdout, /Mokly listening at/);
    assert.match(stdout, /MOKLY_TEST_READY_REPORT_BLOCKED/);
    const exited = new Promise<number | null>((resolve) =>
      child.once("exit", (code) => resolve(code)),
    );
    child.kill("SIGINT");
    child.stdin.end("\n");
    assert.equal(await exited, 0, stderr);
  },
);

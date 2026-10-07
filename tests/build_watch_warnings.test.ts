import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { PlainReporter } from "../dist/cli/reporter/plain.js";
import { run } from "../dist/cli/run.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";
import { registerWarningPage } from "./helpers/link_control_warning_fixture.js";
import { memoryTerminal } from "./helpers/terminal.js";

const warning =
  "[mokly/warning] warning-page/index.html: MockLink child control is inside <button>; one click or key press has two targets\n";

for (const strict of [false, true]) {
  test(`watched Build reports warnings before its writer (strict=${strict})`, async (t) => {
    const fixture = await createFixture();
    t.after(() => removeFixture(fixture));
    await registerWarningPage(fixture);
    const terminal = memoryTerminal({ isTTY: false });
    const reporter = new StopAfterGeneration(terminal.environment);
    await run(
      [
        "build",
        "--watch",
        "--config",
        fixture.configPath,
        ...(strict ? ["--strict"] : []),
      ],
      fixture.root,
      terminal.environment,
      reporter,
    );
    assert.equal(
      terminal.stderr(),
      warning +
        (strict ? "[mokly/build-invalid] 1 build warning with --strict\n" : ""),
    );
    assert.equal(fs.existsSync(fixture.generatedDir), !strict);
    if (strict) assert.equal(terminal.stdout(), "");
    else assert.match(terminal.stdout(), /^Generated \d+ Mokly files\.\n$/);
  });
}

class StopAfterGeneration extends PlainReporter {
  override summary(plain: string, rich: string, durationMs: number): void {
    super.summary(plain, rich, durationMs);
    process.emit("SIGTERM");
  }

  override runtimeDiagnostic(error: unknown): void {
    super.runtimeDiagnostic(error);
    process.emit("SIGTERM");
  }
}

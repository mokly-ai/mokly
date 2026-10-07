import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { PlainReporter } from "../dist/cli/reporter/plain.js";
import { run } from "../dist/cli/run.js";
import { MoklyError } from "../dist/errors.js";

import { createExportFixture } from "./helpers/export_fixture.js";
import { startFakeReceiver } from "./helpers/fake_receiver.js";
import { registerWarningPage } from "./helpers/link_control_warning_fixture.js";
import { memoryTerminal } from "./helpers/terminal.js";

for (const command of ["export", "publish"] as const) {
  test(`${command} strict mode counts config, entry and link warnings before capture`, async (t) => {
    const fixture = await createExportFixture();
    t.after(() => fixture.close());
    await registerWarningPage(fixture);
    await fs.writeFile(
      fixture.entryPath,
      (await fs.readFile(fixture.entryPath, "utf8")).replace(
        'path: "home",',
        'path: "home", dependencies: [],',
      ),
    );
    await fs.writeFile(
      fixture.configPath,
      (await fs.readFile(fixture.configPath, "utf8")).replace(
        'review: { outDir: ".review" }',
        'review: { outDir: ".review", sharedImpact: [] }',
      ),
    );
    if (command === "publish") {
      await fixture.git("add", "-A");
      await fixture.git("commit", "-qm", "test: commit strict warning fixture");
    }
    const receiver = await startFakeReceiver(t);
    const terminal = memoryTerminal({ isTTY: false });
    const reporter = new PlainReporter(terminal.environment);
    const args = [
      command,
      "--strict",
      "--out",
      "strict-site",
      "--config",
      fixture.configPath,
    ];
    if (command === "publish")
      args.push(
        "--no-changes",
        "--endpoint",
        receiver.endpoint,
        "--token",
        "fixture-token",
        "--repository",
        "github.com/example/catalogue",
      );
    const before = await fs.readdir(fixture.mockupsDir);
    try {
      await assert.rejects(
        run(args, fixture.root, terminal.environment, reporter),
        (error: unknown) => {
          assert.ok(error instanceof MoklyError);
          assert.equal(error.code, "build-invalid");
          assert.equal(
            error.message,
            "[mokly/build-invalid] 3 build warnings with --strict",
          );
          return true;
        },
      );
      assert.deepEqual(terminal.stderr().split("\n").filter(Boolean), [
        '[mokly/warning] configuration "mokly.config.ts": review.sharedImpact has been removed; ignoring it. Delete the field.',
        '[mokly/warning] entry "home": dependencies has been removed; ignoring it. Delete the field.',
        "[mokly/warning] warning-page/index.html: MockLink child control is inside <button>; one click or key press has two targets",
      ]);
      assert.deepEqual(await fs.readdir(fixture.mockupsDir), before);
      await assert.rejects(fs.stat(path.join(fixture.root, "strict-site")), {
        code: "ENOENT",
      });
      assert.equal(receiver.plans.length, 0);
      assert.equal(receiver.puts.length, 0);
      assert.equal(receiver.publications.size, 0);
    } finally {
      reporter.close();
    }
  });
}

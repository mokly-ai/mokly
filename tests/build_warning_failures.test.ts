import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { PlainReporter } from "../dist/cli/reporter/plain.js";
import { RichReporter } from "../dist/cli/reporter/rich.js";
import { run } from "../dist/cli/run.js";
import { FileSystemConfigLoader } from "../dist/config/load.js";
import { serve } from "../dist/server/serve.js";

import { createExportFixture } from "./helpers/export_fixture.js";
import { repositoryRoot, validEntrySource } from "./helpers/fixture.js";
import { linkWarningFailureFixture } from "./helpers/link_control_warning_fixture.js";
import { memoryTerminal } from "./helpers/terminal.js";
import { warningFixture } from "./helpers/warning_generations.js";
import {
  FakeOutputStore,
  FakeSupervisor,
  FakeSupervisorFactory,
  FakeWatcherFactory,
} from "./helpers/watch_config.js";

const configMessage =
  "review.sharedImpact has been removed; ignoring it. Delete the field.";

for (const mode of ["plain", "rich"] as const)
  for (const outcome of ["resource", "transform", "success"] as const)
    test(`${mode} Build and Check retain link warnings on ${outcome}`, async (t) => {
      const fixture = await linkWarningFailureFixture(outcome);
      t.after(() => fixture.remove());
      for (const command of ["build", "check"])
        await t.test(command, async () => {
          const terminal = memoryTerminal({ isTTY: false, columns: 240 });
          const reporter =
            mode === "plain"
              ? new PlainReporter(terminal.environment)
              : new RichReporter(terminal.environment);
          try {
            const code = await run(
              [command, "--config", fixture.configPath],
              fixture.root,
              terminal.environment,
              reporter,
            ).catch((error: unknown) => {
              reporter.renderError(error, (value) => value);
              return 1;
            });
            assert.equal(
              code,
              outcome === "success" ? 0 : 1,
              terminal.stderr(),
            );
            const prefix = mode === "plain" ? "[mokly/warning]" : "  !";
            const expected = fixture.diagnostics
              .map(
                (diagnostic) =>
                  `${prefix} ${diagnostic.route ?? 'entry "home"'}: ${diagnostic.message}\n`,
              )
              .join("");
            assert.equal(terminal.stderr().slice(0, expected.length), expected);
            const rest = terminal.stderr().slice(expected.length);
            if (outcome === "success") assert.equal(rest, "");
            else {
              assert.match(rest, fixture.failure);
              assert.ok(!rest.includes(prefix), rest);
            }
          } finally {
            reporter.close();
          }
        });
    });

for (const mode of ["plain", "rich"] as const) {
  for (const command of ["build", "check", "export", "publish"]) {
    test(
      `${mode} ${command} flushes warnings before failure and exits 1`,
      { timeout: 20000 },
      async (t) => {
        const fixture = await createExportFixture();
        t.after(() => fixture.close());
        await fs.writeFile(
          fixture.entryPath,
          validEntrySource().replace(
            'path: "home",',
            'path: "home", dependencies: ["notes.md"],',
          ),
        );
        await fs.writeFile(
          path.join(fixture.root, "broken-renderer.ts"),
          'export default () => { throw new Error("deliberate-render-failure"); };',
        );
        await fs.writeFile(
          fixture.configPath,
          (await fs.readFile(fixture.configPath, "utf8")).replace(
            'review: { outDir: ".review" }',
            'renderer: "broken-renderer.ts", review: { outDir: ".review", sharedImpact: ["notes.md"] }',
          ),
        );
        const child = spawn(
          process.execPath,
          [
            path.join(repositoryRoot, "dist/cli/bin.js"),
            command,
            "--config",
            fixture.configPath,
            ...(command === "export" ? ["--out", "site"] : []),
            ...(command === "publish"
              ? [
                  "--no-changes",
                  "--out",
                  "site",
                  "--endpoint",
                  "http://127.0.0.1:1",
                  "--token",
                  "fixture-token",
                  "--repository",
                  "github.com/example/catalogue",
                ]
              : []),
          ],
          {
            cwd: fixture.root,
            env: { ...process.env, MOKLY_OUTPUT: mode, NO_COLOR: "1" },
            stdio: ["ignore", "pipe", "pipe"],
          },
        );
        t.after(() => {
          if (child.exitCode === null) child.kill("SIGKILL");
        });
        let stderr = "";
        child.stderr.on("data", (chunk) => {
          stderr += String(chunk);
        });
        child.stdout.resume();
        const code = await new Promise<number | null>((resolve) =>
          child.once("close", resolve),
        );
        assert.equal(code, 1, stderr);
        const prefix = mode === "plain" ? "[mokly/warning]" : "  !";
        const expected = `${prefix} configuration "mokly.config.ts": ${configMessage}\n${prefix} entry "home": dependencies has been removed; ignoring it. Delete the field.\n`;
        const displayed =
          mode === "rich"
            ? `${prefix} configuration "mokly.config.ts": review.sharedImpact has been removed; igno…\n${prefix} entry "home": dependencies has been removed; ignoring it. Delete the field.\n`
            : expected;
        assert.ok(stderr.startsWith(displayed), stderr);
        assert.match(
          stderr.slice(displayed.length),
          /deliberate-render-failure/,
        );
        assert.equal(stderr.split("review.sharedImpact").length - 1, 1);
      },
    );
  }

  test(
    `${mode} watched failure prints pending warnings before the failed action`,
    { timeout: 15000 },
    async (t) => {
      const fixture = await warningFixture(t);
      await fixture.fixRenderer();
      const terminal = memoryTerminal({ isTTY: false, columns: 200 });
      const reporter =
        mode === "plain"
          ? new PlainReporter(terminal.environment)
          : new RichReporter(terminal.environment);
      t.after(() => reporter.close());
      const watchers = new FakeWatcherFactory();
      let finish!: () => void;
      const failed = new Promise<void>((resolve) => {
        finish = resolve;
      });
      const original = reporter.watchFailed.bind(reporter);
      reporter.watchFailed = (...args) => {
        original(...args);
        finish();
      };
      const running = await serve(
        fixture.config,
        { port: 0, watch: true },
        {
          reporter,
          watcherFactory: watchers,
          outputStore: new FakeOutputStore(),
          configLoader: new FileSystemConfigLoader(),
          processSupervisorFactory: new FakeSupervisorFactory(
            new FakeSupervisor(),
          ),
          changeClassifier: {
            async read() {
              return undefined;
            },
          },
        },
      );
      fixture.beforeRemove(() => running.close());
      await fs.writeFile(
        fixture.configPath,
        (await fs.readFile(fixture.configPath, "utf8")).replace(
          'review: { outDir: ".review" }',
          'review: { outDir: ".review", sharedImpact: undefined }, colorSchemes: []',
        ),
      );
      watchers.watchers
        .findLast((watcher) => !watcher.closed)!
        .change(fixture.configPath);
      await failed;
      const stderr = terminal.stderr();
      const prefix = mode === "plain" ? "[mokly/warning]" : "  !";
      assert.ok(
        stderr.startsWith(
          `${prefix} configuration "mokly.config.ts": ${configMessage}\n`,
        ),
        stderr,
      );
      assert.match(
        stderr.slice(stderr.indexOf(configMessage) + configMessage.length),
        /colorSchemes|failed/i,
      );
      assert.equal(stderr.split("review.sharedImpact").length - 1, 1);
    },
  );
}

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile, readdir, rm, symlink } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { fixtureGitEnvironment } from "../../../../apps/mockups/src/_tests_/git-environment.mjs";
import { indexPath } from "./catalogue-paths";
import {
  determinismCommandFixture,
  markedDocument,
} from "./determinism-command-fixture";
import { outputDirectory, repository } from "./generated-output-fixture";
import { policyFixture } from "./policy-fixture";

type CommandFixture = Awaited<ReturnType<typeof determinismCommandFixture>>;

test("mockups:test requires a build before policy or browser modules load", async (t) => {
  const fixture = await policyFixture();
  t.after(fixture.cleanup);
  const original = JSON.parse(
    await readFile(path.join(repository, "apps/mockups/package.json"), "utf8"),
  );
  original.scripts["test:policy"] = "node -e \"throw Error('policy loaded')\"";
  original.scripts["test:browser"] =
    "node -e \"throw Error('browser loaded')\"";
  await fixture.write(
    "package.json",
    '{"private":true,"workspaces":["mockups"]}',
  );
  await fixture.write("apps/mockups/package.json", JSON.stringify(original));
  await symlink(
    path.join(repository, "node_modules"),
    path.join(fixture.root, "node_modules"),
    "dir",
  );
  for (const file of ["check-determinism.mjs", "determinism.mjs"]) {
    await fixture.write(
      "apps/mockups/scripts/" + file,
      await readFile(
        path.join(repository, "apps/mockups/scripts", file),
        "utf8",
      ),
    );
  }
  await assert.rejects(
    promisify(execFile)(
      "npm",
      [
        "--prefix",
        "ts",
        "run",
        "mockups:test",
        "--workspace",
        "@mokly-cloud/mockups",
      ],
      { cwd: fixture.root, env: fixtureGitEnvironment() },
    ),
    (error: Error & { stdout?: string; stderr?: string }) => {
      const message = (error.stdout ?? "") + (error.stderr ?? "");
      assert.match(
        message,
        /Mockup output is missing\. Run npm run mockups:build from the repository root\./,
      );
      assert.doesNotMatch(message, /ENOENT|policy loaded|browser loaded/);
      return true;
    },
  );
  await assert.rejects(readdir(path.join(fixture.root, outputDirectory)), {
    code: "ENOENT",
  });
});

test("the real determinism command accepts an independent deterministic build", async (t) => {
  const fixture = await determinismCommandFixture();
  t.after(fixture.cleanup);
  await fixture.run("mockups:build");
  const result = await fixture.run("test:determinism");
  assert.match(result.stdout, /Independent mockup builds match/);
  assert.equal(
    await readFile(path.join(fixture.root, "build-calls"), "utf8"),
    "build\nbuild\n",
  );
});

test("the real determinism command rejects process-dependent bytes and gives Build recovery", async (t) => {
  const fixture = await determinismCommandFixture(true);
  t.after(fixture.cleanup);
  await fixture.run("mockups:build");
  await assert.rejects(
    fixture.run("test:determinism"),
    (error: Error & { stderr?: string }) => {
      const stderr = error.stderr ?? "";
      assert.ok(
        stderr.includes("changed:\n  " + markedDocument + "\n"),
        stderr,
      );
      assert.match(
        stderr,
        /Run npm run mockups:build after source changes\. Then run the tests again\./,
      );
      return true;
    },
  );
});

/** Replace the installed catalogue index with a changed copy. */
function writeIndex(
  fixture: CommandFixture,
  change: (index: Record<string, unknown>) => void,
) {
  const index = structuredClone(fixture.index);
  change(index);
  return fixture.write(
    outputDirectory + "/" + indexPath,
    JSON.stringify(index),
  );
}

for (const [name, outcome, damage] of [
  [
    "an index version other than 9",
    "invalid",
    (fixture: CommandFixture) =>
      writeIndex(fixture, (index) => {
        index.schemaVersion = 8;
      }),
  ],
  [
    "an index without screens",
    "invalid",
    (fixture: CommandFixture) =>
      writeIndex(fixture, (index) => {
        delete index.screens;
      }),
  ],
  [
    "an unsafe entry path",
    "invalid",
    (fixture: CommandFixture) =>
      writeIndex(fixture, (index) => {
        assert.ok(Array.isArray(index.screens));
        const [screen] = index.screens;
        assert.ok(typeof screen === "object" && screen !== null);
        Object.assign(screen, { path: "../unsafe" });
      }),
  ],
  [
    "a missing indexed document",
    "missing",
    (fixture: CommandFixture) => rm(path.join(fixture.output, markedDocument)),
  ],
] as const) {
  test(
    "the real determinism command rejects " + name + " before Build",
    async (t) => {
      const fixture = await determinismCommandFixture();
      t.after(fixture.cleanup);
      await fixture.run("mockups:build");
      await damage(fixture);
      await assert.rejects(
        fixture.run("test:determinism"),
        (error: Error & { stderr?: string }) => {
          const stderr = error.stderr ?? "";
          assert.ok(
            stderr.includes(
              "Mockup output is " +
                outcome +
                ". Run npm run mockups:build from the repository root.",
            ),
            stderr,
          );
          assert.doesNotMatch(stderr, /ENOENT|policy loaded|browser loaded/);
          return true;
        },
      );
      assert.equal(
        await readFile(path.join(fixture.root, "build-calls"), "utf8"),
        "build\n",
      );
    },
  );
}

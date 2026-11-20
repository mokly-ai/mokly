import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { repository, sha256 } from "./generated-output-fixture";
import { policyFixture } from "./policy-fixture";

/** Run module code in a new Node process with tsx and the runtime paths. */
function child(code: string, environment: NodeJS.ProcessEnv) {
  return spawnSync(
    process.execPath,
    ["--import", "tsx", "--input-type=module", "-e", code],
    {
      cwd: path.join(repository, "apps/mockups"),
      encoding: "utf8",
      env: {
        ...environment,
        TSX_TSCONFIG_PATH: path.join(
          repository,
          "apps/mockups/tsconfig.runtime.json",
        ),
      },
      timeout: 120_000,
    },
  );
}

const moduleUrl = (file: string) =>
  JSON.stringify(pathToFileURL(path.join(repository, file)).href);

for (const setup of [
  "apps/mockups/src/_tests_/register-web.mjs",
  "apps/mockups/playwright.config.ts",
  "apps/mockups/playwright.serve.config.ts",
])
  test("test startup removes every inherited Git variable: " + setup, () => {
    const result = child(
      `await import(${moduleUrl(setup)});
       process.stdout.write(JSON.stringify({
         git: Object.keys(process.env).filter((name) => /^git_/i.test(name)),
         kept: process.env.GITHUB_ACTIONS,
       }));`,
      {
        ...process.env,
        GIT_DIR: path.join(repository, ".context/not-a-repository"),
        GIT_INDEX_FILE: path.join(repository, ".context/not-an-index"),
        GIT_FUTURE_OVERRIDE: "exclude",
        git_lower_case_override: "exclude",
        GITHUB_ACTIONS: "fixture-kept",
      },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), {
      git: [],
      kept: "fixture-kept",
    });
  });

for (const [helper, file] of [
  ["outputFixture", "generated-output-fixture.ts"],
  ["policyFixture", "policy-fixture.ts"],
] as const)
  test(
    "fixture Git keeps a hook caller's index and ignores the developer's Git configuration: " +
      helper,
    async (t) => {
      const caller = await policyFixture();
      t.after(caller.cleanup);
      const identity = ["-c", "user.name=Fixture", "-c", "user.email=f@x.test"];
      await caller.write("source.txt", "committed\n");
      caller.git("add", "-A");
      caller.git(...identity, "commit", "--quiet", "-m", "test: caller");
      await caller.write("source.txt", "staged\n");
      caller.git("add", "source.txt");
      // A developer configuration that makes every commit fail.
      await caller.write(
        "home/.gitconfig",
        "[commit]\n\tgpgsign = true\n[gpg]\n\tprogram = false\n",
      );
      const index = path.join(caller.root, ".git/index");
      const before = sha256(await readFile(index));
      const result = child(
        `const { ${helper} } = await import(${moduleUrl("docs/mockups/src/_tests_/" + file)});
         const fixture = await ${helper}();
         try {
           await fixture.write("fixture.txt", "fixture\\n");
           await fixture.git("add", "-A");
           await fixture.git(${identity.map((part) => JSON.stringify(part)).join(", ")}, "commit", "--quiet", "-m", "test: fixture");
         } finally {
           await fixture.cleanup();
         }`,
        {
          ...process.env,
          GIT_INDEX_FILE: index,
          HOME: path.join(caller.root, "home"),
          XDG_CONFIG_HOME: path.join(caller.root, "home/.config"),
        },
      );
      assert.equal(
        sha256(await readFile(index)),
        before,
        "fixture Git changed the caller's index",
      );
      assert.equal(result.status, 0, result.stderr);
      assert.equal(caller.git("show", ":source.txt"), "staged\n");
    },
  );

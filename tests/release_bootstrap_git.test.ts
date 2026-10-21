import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

import { repositoryRoot } from "./helpers/fixture.js";
import { isolatedGitEnvironment } from "./helpers/source_tree_types.js";

const execute = promisify(execFile);
const helper = pathToFileURL(
  path.join(repositoryRoot, "tests/helpers/bootstrap_fixture.ts"),
).href;
const probe = `
import assert from "node:assert/strict";
import { bootstrapFixture } from ${JSON.stringify(helper)};
const cleanups = [];
try {
  const fixture = await bootstrapFixture({ after: (cleanup) => cleanups.push(cleanup) });
  await fixture.git("commit", "--allow-empty", "-m", "test: isolated follow-up");
  await fixture.git("tag", "-a", "fixture-tag", "-m", "test: isolated tag");
  assert.equal(await fixture.git("tag", "--list"), "fixture-tag");
  assert.doesNotMatch(await fixture.git("cat-file", "-p", "HEAD"), /gpgsig/);
  assert.doesNotMatch(await fixture.git("cat-file", "-p", "fixture-tag"), /BEGIN .*SIGNATURE/);
  process.stdout.write("Fixture commit and annotated tag succeeded.\\n");
} finally {
  for (const cleanup of cleanups.reverse()) await cleanup();
}
`;

for (const [scope, configuration] of [
  ["global", "commit signing"],
  ["global", "tag signing"],
  ["global", "hooks"],
  ["system", "hooks"],
] as const) {
  test(`bootstrap Git ignores ${scope} ${configuration}`, async (context) => {
    const root = await fs.mkdtemp(
      path.join(os.tmpdir(), "mokly-bootstrap-git-"),
    );
    context.after(() => fs.rm(root, { recursive: true, force: true }));
    const env = await isolatedGitEnvironment(
      path.join(root, "empty.gitconfig"),
    );
    const config = path.join(root, "hostile.gitconfig");
    const set = async (key: string, value: string) =>
      execute("git", ["config", "--file", config, key, value], { env });
    if (configuration === "hooks") {
      const hooks = path.join(root, "hooks");
      await fs.mkdir(hooks);
      await fs.writeFile(
        path.join(hooks, "pre-commit"),
        "#!/bin/sh\nprintf 'Unexpected global hook\\n' >&2\nexit 1\n",
        { mode: 0o755 },
      );
      await set("core.hooksPath", hooks);
    } else {
      await set(
        configuration === "commit signing" ? "commit.gpgsign" : "tag.gpgSign",
        "true",
      );
      await set("gpg.program", path.join(root, "missing-signing-program"));
    }
    const { stdout } = await execute(
      process.execPath,
      [
        "--import",
        import.meta.resolve("tsx"),
        "--input-type=module",
        "--eval",
        probe,
      ],
      {
        cwd: repositoryRoot,
        env: {
          ...env,
          GIT_CONFIG_GLOBAL:
            scope === "global" ? config : env.GIT_CONFIG_GLOBAL,
          GIT_CONFIG_SYSTEM:
            scope === "system" ? config : env.GIT_CONFIG_GLOBAL,
          GIT_CONFIG_NOSYSTEM: "0",
        },
      },
    );
    assert.equal(stdout, "Fixture commit and annotated tag succeeded.\n");
  });
}

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { parse } from "yaml";

import { repositoryRoot } from "./helpers/fixture.js";

const execute = promisify(execFile);
const RELEASE_COMMIT = "a".repeat(40);

interface Workflow {
  jobs: Readonly<
    Record<
      string,
      {
        outputs?: Readonly<Record<string, string>>;
        steps?: readonly { name?: string; run?: string }[];
      }
    >
  >;
}

const release = async () =>
  parse(
    await fs.readFile(
      path.join(repositoryRoot, ".github/workflows/release.yml"),
      "utf8",
    ),
  ) as Workflow;

/** Run the tag check of `release.yml` with a `gh` that reports `tagged`. */
async function runTagCheck(script: string, tagged: string) {
  const bin = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-tag-check-"));
  try {
    await fs.writeFile(
      path.join(bin, "gh"),
      `#!/usr/bin/env bash\necho "${tagged}"\n`,
      { mode: 0o755 },
    );
    return await execute(
      "bash",
      ["--noprofile", "--norc", "-e", "-o", "pipefail", "-c", script],
      {
        cwd: repositoryRoot,
        env: {
          ...process.env,
          PATH: `${bin}${path.delimiter}${process.env.PATH}`,
          GITHUB_REPOSITORY: "mokly-ai/mokly",
          RELEASE_TAG: "desktop-v0.1.0",
          RELEASE_COMMIT,
        },
      },
    );
  } finally {
    await fs.rm(bin, { recursive: true, force: true });
  }
}

test("the desktop release stops before signing when the tag names another commit", async () => {
  const script = (await release()).jobs["desktop-tag"]?.steps?.find(
    (step) => step.name === "Check that the tag names the release commit",
  )?.run;
  assert.ok(script);
  await assert.doesNotReject(runTagCheck(script, RELEASE_COMMIT));
  await assert.rejects(
    runTagCheck(script, "b".repeat(40)),
    (error: unknown) => {
      assert.match(
        String((error as { stdout?: string }).stdout),
        /::error::desktop-v0\.1\.0 names b{40}, not the release commit a{40}/,
      );
      return true;
    },
  );
});

test("the desktop release reads the outputs of the desktop component's path", async () => {
  const config = JSON.parse(
    await fs.readFile(
      path.join(repositoryRoot, "release-please-config.json"),
      "utf8",
    ),
  ) as { packages: Record<string, { component?: string }> };
  const [desktopPath] = Object.entries(config.packages).find(
    ([, entry]) => entry.component === "desktop",
  ) ?? [""];
  assert.ok(desktopPath);
  const outputs = (await release()).jobs["release-please"]?.outputs ?? {};
  const desktop = Object.entries(outputs).filter(([name]) =>
    name.startsWith("desktop_"),
  );
  assert.ok(desktop.length > 0);
  // A path that moves would leave these outputs empty, and the release would
  // skip without an error.
  for (const [name, value] of desktop)
    assert.ok(value.includes(`['${desktopPath}--`), name);
});

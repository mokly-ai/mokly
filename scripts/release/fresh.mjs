import fs from "node:fs/promises";
import path from "node:path";

import { runCommandResult } from "./command.mjs";
import { isMissingPackage } from "./registry_contract.mjs";
import { releasePackages } from "./targets.mjs";

/** A partial registry publication requires the saved bytes, never a new build. */
export async function requireUnpublishedRelease(
  root,
  execute = runCommandResult,
  {} = {},
) {
  for (const { directory, name } of releasePackages()) {
    const { version } = JSON.parse(
      await fs.readFile(path.join(root, directory, "package.json"), "utf8"),
    );
    const result = await execute(
      "npm",
      ["view", `${name}@${version}`, "--json"],
      { cwd: root },
    );
    if (isMissingPackage(result)) continue;
    if (result.code === 0)
      throw new Error(
        `${name}@${version} is already published; reuse the first run's checked archives`,
      );
    throw new Error(
      `registry lookup failed before release build: ${result.stdout}${result.stderr}`,
    );
  }
}

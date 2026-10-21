import assert from "node:assert/strict";

import { ESLint } from "eslint";

import { repositoryRoot } from "./fixture.js";

/** Load the repository's real flat config, including its ignore integration. */
export const repositoryEslint = new ESLint({ cwd: repositoryRoot });
const fixingRepositoryEslint = new ESLint({
  cwd: repositoryRoot,
  fix: true,
});

/** Require an active rule; a clean result from an ignored file proves nothing. */
export async function requireLintRule(
  filePath: string,
  rule: string,
): Promise<void> {
  assert.equal(await repositoryEslint.isPathIgnored(filePath), false, filePath);
  const config = await repositoryEslint.calculateConfigForFile(filePath);
  assert.ok(config, `No flat config for ${filePath}`);
  const entry = config.rules?.[rule];
  const severity = Array.isArray(entry) ? entry[0] : entry;
  assert.ok(
    severity === 2 || severity === "error",
    `${filePath}: missing ${rule}`,
  );
}

/** Lint only in memory and fail on parser or ignored-file diagnostics. */
export async function lintProbe(source: string, filePath: string, fix = false) {
  const [result] = await (
    fix ? fixingRepositoryEslint : repositoryEslint
  ).lintText(source, { filePath });
  assert.ok(result, filePath);
  assert.equal(
    result.fatalErrorCount,
    0,
    `${filePath}: ${JSON.stringify(result.messages)}`,
  );
  assert.ok(
    result.messages.every(({ ruleId }) => ruleId !== null),
    `${filePath}: ${JSON.stringify(result.messages)}`,
  );
  return result;
}

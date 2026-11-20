/**
 * Each Node and Playwright test process loads this module first, so that no
 * test, and no process that a test starts, inherits a `GIT_*` variable.
 */

import { isGitVariable } from "./git-environment.mjs";

for (const name of Object.keys(process.env))
  if (isGitVariable(name)) delete process.env[name];

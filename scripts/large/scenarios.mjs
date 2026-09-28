/** Deterministic worktree edits used by the classification benchmark matrix. */
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execute = promisify(execFile);
const BASE_COLOR = 'const AREA_ONE_ACTION_COLOR = "rgba(1,2,3,1.00)";';
const EDITED_COLOR = 'const AREA_ONE_ACTION_COLOR = "rgba(4,5,6,1.00)";';
const BASE_MARKUP = 'const SCREEN_ONE_MARKUP = "";';
const EDITED_MARKUP = 'const SCREEN_ONE_MARKUP = "screen-edit";';

export const classificationScenarios = [
  { name: "no-changes", expectedChanges: 0 },
  { name: "component-style", expectedChanges: 1 },
  { name: "screen-markup", expectedChanges: 2 },
];

/** Restore the baseline, apply one edit, and build current committed bytes. */
export async function prepareClassificationScenario(
  repository,
  fixture,
  scenario,
) {
  const selected = classificationScenarios.find(
    ({ name }) => name === scenario,
  );
  if (!selected)
    throw new Error(`Unknown classification scenario: ${scenario}`);
  const renderer = "renderer.tsx";
  let source = await baselineFile(fixture.root, renderer);
  if (!source.includes(BASE_COLOR) || !source.includes(BASE_MARKUP))
    throw new Error("Large fixture renderer has no benchmark edit markers");
  if (scenario === "component-style")
    source = source.replace(BASE_COLOR, EDITED_COLOR);
  if (scenario === "screen-markup")
    source = source.replace(BASE_MARKUP, EDITED_MARKUP);
  await fs.writeFile(path.join(fixture.root, renderer), source);
  const shared = "mockups/assets/shared-1.css";
  try {
    await fs.access(path.join(fixture.root, shared));
    await fs.writeFile(
      path.join(fixture.root, shared),
      await baselineFile(fixture.root, shared),
    );
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  await execute(
    process.execPath,
    [
      path.join(repository, "dist/cli/bin.js"),
      "build",
      "--config",
      fixture.configPath,
    ],
    { cwd: fixture.root, maxBuffer: 16 * 1024 * 1024 },
  );
  return selected;
}

async function baselineFile(root, relative) {
  const { stdout } = await execute("git", ["show", `main:${relative}`], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  return stdout;
}

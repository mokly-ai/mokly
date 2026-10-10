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
const SETUP_RULE =
  ".scale-unrelated-rule { outline: 1px solid rebeccapurple; }\n";

export const classificationScenarios = [
  { name: "no-changes", expectedChangedPaths: [], expectedChangedRoutes: [] },
  {
    name: "component-style",
    expectedChangedPaths: ["area-1/components/action"],
    expectedChangedRoutes: ["area-1/components/action/index.html"],
  },
  {
    name: "screen-markup",
    expectedChangedPaths: [
      "area-1/flows/flow-1",
      "area-1/screens/activity-group-1/screen-1",
    ],
    expectedChangedRoutes: [
      "area-1/flows/flow-1/index.html",
      "area-1/screens/activity-group-1/screen-1/index.html",
    ],
  },
  {
    name: "linked-stylesheet",
    expectedChangedPaths: [],
    expectedChangedRoutes: [],
  },
];

export function selectScenarios(names = []) {
  for (const name of names)
    if (!classificationScenarios.some((scenario) => scenario.name === name))
      throw new Error(`Unknown classification scenario: ${name}`);
  return classificationScenarios.filter(
    ({ name }) => !names.length || names.includes(name),
  );
}

/** Restore the baseline, apply one edit, and build current committed bytes. */
export async function prepareClassificationScenario(
  repository,
  fixture,
  scenario,
  signal,
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
      (await baselineFile(fixture.root, shared)) +
        (scenario === "linked-stylesheet" ? SETUP_RULE : ""),
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
    { cwd: fixture.root, maxBuffer: 16 * 1024 * 1024, signal },
  );
  return selected;
}

/** Stop owned processes before calling; rebuild the setup state even after a failed row. */
export async function restoreFixtureSetup(repository, fixture) {
  await prepareClassificationScenario(repository, fixture, "linked-stylesheet");
}

async function baselineFile(root, relative) {
  const { stdout } = await execute("git", ["show", `main:${relative}`], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  return stdout;
}

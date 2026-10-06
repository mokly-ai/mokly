import type { ShellContext } from "../../packages/viewer/dist/shell/context.js";

import { screen } from "./workspace_views_data_fixture.js";

export const DARK_VIEWS = [
  { viewport: "mobile", colorScheme: "dark" },
  { viewport: "desktop", colorScheme: "dark" },
];

export function context(
  evidence?: ShellContext["componentChanges"],
): ShellContext {
  return {
    base: "main",
    updateVersion: 1,
    activeId: screen.path,
    ...(evidence ? { componentChanges: evidence } : {}),
  };
}

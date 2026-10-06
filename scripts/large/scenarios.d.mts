export interface ClassificationScenario {
  name:
    "no-changes" | "component-style" | "screen-markup" | "linked-stylesheet";
  expectedChangedPaths: readonly string[];
  expectedChangedRoutes: readonly string[];
}

export const classificationScenarios: readonly ClassificationScenario[];
export function selectScenarios(
  names?: readonly string[],
): readonly ClassificationScenario[];
export function restoreFixtureSetup(
  repository: string,
  fixture: { configPath: string; root: string },
): Promise<void>;

export function prepareClassificationScenario(
  repository: string,
  fixture: { configPath: string; root: string },
  scenario: ClassificationScenario["name"],
  signal?: AbortSignal,
): Promise<ClassificationScenario>;

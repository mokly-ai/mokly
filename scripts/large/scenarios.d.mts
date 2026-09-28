export interface ClassificationScenario {
  name: "no-changes" | "component-style" | "screen-markup";
  expectedChanges: number;
}

export const classificationScenarios: readonly ClassificationScenario[];

export function prepareClassificationScenario(
  repository: string,
  fixture: { configPath: string; root: string },
  scenario: ClassificationScenario["name"],
): Promise<ClassificationScenario>;

import { scrollsSideways } from "./build-refusals";
import { buildScenario } from "./build-scenario";
import { desktop } from "./build-state-parts";
import { buildStates } from "./build-states";
import { expect, test } from "./harness";

/**
 * Every row of the shared build state table on the desktop. A row that uses a
 * phone's own way in runs on a phone too, in `build-states-mobile.spec.ts`,
 * which also checks every card state for sideways scrolling.
 */

for (const row of buildStates)
  test(row.title, async ({ page }) => {
    const scenario = await buildScenario(page, "build-state-" + row.label);
    await row.run(page, scenario, desktop);
    expect(await scrollsSideways(page)).toBe(false);
  });

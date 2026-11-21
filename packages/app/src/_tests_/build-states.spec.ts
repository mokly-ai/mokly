import { scrollsSideways } from "./build-refusals";
import { buildScenario } from "./build-scenario";
import { desktop } from "./build-state-parts";
import { buildStates } from "./build-states";
import { expect, test } from "./harness";

/**
 * Every row of the shared build state table on the desktop. The phone runs the
 * same rows in `build-states-mobile.spec.ts`, so a state the table gains runs
 * on both surfaces.
 */

for (const row of buildStates)
  test(row.title, async ({ page }) => {
    const scenario = await buildScenario(page, "build-state-" + row.label);
    await row.run(page, scenario, desktop);
    expect(await scrollsSideways(page)).toBe(false);
  });

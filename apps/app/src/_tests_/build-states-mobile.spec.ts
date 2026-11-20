import { scrollsSideways } from "./build-refusals";
import { buildScenario } from "./build-scenario";
import { phone } from "./build-state-parts";
import { buildStates } from "./build-states";
import { expect, test } from "./harness";

/**
 * Every row of the shared build state table on a phone, at the suite's 390px,
 * with the page the row ends on checked again at 320px. The desktop runs the
 * same rows in `build-states.spec.ts`.
 */

for (const row of buildStates)
  test(row.title, async ({ page }) => {
    const scenario = await buildScenario(
      page,
      "build-mobile-state-" + row.label,
    );
    await row.run(page, scenario, phone);
    expect(await scrollsSideways(page), "at 390px").toBe(false);
    await page.setViewportSize({ width: 320, height: 844 });
    expect(await scrollsSideways(page), "at 320px").toBe(false);
  });

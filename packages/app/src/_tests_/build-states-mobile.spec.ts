import { phases } from "./build-card-walk";
import { scrollsSideways } from "./build-refusals";
import { buildScenario } from "./build-scenario";
import { history } from "./build-state-lists";
import { phone } from "./build-state-parts";
import { planOwner } from "./build-state-readers";
import { expect, test } from "./harness";

/**
 * The phone's build surfaces. `build-states.spec.ts` runs every row of the
 * shared build state table on the desktop. A phone differs in two of those
 * rows: History opens from More, and Open billing opens Billing as a route.
 * Those two rows run here too. Every other row reads the same card at every
 * width, so the phone checks only that no card scrolls sideways, in every
 * state a card draws, at the suite's 390px and at 320px. `build-card-walk.ts`
 * keys those states by the same unions as the desktop rows.
 */

for (const row of [planOwner, history])
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

test("no card scrolls sideways on a phone, in any state", async ({ page }) => {
  const scenario = await buildScenario(page, "build-mobile-card-widths");
  const overflowing: string[] = [];
  for (const phase of phases) {
    await phase.enter(page, scenario);
    for (const state of phase.states) {
      await page.setViewportSize({ width: 390, height: 844 });
      const release = await state.show(page, scenario);
      for (const width of [390, 320]) {
        await page.setViewportSize({ width, height: 844 });
        if (await scrollsSideways(page))
          overflowing.push(`${state.name} at ${width}px`);
      }
      if (release) await release();
    }
  }
  expect(overflowing, "the states that scroll sideways").toEqual([]);
});

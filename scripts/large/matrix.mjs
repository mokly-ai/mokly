/** Preserve every requested sample and restoration failure, including bounded row failures. */
import { sampleOutcome } from "./outcomes.mjs";

export async function executeMatrix(definitions, operations, identity = {}) {
  const runs = [];
  let restorationError;
  try {
    for (const scenario of definitions) {
      let preparationError;
      try {
        await operations.prepare(scenario);
      } catch (error) {
        preparationError = error.message;
      }
      for (const state of ["cold", "warm"]) {
        let result;
        try {
          if (preparationError) throw new Error(preparationError);
          result = await operations.sample(scenario, state);
        } catch (error) {
          result = sampleOutcome([], {
            ...identity,
            scenario: scenario.name,
            state,
            expectedChangedIds: scenario.expectedChangedIds,
            expectedChangedRoutes: scenario.expectedChangedRoutes,
            failurePhase: preparationError ? "preparation" : "infrastructure",
            error: error.message,
          });
        }
        runs.push(result);
        process.stdout.write(`Benchmark sample ${JSON.stringify(result)}\n`);
      }
    }
  } finally {
    try {
      await operations.close();
    } catch (error) {
      restorationError = error.message;
    }
    try {
      await operations.restore();
    } catch (error) {
      restorationError = [restorationError, error.message]
        .filter(Boolean)
        .join("; ");
    }
  }
  return { runs, ...(restorationError ? { restorationError } : {}) };
}

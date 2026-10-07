/** Independent untimed classifications; companion counts never enter benchmark runs. */
import { chromium } from "@playwright/test";

import { loadConfig } from "../../dist/config/load.js";

import { resetFixtureBaseline } from "./baseline.mjs";
import { BenchmarkCancellation } from "./cancellation.mjs";
import { companionOutcome } from "./companion_outcome.mjs";
import { companionSample } from "./sample.mjs";
import {
  classificationScenarios,
  prepareClassificationScenario,
  restoreFixtureSetup,
} from "./scenarios.mjs";

export async function materialDetails(
  repository,
  fixture,
  definitions = classificationScenarios,
) {
  const cancellation = new BenchmarkCancellation();
  const companions = [];
  let browser;
  let restorationError;
  try {
    const config = await loadConfig(fixture.root, fixture.configPath);
    let browserError;
    try {
      browser = await chromium.launch({
        channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome",
        handleSIGINT: false,
        handleSIGTERM: false,
        handleSIGHUP: false,
      });
    } catch (error) {
      browserError = error;
    }
    for (const scenario of definitions) {
      if (cancellation.signal.aborted) break;
      let result;
      try {
        if (browserError) throw browserError;
        await prepareClassificationScenario(
          repository,
          fixture,
          scenario.name,
          cancellation.signal,
        );
        if (!fixture.trackedOutput) await resetFixtureBaseline(config);
        if (cancellation.signal.aborted) break;
        result = await companionSample(
          browser,
          repository,
          fixture,
          scenario,
          cancellation,
        );
      } catch (error) {
        result = companionOutcome([], {
          ...fixture,
          ...scenario,
          scenario: scenario.name,
          error: error.message,
          failurePhase: "preparation",
        });
      }
      companions.push(result);
      process.stdout.write(`Material companion ${JSON.stringify(result)}\n`);
    }
  } finally {
    try {
      await browser?.close();
    } catch (error) {
      restorationError = error.message;
    }
    try {
      await restoreFixtureSetup(repository, fixture);
    } catch (error) {
      restorationError = [restorationError, error.message]
        .filter(Boolean)
        .join("; ");
    }
    cancellation.dispose();
  }
  const result = {
    kind: "material-work-companions",
    timed: false,
    companions,
    ...(restorationError ? { restorationError } : {}),
    ...(cancellation.signal.aborted ? { cancelled: true } : {}),
  };
  process.stdout.write(`Material details ${JSON.stringify(result)}\n`);
  if (
    restorationError ||
    cancellation.signal.aborted ||
    companions.some(({ outcome }) => outcome !== "ok")
  )
    throw new Error("Material companion pass failed; see retained records");
  return result;
}

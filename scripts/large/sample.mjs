/** Capture a bounded fresh-server sample, then derive its outcome from the retained events. */
import path from "node:path";

import { parse } from "parse5";

import { waitForBrowseChanges } from "./browse.mjs";
import { companionOutcome } from "./companion_outcome.mjs";
import { measureInteractive } from "./interactive.mjs";
import { sampleOutcome } from "./outcomes.mjs";
import { start, stop } from "./process.mjs";
import { baselineMeasurement } from "./timings.mjs";

export async function benchmarkSample(
  browser,
  repository,
  fixture,
  scenario,
  state,
  cancellation,
) {
  return captureSample(
    browser,
    repository,
    fixture,
    scenario,
    state,
    cancellation,
    false,
  );
}

/** An independent classification over the same deterministic scenario inputs. */
export async function companionSample(
  browser,
  repository,
  fixture,
  scenario,
  cancellation,
) {
  return captureSample(
    browser,
    repository,
    fixture,
    scenario,
    "cold",
    cancellation,
    true,
  );
}

async function captureSample(
  browser,
  repository,
  fixture,
  scenario,
  state,
  cancellation,
  details,
) {
  const measured = {
    ...scenario,
    scenario: scenario.name,
    state,
    templateDigest: fixture.templateDigest,
    moklyCommit: fixture.moklyCommit,
    moklyDirty: fixture.moklyDirty,
    fixtureCommit: fixture.fixtureCommit,
    renderingDependencies: fixture.renderingDependencies,
    preparedMoklyCommit: fixture.preparedMoklyCommit,
    preparedMoklyDirty: fixture.preparedMoklyDirty,
  };
  delete measured.name;
  const errors = [];
  let page;
  let running;
  let stopRequestedMs;
  let failurePhase = "startup";
  try {
    page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.on("pageerror", (error) => errors.push(error.message));
    const beginning = performance.now();
    running = start(
      [
        path.join(repository, "dist/cli/bin.js"),
        "serve",
        "--config",
        fixture.configPath,
        "--port",
        "0",
        "--debug-timings",
      ],
      fixture.root,
      { MOKLY_MATERIAL_WORK: details ? "1" : "0" },
    );
    cancellation.setActive(running);
    failurePhase = "browser";
    await measureInteractive(page, running, fixture, beginning, measured);
    failurePhase = "delivery";
    const html = await waitForBrowseChanges(
      measured.url,
      fixture.size.inlineStyles ? 900_000 : undefined,
    );
    Object.assign(measured, browseMembership(html), {
      changesReadyMs: Math.round(performance.now() - beginning),
    });
    if (errors.length) throw new Error(errors.join("\n"));
  } catch (error) {
    Object.assign(measured, { failurePhase, error: error.message });
  } finally {
    stopRequestedMs = performance.now();
    try {
      if (running) await stop(running);
    } catch (error) {
      measured.error ??= error.message;
      measured.failurePhase ??= "stop";
    }
    try {
      await page?.close();
    } catch (error) {
      measured.error ??= error.message;
      measured.failurePhase ??= "browser";
    }
    cancellation.clearActive(running);
  }
  if (fixture.generatedOutput === "derived") {
    try {
      Object.assign(
        measured,
        baselineMeasurement(
          running?.timings ?? [],
          measured.beginning,
          state === "warm",
        ),
      );
    } catch (error) {
      measured.error ??= error.message;
      measured.failurePhase ??= "baseline";
    }
  }
  delete measured.url;
  delete measured.beginning;
  return (details ? companionOutcome : sampleOutcome)(running?.timings ?? [], {
    ...measured,
    stopRequestedMs,
  });
}

/** Only a complete delivered Changes page can supply observed membership. */
export function browseMembership(html) {
  if (!html.includes('data-changes-status="ready"'))
    throw new Error("Changes membership is not complete");
  const ids = new Set();
  const routes = new Set();
  const visit = (node) => {
    if (node.tagName === "a") {
      const attributes = Object.fromEntries(
        node.attrs.map(({ name, value }) => [name, value]),
      );
      if (
        attributes["data-changed"] === "true" &&
        attributes["data-entry-id"]
      ) {
        ids.add(attributes["data-entry-id"]);
        if (attributes["data-route"]) routes.add(attributes["data-route"]);
      }
    }
    for (const child of node.childNodes ?? []) visit(child);
  };
  visit(parse(html));
  return { changedIds: [...ids].sort(), changedRoutes: [...routes].sort() };
}

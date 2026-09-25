import { expect, test } from "@playwright/test";
import type { CDPSession, Page } from "@playwright/test";

import {
  buildDevelopmentBundle,
  captureBrowserErrors,
  expectCleanHydration,
  expectNoBrowserErrors,
  installDevelopmentBundle,
} from "./react_shell_hydration_helpers.js";

interface PreciseCoverage {
  result: Array<{
    functions: Array<{
      functionName: string;
      ranges: Array<{ count: number }>;
    }>;
  }>;
}

let developmentBundle: string;

test.beforeAll(async () => {
  test.setTimeout(120_000);
  developmentBundle = await buildDevelopmentBundle();
});

test("hydration and shell rerenders do not serialize embedded state", async ({
  context,
  page,
}) => {
  const errors = captureBrowserErrors(page);
  await installDevelopmentBundle(page, developmentBundle);
  await page.setViewportSize({ width: 390, height: 844 });
  const session = await context.newCDPSession(page);
  await session.send("Profiler.enable");
  await session.send("Profiler.startPreciseCoverage", {
    callCount: true,
    detailed: true,
  });
  try {
    await page.goto("/view/screens/welcome.html");
    await expectCleanHydration(page, errors);
    const embedded = await embeddedState(page);
    assertNoSerialization(await serializationCalls(session), "hydration");

    await page.locator("[data-mokly-menu]").click();
    await expect(page.locator("[data-mokly-shell]")).toHaveAttribute(
      "data-drawer",
      "open",
    );
    await settleRender(page);
    await expectEmbeddedState(page, embedded);
    assertNoSerialization(await serializationCalls(session), "drawer toggle");

    await page
      .locator('[data-mokly-nav] a[href="/view/screens/details.html"]')
      .click();
    await expect(page).toHaveURL(/\/view\/screens\/details\.html$/);
    await settleRender(page);
    await expectEmbeddedState(page, embedded);
    assertNoSerialization(
      await serializationCalls(session),
      "route announcement",
    );
    await expectNoBrowserErrors(page, errors);
  } finally {
    await session.send("Profiler.stopPreciseCoverage");
  }
});

async function serializationCalls(session: CDPSession) {
  const coverage = (await session.send(
    "Profiler.takePreciseCoverage",
  )) as PreciseCoverage;
  const calls = (name: string) =>
    coverage.result
      .flatMap((script) => script.functions)
      .filter((fn) => fn.functionName === name)
      .reduce((total, fn) => total + (fn.ranges[0]?.count ?? 0), 0);
  return {
    bootstrap: calls("serializeShellBootstrap"),
    capability: calls("serializeViewerCapabilityDescriptor"),
  };
}

function assertNoSerialization(
  calls: { bootstrap: number; capability: number },
  stage: string,
) {
  expect(calls, stage).toEqual({ bootstrap: 0, capability: 0 });
}

async function embeddedState(page: Page) {
  return {
    bootstrap: await page
      .locator("script[data-mokly-shell-bootstrap]")
      .textContent(),
    capability: await page
      .locator("script[data-mokly-host-capability-state]")
      .textContent(),
  };
}

async function expectEmbeddedState(
  page: Page,
  expected: Awaited<ReturnType<typeof embeddedState>>,
) {
  expect(await embeddedState(page)).toEqual(expected);
}

async function settleRender(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}

import type { ElementHandle, Page } from "@playwright/test";

import { publicationPathFor } from "../addresses";
import { expect, open } from "../harness";

import { arrival } from "./held-reads";
import { publishedViewerReady } from "./support";

/**
 * Hold one route until the test releases it. `arrived()` settles once the first
 * request is held, so a test waits for the request itself rather than polling
 * for it.
 */
function requestGate(what: string) {
  const gate = Promise.withResolvers<void>();
  const arrived = Promise.withResolvers<void>();
  return {
    hold: async () => {
      arrived.resolve();
      await gate.promise;
    },
    release: () => gate.resolve(),
    arrived: () => arrival(arrived.promise, what),
  };
}

export async function holdPackageHandoff(page: Page, catalogueUrl: string) {
  const catalogueOrigin = new URL(catalogueUrl).origin;
  const access = requestGate("the held access confirmation");
  const catalogue = requestGate("the held catalogue index read");
  await page.route(
    (url) => url.origin === catalogueOrigin && url.pathname === "/",
    async (route) => {
      await access.hold();
      await route.continue();
    },
  );
  await page.route("**/mokly-viewer/index.json", async (route) => {
    await catalogue.hold();
    await route.continue();
  });
  return { access, catalogue, catalogueOrigin };
}

export async function openHeldPackage(
  page: Page,
  projectId: string,
  publicationId: string,
  accessArrived: () => Promise<void>,
): Promise<void> {
  await open(page, await publicationPathFor(page, projectId, publicationId));
  await expect(page.getByTestId("viewer-share")).toBeVisible();
  await accessArrived();
}

/**
 * Let the package become ready while the press is held: the access exchange,
 * then the host's index read. The press keeps the fallback control it began
 * on until the activation concludes.
 */
export async function releaseAccessDuringPress(
  page: Page,
  previous: ElementHandle<HTMLElement | SVGElement>,
  handoff: Awaited<ReturnType<typeof holdPackageHandoff>>,
): Promise<void> {
  const confirmed = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.origin === handoff.catalogueOrigin && url.pathname === "/";
  });
  const indexed = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return (
      url.origin === handoff.catalogueOrigin &&
      url.pathname === "/mokly-viewer/index.json"
    );
  });
  handoff.access.release();
  await confirmed;
  await handoff.catalogue.arrived();
  handoff.catalogue.release();
  await indexed;
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
  expect(await previous.evaluate((element) => element.isConnected)).toBe(true);
  await expect(page.getByTestId("viewer-share")).toBeVisible();
}

export async function finishPackageHandoff(
  page: Page,
  handoff: Awaited<ReturnType<typeof holdPackageHandoff>>,
): Promise<void> {
  await handoff.catalogue.arrived();
  handoff.catalogue.release();
  await publishedViewerReady(page);
}

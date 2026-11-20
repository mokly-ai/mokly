import type { ElementHandle, Page } from "@playwright/test";

import { publicationPathFor } from "../addresses";
import { expect, open } from "../harness";

import { publishedViewerReady } from "./support";

function requestGate() {
  let release: () => void = () => undefined;
  let seen = false;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  return {
    hold: async () => {
      seen = true;
      await pending;
    },
    release: () => release(),
    seen: () => seen,
  };
}

export async function holdPackageHandoff(page: Page, catalogueUrl: string) {
  const catalogueOrigin = new URL(catalogueUrl).origin;
  const access = requestGate();
  const catalogue = requestGate();
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
  accessSeen: () => boolean,
): Promise<void> {
  await open(page, await publicationPathFor(page, projectId, publicationId));
  await expect(page.getByTestId("viewer-share")).toBeVisible();
  await expect.poll(accessSeen).toBe(true);
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
  await expect.poll(handoff.catalogue.seen).toBe(true);
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
  await expect.poll(handoff.catalogue.seen).toBe(true);
  handoff.catalogue.release();
  await publishedViewerReady(page);
}

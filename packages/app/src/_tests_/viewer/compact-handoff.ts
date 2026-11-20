import type { ElementHandle, Page } from "@playwright/test";

import { expect, open } from "../harness";

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

export async function holdCatalogueHandoff(page: Page, catalogueUrl: string) {
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

/**
 * Let the package become ready while the press is held: the access exchange,
 * then the host's index read. The press keeps the fallback control it began
 * on until the activation concludes.
 */
export async function releaseAccessDuringCompactPress(
  page: Page,
  previous: ElementHandle<HTMLElement | SVGElement>,
  handoff: Awaited<ReturnType<typeof holdCatalogueHandoff>>,
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
  await expect(page.getByTestId("viewer-more")).toBeVisible();
}

export async function openHeldViewer(
  page: Page,
  path: string,
  accessSeen: () => boolean,
): Promise<void> {
  await open(page, path);
  await expect(page.getByTestId("viewer-publication")).toContainText("main");
  await expect.poll(accessSeen).toBe(true);
}

export async function openShareFromMore(page: Page) {
  await page.getByTestId("viewer-more").click();
  const menu = page.getByRole("menu", { name: "Viewer actions" });
  await expect(menu).toBeVisible();
  await menu.getByText("Share", { exact: true }).click();
  const panel = page.getByTestId("viewer-panel-share");
  await expect(panel).toBeVisible();
  return panel;
}

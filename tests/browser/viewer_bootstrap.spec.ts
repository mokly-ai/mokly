import { expect, test } from "@playwright/test";

import { startEvidenceFixture } from "../helpers/evidence_fixture.js";

test("reload recovery starts without loading catalogue validation", async ({
  page,
}) => {
  const fixture = await startEvidenceFixture();
  let readerRequests = 0;
  let readerAllowed = false;
  let connected = false;
  page.on("response", (response) => {
    if (new URL(response.url()).pathname === "/__mokly/events" && response.ok())
      connected = true;
  });
  await page.route("**/__mokly/client/catalogue_updates.js", (route) => {
    readerRequests++;
    return readerAllowed ? route.continue() : route.abort();
  });
  try {
    await page.goto(`${fixture.server.url}/view/screens/home.html`);
    await expect.poll(() => connected).toBe(true);
    expect(readerRequests).toBe(0);
    await page.locator("html").evaluate((root) => {
      root.setAttribute("data-test-retained", "true");
    });
    readerAllowed = true;
    expect(
      fixture.server.completeCatalogue?.(
        fixture.compilation.manifest,
        fixture.runtime.generation,
      ),
    ).toBe(true);
    fixture.server.publishUpdate({ kind: "evidence" });
    await expect(page.locator("html")).toHaveAttribute(
      "data-mokly-update-version",
      "2",
    );
    expect(readerRequests).toBe(1);
    await expect(page.locator("html")).toHaveAttribute(
      "data-test-retained",
      "true",
    );
  } finally {
    await fixture.close();
  }
});

test("early native disclosures survive delayed enhancement and recovery", async ({
  page,
}) => {
  const fixture = await startEvidenceFixture();
  let release = (): void => {};
  const blocked = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(
    /\/__mokly\/client\/(browse_runtime|browser)\.js$/,
    async (route) => {
      await blocked;
      await route.continue();
    },
  );
  await page.addInitScript(() => {
    if (window.parent !== window) return;
    sessionStorage.setItem(
      "mokly:live-update-recovery",
      JSON.stringify({
        url: location.href,
        version: 1,
        browse: {
          changedOnly: false,
          closedCollectionIds: ["collection:pages:archive"],
          colorScheme: "light",
          detailsOpen: false,
          drawerOpen: false,
          filterBaselineClosedCollectionIds: null,
          navScroll: 0,
          query: "",
          regionScrolls: {},
          viewport: "both",
        },
      }),
    );
  });
  try {
    await page.goto(`${fixture.server.url}/view/screens/home.html`, {
      waitUntil: "commit",
    });
    await expect(page.locator("[data-mokly-nav-resize]")).toHaveAttribute(
      "data-resize-initialized",
      "true",
    );
    const screens = page.locator('[data-nav-collection="collection:screens"]');
    const archive = page.locator('[data-nav-collection="collection:archive"]');
    await screens.locator("summary").click();
    await archive.locator("summary").click();
    await expect(screens).not.toHaveAttribute("open", "");
    await expect(archive).toHaveAttribute("open", "");
    release();
    await page.waitForLoadState("load");
    await expect(screens).not.toHaveAttribute("open", "");
    await expect(archive).toHaveAttribute("open", "");
    await expect(page.locator("[data-mokly-early-disclosure]")).toHaveCount(0);
    await expect
      .poll(() =>
        page.evaluate(() => localStorage.getItem("mokly:nav-disclosure:v2")),
      )
      .toContain("collection:pages:screens");
    await archive.locator("summary").click();
    await expect(archive).not.toHaveAttribute("open", "");
    await expect(page.locator("[data-mokly-early-disclosure]")).toHaveCount(0);
  } finally {
    release();
    await fixture.close();
  }
});

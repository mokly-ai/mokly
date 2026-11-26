import { publicationPathFor } from "../addresses";
import { expect, open, test } from "../harness";
import { publish } from "../publish";

import { publishedViewerReady, publishedProject } from "./support";

/** The publication host's own credential, which the exchange sets. */
const catalogueCookie = "__Host-mkc_catalogue";

/*
 * A private publication is opened with the publication host's own cookie,
 * which the next detail read renews once it expires, and a switch confirms
 * access before the catalogue loads. Every step reads the same project; the
 * listeners record the whole page's traffic from its first open.
 */
test("a private publication is opened with the publication host's own cookie, renewed once, and confirmed before a switch loads", async ({
  context,
  page,
}) => {
  const made = await publishedProject(page, "grant");
  expect(made.catalogueUrl).not.toBeNull();
  const catalogueUrl = made.catalogueUrl as string;
  const publicationHost = new URL(catalogueUrl).host;
  const origin = new URL(catalogueUrl).origin;

  // Whatever this page sends to the publication host, it is never the app's
  // own session: that credential belongs to the app origin alone.
  const sent: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).host !== publicationHost) return;
    sent.push(request.headers().cookie ?? "");
  });
  const exchanges: string[] = [];
  const reads: number[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.endsWith("/access-grants")) exchanges.push("grant");
    if (url.origin !== origin) return;
    if (url.pathname === "/_access") exchanges.push("exchange");
    if (url.pathname === "/") exchanges.push("confirmation");
  });
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (url.origin === origin && url.pathname.endsWith("/entries/start.json")) {
      reads.push(response.status());
    }
  });

  await open(page, made.publicationPath);

  await test.step("a private publication is opened with the publication host's own cookie", async () => {
    // The real package mounts only after the exchange has actually let it in.
    const viewer = page.locator("[data-mokly-shell]");
    await expect(viewer).toBeVisible();
    await expect(
      viewer.getByRole("navigation", { name: "Catalogue" }),
    ).toBeVisible();
    await expect(
      viewer.getByRole("heading", { level: 2, name: "Mokly" }),
    ).toBeVisible();
    // A changed entry's link name also carries the package's change marker.
    await expect(
      viewer.getByRole("link", { name: /^Start( Changed)?$/ }),
    ).toBeVisible();
    await expect(page.getByTestId("viewer-share")).toBeEnabled();

    expect(
      sent.length,
      "the app talks to the publication host",
    ).toBeGreaterThan(0);
    for (const cookie of sent) {
      expect(
        cookie,
        "the app session never reaches the catalogue",
      ).not.toContain("mkc_session");
    }

    // The cookie is the publication host's own, not the catalogue domain's,
    // so it is asked for at exactly that origin.
    const cookies = await context.cookies(catalogueUrl);
    const held = cookies.find((entry) => entry.name === catalogueCookie);
    expect(
      held,
      "the publication host set its own host-only cookie",
    ).toBeTruthy();
    expect(held?.httpOnly).toBe(true);
    expect(held?.domain).toBe(new URL(catalogueUrl).hostname);
  });

  await test.step("an expired catalogue cookie is renewed once by the next detail read", async () => {
    await publishedViewerReady(page);
    expect(exchanges).toEqual(["grant", "exchange", "confirmation"]);
    const shell = await page.locator("[data-mokly-shell]").elementHandle();

    // The cookie lives 300 seconds; without it the host answers as it does
    // after expiry, and the next entry's detail read meets that 401.
    await context.clearCookies({ name: catalogueCookie });
    await page.getByRole("link", { name: /^Start( Changed)?$/ }).click();
    await expect(
      page.getByRole("heading", { level: 2, name: "Start" }),
    ).toBeVisible();
    await expect.poll(() => reads).toEqual([401, 200]);
    // One more exchange and no confirmation: the access state, whose retry
    // remounts the viewer, never ran again, and the package root stayed.
    expect(exchanges).toEqual([
      "grant",
      "exchange",
      "confirmation",
      "grant",
      "exchange",
    ]);
    expect(await shell?.evaluate((element) => element.isConnected)).toBe(true);
  });

  await test.step("a private publication switch confirms access before catalogue loading", async () => {
    // The older publication starts without its cookie, as on a first visit.
    await context.clearCookies({ name: catalogueCookie });
    const newer = await publish(made.token, made.projectId, {
      branch: "main",
    });
    await open(page, await publicationPathFor(page, made.projectId, newer.id));
    await publishedViewerReady(page);

    let confirmed = false;
    let catalogueLoads = 0;
    const premature: string[] = [];
    page.on("response", (response) => {
      const url = new URL(response.url());
      if (url.origin === origin && url.pathname === "/" && response.ok()) {
        confirmed = true;
      }
    });
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (
        url.origin === origin &&
        url.pathname === "/mokly-viewer/index.json"
      ) {
        catalogueLoads += 1;
        if (!confirmed) premature.push(url.href);
      }
    });

    await page.getByTestId("viewer-history").click();
    await page.locator(`a[href="${made.publicationPath}"]`).click();
    await expect(page).toHaveURL(
      new RegExp(`publications/${made.publicationId}$`),
    );
    await expect(page.locator("[data-mokly-shell]")).toBeVisible();
    expect(confirmed).toBe(true);
    expect(catalogueLoads).toBeGreaterThan(0);
    expect(premature).toEqual([]);
  });
});

/*
 * Each way the publication host can keep a private catalogue out leaves the
 * reader a way on rather than a blank stage. Each step opens the same
 * publication with only its own refusal in place.
 */
test("a refused private catalogue leaves a retry, its own tab, or a covered comparison", async ({
  page,
}) => {
  const made = await publishedProject(page, "refused-grant");
  const catalogueUrl = made.catalogueUrl as string;
  const publicationHost = new URL(catalogueUrl).host;
  const catalogueOrigin = new URL(catalogueUrl).origin;

  await test.step("an expired credential leaves a retry rather than a blank stage", async () => {
    // The publication host refuses the exchange the way an expired grant is
    // refused; the app has to say so and offer the way back.
    await page.route("**/_access", (route) =>
      route.fulfill({ status: 401, body: "" }),
    );
    await open(page, made.publicationPath);
    await expect(
      page.getByText("This publication couldn’t open"),
    ).toBeVisible();
    await expect(page.getByTestId("access-retry")).toBeVisible();
    await page.unrouteAll({ behavior: "wait" });
  });

  await test.step("a browser that keeps the cookie out offers the catalogue its own tab", async () => {
    // The exchange succeeds and the cookie is dropped, which is what a blocked
    // third-party cookie looks like from this page: the catalogue answers 401.
    await page.route(
      (url) => url.host === publicationHost && url.pathname === "/",
      (route) => route.fulfill({ status: 401, body: "" }),
    );
    await open(page, made.publicationPath);
    await expect(
      page.getByText("Open the catalogue in its own tab"),
    ).toBeVisible();
    await expect(page.getByTestId("open-catalogue-tab")).toBeVisible();
    await page.unrouteAll({ behavior: "wait" });
  });

  await test.step("a private comparison read sends no credentials and covers the stage", async () => {
    const comparisonResponse = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return (
        url.origin === catalogueOrigin &&
        url.pathname.startsWith("/mokly-viewer/diffs/")
      );
    });

    await open(
      page,
      made.publicationPath + "?view=changes&catalogueScreen=start",
    );
    await expect(
      page.getByRole("heading", { level: 2, name: "Start" }),
    ).toBeVisible();
    // The compare modes stand in the Changes tab of the right panel.
    await page.getByRole("tab", { name: "Changes", exact: true }).click();
    await page
      .getByRole("button", { name: "Side by side", exact: true })
      .click();
    // The pinned viewer reads comparison documents itself, without the
    // publication host's cookie, so a private comparison is refused.
    const embedded = await comparisonResponse;
    const embeddedHeaders = await embedded.request().allHeaders();
    const embeddedCookieNames = (embeddedHeaders.cookie ?? "")
      .split(";")
      .map((part) => part.trim().split("=", 1)[0])
      .filter(Boolean);
    expect(embedded.status()).toBe(401);
    expect(embeddedCookieNames).not.toContain(catalogueCookie);
    expect(embeddedCookieNames).not.toContain("mkc_session");
    await expect(
      page.getByText("Open the catalogue in its own tab"),
    ).toBeVisible();
  });
});

import { expect, open, publicationPathFor, test } from "../harness";
import { publish } from "../publish";
import { makePublic, publishedViewerReady, publishedProject } from "./support";

test("a private publication is opened with the publication host's own cookie", async ({
  page,
}) => {
  const made = await publishedProject(page, "grant");
  expect(made.catalogueUrl).not.toBeNull();
  const publicationHost = new URL(made.catalogueUrl as string).host;

  // Whatever this page sends to the publication host, it is never the app's
  // own session: that credential belongs to the app origin alone.
  const sent: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).host !== publicationHost) return;
    sent.push(request.headers().cookie ?? "");
  });

  await open(page, made.publicationPath);
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

  expect(sent.length, "the app talks to the publication host").toBeGreaterThan(
    0,
  );
  for (const cookie of sent) {
    expect(cookie, "the app session never reaches the catalogue").not.toContain(
      "mkc_session",
    );
  }

  // The cookie is the publication host's own, not the catalogue domain's, so
  // it is asked for at exactly that origin.
  const cookies = await page.context().cookies(made.catalogueUrl as string);
  const held = cookies.find((entry) => entry.name === "__Host-mkc_catalogue");
  expect(
    held,
    "the publication host set its own host-only cookie",
  ).toBeTruthy();
  expect(held?.httpOnly).toBe(true);
  expect(held?.domain).toBe(new URL(made.catalogueUrl as string).hostname);
});

test("an expired catalogue cookie is renewed once by the next detail read", async ({
  context,
  page,
}) => {
  const made = await publishedProject(page, "detail-renewal");
  const origin = new URL(made.catalogueUrl as string).origin;
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
  await publishedViewerReady(page);
  expect(exchanges).toEqual(["grant", "exchange", "confirmation"]);
  const shell = await page.locator("[data-mokly-shell]").elementHandle();

  // The cookie lives 300 seconds; without it the host answers as it does
  // after expiry, and the next entry's detail read meets that 401.
  await context.clearCookies({ name: "__Host-mkc_catalogue" });
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

test("a private publication switch confirms access before catalogue loading", async ({
  page,
}) => {
  const older = await publishedProject(page, "grant-switch");
  const newer = await publish(older.token, older.projectId, { branch: "main" });
  await open(page, await publicationPathFor(page, older.projectId, newer.id));
  await publishedViewerReady(page);

  const olderOrigin = new URL(older.catalogueUrl as string).origin;
  let confirmed = false;
  let catalogueLoads = 0;
  const premature: string[] = [];
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (url.origin === olderOrigin && url.pathname === "/" && response.ok()) {
      confirmed = true;
    }
  });
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (
      url.origin === olderOrigin &&
      url.pathname === "/mokly-viewer/index.json"
    ) {
      catalogueLoads += 1;
      if (!confirmed) premature.push(url.href);
    }
  });

  await page.getByTestId("viewer-history").click();
  await page.locator(`a[href="${older.publicationPath}"]`).click();
  await expect(page).toHaveURL(
    new RegExp(`publications/${older.publicationId}$`),
  );
  await expect(page.locator("[data-mokly-shell]")).toBeVisible();
  expect(confirmed).toBe(true);
  expect(catalogueLoads).toBeGreaterThan(0);
  expect(premature).toEqual([]);
});

test("a public publication asks for no grant at all", async ({ page }) => {
  const made = await publishedProject(page, "public-grant");
  let grants = 0;
  await page.route("**/access-grants", (route) => {
    grants += 1;
    return route.continue();
  });
  await makePublic(page, made.projectId);

  await open(page, made.publicationPath);
  await expect(page.getByTestId("viewer-share")).toBeEnabled();
  expect(grants, "a public catalogue needs no credential").toBe(0);
});

test("an expired credential leaves a retry rather than a blank stage", async ({
  page,
}) => {
  const made = await publishedProject(page, "expired-grant");
  // The publication host refuses the exchange the way an expired grant is
  // refused; the app has to say so and offer the way back.
  await page.route("**/_access", (route) =>
    route.fulfill({ status: 401, body: "" }),
  );
  await open(page, made.publicationPath);
  await expect(page.getByText("This publication couldn’t open")).toBeVisible();
  await expect(page.getByTestId("access-retry")).toBeVisible();
});

test("a browser that keeps the cookie out offers the catalogue its own tab", async ({
  page,
}) => {
  const made = await publishedProject(page, "blocked-grant");
  const publicationHost = new URL(made.catalogueUrl as string).host;
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
});

test("a private comparison read sends no credentials and covers the stage", async ({
  page,
}) => {
  const made = await publishedProject(page, "private-comparison");
  const catalogueOrigin = new URL(made.catalogueUrl as string).origin;
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
  await page.getByRole("button", { name: "Side by side", exact: true }).click();
  // The pinned viewer reads comparison documents itself, without the
  // publication host's cookie, so a private comparison is refused.
  const embedded = await comparisonResponse;
  const embeddedHeaders = await embedded.request().allHeaders();
  const embeddedCookieNames = (embeddedHeaders.cookie ?? "")
    .split(";")
    .map((part) => part.trim().split("=", 1)[0])
    .filter(Boolean);
  expect(embedded.status()).toBe(401);
  expect(embeddedCookieNames).not.toContain("__Host-mkc_catalogue");
  expect(embeddedCookieNames).not.toContain("mkc_session");
  await expect(
    page.getByText("Open the catalogue in its own tab"),
  ).toBeVisible();
});

import type { Page, Request } from "@playwright/test";

import { accessStartPath } from "../../viewer/access-exchange";
import { expect, open, test } from "../harness";

import {
  routeAccessStatus,
  routeUnavailableFrame,
} from "./access-browser-fixture";
import { catalogueCookie, checkCookieAccess } from "./access-cookie";
import { publishedProject } from "./support";

const shell = "[data-mokly-shell]";
const startPage = `/${accessStartPath}`;
const index = "/mokly-viewer/index.json";
const blockedTitle = "This publication can’t open in this browser";

function originOf(catalogueUrl: string | null): string {
  if (catalogueUrl === null)
    throw new Error("The publication has no catalogue origin.");
  return new URL(catalogueUrl).origin;
}

/** The blocked stage is one final message: its title, its line, no action. */
async function expectBlockedStage(page: Page): Promise<void> {
  const card = page.getByRole("alert").filter({
    has: page.getByRole("heading", { name: blockedTitle, exact: true }),
  });
  await expect(card).toBeVisible();
  await expect(
    card.getByText("Open it in Chrome, Edge or Firefox on a computer.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(card.getByRole("button")).toHaveCount(0);
  await expect(card.getByRole("link")).toHaveCount(0);
  await expect(page.getByTestId("open-catalogue-tab")).toHaveCount(0);
}

test(
  "a private publication is opened with the publication host's own cookie, renewed once, and confirmed before a switch loads",
  checkCookieAccess,
);

test("a refused private catalogue leaves a retry or a covered comparison", async ({
  page,
}) => {
  const made = await publishedProject(page, "refused-grant");
  const origin = originOf(made.catalogueUrl);

  await test.step("an expired credential leaves a retry rather than a blank stage", async () => {
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

  await test.step("a private comparison read sends no credentials and covers the stage", async () => {
    const comparisonResponse = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return (
        url.origin === origin && url.pathname.startsWith("/mokly-viewer/diffs/")
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
    // The viewer reads comparison documents itself without the catalogue cookie.
    const embedded = await comparisonResponse;
    const embeddedHeaders = await embedded.request().allHeaders();
    const embeddedCookieNames = (embeddedHeaders.cookie ?? "")
      .split(";")
      .map((part) => part.trim().split("=", 1)[0])
      .filter(Boolean);
    expect(embedded.status()).toBe(401);
    expect(embeddedCookieNames).not.toContain(catalogueCookie);
    expect(embeddedCookieNames).not.toContain("mkc_session");
    // The overlay draws the blocked stage card.
    await expect(
      page.getByRole("heading", { name: blockedTitle, exact: true }),
    ).toBeVisible();
  });
});

test("a failed cookie confirmation opens the private catalogue with bearer reads", async ({
  page,
}) => {
  const made = await publishedProject(page, "bearer-access");
  const origin = originOf(made.catalogueUrl);
  await routeAccessStatus(page, origin, "/", 401, false);
  const detail = "/mokly-viewer/entries/start.json";
  const requests: Request[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (
      url.origin === origin &&
      request.method() === "GET" &&
      ["/", startPage, index, detail].includes(url.pathname)
    ) {
      requests.push(request);
    }
  });

  await open(page, made.publicationPath);
  await expect(page.locator(shell)).toBeVisible();
  await page.getByRole("link", { name: /^Start( Changed)?$/ }).click();
  await expect(
    page.getByRole("heading", { level: 2, name: "Start" }),
  ).toBeVisible();

  expect(requests.map((request) => new URL(request.url()).pathname)).toEqual([
    "/",
    startPage,
    "/",
    index,
    detail,
  ]);
  const [cookie, check, ...reads] = await Promise.all(
    requests.map((request) => request.allHeaders()),
  );
  expect(cookie?.authorization).toBeUndefined();
  expect(check?.authorization).toMatch(/^Bearer /);
  for (const headers of [check, ...reads]) {
    expect(headers?.authorization).toBe(check?.authorization);
    expect(headers?.cookie).toBeUndefined();
  }
});

test("a missing start page shows the blocked stage before the viewer mounts", async ({
  page,
}) => {
  const made = await publishedProject(page, "missing-access-start");
  const origin = originOf(made.catalogueUrl);
  await routeAccessStatus(page, origin, "/", 401, false);
  await routeAccessStatus(page, origin, startPage, 404, true);

  await open(page, made.publicationPath);
  await expectBlockedStage(page);
  await expect(page.locator(shell)).toHaveCount(0);
});

test("a failed bearer confirmation offers Try again", async ({ page }) => {
  const made = await publishedProject(page, "refused-bearer");
  const origin = originOf(made.catalogueUrl);
  await routeAccessStatus(page, origin, "/", 401, false);
  await routeAccessStatus(page, origin, "/", 401, true);

  await open(page, made.publicationPath);
  await expect(page.getByText("This publication couldn’t open")).toBeVisible();
  const retry = page.getByTestId("access-retry");
  await expect(retry).toBeVisible();
  await expect(page.locator(shell)).toHaveCount(0);
  await page.unrouteAll({ behavior: "wait" });
  await retry.click();
  await expect(page.locator(shell)).toBeVisible();
});

test("a private frame that cannot open with its token replaces the viewer with the blocked stage", async ({
  page,
}) => {
  const made = await publishedProject(page, "unavailable-frame-access");
  const origin = originOf(made.catalogueUrl);
  await routeAccessStatus(page, origin, "/", "abort", false);
  const frameTokens = await routeUnavailableFrame(page, origin);
  let exchanges = 0;
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (
      url.origin === origin &&
      url.pathname === "/_access" &&
      request.method() === "POST"
    )
      exchanges += 1;
  });
  const indexRead = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return (
      url.origin === origin &&
      url.pathname === index &&
      request.method() === "GET"
    );
  });

  await open(page, made.publicationPath);
  await expect(page.locator(shell)).toBeVisible();
  const authorization = await (await indexRead).headerValue("authorization");
  expect(authorization).toMatch(/^Bearer /);
  await page.getByRole("link", { name: /^Start( Changed)?$/ }).click();
  await expectBlockedStage(page);
  await expect(page.locator(shell)).toHaveCount(0);
  expect(frameTokens.length).toBeGreaterThan(0);
  for (const token of frameTokens)
    expect(`Bearer ${token}`).toBe(authorization);
  expect(exchanges).toBe(1);
});

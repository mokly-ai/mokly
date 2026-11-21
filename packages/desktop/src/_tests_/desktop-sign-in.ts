import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { promisify } from "node:util";

import { expect } from "@playwright/test";
import type { ElectronApplication, Page } from "@playwright/test";

import {
  grantOf,
  keptVerifier,
  recordConnect,
  requestGrant,
} from "../../../app/src/_tests_/desktop-sign-in";
import { apiOrigin, appOrigin } from "../../../app/src/_tests_/origins";
import { mailedLink } from "../../../app/src/_tests_/sign-in-links";

import { captureOpener, opened, screenshot } from "./shell";

/** Press the real window action and capture what its system-browser opener receives. */
export async function startSignIn(
  electron: ElectronApplication,
  page: Page,
): Promise<{ connect: URL; verifier: string }> {
  await captureOpener(electron);
  await page.getByRole("button", { name: "Continue in browser" }).click();
  await expect.poll(() => opened(electron)).toHaveLength(1);
  const [address] = await opened(electron);
  const connect = new URL(address);
  expect(connect.origin).toBe(appOrigin);
  expect(connect.pathname).toBe("/connect/desktop");
  expect(connect.searchParams.get("challenge")).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(connect.searchParams.get("returnTo")).toBe("/new");
  const verifier = await keptVerifier(page);
  if (verifier === null)
    throw new Error("The window did not keep its verifier");
  expect(connect.searchParams.get("challenge")).toBe(
    createHash("sha256").update(verifier).digest("base64url"),
  );
  return { connect, verifier };
}

/** Sign the separate browser in and issue a grant through the real connect page and API. */
export async function browserGrant(
  browser: Page,
  email: string,
  connect: URL,
): Promise<string> {
  await browser.context().clearCookies();
  await browser.goto(appOrigin + "/sign-up");
  await browser.getByLabel("Email").fill(email);
  const sent = browser.waitForResponse(apiOrigin + "/v1/auth/magic-links");
  await browser.getByTestId("email-entry").click();
  expect((await sent).status()).toBe(202);
  const link = await mailedLink(email);
  expect(new URL(link).search).toBe("");
  await browser.goto(link);
  await browser.waitForURL(appOrigin + "/new");
  const log = await recordConnect(browser);
  await browser.goto(connect.href);
  await expect(
    browser.getByRole("button", { name: "Open Mokly" }),
  ).toBeVisible();
  await screenshot(browser, "browser-handoff");
  await requestGrant(browser);
  await expect.poll(() => log.schemes.length).toBe(1);
  expect(log.requests).toHaveLength(1);
  expect(log.requests[0].postDataJSON()).toEqual({
    challenge: connect.searchParams.get("challenge"),
    returnTo: connect.searchParams.get("returnTo"),
  });
  return grantOf(log.schemes[0].url);
}

/** A real second launch delivers its argument while the requesting tab keeps its verifier. */
export async function launchHandoff(
  electron: ElectronApplication,
  profile: string,
  address: string,
): Promise<void> {
  try {
    await promisify(execFile)(
      electron.process().spawnfile,
      ["--no-sandbox", ".", `--user-data-dir=${profile}`, address],
      { cwd: process.cwd(), env: process.env },
    );
  } catch {
    throw new Error("The desktop handoff launch failed");
  }
}

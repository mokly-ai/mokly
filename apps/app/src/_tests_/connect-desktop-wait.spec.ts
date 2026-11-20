import { connectDesktopAddress } from "../navigation/desktop-sign-in";

import {
  connectReturnTo,
  controls,
  expectConfirmation,
  externalGlyphIn,
  freshVerifier,
  recordConnect,
} from "./desktop-sign-in";
import { expect, freshEmail, open, signIn, test } from "./harness";
import { holdReads } from "./viewer/held-reads";

/**
 * The connect page's wait for the session read, as the Wait composition of
 * `folio-chrome.md` defines it: the confirmation's own layout, which a
 * signed-in reader gets, held here until it has been seen. Open Mokly's own
 * request waits on its control, which `connect-desktop.spec.ts` checks with
 * its refusal.
 */

test("while the session read runs, the page draws its confirmation waiting", async ({
  page,
}) => {
  const email = freshEmail("connect-session-wait");
  await signIn(page, email);
  const { challenge } = freshVerifier();
  const log = await recordConnect(page);
  const session = await holdReads(
    page,
    (url) => url.pathname === "/v1/session",
  );
  await open(page, connectDesktopAddress(challenge, connectReturnTo));
  await session.arrived;

  // The confirmation's own layout: its title and both controls, drawn
  // disabled, and the line that names the account naming the read instead.
  await expect(
    page.getByRole("heading", { level: 1, name: "Sign in to the Mokly app" }),
  ).toBeVisible();
  await expect(page.locator("main .fo-wait")).toHaveAttribute(
    "aria-busy",
    "true",
  );
  await expect(page.locator(".fo-account-detail")).toHaveText(
    "Loading your account…",
  );
  await expect(page.locator(".fo-account-header")).not.toContainText(email);
  await expect(controls(page)).toHaveText([
    "Open Mokly",
    "Use another account",
  ]);
  for (const name of ["Open Mokly", "Use another account"])
    await expect(page.getByRole("button", { name })).toBeDisabled();
  // Open Mokly draws itself, so it keeps the glyph of a control that leaves.
  await expect(
    externalGlyphIn(page.getByRole("button", { name: "Open Mokly" })),
  ).toHaveCount(1);

  session.release();
  await expectConfirmation(page, email);
  expect(log.requests, "the wait requests no grant").toEqual([]);
});

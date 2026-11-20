import { failWith } from "./api-responses";
import { failureShape } from "./fragment";
import { expect, freshEmail, open, test } from "./harness";

test("a refused resend is reported beside Resend link", async ({ page }) => {
  const address = freshEmail("resend");
  await open(
    page,
    `/auth/email?email=${encodeURIComponent(address)}&returnTo=/dashboard`,
  );
  await failWith(page, "**/v1/auth/magic-links", "POST", "unavailable");
  const control = page.getByTestId("resend-link");
  await control.click();

  // The refusal belongs to the resend, so it is reported beside that control
  // rather than in place of the screen: the link this screen was opened for
  // was sent, and the screen still says so.
  await expect(
    page.locator(".fo-write-failure").getByTestId("resend-link"),
    "the control is inside the fragment",
  ).toBeVisible();
  await expect(
    page.locator(".fo-write-failure").getByRole("alert"),
    "the cause is the one the reason carries",
  ).toHaveText("Mokly is busy. Try again in a moment.");
  await expect(control, "the control is the way back").toHaveText("Try again");
  const shape = await failureShape(page, "resend-link");
  expect(shape.causeAbove, "the cause is above the control").toBe(true);
  expect(shape.references, "one reference").toBe(1);
  expect(shape.detailsBelow, "the reference is beneath the control").toBe(true);
  await expect(
    page.getByText(address).first(),
    "the screen keeps what it was saying",
  ).toBeVisible();

  // The same request can succeed, so the way back sends it again; once it has,
  // there is nothing left to send and nothing left to report.
  await page.unrouteAll();
  await page.route("**/v1/auth/magic-links", (route) =>
    route.fulfill({
      status: 202,
      contentType: "application/json",
      body: JSON.stringify({
        requestId: "01994f10-0000-7000-8000-0000000000cc",
        resendAfter: "2026-01-01T00:00:00Z",
      }),
    }),
  );
  await control.click();
  await expect(control, "the link was sent").toHaveText("Link sent");
  await expect(control, "there is nothing left to send").toBeDisabled();
  await expect(page.getByRole("alert"), "no notice").toHaveCount(0);
  await expect(page.locator(".fo-error-details"), "no reference").toHaveCount(
    0,
  );
  await page.unrouteAll();
});

test("a link sent from the empty state says where it went", async ({
  page,
}) => {
  await open(page, "/auth/email?returnTo=/dashboard");
  const address = freshEmail("sent-from-empty");
  await page.getByLabel("Email").fill(address);
  await page.route("**/v1/auth/magic-links", (route) =>
    route.fulfill({
      status: 202,
      contentType: "application/json",
      body: JSON.stringify({
        requestId: "01994f10-0000-7000-8000-0000000000dd",
        resendAfter: "2026-01-01T00:00:00Z",
      }),
    }),
  );
  await page.getByTestId("send-link").click();

  // Sending is what the screen was for, so the reader lands on the same
  // composition as anyone who arrived with a link outstanding: it names the
  // address the link actually went to, and there is nothing left to send.
  await expect(
    page.getByText(address).first(),
    "the screen names the address the link went to",
  ).toBeVisible();
  const control = page.getByTestId("resend-link");
  await expect(control, "the link was sent").toHaveText("Link sent");
  await expect(control, "there is nothing left to send").toBeDisabled();
  await expect(
    page.getByText("Change email"),
    "the way to correct the address is offered",
  ).toBeVisible();
  await expect(
    page.getByTestId("send-link"),
    "the form the reader has finished with is gone",
  ).toHaveCount(0);
  await page.unrouteAll();
});

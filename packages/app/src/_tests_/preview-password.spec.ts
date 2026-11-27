import { failWith } from "./api-responses";
import { previewSignInEmail, previewSignInPassword } from "./api-server";
import { signedInAs } from "./desktop-sign-in";
import { failureShape } from "./fragment";
import { expect, open, test } from "./harness";

/**
 * Sign in's password section against the suite's API, whose configuration
 * answer names the shared account and which checks a password against the
 * shared fixture's verifier. A refusal for any other cause, and the write's
 * wait, are asserted with every other write in `settings/writes.spec.ts`.
 */

/** The section's control, named for the shared account. */
const continueAs = "Continue as " + previewSignInEmail;

test("a password the API refused is said on the Password field, and the control keeps its label", async ({
  page,
}) => {
  await open(page, "/sign-in");
  const field = page.getByLabel("Password", { exact: true });
  const control = page.getByTestId("password-entry");
  await field.fill("not the preview password");
  // The API's own tests refuse a wrong password with this reason, so the
  // answer is routed here rather than spending a slow password check on it.
  await failWith(page, "**/v1/auth/preview", "POST", "magic-link-invalid");
  await control.click();

  await expect(field, "the field is marked").toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(
    page.getByText("This password isn’t valid."),
    "the field says why, once",
  ).toHaveCount(1);
  await expect(control, "the same password would be refused again").toHaveText(
    continueAs,
  );
  await expect(field, "the password is kept").toHaveValue(
    "not the preview password",
  );
  const shape = await failureShape(page, "password-entry");
  expect(shape.causeAbove, "nothing is said again above the control").toBe(
    false,
  );
  expect(shape.references, "one reference").toBe(1);
  expect(shape.detailsBelow, "the reference is beneath the control").toBe(true);

  // Nothing about it reaches the email form.
  await expect(page.getByLabel("Email", { exact: true })).toHaveAttribute(
    "aria-invalid",
    "false",
  );
  await expect(page.getByTestId("email-entry")).toHaveText(
    "Continue with email",
  );
});

test("the trimmed password signs in the shared account and returns to the page's destination", async ({
  page,
}) => {
  const destination = "/new?from=password";
  await open(page, `/sign-in?returnTo=${encodeURIComponent(destination)}`);
  const field = page.getByLabel("Password", { exact: true });
  const control = page.getByTestId("password-entry");
  // White space alone is nothing to send.
  await field.fill("   ");
  await expect(control).toBeDisabled();

  await field.fill(`  ${previewSignInPassword} `);
  const sent = page.waitForRequest(
    (request) =>
      request.method() === "POST" && request.url().endsWith("/v1/auth/preview"),
  );
  await control.click();
  expect(
    (await sent).postDataJSON(),
    "the API checks the password as sent, so the page sends it trimmed",
  ).toEqual({ password: previewSignInPassword, returnTo: destination });

  await page.waitForURL((url) => url.pathname + url.search === destination);
  expect(await signedInAs(page)).toBe(previewSignInEmail);
});

import { failWith } from "./api-responses";
import { failureShape } from "./fragment";
import { expect, freshEmail, open, test } from "./harness";

/**
 * Sign in and sign up are one composition, so what one of them does with a
 * refused write the other does too. Every statement about that screen is made
 * about both here rather than about whichever was written first.
 */
const entries = ["sign-in", "sign-up"] as const;

test("GitHub sign-in reports the operation and keeps email open", async ({
  page,
}) => {
  await open(page, "/sign-in");
  // The suite's API has a GitHub App, so the answer that says the operation is
  // not open yet is the one deployment the environment cannot produce.
  await failWith(page, "**/v1/auth/github", "POST", "operation-unavailable");
  await page.getByRole("button", { name: "Continue with GitHub" }).click();
  // Nothing failed and there is no way back to offer, so the notice is polite
  // rather than assertive, and it is said beside the control it is about.
  await expect(page.getByRole("status")).toContainText("email address");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByLabel("Email")).toBeVisible();
  const placed = await page.getByRole("status").evaluate((notice: Element) => {
    const before = (testId: string) => {
      const target = document.querySelector(`[data-testid="${testId}"]`);
      return (
        target !== null &&
        (notice.compareDocumentPosition(target) &
          Node.DOCUMENT_POSITION_FOLLOWING) !==
          0
      );
    };
    return {
      beforeGitHub: before("github-entry"),
      beforeEmailField: before("field-sign-in-email"),
    };
  });
  expect(placed.beforeGitHub, "the notice is above Continue with GitHub").toBe(
    true,
  );
  expect(
    placed.beforeEmailField,
    "the notice is beside GitHub, not the email form",
  ).toBe(true);
  await expect(page.getByLabel("Email")).toHaveAttribute(
    "aria-invalid",
    "false",
  );
});

test("a refused link says why above Continue with email", async ({ page }) => {
  for (const mode of entries) {
    await open(page, `/${mode}`);
    const address = freshEmail(mode + "-refused");
    await page.getByLabel("Email").fill(address);
    await failWith(page, "**/v1/auth/magic-links", "POST", "unavailable");
    const control = page.getByTestId("email-entry");
    await control.click();

    await expect(
      page.locator(".fo-write-failure").getByTestId("email-entry"),
      `${mode}: the control is inside the fragment`,
    ).toBeVisible();
    await expect(
      page.locator(".fo-write-failure").getByRole("alert"),
      `${mode}: the cause is the one the reason carries`,
    ).toHaveText("Mokly is busy. Try again in a moment.");
    await expect(control, `${mode}: the control is the way back`).toHaveText(
      "Try again",
    );

    // The address is not what this refusal was about, so it is kept and the
    // field is left unmarked: marking it would say the reader's text is wrong.
    const field = page.getByLabel("Email");
    await expect(field, `${mode}: the address is retained`).toHaveValue(
      address,
    );
    await expect(field, `${mode}: the field is unmarked`).toHaveAttribute(
      "aria-invalid",
      "false",
    );

    const shape = await failureShape(page, "email-entry");
    expect(shape.causeAbove, `${mode}: the cause is above the control`).toBe(
      true,
    );
    expect(shape.references, `${mode}: one reference`).toBe(1);
    expect(
      shape.detailsBelow,
      `${mode}: the reference is beneath the control`,
    ).toBe(true);
    await page.unrouteAll();
  }
});

test("an address the API refused marks the field", async ({ page }) => {
  for (const mode of entries) {
    await open(page, `/${mode}`);
    await page.getByLabel("Email").fill("someone@example");
    await failWith(page, "**/v1/auth/magic-links", "POST", "validation-failed");
    const control = page.getByTestId("email-entry");
    await control.click();

    // The sentence the registered input's invalid variant draws, not the
    // shared copy every other form's field would have shown.
    await expect(
      page.getByText("Enter a complete email address."),
      `${mode}: the field says what to do, once`,
    ).toHaveCount(1);
    await expect(
      page.getByLabel("Email"),
      `${mode}: the field is marked`,
    ).toHaveAttribute("aria-invalid", "true");
    await expect(
      control,
      `${mode}: the control keeps its own label`,
    ).toHaveText("Continue with email");
    await expect(
      page.locator(".fo-write-failure").getByRole("alert"),
      `${mode}: nothing is said a second time above the control`,
    ).toHaveCount(0);
    await page.unrouteAll();
  }
});

test("a refused GitHub connect leaves the email form alone", async ({
  page,
}) => {
  for (const mode of entries) {
    await open(page, `/${mode}`);
    await failWith(page, "**/v1/auth/github", "POST", "unavailable");
    await page.getByTestId("github-entry").click();

    // The refusal is reported beside the control that made it.
    await expect(
      page.locator(".fo-write-failure").getByTestId("github-entry"),
      `${mode}: reported beside Continue with GitHub`,
    ).toBeVisible();
    await expect(
      page.getByTestId("github-entry"),
      `${mode}: that control is the way back`,
    ).toHaveText("Try again");

    // Nothing about it reaches the other control's form.
    await expect(
      page.getByTestId("email-entry"),
      `${mode}: the email control keeps its resting label`,
    ).toHaveText("Continue with email");
    await expect(
      page.getByLabel("Email"),
      `${mode}: the Email field is unmarked`,
    ).toHaveAttribute("aria-invalid", "false");
    const shape = await failureShape(page, "email-entry");
    expect(shape.causeAbove, `${mode}: no cause above the email control`).toBe(
      false,
    );
    expect(shape.references, `${mode}: no reference under the email form`).toBe(
      0,
    );
    await expect(
      page.locator(".fo-error-details"),
      `${mode}: one disclosure, and it is GitHub's`,
    ).toHaveCount(1);
    await page.unrouteAll();
  }
});

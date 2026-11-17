import { failureShape } from "./fragment";
import {
  createProject,
  expect,
  failWith,
  freshEmail,
  navigateMagicLink,
  open,
  projectPathFor,
  signIn,
  test,
} from "./harness";
import { recordedFrames, recordFrames } from "./screen-frames";

/**
 * Sign in and sign up are one composition, so what one of them does with a
 * refused write the other does too. Every statement about that screen is made
 * about both here rather than about whichever was written first.
 */
const entries = ["sign-in", "sign-up"] as const;

test("a settings query stays inert while the reader is signed out", async ({
  page,
}) => {
  let scopeRequests = 0;
  await page.route("**/v1/workspaces", (route) => {
    scopeRequests += 1;
    return route.continue();
  });
  const session = page.waitForResponse((answer) =>
    answer.url().endsWith("/v1/session"),
  );
  await open(page, "/sign-in?settings=account");
  await session;
  await expect(page.getByLabel("Email")).toBeVisible();
  expect(scopeRequests).toBe(0);
});

test("a new account signs up through a one-use email link", async ({
  page,
}) => {
  const email = freshEmail("signup");
  await signIn(page, email);
  // A fresh account opens on the first setup step, which is the workspace:
  // nothing earlier is asked of them.
  await page.waitForURL((url) => url.pathname === "/new");
  await expect(
    page.getByRole("heading", { level: 1, name: "Create a workspace" }),
  ).toBeVisible();
  await expect(page.locator(".fo-step-count-label")).toContainText(
    "Step 1 of 3",
  );
  // A reader who has set no name is called by their address, whole, and it
  // is the header that says so: the panel names no one.
  const identity = page.locator(".fo-account-header .review-account");
  await expect(identity.locator("span").last()).toHaveText(email);
  await expect(identity).not.toHaveAttribute("title");
  expect(page.url()).not.toContain("token=");
});

test("a used link says so and offers another one", async ({ page }) => {
  const email = freshEmail("used");
  await signIn(page, email);
  await page.waitForURL((url) => url.pathname === "/new");
  const { magicLinkFor } = await import("./api-server");
  await navigateMagicLink(page, magicLinkFor(email) as string);
  await expect(
    page.getByRole("heading", { level: 1, name: /already been used/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Back to sign in" }),
  ).toBeVisible();
});

test("a duplicate email token is refused and removed from the URL", async ({
  page,
}) => {
  let requests = 0;
  await page.route("**/v1/auth/callback", (route) => {
    requests += 1;
    return route.abort();
  });
  const first = "a".repeat(64);
  const second = "b".repeat(64);
  await page.goto(
    `/auth/email/callback?source=test#token=${first}&token=${second}`,
  );

  await expect(
    page.getByRole("button", { name: "Back to sign in" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 1, name: "This link isn’t valid" }),
  ).toBeVisible();
  expect(new URL(page.url()).search).toBe("?source=test");
  expect(new URL(page.url()).hash).toBe("");
  expect(requests).toBe(0);
});

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

test("a private deep link returns to itself after signing in", async ({
  page,
}) => {
  const email = freshEmail("returnto");
  await signIn(page, email);
  const projectId = await createProject(page, "Return Org");
  const destination = await projectPathFor(page, projectId);
  await page.evaluate(() => window.localStorage.clear());
  await page.context().clearCookies();
  await recordFrames(page);
  await page.goto(destination);
  await page.waitForURL(/sign-in\?returnTo=/);
  expect(decodeURIComponent(page.url())).toContain(destination);
  // While the guard sends the reader on, it draws the sign-in screen's wait,
  // not the destination's: the panel they are about to use, waiting.
  expect(await recordedFrames(page)).toContainEqual({
    heading: "Sign in to Mokly",
    waiting: true,
  });
});

test("account entry stays usable at 320px with 200% text", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await open(page, "/sign-up");
  await page.addStyleTag({ content: "html{font-size:32px}" });
  await expect(
    page.getByRole("heading", { level: 1, name: "Create your account" }),
  ).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
  const box = await page
    .getByRole("button", { name: "Continue with GitHub" })
    .boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
});

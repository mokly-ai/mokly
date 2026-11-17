import { projectPathFor } from "./addresses";
import {
  expect,
  freshEmail,
  navigateMagicLink,
  open,
  signIn,
  test,
} from "./harness";
import { createProject } from "./project-setup";
import { recordedFrames, recordFrames } from "./screen-frames";

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

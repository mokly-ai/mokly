import { projectQueryPathFor } from "../addresses";
import { countRequests, failWith } from "../api-responses";
import { expect, freshEmail, openDialog, signIn, test } from "../harness";
import { createProject } from "../project-setup";

import { chooseRevoke, makeToken } from "./tokens";

test("a token is created, revealed once and revoked behind a confirmation", async ({
  page,
}) => {
  await signIn(page, freshEmail("token"));
  const projectId = await createProject(page, "Token Org");
  await openDialog(
    page,
    await projectQueryPathFor(page, projectId, "settings=tokens"),
  );
  await expect(page.getByText("Create a publishing token")).toBeVisible();
  await makeToken(page, "GitHub Actions");
  const secret = page.locator(".fo-secret");
  await expect(secret).toHaveText(/^mkc_[0-9a-f]{64}$/);
  // The one render of the secret is closed only by its own Done.
  await page.keyboard.press("Escape");
  await page.mouse.click(10, 10);
  await expect(secret).toBeVisible();
  await page.getByTestId("token-done").click();
  await expect(page.locator(".fo-secret")).toHaveCount(0);
  await expect(page.getByText("GitHub Actions", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator(".fo-secret")).toHaveCount(0);
  await chooseRevoke(page, "GitHub Actions");
  await expect(page.getByText("Create a replacement first.")).toBeVisible();
  await page.getByRole("button", { name: "Revoke token" }).click();
  await expect(page.getByText("Revoked")).toBeVisible();
  // A revoked token has nothing left to do.
  await expect(
    page.getByRole("button", { name: "Actions for GitHub Actions" }),
  ).toHaveCount(0);
});

test("a failed token revoke says so and offers one retry", async ({ page }) => {
  await signIn(page, freshEmail("revoke-token-fails"));
  const projectId = await createProject(page, "Rev Org");
  await openDialog(
    page,
    await projectQueryPathFor(page, projectId, "settings=tokens"),
  );
  await makeToken(page, "Doomed token");
  await page.getByTestId("token-done").click();

  await failWith(page, "**/v1/projects/*/tokens/*", "DELETE", "unavailable");
  await chooseRevoke(page, "Doomed token");
  const confirm = page.getByTestId("confirm-revoke");
  await confirm.click();
  await expect(page.getByRole("alert")).toContainText("Mokly is busy");
  await expect(confirm).toHaveText("Try again");
  await expect(confirm).toBeEnabled();
  await page.getByText("Details").last().click();
  await expect(page.getByText("Reference")).toBeVisible();
});

test("a token is reported copied only when it was, whatever the clipboard does", async ({
  page,
}) => {
  await signIn(page, freshEmail("clipboard"));
  const projectId = await createProject(page, "Clip Org");
  // A browser that will not copy: a page served over plain http, an older
  // permission path, a reader who has refused. The secret is on screen, so
  // saying it was copied when it was not is the one unrecoverable answer.
  await page.addInitScript(() => {
    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
  });
  await openDialog(
    page,
    await projectQueryPathFor(page, projectId, "settings=tokens"),
  );

  await test.step("a token is reported copied only when it was", async () => {
    await makeToken(page, "Uncopyable token");
    const copy = page.getByTestId("copy-token");
    const secret = await page.locator(".fo-secret").textContent();

    await copy.click();
    await expect(copy).toHaveText("Copy token");
    await expect(page.getByRole("alert")).toContainText("Copying didn’t work");
    await expect(page.locator(".fo-secret")).toHaveText(secret ?? "");
    await page.getByTestId("token-done").click();
  });

  await test.step("a clipboard that refuses is not reported as a copy", async () => {
    // The clipboard is replaced in the running page, which no reader can do.
    await page.evaluate(() => {
      Object.defineProperty(window.navigator, "clipboard", {
        configurable: true,
        value: { writeText: () => Promise.reject(new Error("denied")) },
      });
    });
    await makeToken(page, "Refused token");
    const copy = page.getByTestId("copy-token");
    await copy.click();
    await expect(copy).toHaveText("Copy token");
    await expect(page.getByRole("alert")).toContainText("Copying didn’t work");
  });
});

test("pressing a destructive control twice sends one write", async ({
  page,
}) => {
  await signIn(page, freshEmail("one-write"));
  const projectId = await createProject(page, "Once Org");
  await openDialog(
    page,
    await projectQueryPathFor(page, projectId, "settings=tokens"),
  );
  await makeToken(page, "Twice pressed");
  await page.getByTestId("token-done").click();

  const sent = await countRequests(page, "**/v1/projects/*/tokens/*", "DELETE");
  await chooseRevoke(page, "Twice pressed");
  const confirm = page.getByTestId("confirm-revoke");
  // Two presses in one task, before anything can be disabled in between: the
  // control has to refuse the second itself, not rely on being greyed out.
  // While its write works it is busy, which refuses a press and keeps focus.
  await confirm.evaluate((node: HTMLElement) => {
    node.click();
    node.click();
  });
  await expect(confirm).toHaveAttribute("aria-busy", "true");
  await expect(page.getByText("Revoked")).toBeVisible();
  expect(sent()).toBe(1);
});

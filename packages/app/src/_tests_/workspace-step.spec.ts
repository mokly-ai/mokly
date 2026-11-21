import type { Page } from "@playwright/test";

import { failWith } from "./api-responses";
import { expect, freshEmail, signIn, test } from "./harness";

/**
 * The workspace step's own write, refused: each refusal is reported beside
 * Create workspace, and the name the reader typed stays theirs.
 */

/** The reader at the workspace step, with a name typed and nothing sent. */
async function atWorkspaceStep(page: Page, label: string): Promise<void> {
  await signIn(page, freshEmail(label));
  await page.waitForURL((url) => url.pathname === "/new");
  await page.getByLabel("Workspace name").fill("Refused Org");
}

test("a refused workspace is reported beside its own control", async ({
  page,
}) => {
  await atWorkspaceStep(page, "refused-org");
  await failWith(page, "**/v1/workspaces", "POST", "unavailable");
  await page.getByTestId("create-workspace").click();

  // The operation is named by the control and the cause by the message.
  const control = page.getByTestId("create-workspace");
  await expect(control).toHaveText("Try again");
  const fragment = page.locator(".fo-write-failure");
  await expect(fragment.getByRole("alert")).toHaveText(
    "Mokly is busy. Try again in a moment.",
  );
  await expect(fragment.getByTestId("create-workspace")).toBeVisible();
  await expect(fragment.locator("details")).toHaveCount(1);

  // The name the reader typed is not what failed, so it is neither marked as
  // the cause nor taken away from them.
  const field = page.getByLabel("Workspace name");
  await expect(field).toHaveValue("Refused Org");
  await expect(field).not.toHaveAttribute("aria-invalid", "true");
});

test("ambiguous workspace validation stays above its control", async ({
  page,
}) => {
  await atWorkspaceStep(page, "invalid-org");
  await failWith(page, "**/v1/workspaces", "POST", "validation-failed");
  await page.getByTestId("create-workspace").click();

  const field = page.getByLabel("Workspace name");
  await expect(field).toHaveAttribute("aria-invalid", "false");
  await expect(page.getByText("Check the values and try again.")).toHaveCount(
    1,
  );
  // The reason names neither Name nor Slug, so the form does not guess which
  // field the reader should change. The control owns the general recovery.
  await expect(page.getByTestId("create-workspace")).toHaveText("Try again");
  await expect(page.locator(".fo-write-failure").getByRole("alert")).toHaveText(
    "Check the values and try again.",
  );
});

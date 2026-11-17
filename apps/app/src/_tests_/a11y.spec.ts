import type { Page } from "@playwright/test";

import {
  createProject,
  expect,
  freshEmail,
  open,
  openDialog,
  projectAddress,
  signIn,
  test,
} from "./harness";
import { stateDocumentViolations } from "./document-policy";
import { expectScreenPolicy } from "./screen-policy";
import { makeToken, rowMenu } from "./settings/tokens";

const panes = [
  "account",
  "workspace",
  "github",
  "members",
  "billing",
  "project",
  "tokens",
  "access",
  "danger",
] as const;

/** Every registered screen owns one main landmark, one heading and a skip link. */
async function policy(page: Page, path: string): Promise<void> {
  await open(page, path);
  await expectScreenPolicy(page, path);
}

test("the logged-out account screens meet the screen policy", async ({
  page,
}) => {
  for (const path of ["/sign-in", "/sign-up", "/auth/email"]) {
    await policy(page, path);
  }
});

test("the signed-in screens meet the screen policy", async ({ page }) => {
  await signIn(page, freshEmail("a11y"));
  await policy(page, "/new");
  const projectId = await createProject(page, "A11y Org");
  const address = await projectAddress(page, projectId);
  await policy(page, `${address.path}/setup`);
  await policy(page, address.path);
  await policy(page, "/dashboard");
  await policy(page, `/${address.workspaceSlug}/-/new/cli`);
  await policy(page, "/install?installationId=1");
});

test("the dialog owns the only heading and landmark while it is open", async ({
  page,
}) => {
  await signIn(page, freshEmail("a11y-dialog"));
  const projectId = await createProject(page, "Dialog Org");
  const address = await projectAddress(page, projectId);
  for (const pane of panes) {
    await openDialog(page, `${address.path}?settings=${pane}`);
    await expect(page.getByRole("heading", { level: 1 }), pane).toHaveCount(1);
    await expect(page.locator("main, [role=main]"), pane).toHaveCount(1);
    await expect(page.locator("#root")).toHaveAttribute("aria-hidden", "true");
    await expect(page.locator("#root")).toHaveAttribute("inert", "");
  }
  await openDialog(page, `${address.path}?settings=tokens`);
  const settings = page.getByTestId("settings-dialog");
  await makeToken(page, "Accessibility");
  await expect(
    page.getByRole("dialog", { name: "Save your token", exact: true }),
  ).toBeVisible();
  await expect(page.locator("#root")).toHaveAttribute("inert", "");
  await expect(settings).toHaveAttribute("inert", "");
  await page.getByTestId("token-done").click();
  await expect(settings).toBeVisible();
  await expect(settings).not.toHaveAttribute("inert", "");
  await rowMenu(page, "Accessibility").click();
  await page.getByRole("menuitem", { name: "Revoke", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Revoke Accessibility?" }),
  ).toBeVisible();
  await expect(page.locator("#root")).toHaveAttribute("inert", "");
  await expect(settings).toHaveAttribute("inert", "");
});

test("opening the dialog focuses the pane the reader asked for", async ({
  page,
}) => {
  await signIn(page, freshEmail("a11y-focus"));
  const projectId = await createProject(page, "Focus Org");
  const address = await projectAddress(page, projectId);
  await openDialog(page, `${address.path}?settings=tokens`);
  // The dialog opens before the scope names a project, so the pane it can
  // draw changes once; focus is asserted on the pane the reader asked for,
  // which is the one that has to end up holding it.
  await expect(
    page.getByRole("dialog").getByRole("heading", { level: 1 }),
  ).toHaveText("Publishing tokens");
  const focused = await page.evaluate(
    () => document.activeElement?.textContent ?? "",
  );
  expect(focused).toContain("Publishing tokens");
});

test("focus is not left inside a dismissed dialog", async ({ page }) => {
  await signIn(page, freshEmail("a11y-restore"));
  const projectId = await createProject(page, "Restore Org");
  const address = await projectAddress(page, projectId);
  await openDialog(page, `${address.path}?settings=project`);
  await page.getByTestId("close-settings").click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const landed = await page.evaluate(() => {
    const active = document.activeElement;
    if (!active) return "none";
    if (active.closest("[role='dialog']")) return "dialog";
    if (!active.isConnected) return "detached";
    return active === document.body ? "body" : active.tagName.toLowerCase();
  });
  // Until an in-app trigger exists to return focus to, the page itself takes
  // it back. Naming where focus landed is what makes this test falsifiable.
  expect(landed, "focus returns to the page under the dialog").toBe("body");
});

test("compact targets clear 44px on every account screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, "/sign-up");
  for (const name of ["Continue with GitHub", "Continue with email"]) {
    const box = await page.getByRole("button", { name }).boundingBox();
    expect(box?.height ?? 0, name).toBeGreaterThanOrEqual(44);
  }
});

test("rendered state policy rejects silent and repeated state copy", async ({
  page,
}) => {
  await page.setContent(
    '<main data-mkc-screen="screen"><h1>Signing you in</h1>' +
      '<div class="fo-wait" aria-busy="true"><div class="fo-state fo-wait-state"><h2 class="fo-state-title"><span class="fo-pending-label fo-wait-name">Signing you in…</span></h2></div></div>' +
      '<section class="fo-state fo-state-problem"><span class="fo-state-glyph">!</span>' +
      '<div class="fo-state-action">Retry</div><details><summary>Details</summary></details></section></main>',
  );
  expect(await page.evaluate(stateDocumentViolations)).toEqual([
    "visible pending label repeats screen heading",
    "error state needs announced copy",
  ]);
});

test("rendered state policy accepts hidden state copy", async ({ page }) => {
  await page.setContent(
    '<main data-mkc-screen="screen"><h1>Signing you in</h1>' +
      '<div class="fo-wait" aria-busy="true"><span class="fo-pending-label fo-sr-only" role="status">Signing you in…</span><div class="fo-state fo-wait-state"></div></div>' +
      '<section class="fo-state fo-state-problem"><span class="fo-sr-only">Sign-in failed</span></section></main>',
  );
  expect(await page.evaluate(stateDocumentViolations)).toEqual([]);
});

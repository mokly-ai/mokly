import type { Page } from "@playwright/test";

import {
  disconnectInstallation,
  installedRepository,
} from "./database-fixture";
import {
  createProject,
  currentWorkspaceId,
  expect,
  freshEmail,
  open,
  openDialog,
  projectAddress,
  signIn,
  test,
  unloadGuard,
} from "./harness";
import { appOrigin } from "./origins";
import {
  captureReadableAddress,
  settingsAddress,
  shareSelection,
  uniqueSlug,
} from "./readable-addresses-support";
import { publishedViewerReady, publishedProject } from "./viewer/support";

test.use({ permissions: ["clipboard-read", "clipboard-write"] });

async function expectTopBarFits(page: Page): Promise<void> {
  const violations = await page.locator(".mokly-top-host").evaluate((bar) => {
    const boundary = bar.getBoundingClientRect();
    const problems: string[] = [];
    if (bar.scrollWidth > bar.clientWidth + 1)
      problems.push("horizontal scroll");
    for (const slot of bar.querySelectorAll<HTMLElement>(
      "[data-mkc-viewer-slot]",
    )) {
      const box = slot.getBoundingClientRect();
      const name = slot.dataset.mkcViewerSlot ?? "unknown";
      if (box.top < boundary.top - 1 || box.bottom > boundary.bottom + 1) {
        problems.push(`${name} leaves the bar`);
      }
      for (const label of slot.querySelectorAll<HTMLElement>("[dir=auto]")) {
        const lineHeight = Number.parseFloat(
          getComputedStyle(label).lineHeight,
        );
        if (label.getBoundingClientRect().height > lineHeight + 1) {
          problems.push(`${name} wraps`);
        }
      }
    }
    return problems;
  });
  expect(violations).toEqual([]);
}

test("old shares, check links, and UUID permalinks survive both slug renames", async ({
  page,
}) => {
  const made = await publishedProject(page, "readable-rename");
  const original = await projectAddress(page, made.projectId);
  const workspaceId = await currentWorkspaceId(page);
  await open(page, made.publicationPath);
  await publishedViewerReady(page);
  const selection = await shareSelection(
    page,
    made.projectId,
    made.publicationId,
  );
  const selected = new URL(made.publicationPath, appOrigin);
  selected.searchParams.set("catalogueScreen", selection.path);
  selected.searchParams.set("viewport", selection.viewport);
  selected.searchParams.set("scheme", selection.scheme);
  await open(page, selected.href);
  await publishedViewerReady(page);
  await page.getByTestId("viewer-share").click();
  const sharePanel = page.getByTestId("viewer-panel-share");
  const shareField = sharePanel.getByLabel("Publication link");
  await expect(shareField).toHaveValue(/catalogueScreen=/);
  await sharePanel.getByTestId("share-copy").click();
  await expect(
    page
      .getByRole("region", { name: "Notifications" })
      .getByText("Link copied", { exact: true }),
  ).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => globalThis.navigator.clipboard.readText()))
    .toBe(await shareField.inputValue());
  const oldShare = await page.evaluate(() =>
    globalThis.navigator.clipboard.readText(),
  );
  expect(oldShare).toBe(await shareField.inputValue());
  const mintedShare = new URL(oldShare);
  const oldCheckDetails = new URL(made.publicationPath, appOrigin);
  oldCheckDetails.searchParams.set("view", "changes");
  expect(new URL(oldShare).pathname).toBe(oldCheckDetails.pathname);
  await page.goBack();
  await expect(sharePanel).toHaveCount(0);

  const nextProjectSlug = uniqueSlug("renamed-project");
  await openDialog(page, settingsAddress(page.url(), "project"));
  await page.getByTestId("change-project-slug").click();
  await expect(
    page.getByRole("dialog").getByRole("heading", { level: 1 }),
  ).toHaveText("Project address");
  await page.getByLabel("Project slug").fill(nextProjectSlug);
  await captureReadableAddress(page, "desktop-project-address-dialog");
  const projectSaved = page.waitForResponse(
    (answer) =>
      answer.url().endsWith(`/v1/projects/${made.projectId}`) &&
      answer.request().method() === "PATCH",
  );
  await page.getByTestId("save-project-slug").click();
  expect((await projectSaved).ok()).toBe(true);
  await page.waitForURL(
    (url) =>
      url.pathname ===
      `/${original.workspaceSlug}/${nextProjectSlug}/publications/${made.publicationId}`,
  );
  await expect.poll(() => unloadGuard(page)).toBe(false);
  await page.goBack();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.waitForURL(
    (url) =>
      url.pathname ===
      `/${original.workspaceSlug}/${nextProjectSlug}/publications/${made.publicationId}`,
  );
  let current = new URL(page.url());
  expect(current.searchParams.get("catalogueScreen")).toBe(selection.path);
  expect(current.searchParams.get("viewport")).toBe(selection.viewport);
  expect(current.searchParams.get("scheme")).toBe(selection.scheme);

  await openDialog(page, settingsAddress(page.url(), "project"));
  await page.getByTestId("change-project-slug").click();
  await expect(page.getByLabel("Project slug")).toHaveValue(nextProjectSlug);
  await expect(page.getByTestId("save-project-slug")).toBeDisabled();
  await page.getByTestId("close-settings").click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  const nextWorkspaceSlug = uniqueSlug("renamed-team");
  await openDialog(page, settingsAddress(page.url(), "workspace"));
  await page.getByTestId("change-workspace-slug").click();
  await page.getByLabel("Workspace slug").fill(nextWorkspaceSlug);
  const workspaceSaved = page.waitForResponse(
    (answer) =>
      answer.url().endsWith(`/v1/workspaces/${workspaceId}`) &&
      answer.request().method() === "PATCH",
  );
  await page.getByTestId("save-workspace-slug").click();
  expect((await workspaceSaved).ok()).toBe(true);
  await page.waitForURL(
    (url) =>
      url.pathname ===
      `/${nextWorkspaceSlug}/${nextProjectSlug}/publications/${made.publicationId}`,
  );
  await expect.poll(() => unloadGuard(page)).toBe(false);
  await page.getByTestId("close-settings").click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const renamed = await projectAddress(page, made.projectId);
  expect(renamed).toMatchObject({
    workspaceSlug: nextWorkspaceSlug,
    slug: nextProjectSlug,
  });

  await open(page, oldShare);
  await page.waitForURL(
    (url) =>
      url.pathname ===
      `/${nextWorkspaceSlug}/${nextProjectSlug}/publications/${made.publicationId}`,
  );
  await publishedViewerReady(page);
  current = new URL(page.url());
  for (const key of ["catalogueScreen", "viewport", "scheme"]) {
    expect(current.searchParams.get(key)).toBe(
      mintedShare.searchParams.get(key),
    );
  }
  await expect(
    page.getByRole("heading", { level: 2, name: selection.title }),
  ).toBeVisible();
  await expect(page.locator("[data-mokly-stage]")).toHaveAttribute(
    "data-viewport",
    selection.viewport,
  );
  await expect(page.locator("[data-mokly-shell]")).toHaveAttribute(
    "data-mokly-color-scheme",
    selection.scheme,
  );

  await open(page, oldCheckDetails.href);
  await page.waitForURL(
    (url) =>
      url.pathname ===
        `/${nextWorkspaceSlug}/${nextProjectSlug}/publications/${made.publicationId}` &&
      url.searchParams.get("view") === "changes",
  );
  await publishedViewerReady(page);
  await expect(page.getByRole("button", { name: /^Changes/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  const uuid = new URL(
    `/projects/${made.projectId}/publications/${made.publicationId}`,
    appOrigin,
  );
  uuid.searchParams.set("view", "changes");
  uuid.searchParams.set("catalogueScreen", selection.path);
  uuid.searchParams.set("viewport", selection.viewport);
  uuid.searchParams.append("tag", "one");
  uuid.searchParams.append("tag", "two");
  await open(page, uuid.href);
  await page.waitForURL(
    (url) =>
      url.pathname ===
      `/${nextWorkspaceSlug}/${nextProjectSlug}/publications/${made.publicationId}`,
  );
  await publishedViewerReady(page);
  current = new URL(page.url());
  expect(current.searchParams.get("view")).toBe("changes");
  expect(current.searchParams.get("catalogueScreen")).toBe(selection.path);
  expect(current.searchParams.get("viewport")).toBe(selection.viewport);
  expect(current.searchParams.getAll("tag")).toEqual(["one", "two"]);
  await expect(
    page.getByRole("heading", { level: 2, name: selection.title }),
  ).toBeVisible();
  await expectTopBarFits(page);
  await expect(page.getByTestId("viewer-project")).toHaveAccessibleName(
    `${made.workspaceName} / ${installedRepository.split("/")[1]}`,
  );
  await expect(page.getByTestId("viewer-account")).toHaveAccessibleName(
    made.email,
  );
  await captureReadableAddress(page, "desktop-renamed-share");
});

test("slug saves keep the unrelated install route and its settings scope", async ({
  page,
}) => {
  await signIn(page, freshEmail("install-settings-address"));
  const projectId = await createProject(page, "Install Settings Org");
  const workspaceId = await currentWorkspaceId(page);
  // A bound workspace's install route moves on to the repository step, so
  // the App is removed first: that is when a reader with a project is there.
  disconnectInstallation(workspaceId);
  const install = new URL("/install", appOrigin);
  install.searchParams.set("workspaceId", workspaceId);
  install.searchParams.set("settings", "project");
  install.searchParams.set("settingsProject", projectId);
  await openDialog(page, install.href);

  await page.getByTestId("change-project-slug").click();
  const projectSlug = uniqueSlug("install-project");
  await page.getByLabel("Project slug").fill(projectSlug);
  await page.getByTestId("save-project-slug").click();
  await page.waitForURL((url) => url.pathname === "/install");
  let current = new URL(page.url());
  expect(current.searchParams.get("workspaceId")).toBe(workspaceId);
  expect(current.searchParams.get("settingsProject")).toBe(projectId);
  expect(current.searchParams.get("settings")).toBe("project");

  current.searchParams.set("settings", "workspace");
  await openDialog(page, current.href);
  await page.getByTestId("change-workspace-slug").click();
  await page.getByLabel("Workspace slug").fill(uniqueSlug("install-workspace"));
  await page.getByTestId("save-workspace-slug").click();
  await page.waitForURL((url) => url.pathname === "/install");
  current = new URL(page.url());
  expect(current.searchParams.get("workspaceId")).toBe(workspaceId);
  expect(current.searchParams.get("settingsProject")).toBe(projectId);
  expect(current.searchParams.get("settings")).toBe("workspace");
});

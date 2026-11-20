import type { Locator, Page } from "@playwright/test";

import { projectPath, settingsPath } from "../navigation/paths";

import { installApp } from "./github-installation";
import { expect, open, openDialog } from "./harness";
import { chooseRepository } from "./project-setup";
import { createWorkspaceStep, uniqueSlug } from "./readable-addresses-support";

async function expectIdentifier(
  field: Locator,
  surface: string,
): Promise<void> {
  await expect(field, surface).toHaveAttribute("autocapitalize", "none");
  await expect(field, surface).toHaveAttribute("autocorrect", "off");
  await expect(field, surface).toHaveAttribute("spellcheck", "false");
}

async function expectProse(field: Locator, surface: string): Promise<void> {
  await expect(field, surface).toHaveAttribute("autocapitalize", "sentences");
  await expect(field, surface).toHaveAttribute("autocorrect", "on");
  await expect(field, surface).toHaveAttribute("spellcheck", "true");
}

async function openSettings(
  page: Page,
  viewport: "desktop" | "mobile",
  pane: "workspace" | "project",
  workspaceSlug: string,
  projectSlug: string,
): Promise<void> {
  if (viewport === "mobile") {
    await open(
      page,
      settingsPath(
        pane === "workspace"
          ? { pane, workspaceSlug }
          : { pane, workspaceSlug, projectSlug },
      ),
    );
    return;
  }
  await openDialog(
    page,
    `${projectPath(workspaceSlug, projectSlug)}?settings=${pane}`,
  );
}

/**
 * Check rendered input attributes in workspace creation, the listed GitHub
 * repository form, and workspace and project settings at one viewport.
 */
export async function expectIdentifierFieldPolicy(
  page: Page,
  viewport: "desktop" | "mobile",
): Promise<void> {
  await createWorkspaceStep(page, `${viewport}-identifier-fields`);
  await expectProse(page.getByLabel("Workspace name"), "workspace name");
  await expectIdentifier(
    page.getByLabel("Workspace slug"),
    "workspace creation slug",
  );

  const workspaceSlug = uniqueSlug(
    viewport === "desktop" ? "desk-id" : "mobile-id",
  );
  await page.getByLabel("Workspace name").fill(`${viewport} Identifier Team`);
  await page.getByLabel("Workspace slug").fill(workspaceSlug);
  await page.getByTestId("create-workspace").click();
  await page.waitForURL((url) => url.pathname === "/install");

  await installApp(page);
  await expectProse(page.getByLabel("Config path"), "listed config path");
  await expectIdentifier(
    page.getByLabel("Project slug"),
    "listed repository project slug",
  );
  await chooseRepository(page);
  await expect(page.getByLabel("Project slug")).not.toHaveValue("");
  await page.getByTestId("create-project").click();
  await page.waitForURL((url) => /^\/[^/]+\/[^/]+\/setup$/.test(url.pathname));
  const [createdWorkspace = "", createdProject = ""] = new URL(
    page.url(),
  ).pathname
    .split("/")
    .filter(Boolean)
    .map(decodeURIComponent);

  await openSettings(
    page,
    viewport,
    "workspace",
    createdWorkspace,
    createdProject,
  );
  await expectProse(
    page.getByLabel("Workspace name"),
    "workspace settings name",
  );
  await page.getByTestId("change-workspace-slug").click();
  await expectIdentifier(
    page.getByLabel("Workspace slug"),
    "workspace settings slug",
  );

  await openSettings(
    page,
    viewport,
    "project",
    createdWorkspace,
    createdProject,
  );
  await expectProse(page.getByLabel("Project name"), "project settings name");
  await page.getByTestId("change-project-slug").click();
  await expectIdentifier(
    page.getByLabel("Project slug"),
    "project settings slug",
  );
}

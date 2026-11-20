import { projectPathFor, projectQueryPathFor } from "../addresses";
import {
  expect,
  freshEmail,
  openDialog,
  signIn,
  test,
  unloadGuard,
} from "../harness";
import { createProject } from "../project-setup";

import { openDialogInApp } from "./in-app";

/** Every way out of settings, and where each one lands. */

test("Escape closes a clean dialog and returns to the page beneath", async ({
  page,
}) => {
  await signIn(page, freshEmail("escape"));
  const projectId = await createProject(page, "Esc Org");
  await openDialog(
    page,
    await projectQueryPathFor(page, projectId, "settings=project"),
  );
  // The dialog takes the keyboard once it has moved focus into itself, onto
  // the pane the address asked for. A key pressed before that reaches no
  // dialog yet.
  await expect(
    page
      .getByRole("dialog")
      .getByRole("link", { name: "Project", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("Close returns to the page beneath from any address", async ({ page }) => {
  await signIn(page, freshEmail("close-beneath"));
  const projectId = await createProject(page, "Close Org");
  const beneath = await projectPathFor(page, projectId);

  // Reached through the settings index, so the entry behind the dialog is a
  // settings address too. One press still closes.
  await openDialogInApp(page, "Account");
  await page.getByTestId("close-settings").click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).toHaveURL((url) => url.pathname === beneath);

  await openDialogInApp(page, "Account");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).toHaveURL((url) => url.pathname === beneath);

  await openDialogInApp(page, "Account");
  await page.getByLabel("Name", { exact: true }).fill("Closing draft");
  await page.getByTestId("close-settings").click();
  await page.getByTestId("discard-changes").click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).toHaveURL((url) => url.pathname === beneath);
});

/**
 * Every control inside a pane whose press takes the reader out of settings,
 * with something unsaved held on a pane it has nothing to do with — the work a
 * reader is most likely to lose without noticing. Create workspace is the
 * one such control this table cannot reach: it renders only to a reader with
 * no workspace, where the only pane that exists is the one it is not on.
 * The lint rules under `settings/panes` are what keep that door, and any added
 * later, on the same guarded path. They cover two shapes: the `href` a pane
 * would write itself, and an `ExternalLink` a pane draws without `newTab`,
 * which would leave in this tab and so walk past the same guard. A link that
 * opens a tab of its own is not a door at all — the pane it sits on is still
 * there, holding whatever the reader typed — so it has no row here.
 */
interface Door {
  /** The control's own label, which is what the reader presses. */
  control: string;
  /** The pane it sits on, reached from Workspace by a rail click. */
  pane: string;
  /** Where pressing it takes a reader who chooses to go on. */
  lands: RegExp;
  /** Whether it ends the session, so there is no coming back to look. */
  ends?: boolean;
}

const doors: readonly Door[] = [
  { control: "Create project", pane: "Workspace", lands: /\/-\/new$/ },
  // Adding an account leaves for GitHub's install page; the recorded GitHub
  // does not draw it, so the address it reaches is where the door leads.
  {
    control: "Add GitHub account",
    pane: "GitHub accounts",
    lands: /\/installations\/new/,
  },
  { control: "Sign out", pane: "Account", lands: /sign-in/, ends: true },
];

for (const { control, pane, lands, ends } of doors) {
  test(`${control} asks about unsaved work before leaving`, async ({
    page,
  }) => {
    await signIn(page, freshEmail("door-" + control));
    const projectId = await createProject(page, "Door Org");
    const settings = await projectQueryPathFor(
      page,
      projectId,
      "settings=workspace",
    );
    // The walk that created the project answered GitHub's own pages; a door is
    // about leaving, so nothing answers for the page a door leaves for.
    await page.unrouteAll();
    await openDialog(page, settings);
    await page.getByLabel("Workspace name").fill("Abandoned draft");
    if (pane !== "Workspace") {
      // A rail click, not a page load: the draft has to survive to be at risk.
      await page.getByRole("link", { name: pane, exact: true }).click();
      await expect(
        page.getByRole("dialog").getByRole("heading", { level: 1 }),
      ).toHaveText(pane);
    }
    await expect.poll(() => unloadGuard(page)).toBe(true);

    const press = () => page.getByRole("button", { name: control }).click();
    await press();
    await expect(page.getByText("Discard your changes?")).toBeVisible();
    await page.getByTestId("keep-changes").click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("link", { name: "Workspace", exact: true }).click();
    await expect(page.getByLabel("Workspace name")).toHaveValue(
      "Abandoned draft",
    );
    if (pane !== "Workspace") {
      await page.getByRole("link", { name: pane, exact: true }).click();
    }

    await press();
    await page.getByTestId("discard-changes").click();
    await page.waitForURL(lands);
    await expect.poll(() => unloadGuard(page)).toBe(false);

    if (ends) return;
    // Nothing is waiting for them when they come back.
    await openDialog(page, settings);
    await expect(page.getByLabel("Workspace name")).not.toHaveValue(
      "Abandoned draft",
    );
  });
}

test("Keep project closes settings, clean or holding a draft", async ({
  page,
}) => {
  await signIn(page, freshEmail("keep-project"));
  const projectId = await createProject(page, "Keep Org");
  const beneath = await projectPathFor(page, projectId);
  const keep = () => page.getByRole("button", { name: "Keep project" }).click();

  await openDialog(
    page,
    await projectQueryPathFor(page, projectId, "settings=danger"),
  );
  await keep();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).toHaveURL((url) => url.pathname === beneath);

  await openDialog(
    page,
    await projectQueryPathFor(page, projectId, "settings=danger"),
  );
  await page.getByLabel(/^Type /).fill("not the name");
  await expect.poll(() => unloadGuard(page)).toBe(true);
  await keep();
  await expect(page.getByText("Discard your changes?")).toBeVisible();
  await page.getByTestId("discard-changes").click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).toHaveURL((url) => url.pathname === beneath);
});

test("a confirmed deletion leaves without asking a second time", async ({
  page,
}) => {
  await signIn(page, freshEmail("delete-door"));
  const projectId = await createProject(page, "Del Org");
  const deletedPath = await projectPathFor(page, projectId);
  // A draft on another pane entirely: the reader has already confirmed the
  // deletion by name, so nothing is asked again, and nothing is left behind.
  await openDialog(
    page,
    await projectQueryPathFor(page, projectId, "settings=workspace"),
  );
  await page.getByLabel("Workspace name").fill("Half typed rename");
  await page.getByRole("link", { name: "Delete project" }).click();
  await expect(page.getByLabel(/^Type /)).toBeVisible();
  await expect.poll(() => unloadGuard(page)).toBe(true);
  const asked = await page.getByText(/^Type .+ to confirm$/).textContent();
  await page
    .getByLabel(/^Type /)
    .fill((asked ?? "").replace(/^Type /, "").replace(/ to confirm$/, ""));
  await page.getByRole("button", { name: "Delete project" }).click();
  // The deleted project's address must not be where the reader is left, and
  // the dialog must not be left open over wherever they land.
  await expect(page).not.toHaveURL((url) => url.pathname === deletedPath);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("Discard your changes?")).toHaveCount(0);
  await expect.poll(() => unloadGuard(page)).toBe(false);
});

import { failWith } from "../api-responses";
import { expect, open, test } from "../harness";
import { apiOrigin, appOrigin } from "../origins";

import {
  canvasFrame,
  expectSharePreparing,
  expectShownViewport,
  expectViewportToggles,
  holdViewerRead,
  makePublic,
  publishedViewerReady,
  publishedProject,
  viewportToggle,
} from "./support";

test.use({ permissions: ["clipboard-read", "clipboard-write"] });

test("Share copies the canonical link and says who can open it", async ({
  page,
}) => {
  const made = await publishedProject(page, "share");
  const { projectId } = made;
  const path = made.publicationPath;

  await open(page, path);
  await publishedViewerReady(page);
  await page.getByTestId("viewer-share").click();
  const panel = page.getByTestId("viewer-panel-share");
  await expect(panel).toBeVisible();
  await expect(
    panel.getByText("Project members can open this link."),
  ).toBeVisible();
  const link = panel.getByLabel("Publication link");
  // The link pins the publication and nothing the reader did not choose.
  await expect(link).toHaveValue(appOrigin + path);

  await panel.getByTestId("share-copy").click();
  await expect(page.getByText("Link copied").first()).toBeVisible();
  const copied = await page.evaluate(() =>
    globalThis.navigator.clipboard.readText(),
  );
  expect(copied).toBe(await link.inputValue());

  // A screen this publication draws at this viewport and scheme pins the link
  // to it, and the address follows. Both is the default viewport, so neither
  // the address nor the link names one.
  await panel
    .getByRole("listitem")
    .filter({ hasText: "Start" })
    .getByText("Select")
    .click();
  await expect(page).toHaveURL(/catalogueScreen=start/);
  await expect(link).toHaveValue(
    new RegExp(`${path}\\?catalogueScreen=start$`),
  );

  // Its recipient opens the screen on Both, in its Mobile and Desktop frames,
  // and the address names no viewport.
  await open(page, await link.inputValue());
  await expect(
    page.getByRole("heading", { level: 2, name: "Start" }),
  ).toBeVisible();
  for (const frame of ["Start — mobile", "Start — desktop"])
    await expect(
      canvasFrame(page, frame)
        .contentFrame()
        .getByRole("heading", { level: 1, name: "Publish the draft" }),
      frame,
    ).toBeVisible();
  await expect(page).not.toHaveURL(/viewport=/);

  // One viewport is the reader's own choice: turning Mobile off in the Frames
  // filter leaves Desktop. The address and the link both name it, and the
  // link's recipient opens on that viewport, with the same toggles.
  await viewportToggle(page, "Mobile").uncheck();
  await expect(page).toHaveURL(/viewport=desktop/);
  await page.getByTestId("viewer-share").click();
  await expect(
    panel.getByRole("listitem").filter({ hasText: "Start" }),
  ).toContainText("Selected");
  await expect(link).toHaveValue(
    new RegExp(`${path}\\?catalogueScreen=start&viewport=desktop$`),
  );
  const desktopLink = await link.inputValue();

  await panel.getByTestId("share-copy").click();
  await expect
    .poll(() => page.evaluate(() => globalThis.navigator.clipboard.readText()))
    .toBe(desktopLink);
  // Preparing and copying the link does not reduce the controlled sender: the
  // canvas beneath the panel still shows the Desktop frame alone.
  await expect(page).toHaveURL(/viewport=desktop/);
  await expectShownViewport(page, "Start", "desktop");

  const recipient = await page.context().newPage();
  await open(recipient, desktopLink);
  await expect(recipient).toHaveURL(/catalogueScreen=start/);
  await expect(recipient).toHaveURL(/viewport=desktop/);
  await expectShownViewport(recipient, "Start", "desktop");
  await expectViewportToggles(recipient, "desktop");
  await expect(
    canvasFrame(recipient, "Start — desktop")
      .contentFrame()
      .getByRole("heading", { level: 1, name: "Publish the draft" }),
  ).toBeVisible();
  await recipient.close();

  await makePublic(page, projectId);
  await page.reload();
  await expect(
    page
      .getByTestId("viewer-panel-share")
      .getByText("Anyone with the link can view."),
  ).toBeVisible();

  // Neither screen has a dark view. Under Dark the viewer shows each one
  // through its light view, so Share still offers both, and the link names
  // the light view the reader sees.
  await open(page, `${path}?catalogueScreen=start&scheme=dark&panel=share`);
  const choices = panel.getByRole("listitem");
  await expect(choices.filter({ hasText: "Start" })).toContainText("Selected");
  await expect(
    choices.filter({ hasText: "Finish" }).getByText("Select", { exact: true }),
  ).toBeVisible();
  await expect(link).toHaveValue(
    appOrigin + path + "?catalogueScreen=start&scheme=light",
  );
});

test("a publication with nothing to compare still shares itself", async ({
  page,
}) => {
  const made = await publishedProject(page, "nocompare", {
    branch: "first",
    currentOnly: true,
  });

  const screenResponse = await page.evaluate(
    async ([origin, project, publication]) => {
      const answer = await fetch(
        `${origin}/v1/projects/${project}/publications/${publication}/screens`,
        { credentials: "include" },
      );
      return {
        status: answer.status,
        body: (await answer.json()) as {
          error?: { reason?: string };
        },
      };
    },
    [apiOrigin, made.projectId, made.publicationId] as const,
  );
  expect(screenResponse.status).toBe(503);
  expect(screenResponse.body).toMatchObject({
    error: { reason: "operation-unavailable" },
  });

  const path = made.publicationPath;
  // A link that names the default viewport stays valid and opens on Both.
  await open(page, `${path}?catalogueScreen=start&viewport=both`);
  await expect(
    page.getByRole("heading", { level: 2, name: "Start" }),
  ).toBeVisible();
  await expectShownViewport(page, "Start", "both");
  await page.getByTestId("viewer-share").click();
  const panel = page.getByTestId("viewer-panel-share");
  await expect(panel).toBeVisible();
  // Publication-level sharing remains; the screen list does not, because this
  // publication has no comparison-backed screen selections.
  await expect(panel.getByTestId("share-copy")).toBeVisible();
  await expect(panel.getByText("Screen")).toHaveCount(0);
  await expect(panel.getByText("Whole catalogue")).toHaveCount(0);
  // Both is the default, so the link names no viewport, and neither does the
  // address the panel wrote.
  await expect(panel.getByLabel("Publication link")).toHaveValue(
    appOrigin + path,
  );
  await expect(page).toHaveURL(/catalogueScreen=start/);
  await expect(page).not.toHaveURL(/viewport=/);
  await page.goBack();
  await expect(panel).toHaveCount(0);
  await expect(
    page.getByRole("heading", { level: 2, name: "Start" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/catalogueScreen=start/);
});

test("a reader who arrived on a screen can clear it", async ({ page }) => {
  const made = await publishedProject(page, "clear-screen");
  const path = made.publicationPath;
  // The address the reader arrived on pins a screen, which is what the Whole
  // catalogue row has to be able to clear.
  await open(page, `${path}?catalogueScreen=start&panel=share`);
  const panel = page.getByTestId("viewer-panel-share");
  await expect(panel).toBeVisible();
  const link = panel.getByLabel("Publication link");
  await expect(link).toHaveValue(
    new RegExp(`${path}\\?catalogueScreen=start$`),
  );

  await panel.getByTestId("choose-whole-catalogue").click();
  // Whole catalogue means the whole catalogue: the address, the stage and the
  // link the reader copies all stop naming a screen.
  await expect(page).not.toHaveURL(/catalogueScreen=/);
  await expect(page.locator("[data-mokly-stage]")).toHaveCount(0);
  await expect(page.locator("[data-mokly-view] h2")).toHaveText("Mokly");
  await expect(link).toHaveValue(appOrigin + path);
  await expect(
    panel.getByRole("listitem").filter({ hasText: "Whole catalogue" }),
  ).toContainText("Selected");
});

test("a failed screen read keeps the publication link and the viewer selection", async ({
  page,
}) => {
  const made = await publishedProject(page, "share-screen-failure");
  const screens = `**/publications/${made.publicationId}/screens*`;
  const shares: string[] = [];
  page.on("request", (request) => {
    if (
      new URL(request.url()).pathname.endsWith(
        `/publications/${made.publicationId}/share`,
      )
    )
      shares.push(request.url());
  });
  await failWith(page, screens, "GET", "unavailable");
  await open(page, `${made.publicationPath}?catalogueScreen=start&panel=share`);
  const panel = page.getByTestId("viewer-panel-share");
  const failed = panel.getByRole("heading", { name: "Screens couldn’t load" });
  await expect(failed).toBeVisible();
  await expect(panel.getByLabel("Publication link")).toHaveValue(
    appOrigin + made.publicationPath,
  );
  await expect(panel.getByTestId("share-copy")).toBeVisible();
  await expect(page).toHaveURL(/catalogueScreen=start/);
  expect(shares).toHaveLength(1);

  const repeatedFailure = page.waitForResponse(
    (response) =>
      response.url().includes("/screens") && response.status() === 503,
  );
  await panel.getByRole("button", { name: "Try again" }).click();
  await repeatedFailure;
  await expect(failed).toBeVisible();
  expect(
    shares,
    "a repeated walk failure reuses the publication link",
  ).toHaveLength(1);

  await page.unroute(screens);
  const held = await holdViewerRead(
    page,
    (url) =>
      url.origin === apiOrigin &&
      url.pathname.endsWith(`/publications/${made.publicationId}/screens`),
  );
  try {
    await panel.getByRole("button", { name: "Try again" }).click();
    await expect.poll(held.seen).toBe(true);
    await expectSharePreparing(panel);
    expect(shares).toHaveLength(1);
    held.release();
    await expect(panel.getByLabel("Publication link")).toHaveValue(
      `${appOrigin}${made.publicationPath}?catalogueScreen=start`,
    );
    expect(shares).toHaveLength(2);
    expect(new URL(shares[1]).searchParams.get("catalogueScreen")).toBe(
      "start",
    );
    await expect(page).toHaveURL(/catalogueScreen=start/);
  } finally {
    held.release();
    await page.unrouteAll({ behavior: "wait" });
  }
});

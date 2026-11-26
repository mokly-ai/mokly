import { defaultPageSize } from "../../data/publications";
import { expect, open, test as base } from "../harness";
import { apiOrigin } from "../origins";

import { retainedFixture } from "./retained-fixture";
import {
  canvasFrame,
  expectSharePreparing,
  holdViewerRead,
  makePublic,
  openSettingsFromAccount,
  publishedViewerReady,
  publishedProject,
} from "./support";

/**
 * The retained-evidence exports of this file, one for each number of earlier
 * screens. Each test only reads an archive and publishes it into a project of
 * its own, so the CLI builds each export once for the worker, at the first
 * test that asks for it. Share's test asks for two pages of earlier screens
 * before the shared screen, so Share reads three pages of screens before it
 * offers its link; the other test keeps the smaller export, which publishes
 * faster.
 */
const test = base.extend<
  object,
  { retained: (earlierScreens?: number) => string }
>({
  retained: [
    // Playwright requires the fixture argument to be a destructuring pattern,
    // even when nothing is used.
    // eslint-disable-next-line no-empty-pattern
    async ({}, provide) => {
      const built = new Map<number, ReturnType<typeof retainedFixture>>();
      try {
        await provide((earlierScreens = 0) => {
          const export_ =
            built.get(earlierScreens) ?? retainedFixture(earlierScreens);
          built.set(earlierScreens, export_);
          return export_.path;
        });
      } finally {
        for (const export_ of built.values()) export_.dispose();
      }
    },
    { scope: "worker" },
  ],
});

test.use({ permissions: ["clipboard-read", "clipboard-write"] });

test("a removed entry opens its advertised snapshot in Changes", async ({
  page,
  retained,
}) => {
  const made = await publishedProject(page, "retained-entry", {
    branch: "main",
    fixture: retained(),
  });
  await makePublic(page, made.projectId);
  await open(page, made.publicationPath + "?view=changes");
  await publishedViewerReady(page);
  await page.getByRole("link", { name: /^Retired form/ }).click();
  await expect(page).toHaveURL(/catalogueScreen=product%2Fretired/);
  await expect(page).toHaveURL(/catalogueSnapshot=[a-f0-9]{64}/);
  // The link from Changes opens one viewport, and its frame shows the
  // removed screen's previous version.
  await expect(
    canvasFrame(page, "Retired form")
      .contentFrame()
      .getByRole("heading", { name: "Retired form" }),
  ).toBeVisible();
});

test("Share waits for the third screen page, then copies a nested screen path that another browser can open", async ({
  page,
  context,
  retained,
}) => {
  const made = await publishedProject(page, "nested-share", {
    branch: "main",
    fixture: retained(defaultPageSize * 2),
  });
  await makePublic(page, made.projectId);
  await open(
    page,
    made.publicationPath + "?catalogueScreen=product%2FStart_here-2",
  );
  await publishedViewerReady(page);
  await expect(
    canvasFrame(page, "Current form — desktop")
      .contentFrame()
      .getByRole("heading", { name: "Published form" }),
  ).toBeVisible();
  const frame = await canvasFrame(
    page,
    "Current form — desktop",
  ).elementHandle();
  expect(frame).not.toBeNull();
  const panel = page.getByTestId("viewer-panel-share");
  const link = panel.getByLabel("Publication link");

  await test.step("Share waits for the third screen page before offering its link", async () => {
    const cursors: (string | null)[] = [];
    const shares: string[] = [];
    const held = await holdViewerRead(
      page,
      (url) =>
        url.origin === apiOrigin &&
        url.pathname.endsWith(`/publications/${made.publicationId}/screens`) &&
        url.searchParams.has("cursor"),
    );
    try {
      page.on("request", (request) => {
        const url = new URL(request.url());
        if (
          url.pathname.endsWith(`/publications/${made.publicationId}/screens`)
        ) {
          cursors.push(url.searchParams.get("cursor"));
        }
        if (url.pathname.endsWith(`/publications/${made.publicationId}/share`))
          shares.push(request.url());
      });
      await page.getByTestId("viewer-share").click();
      await held.arrived();
      await expectSharePreparing(panel);
      expect(shares).toEqual([]);
      held.release();
      const choice = panel
        .getByRole("listitem")
        .filter({ hasText: "Current form" });
      await expect(choice).toContainText("Selected");
      await expect(link).toHaveValue(/catalogueScreen=product%2FStart_here-2/);
      expect(
        new URL(await link.inputValue()).searchParams.get("catalogueScreen"),
      ).toBe("product/Start_here-2");
      expect(cursors).toHaveLength(3);
      expect(cursors[0]).toBeNull();
      expect(cursors.slice(1).every((cursor) => cursor !== null)).toBe(true);
      expect(shares).toHaveLength(1);
      expect(new URL(shares[0]).searchParams.get("catalogueScreen")).toBe(
        "product/Start_here-2",
      );
      await panel.getByTestId("share-copy").click();
      await expect(
        page
          .getByRole("region", { name: "Notifications" })
          .getByText("Link copied", { exact: true }),
      ).toBeVisible();
      await expect
        .poll(() =>
          page.evaluate(() => globalThis.navigator.clipboard.readText()),
        )
        .toBe(await link.inputValue());
      expect(
        await page.evaluate(() => globalThis.navigator.clipboard.readText()),
      ).toBe(await link.inputValue());
    } finally {
      held.release();
      await page.unrouteAll({ behavior: "wait" });
    }
  });

  await test.step("Share copies a nested screen path that another browser can open", async () => {
    await expect(link).toHaveValue(/catalogueScreen=product%2FStart_here-2/);
    expect(await frame?.evaluate((element) => element.isConnected)).toBe(true);
    const url = await link.inputValue();
    expect(new URL(url).searchParams.get("catalogueScreen")).toBe(
      "product/Start_here-2",
    );
    const recipient = await context.newPage();
    await recipient.goto(url);
    await publishedViewerReady(recipient);
    await expect(
      recipient.getByRole("heading", { level: 2, name: "Current form" }),
    ).toBeVisible();
    await expect(
      canvasFrame(recipient, "Current form — desktop")
        .contentFrame()
        .getByRole("heading", { name: "Published form" }),
    ).toBeVisible();
    await recipient.close();

    await page.getByTestId("close-share").click();
    await expect(page.getByTestId("viewer-panel-share")).toHaveCount(0);
    await publishedViewerReady(page);
    const settingsFrame = await canvasFrame(
      page,
      "Current form — desktop",
    ).elementHandle();
    expect(settingsFrame).not.toBeNull();
    await openSettingsFromAccount(page);
    const settings = page.getByTestId("settings-dialog");
    await expect(settings).toBeVisible();
    await expect(
      settings.getByRole("heading", {
        level: 1,
        name: "Settings",
        exact: true,
      }),
    ).toBeVisible();
    expect(
      await settingsFrame?.evaluate((element) => element.isConnected),
    ).toBe(true);
  });
});

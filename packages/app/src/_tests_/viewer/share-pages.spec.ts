import { defaultPageSize } from "../../data/publications";
import { expect, open, test } from "../harness";
import { apiOrigin } from "../origins";

import { retainedFixture } from "./retained-fixture";
import {
  canvasFrame,
  expectSharePreparing,
  holdViewerRead,
  makePublic,
  publishedViewerReady,
  publishedProject,
} from "./support";

test.use({ permissions: ["clipboard-read", "clipboard-write"] });

test("Share waits for the third screen page before offering its link", async ({
  page,
}) => {
  const fixture = retainedFixture(defaultPageSize * 2);
  let release: () => void = () => undefined;
  try {
    const made = await publishedProject(page, "share-pages", {
      branch: "main",
      fixture: fixture.path,
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
    const cursors: (string | null)[] = [];
    const shares: string[] = [];
    const held = await holdViewerRead(
      page,
      (url) =>
        url.origin === apiOrigin &&
        url.pathname.endsWith(`/publications/${made.publicationId}/screens`) &&
        url.searchParams.has("cursor"),
    );
    release = held.release;
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
    const panel = page.getByTestId("viewer-panel-share");
    await expect.poll(held.seen).toBe(true);
    await expectSharePreparing(panel);
    expect(shares).toEqual([]);
    release();
    const choice = panel
      .getByRole("listitem")
      .filter({ hasText: "Current form" });
    await expect(choice).toContainText("Selected");
    const link = panel.getByLabel("Publication link");
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
    release();
    await page.unrouteAll({ behavior: "wait" });
    fixture.dispose();
  }
});

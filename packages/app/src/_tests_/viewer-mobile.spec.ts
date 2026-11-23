import type { Page } from "@playwright/test";

import { publicationPathFor } from "./addresses";
import { fillPullRequest } from "./database-fixture";
import { expect, freshEmail, open, signIn, test } from "./harness";
import { createProject } from "./project-setup";
import { createToken, publish } from "./publish";
import {
  holdCatalogueHandoff,
  openHeldViewer,
  openShareFromMore,
} from "./viewer/compact-handoff";
import {
  publicationReference,
  publishedViewerReady,
  publishedProject,
} from "./viewer/support";
import { pressWrite } from "./writes";

/** How far the document scrolls sideways; anything but zero is a defect. */
function sidewaysOverflow(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
}

/** The two widths the viewer protocol names: legible at 390px, usable at 320px. */
const mobileWidths = [390, 320];

test("the compact bar keeps every action in More and a panel is a sheet", async ({
  page,
}) => {
  const made = await publishedProject(page, "compact");
  const handoff = await holdCatalogueHandoff(page, made.catalogueUrl as string);
  await openHeldViewer(page, made.publicationPath, handoff.access.seen);
  for (const slot of ["viewer-publication", "viewer-more"]) {
    const trigger = page.getByTestId(slot);
    await expect(trigger).toBeVisible();
    const box = await trigger.boundingBox();
    expect(box?.height ?? 0, slot).toBeGreaterThanOrEqual(44);
  }
  const panel = await openShareFromMore(page);
  await expect(page.locator("#root")).toHaveAttribute("inert", "");
  const sheet = await panel.boundingBox();
  const viewport = page.viewportSize();
  expect(sheet?.width, "a sheet is full width").toBe(viewport?.width);
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByRole("main")).toHaveCount(1);

  // The access answer starts the host's held index read, so the cloud
  // fallback stays and the overlay stays open across the handoff.
  handoff.access.release();
  await expect.poll(handoff.catalogue.seen).toBe(true);
  await page.getByTestId("close-share").click();
  await expect(panel).toHaveCount(0);
  // Let the bounded restore return focus to the fallback slot, then make the
  // package slot replace it. Focus still belongs to the action that opened
  // Share.
  await page.waitForTimeout(300);
  handoff.catalogue.release();
  await expect(page.locator("[data-mokly-shell]")).toBeVisible();
  const more = page.getByTestId("viewer-more");
  await expect(more).toBeVisible();
  await expect
    .poll(async () => (await more.boundingBox())?.height ?? 0)
    .toBeGreaterThanOrEqual(44);
  await expect(page.getByTestId("viewer-more")).toBeFocused();
});

test("the bar fits a person who has not set a name, at 320px", async ({
  page,
}) => {
  // Every account is created by email, so this is what a new reader sees.
  const made = await publishedProject(page, "no-name");
  await page.setViewportSize({ width: 320, height: 844 });
  await open(page, made.publicationPath);
  await publishedViewerReady(page);
  await page.getByTestId("viewer-more").click();
  const menu = page.getByRole("menu", { name: "Viewer actions" });
  await expect(menu).toContainText(made.email);
  expect(
    await sidewaysOverflow(page),
    "the viewer does not scroll sideways at 320px",
  ).toBe(0);
  // The whole address is still reachable without hovering: it is the
  // control's own accessible name, which is what a screen reader announces
  // and what voice control matches on.
  await expect(menu.getByText("Account", { exact: true })).toBeVisible();
});

/**
 * A long pull request title must not make the compact viewer scroll sideways.
 * The compact pill shows the pull request's number, and its one control keeps
 * the whole name at 390px and 320px: the full reference, then its state.
 */
test("a pull request publication does not scroll sideways", async ({
  page,
}) => {
  await signIn(page, freshEmail("pr-compact"));
  const projectId = await createProject(page, "PR Compact Org");
  const token = await createToken(page, projectId);
  fillPullRequest(projectId, {
    number: 42,
    title: "Name the pull request on every publication address",
    author: "octocat",
    branch: "feature",
  });
  const published = await publish(token, projectId, {
    branch: "feature",
    pullRequest: 42,
  });

  for (const width of mobileWidths) {
    // Loaded fresh at each width, because the bar composes on first paint.
    await page.setViewportSize({ width, height: 844 });
    await open(page, await publicationPathFor(page, projectId, published.id));
    await publishedViewerReady(page);
    await expect(publicationReference(page)).toHaveText("#42");
    await expect(page.getByTestId("viewer-publication")).toHaveAccessibleName(
      /^#42 Name the pull request on every publication address, octocat · Ready · /,
    );
    expect(
      await sidewaysOverflow(page),
      `the viewer does not scroll sideways at ${width}px`,
    ).toBe(0);
  }
});

test("a reader who set a name is called by it, at every width", async ({
  page,
}) => {
  const made = await publishedProject(page, "named");
  const path = made.publicationPath;
  const named = "Charlotte Wainwright";
  await open(page, `${path}?settings=account`);
  await page.getByLabel("Name", { exact: true }).fill(named);
  await pressWrite(
    page,
    page.getByTestId("save-account"),
    "PATCH",
    "/v1/account",
  );
  await expect(page.getByTestId("save-account")).toBeDisabled();
  // Back to the viewer by address rather than by the way out, because this
  // width draws settings as its own screen and the way out differs.
  await open(page, path);
  await publishedViewerReady(page);

  // The name is the only thing on screen, so it is the only thing the control
  // answers to: a reader who says what they can see reaches it, and a screen
  // reader announces the name they chose rather than the address behind it.
  for (const width of [1440, 320]) {
    await page.setViewportSize({ width, height: 844 });
    if (width === 320) {
      await page.getByTestId("viewer-more").click();
      const menu = page.getByRole("menu", { name: "Viewer actions" });
      await expect(menu, `${width}px`).toContainText(named);
      await expect(menu, `${width}px`).not.toContainText(made.email);
      await page.keyboard.press("Escape");
    } else {
      await expect(page.getByTestId("viewer-account"), `${width}px`).toHaveText(
        named,
      );
      await expect(
        page.getByRole("button", { name: named, exact: true }),
        `${width}px`,
      ).toHaveCount(1);
      await expect(
        page.getByRole("button", { name: made.email, exact: true }),
        `${width}px`,
      ).toHaveCount(0);
    }
  }
});

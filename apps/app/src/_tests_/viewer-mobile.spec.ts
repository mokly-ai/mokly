import type { ElementHandle, Page } from "@playwright/test";

import {
  fillPullRequest,
  installedRepository,
  suspendInstallation,
} from "./database-fixture";
import {
  createProject,
  currentWorkspaceId,
  expect,
  failWith,
  freshEmail,
  open,
  workspaceAddress,
  publicationPathFor,
  signIn,
  test,
} from "./harness";
import { createToken, publish } from "./publish";
import { publishedViewerReady, publishedProject } from "./viewer/support";
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

function requestGate() {
  let release: () => void = () => undefined;
  let seen = false;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  return {
    hold: async () => {
      seen = true;
      await pending;
    },
    release: () => release(),
    seen: () => seen,
  };
}

async function holdCatalogueHandoff(page: Page, catalogueUrl: string) {
  const catalogueOrigin = new URL(catalogueUrl).origin;
  const access = requestGate();
  const catalogue = requestGate();
  await page.route(
    (url) => url.origin === catalogueOrigin && url.pathname === "/",
    async (route) => {
      await access.hold();
      await route.continue();
    },
  );
  await page.route("**/mokly-viewer/index.json", async (route) => {
    await catalogue.hold();
    await route.continue();
  });
  return { access, catalogue, catalogueOrigin };
}

/**
 * Let the package become ready while the press is held: the access exchange,
 * then the host's index read. The press keeps the fallback control it began
 * on until the activation concludes.
 */
async function releaseAccessDuringCompactPress(
  page: Page,
  previous: ElementHandle<HTMLElement | SVGElement>,
  handoff: Awaited<ReturnType<typeof holdCatalogueHandoff>>,
): Promise<void> {
  const confirmed = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.origin === handoff.catalogueOrigin && url.pathname === "/";
  });
  const indexed = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return (
      url.origin === handoff.catalogueOrigin &&
      url.pathname === "/mokly-viewer/index.json"
    );
  });
  handoff.access.release();
  await confirmed;
  await expect.poll(handoff.catalogue.seen).toBe(true);
  handoff.catalogue.release();
  await indexed;
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
  expect(await previous.evaluate((element) => element.isConnected)).toBe(true);
  await expect(page.getByTestId("viewer-more")).toBeVisible();
}

async function openHeldViewer(
  page: Page,
  path: string,
  accessSeen: () => boolean,
): Promise<void> {
  await open(page, path);
  await expect(page.getByTestId("viewer-publication")).toContainText("main");
  await expect.poll(accessSeen).toBe(true);
}

async function openShareFromMore(page: Page) {
  await page.getByTestId("viewer-more").click();
  const menu = page.getByRole("menu", { name: "Viewer actions" });
  await expect(menu).toBeVisible();
  await menu.getByText("Share", { exact: true }).click();
  const panel = page.getByTestId("viewer-panel-share");
  await expect(panel).toBeVisible();
  return panel;
}

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

test("a late package slot does not take deliberately moved focus", async ({
  page,
}) => {
  const made = await publishedProject(page, "compact-focus-moved");
  const handoff = await holdCatalogueHandoff(page, made.catalogueUrl as string);
  await openHeldViewer(page, made.publicationPath, handoff.access.seen);
  const panel = await openShareFromMore(page);
  handoff.access.release();
  await expect.poll(handoff.catalogue.seen).toBe(true);
  await page.getByTestId("close-share").click();
  await expect(panel).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );

  const destination = page
    .getByRole("link", { name: "Skip to content" })
    .first();
  await destination.focus();
  expect(
    await destination.evaluate((element) => document.activeElement === element),
  ).toBe(true);
  handoff.catalogue.release();
  await expect(page.locator("[data-mokly-shell]")).toBeVisible();
  await expect(destination).toBeFocused();
  await expect(page.getByTestId("viewer-more")).not.toBeFocused();
});

test("a later pointer action cancels the package slot restore", async ({
  page,
}) => {
  const made = await publishedProject(page, "compact-pointer-moved");
  const handoff = await holdCatalogueHandoff(page, made.catalogueUrl as string);
  await openHeldViewer(page, made.publicationPath, handoff.access.seen);
  const panel = await openShareFromMore(page);
  handoff.access.release();
  await expect.poll(handoff.catalogue.seen).toBe(true);
  await page.getByTestId("close-share").click();
  await expect(panel).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // A press on the stage's pending card, away from every slot, while the
  // host still reads the index.
  await page.getByText("Opening the catalogue").click();
  handoff.catalogue.release();
  await expect(page.locator("[data-mokly-shell]")).toBeVisible();
  await expect(page.getByTestId("viewer-more")).not.toBeFocused();
});

test("a late package slot does not restore after leaving its path", async ({
  page,
}) => {
  const made = await publishedProject(page, "compact-path-left");
  const handoff = await holdCatalogueHandoff(page, made.catalogueUrl as string);
  await openHeldViewer(page, made.publicationPath, handoff.access.seen);
  const panel = await openShareFromMore(page);
  handoff.access.release();
  await expect.poll(handoff.catalogue.seen).toBe(true);
  await page.getByTestId("close-share").click();
  await expect(panel).toHaveCount(0);

  await page.evaluate(() => window.history.pushState({}, "", "/focus-left"));
  await expect(page).toHaveURL(/\/focus-left$/);
  handoff.catalogue.release();
  await expect(page.locator("[data-mokly-shell]")).toBeVisible();
  await expect(page.getByTestId("viewer-more")).not.toBeFocused();
});

test("a More press survives the package slot handoff", async ({ page }) => {
  const made = await publishedProject(page, "compact-more-handoff");
  const handoff = await holdCatalogueHandoff(page, made.catalogueUrl as string);
  await openHeldViewer(page, made.publicationPath, handoff.access.seen);
  const historyLength = await page.evaluate(() => window.history.length);
  const trigger = page.getByTestId("viewer-more");
  const previous = await trigger.elementHandle();
  expect(previous).not.toBeNull();
  const before = await trigger.boundingBox();
  expect(before).not.toBeNull();
  await page.mouse.move(
    (before?.x ?? 0) + (before?.width ?? 0) / 2,
    (before?.y ?? 0) + (before?.height ?? 0) / 2,
  );
  await page.mouse.down();
  await releaseAccessDuringCompactPress(
    page,
    previous as NonNullable<typeof previous>,
    handoff,
  );
  const after = await page.getByTestId("viewer-more").boundingBox();
  expect(after).not.toBeNull();
  await page.mouse.move(
    (after?.x ?? 0) + (after?.width ?? 0) / 2,
    (after?.y ?? 0) + (after?.height ?? 0) / 2,
  );
  await page.mouse.up();

  await expect.poll(handoff.catalogue.seen).toBe(true);
  handoff.catalogue.release();
  await publishedViewerReady(page);
  const menu = page.getByRole("menu", { name: "Viewer actions" });
  await expect(menu).toBeVisible();
  await expect(menu).toHaveCount(1);
  await menu.getByText("Share", { exact: true }).click();
  await expect(page.getByTestId("viewer-panel-share")).toBeVisible();
  expect(await page.evaluate(() => window.history.length)).toBe(
    historyLength + 1,
  );
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
 * The publication trigger must retain its full accessible name at 390px and
 * 320px.
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
    await expect(page.getByTestId("viewer-publication")).toContainText("#42");
    await expect(
      page.getByRole("button", {
        name: "#42 Name the pull request on every publication address",
        exact: true,
      }),
    ).toHaveCount(1);
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

test("an unavailable installation offers another attempt", async ({ page }) => {
  await signIn(page, freshEmail("suspended-compact"));
  await open(page, "/new");
  await page.getByLabel("Workspace name").fill("Suspended Org");
  await page.getByRole("button", { name: "Create workspace" }).click();
  await page.waitForURL(/\/install/);

  await failWith(
    page,
    "**/v1/github/installations",
    "POST",
    "operation-unavailable",
  );
  await page.getByTestId("install-app").click();
  const refusal = page.getByTestId("install-refusal");
  await expect(refusal).toBeVisible();
  await expect(refusal).toContainText("App installation opens soon");
  // No retry helps, so the refusal invents no retry time.
  await expect(refusal).not.toContainText("Try again shortly.");
  await expect(page.getByTestId("install-app")).toHaveText("Try again");
});

test("a suspended installation is kept out of the repository picker", async ({
  page,
}) => {
  await signIn(page, freshEmail("picker-compact"));
  const projectId = await createProject(page, "Picker Org");
  const workspaceId = await currentWorkspaceId(page);
  // A bound installation GitHub has suspended, exactly as reconciliation
  // records one. A suspended installation reads no repository, so the step
  // that would list them is not where the reader belongs.
  suspendInstallation(workspaceId);

  const workspace = await workspaceAddress(page, workspaceId);
  await open(page, `${workspace.path}/-/new`);
  await page.waitForURL((url) => url.pathname === "/install");
  await expect(page.getByText(installedRepository)).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Resume on GitHub" }),
  ).toBeVisible();
  expect(projectId.length).toBeGreaterThan(0);
});

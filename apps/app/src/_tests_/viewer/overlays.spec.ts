import {
  createProject,
  expect,
  freshEmail,
  open,
  projectPathFor,
  publicationPathFor,
  signIn,
  test,
} from "../harness";
import { installedAccount } from "../database-fixture";
import { corrected, publishedViewerReady, publishedProject } from "./support";
import { appOrigin } from "../origins";
import type { ElementHandle, Page } from "@playwright/test";

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

async function holdPackageHandoff(page: Page, catalogueUrl: string) {
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

async function openHeldPackage(
  page: Page,
  projectId: string,
  publicationId: string,
  accessSeen: () => boolean,
): Promise<void> {
  await open(page, await publicationPathFor(page, projectId, publicationId));
  await expect(page.getByTestId("viewer-share")).toBeVisible();
  await expect.poll(accessSeen).toBe(true);
}

/**
 * Let the package become ready while the press is held: the access exchange,
 * then the host's index read. The press keeps the fallback control it began
 * on until the activation concludes.
 */
async function releaseAccessDuringPress(
  page: Page,
  previous: ElementHandle<HTMLElement | SVGElement>,
  handoff: Awaited<ReturnType<typeof holdPackageHandoff>>,
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
  await expect(page.getByTestId("viewer-share")).toBeVisible();
}

async function finishPackageHandoff(
  page: Page,
  handoff: Awaited<ReturnType<typeof holdPackageHandoff>>,
): Promise<void> {
  await expect.poll(handoff.catalogue.seen).toBe(true);
  handoff.catalogue.release();
  await publishedViewerReady(page);
}

test("a pointer press survives the package slot handoff", async ({ page }) => {
  const made = await publishedProject(page, "pointer-slot-handoff");
  const handoff = await holdPackageHandoff(page, made.catalogueUrl as string);
  await openHeldPackage(
    page,
    made.projectId,
    made.publicationId,
    handoff.access.seen,
  );

  const trigger = page.getByTestId("viewer-share");
  const historyLength = await page.evaluate(() => window.history.length);
  const previous = await trigger.elementHandle();
  expect(previous).not.toBeNull();
  const before = await trigger.boundingBox();
  expect(before).not.toBeNull();
  await page.mouse.move(
    (before?.x ?? 0) + (before?.width ?? 0) / 2,
    (before?.y ?? 0) + (before?.height ?? 0) / 2,
  );
  await page.mouse.down();

  await releaseAccessDuringPress(
    page,
    previous as NonNullable<typeof previous>,
    handoff,
  );
  const after = await page.getByTestId("viewer-share").boundingBox();
  expect(after).not.toBeNull();
  await page.mouse.move(
    (after?.x ?? 0) + (after?.width ?? 0) / 2,
    (after?.y ?? 0) + (after?.height ?? 0) / 2,
  );
  await page.mouse.up();

  const panel = page.getByTestId("viewer-panel-share");
  await expect(panel).toBeVisible();
  await expect(panel).toHaveCount(1);
  expect(await page.evaluate(() => window.history.length)).toBe(
    historyLength + 1,
  );
  await finishPackageHandoff(page, handoff);
  await expect(panel).toBeVisible();
  await expect(panel).toHaveCount(1);
});

test("a Space press survives the package slot handoff", async ({ page }) => {
  const made = await publishedProject(page, "space-slot-handoff");
  const handoff = await holdPackageHandoff(page, made.catalogueUrl as string);
  await openHeldPackage(
    page,
    made.projectId,
    made.publicationId,
    handoff.access.seen,
  );

  const trigger = page.getByTestId("viewer-share");
  const historyLength = await page.evaluate(() => window.history.length);
  const previous = await trigger.elementHandle();
  expect(previous).not.toBeNull();
  await trigger.focus();
  await expect(trigger).toBeFocused();
  await page.keyboard.down("Space");

  await releaseAccessDuringPress(
    page,
    previous as NonNullable<typeof previous>,
    handoff,
  );
  await page.keyboard.up("Space");

  const panel = page.getByTestId("viewer-panel-share");
  await expect(panel).toBeVisible();
  await expect(panel).toHaveCount(1);
  expect(await page.evaluate(() => window.history.length)).toBe(
    historyLength + 1,
  );
  await finishPackageHandoff(page, handoff);
  await expect(panel).toBeVisible();
  await expect(panel).toHaveCount(1);
});

test("an off-slot release cancels the held package handoff press", async ({
  page,
}) => {
  const made = await publishedProject(page, "cancel-slot-handoff");
  const handoff = await holdPackageHandoff(page, made.catalogueUrl as string);
  await openHeldPackage(
    page,
    made.projectId,
    made.publicationId,
    handoff.access.seen,
  );
  const historyLength = await page.evaluate(() => window.history.length);
  const trigger = page.getByTestId("viewer-share");
  const previous = await trigger.elementHandle();
  expect(previous).not.toBeNull();
  const before = await trigger.boundingBox();
  expect(before).not.toBeNull();
  await page.mouse.move(
    (before?.x ?? 0) + (before?.width ?? 0) / 2,
    (before?.y ?? 0) + (before?.height ?? 0) / 2,
  );
  await page.mouse.down();
  await releaseAccessDuringPress(
    page,
    previous as NonNullable<typeof previous>,
    handoff,
  );
  const viewport = page.viewportSize();
  await page.mouse.move(16, (viewport?.height ?? 900) - 16);
  await page.mouse.up();

  await finishPackageHandoff(page, handoff);
  await expect(page.getByTestId("viewer-panel-share")).toHaveCount(0);
  expect(await page.evaluate(() => window.history.length)).toBe(historyLength);
});

test("another key cancels a held Space handoff activation", async ({
  page,
}) => {
  const made = await publishedProject(page, "cancel-space-handoff");
  const handoff = await holdPackageHandoff(page, made.catalogueUrl as string);
  await openHeldPackage(
    page,
    made.projectId,
    made.publicationId,
    handoff.access.seen,
  );
  const historyLength = await page.evaluate(() => window.history.length);
  const trigger = page.getByTestId("viewer-share");
  const previous = await trigger.elementHandle();
  expect(previous).not.toBeNull();
  await trigger.focus();
  await page.keyboard.down("Space");
  await releaseAccessDuringPress(
    page,
    previous as NonNullable<typeof previous>,
    handoff,
  );
  await page.keyboard.press("Tab");
  await page.keyboard.up("Space");

  await finishPackageHandoff(page, handoff);
  await expect(page.getByTestId("viewer-panel-share")).toHaveCount(0);
  expect(await page.evaluate(() => window.history.length)).toBe(historyLength);
});

test("a settled package pointer press activates History once", async ({
  page,
}) => {
  const { publicationPath } = await publishedProject(
    page,
    "settled-history-press",
  );
  await open(page, publicationPath);
  await publishedViewerReady(page);
  await page.evaluate(() => {
    document.documentElement.dataset.viewerNativeClicks = "0";
    document.addEventListener(
      "click",
      (event) => {
        if (
          event.target instanceof Element &&
          event.target.closest('[data-testid="viewer-history"]')
        ) {
          const value = Number(
            document.documentElement.dataset.viewerNativeClicks ?? "0",
          );
          document.documentElement.dataset.viewerNativeClicks = String(
            value + 1,
          );
        }
      },
      true,
    );
  });
  const historyLength = await page.evaluate(() => window.history.length);
  const trigger = page.getByTestId("viewer-history");
  const box = await trigger.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(
    (box?.x ?? 0) + (box?.width ?? 0) / 2,
    (box?.y ?? 0) + (box?.height ?? 0) / 2,
  );
  await page.mouse.down();
  await page.mouse.up();

  expect(
    await page.evaluate(() =>
      Number(document.documentElement.dataset.viewerNativeClicks ?? "0"),
    ),
  ).toBe(1);
  await expect(page.getByTestId("viewer-panel-history")).toBeVisible();
  await expect(page.getByTestId("viewer-panel-history")).toHaveCount(1);
  await expect(page).toHaveURL(/panel=history/);
  expect(await page.evaluate(() => window.history.length)).toBe(
    historyLength + 1,
  );
});

test("a settled package Space press activates Settings once", async ({
  page,
}) => {
  const { publicationPath } = await publishedProject(
    page,
    "settled-settings-press",
  );
  await open(page, publicationPath);
  await publishedViewerReady(page);
  await page.evaluate(() => {
    document.documentElement.dataset.viewerNativeClicks = "0";
    document.addEventListener(
      "click",
      (event) => {
        if (
          event.target instanceof Element &&
          event.target.closest('[data-testid="viewer-settings"]')
        ) {
          const value = Number(
            document.documentElement.dataset.viewerNativeClicks ?? "0",
          );
          document.documentElement.dataset.viewerNativeClicks = String(
            value + 1,
          );
        }
      },
      true,
    );
  });
  const trigger = page.getByTestId("viewer-settings");
  await trigger.focus();
  await expect(trigger).toBeFocused();
  await page.keyboard.down("Space");
  await page.keyboard.up("Space");

  expect(
    await page.evaluate(() =>
      Number(document.documentElement.dataset.viewerNativeClicks ?? "0"),
    ),
  ).toBe(1);
  await expect(page.getByTestId("settings-dialog")).toBeVisible();
  await expect(page.getByTestId("settings-dialog")).toHaveCount(1);
  await expect(page).toHaveURL(/settings=/);
});

test("invalid cloud values are corrected while package routes stay authoritative", async ({
  page,
}) => {
  const { publicationId, publicationPath: path } = await publishedProject(
    page,
    "urlstate",
  );
  await open(page, `${path}?view=diff&viewport=tablet&scheme=sepia&panel=none`);
  await corrected(page, /scheme=sepia/);
  await expect(page).toHaveURL(new RegExp(`publications/${publicationId}$`));
  const viewer = page.locator("[data-mokly-shell]");
  await expect(viewer).toHaveAttribute("data-mokly-color-scheme", "light");
  await expect(
    viewer.getByRole("heading", { level: 2, name: "Mokly" }),
  ).toBeVisible();

  // Routed-entry membership belongs to the package, which keeps the address
  // and draws its documented not-found state instead of the host rewriting it.
  await open(page, `${path}?catalogueScreen=not-a-screen`);
  await expect(page).toHaveURL(/catalogueScreen=not-a-screen/);
  await expect(
    page.getByRole("heading", { level: 2, name: "Item not found" }),
  ).toBeVisible();
  await open(page, `${path}?catalogueScreen=start`);
  await expect(page).toHaveURL(/catalogueScreen=start/);
  await expect(page.locator("[data-mokly-stage]")).toHaveAttribute(
    "data-viewport",
    "desktop",
  );
});

test("back and forward restore the panel the reader opened", async ({
  page,
}) => {
  const { publicationId, publicationPath } = await publishedProject(
    page,
    "restore",
  );
  await open(page, publicationPath);
  await publishedViewerReady(page);
  await page.getByTestId("viewer-history").click();
  await expect(page.getByTestId("viewer-panel-history")).toBeVisible();
  await expect(page).toHaveURL(/panel=history/);

  await page.goBack();
  await expect(page.getByTestId("viewer-panel-history")).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`publications/${publicationId}$`));

  await page.goForward();
  await expect(page.getByTestId("viewer-panel-history")).toBeVisible();

  // Close leaves the publication exactly where it was.
  await page.getByTestId("close-history").click();
  await expect(page.getByTestId("viewer-panel-history")).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`publications/${publicationId}$`));
});

test("opening and closing a panel leaves no step that does nothing", async ({
  page,
}) => {
  const { publicationId, projectPath } = await publishedProject(page, "stack");
  await open(page, projectPath);
  await expect(page).toHaveURL(new RegExp(`publications/${publicationId}$`));
  await publishedViewerReady(page);

  await page.getByTestId("viewer-history").click();
  await expect(page.getByTestId("viewer-panel-history")).toBeVisible();
  await page.getByTestId("close-history").click();
  await expect(page.getByTestId("viewer-panel-history")).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`publications/${publicationId}$`));

  // The panel's entry was undone rather than written over, so one press of
  // Back leaves the publication instead of retracing the same address.
  await page.goBack();
  await expect(page).not.toHaveURL(new RegExp(`publications/${publicationId}`));
});

test("only one overlay is open at a time", async ({ page }) => {
  const { publicationPath: path } = await publishedProject(page, "overlay");
  await open(page, path);
  await publishedViewerReady(page);
  await page.getByTestId("viewer-history").click();
  await expect(page.getByTestId("viewer-panel-history")).toBeVisible();
  // The page beneath a panel is inert, so the chrome's own triggers are out of
  // reach until it is dismissed.
  await expect(page.locator("#root")).toHaveAttribute("aria-hidden", "true");
  await expect(page.locator("#root")).toHaveAttribute("inert", "");

  // An address naming both still opens exactly one, and it is the dialog.
  await open(page, `${path}?panel=history&settings=`);
  await expect(page.getByTestId("settings-dialog")).toBeVisible();
  await expect(page.getByTestId("viewer-panel-history")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByRole("main")).toHaveCount(1);
});

test("closing the settings dialog returns focus to the trigger that opened it", async ({
  page,
}) => {
  const { publicationPath: path } = await publishedProject(page, "focus");
  await open(page, path);
  await publishedViewerReady(page);
  await page.getByTestId("viewer-settings").click();
  await expect(page.getByTestId("settings-dialog")).toBeVisible();
  await page.getByTestId("close-settings").click();
  await expect(page.getByTestId("settings-dialog")).toHaveCount(0);
  await expect(page.getByTestId("viewer-settings")).toBeFocused();

  // Every slot answers the same way, so a reader never loses their place.
  await page.getByTestId("viewer-history").click();
  await expect(page.getByTestId("viewer-panel-history")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("viewer-panel-history")).toHaveCount(0);
  await expect(page.getByTestId("viewer-history")).toBeFocused();
});

test("a settings address survives a viewer value the route corrects", async ({
  page,
}) => {
  const { publicationPath: path } = await publishedProject(
    page,
    "settings-kept",
  );
  // The scheme is not one this publication can honour, so the route corrects
  // it — and the dialog the same address asked for still opens.
  await open(page, `${path}?scheme=blue&settings=account`);
  await corrected(page, /scheme=blue/);
  // Everything below describes the address the route produced. Asserted before
  // the correction they would all hold of the address the reader asked for,
  // which is the one state that proves nothing.
  await expect(page).toHaveURL(/settings=account/);
  await expect(page.getByTestId("settings-dialog")).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 1, name: "Account" }),
  ).toBeVisible();
});

test("settings opens over the viewer and closes back onto its selection", async ({
  page,
}) => {
  const { publicationPath: path } = await publishedProject(page, "beneath");
  await open(page, `${path}?view=changes`);
  await publishedViewerReady(page);
  await page.getByTestId("viewer-settings").click();
  await expect(page.getByTestId("settings-dialog")).toBeVisible();
  await page.getByTestId("close-settings").click();
  await expect(page).toHaveURL(/view=changes/);
  await expect(page.getByRole("button", { name: /^Changes/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("a listed screen response cannot erase a selected component variant", async ({
  page,
}) => {
  const { publicationPath: path } = await publishedProject(
    page,
    "component-state",
  );
  // The variant is an entry of its own: `listScreens` names only the two
  // screens, and the package still selects the variant the address names.
  const query =
    "catalogueScreen=notice%2Fdraft&viewport=both&scheme=dark&search=notice";
  await open(page, `${path}?${query}`);
  const chosen = page.locator('[data-workspace-variant="notice/draft"]');

  const stage = page.locator("[data-mokly-stage]");
  await expect(stage).toHaveAttribute("data-viewport", "both");
  await expect(page.locator("[data-mokly-shell]")).toHaveAttribute(
    "data-mokly-color-scheme",
    "dark",
  );
  await expect(
    page.getByRole("heading", { level: 2, name: "Notice" }),
  ).toBeVisible();
  // The variant entry itself, not its parent showing its first variant.
  await expect(
    page.getByRole("button", { name: "Copy path notice/draft", exact: true }),
  ).toBeVisible();
  await expect(chosen).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByRole("searchbox", { name: "Search catalogue" }),
  ).toHaveValue("notice");

  const screenResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "GET" &&
      /\/publications\/[^/]+\/screens(?:\?|$)/.test(response.url()) &&
      response.status() === 200,
  );
  await page.getByTestId("viewer-share").click();
  const panel = page.getByTestId("viewer-panel-share");
  const listed = (await (await screenResponse).json()) as {
    items: { path: string }[];
  };
  expect(listed.items.map(({ path }) => path)).toEqual(["finish", "start"]);
  await expect(
    panel.getByText("Whole catalogue", { exact: true }),
  ).toBeVisible();
  // While the link is prepared, its field waits in its own frame, empty.
  const link = panel.getByLabel("Publication link");
  await expect(link).not.toHaveValue("");
  const shared = new URL(await link.inputValue());
  expect(shared.pathname).toBe(path);
  expect(shared.searchParams.get("scheme")).toBe("dark");
  expect(shared.searchParams.has("catalogueScreen")).toBe(false);
  // The scheme the API validated and the Both the host carries, and none of
  // the package's working state.
  expect([...shared.searchParams.keys()].sort()).toEqual([
    "scheme",
    "viewport",
  ]);
  await expect(page).toHaveURL(/catalogueScreen=notice%2Fdraft/);
  await expect(page).toHaveURL(/viewport=both/);
  await expect(page).toHaveURL(/search=notice/);

  await page.goBack();
  await expect(panel).toHaveCount(0);
  await expect(
    page.getByRole("heading", { level: 2, name: "Notice" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/catalogueScreen=notice%2Fdraft/);
  await expect(page).toHaveURL(/viewport=both/);
  await expect(page).toHaveURL(/scheme=dark/);
  await expect(page).toHaveURL(/search=notice/);
  await expect(stage).toHaveAttribute("data-viewport", "both");
  await expect(page.locator("[data-mokly-shell]")).toHaveAttribute(
    "data-mokly-color-scheme",
    "dark",
  );
  await expect(chosen).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByRole("searchbox", { name: "Search catalogue" }),
  ).toHaveValue("notice");

  await page.getByTestId("viewer-settings").click();
  await expect(page.getByTestId("settings-dialog")).toBeVisible();
  await page.getByTestId("close-settings").click();
  await expect(
    page.getByRole("heading", { level: 2, name: "Notice" }),
  ).toBeVisible();
  await expect(stage).toHaveAttribute("data-viewport", "both");
  await expect(page.locator("[data-mokly-shell]")).toHaveAttribute(
    "data-mokly-color-scheme",
    "dark",
  );
  await expect(chosen).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByRole("searchbox", { name: "Search catalogue" }),
  ).toHaveValue("notice");
  await expect(page).toHaveURL(/catalogueScreen=notice%2Fdraft/);
  await expect(page).toHaveURL(/viewport=both/);
  await expect(page).toHaveURL(/scheme=dark/);
  await expect(page).toHaveURL(/search=notice/);
});

test("package filters survive panels, Back and settings rerenders", async ({
  page,
}) => {
  const { publicationPath: path } = await publishedProject(
    page,
    "filter-state",
  );
  const query = "viewport=both&scheme=dark&search=notice&tag=review";
  const search = page.getByRole("searchbox", { name: "Search catalogue" });
  await open(page, `${path}?${query}`);
  await expect(search).toHaveValue("notice tag:review");

  await page.getByTestId("viewer-history").click();
  await expect(page.getByTestId("viewer-panel-history")).toBeVisible();
  await page.goBack();
  await expect(page.getByTestId("viewer-panel-history")).toHaveCount(0);
  await expect(search).toHaveValue("notice tag:review");
  await expect(page).toHaveURL(/viewport=both/);
  await expect(page).toHaveURL(/scheme=dark/);
  await expect(page).toHaveURL(/search=notice/);
  await expect(page).toHaveURL(/tag=review/);

  await page.getByTestId("viewer-settings").click();
  await expect(page.getByTestId("settings-dialog")).toBeVisible();
  await page.getByTestId("close-settings").click();
  await expect(search).toHaveValue("notice tag:review");
  await expect(page).toHaveURL(/viewport=both/);
  await expect(page).toHaveURL(/scheme=dark/);
  await expect(page).toHaveURL(/search=notice/);
  await expect(page).toHaveURL(/tag=review/);
});

test("package search and result selection survive controlled feedback", async ({
  page,
}) => {
  const { publicationPath: path } = await publishedProject(
    page,
    "search-result",
  );
  const search = page.getByRole("searchbox", { name: "Search catalogue" });
  await open(page, `${path}?catalogueScreen=start`);
  await expect(
    page.getByRole("heading", { level: 2, name: "Start" }),
  ).toBeVisible();

  await search.fill("notice");
  await expect(search).toHaveValue("notice");
  await expect(page).toHaveURL(/search=notice/);
  await page.getByRole("link", { name: /^Notice( Changed)?$/ }).click();
  await expect(
    page.getByRole("heading", { level: 2, name: "Notice" }),
  ).toBeVisible();
  await expect(search).toHaveValue("notice");
  await expect(page).toHaveURL(/catalogueScreen=notice/);
  await expect(page).toHaveURL(/search=notice/);

  await page.getByTestId("viewer-history").click();
  await expect(page.getByTestId("viewer-panel-history")).toBeVisible();
  await page.goBack();
  await expect(page.getByTestId("viewer-panel-history")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { level: 2, name: "Notice" }),
  ).toBeVisible();
  await expect(search).toHaveValue("notice");
  await expect(page).toHaveURL(/catalogueScreen=notice/);
  await expect(page).toHaveURL(/search=notice/);
});

test("the projects panel lists what the reader can open and creates the next", async ({
  page,
}) => {
  const made = await publishedProject(page, "projects");
  await open(page, made.publicationPath);
  await publishedViewerReady(page);
  await page.getByTestId("viewer-project").click();
  const panel = page.getByTestId("viewer-panel-projects");
  await expect(panel).toBeVisible();
  // The workspace is named with the GitHub accounts it connects, which the
  // installation list answers for every workspace at once.
  await expect(panel.locator(".fo-ref-head .fo-ref-detail")).toHaveText(
    installedAccount,
  );
  await expect(panel.getByText("Current")).toBeVisible();
  await expect(
    panel.getByText(new URL(appOrigin).host + made.projectPath),
  ).toBeVisible();
  await panel.getByTestId("projects-create").click();
  await expect(page).toHaveURL((url) => /^\/[^/]+\/-\/new$/.test(url.pathname));
});

test("one overlay is one entry, however the reader reached it", async ({
  page,
}) => {
  await signIn(page, freshEmail("one-entry"));
  const projectId = await createProject(page, "One Entry Org");
  const here = await projectPathFor(page, projectId);
  await open(page, here);

  // A panel opened from a panel replaces it, so closing lands on the page
  // rather than on the panel the reader came through.
  await page.getByTestId("viewer-history").click();
  await expect(page.getByTestId("viewer-panel-history")).toBeVisible();
  await page.getByTestId("history-choose-publication").click();
  await expect(page.getByTestId("viewer-panel-switcher")).toBeVisible();
  await expect(page.getByTestId("viewer-panel-history")).toHaveCount(0);
  await page.getByTestId("close-switcher").click();
  await expect(page.getByTestId("viewer-panel-switcher")).toHaveCount(0);
  await expect(page.getByTestId("viewer-panel-history")).toHaveCount(0);
  await expect(page).toHaveURL((url) => url.pathname === here);

  // And the settings dialog obeys the same rule the panels do: one entry,
  // undone on close, so one press of Back leaves the page.
  await page.getByTestId("viewer-settings").click();
  await expect(page.getByTestId("settings-dialog")).toBeVisible();
  await page.getByTestId("close-settings").click();
  await expect(page.getByTestId("settings-dialog")).toHaveCount(0);
  await expect(page).toHaveURL((url) => url.pathname === here);
  await page.goBack();
  await expect(page).not.toHaveURL((url) => url.pathname === here);
});

test("a trigger says which overlay it opens, and whether it is open", async ({
  page,
}) => {
  const made = await publishedProject(page, "announced");
  const path = made.publicationPath;
  await open(page, path);
  await publishedViewerReady(page);

  // Every bar trigger opens one overlay, and says so before it is pressed.
  for (const slot of [
    "viewer-project",
    "viewer-publication",
    "viewer-history",
    "viewer-share",
    "viewer-settings",
    "viewer-account",
  ]) {
    await expect(page.getByTestId(slot)).toHaveAttribute(
      "aria-haspopup",
      "dialog",
    );
    await expect(page.getByTestId(slot)).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  }

  // Exactly the open one reports itself expanded, for a panel and for each
  // settings pane, so a reader who cannot see the overlay is still told.
  const open_ = async (address: string, expanded: string, shut: string) => {
    await open(page, `${path}${address}`);
    await expect(page.getByTestId(expanded)).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    await expect(page.getByTestId(shut)).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  };
  await open_("?panel=history", "viewer-history", "viewer-share");
  await open_("?settings=", "viewer-settings", "viewer-account");
  await open_("?settings=account", "viewer-account", "viewer-settings");
});

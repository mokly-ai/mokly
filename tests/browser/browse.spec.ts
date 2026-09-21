import { expect, test, type Page } from "@playwright/test";

import { chooseScheme, chooseViewport } from "./workspace_actions.js";
import { expectFrameSource } from "./workspace_actions.js";

const welcomeRow = 'a[data-nav-row][data-route="screens/welcome.html"]';
const detailsRow = 'a[data-nav-row][data-route="screens/details.html"]';
const designHomeRow =
  'a[data-nav-row][data-route="design/browse/views/home.html"]';
const tourRow = 'a[data-nav-row][data-route="user-flows/example-tour.html"]';
const appearance = ".mbk-topbar [data-mokly-appearance-control]";
const appearanceSelect = "[data-mokly-appearance-select]";
const face = (value: string) =>
  `[data-appearance-option="${value}"] .mbk-appearance-value`;
const mobileFrame = ".mbk-frame-mobile iframe";
const desktopFrame = ".mbk-frame-desktop iframe";
const darkSurface = "rgb(18, 21, 20)";
const formsChip = '[data-inspector-panel="details"] [data-mokly-tag="forms"]';
const accentFill = "rgb(79, 120, 100)";

async function markPage(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as { __moklyMarker?: boolean }).__moklyMarker = true;
  });
}

function hasMarker(page: Page): Promise<boolean> {
  return page.evaluate(
    () => (window as { __moklyMarker?: boolean }).__moklyMarker === true,
  );
}

/**
 * Deeper navigation groups default closed away from their routes, so tests
 * that click a screen row from another page disclose its group first — the
 * same gesture a reader uses.
 */
async function openScreensGroup(page: Page): Promise<void> {
  const group = page.locator(
    'details[data-nav-collection="collection:example-screens"]',
  );
  if ((await group.getAttribute("open")) === null) {
    await group.locator("summary").click();
  }
  await expect(page.locator(welcomeRow)).toBeVisible();
}

/** Visible workspace toggle and retained legacy state agree. */
async function expectSchemeSelected(
  page: Page,
  value: "dark" | "light",
): Promise<void> {
  // The document mark is what every frame and caption follows. The control
  // may read Auto while resolving to the same scheme, so it is asserted where
  // an explicit choice was actually made.
  await expect(page.locator("body")).toHaveAttribute(
    "data-mokly-color-scheme",
    value,
  );
}

function computedStyle(
  page: Page,
  selector: string,
  property:
    | "backgroundColor"
    | "boxShadow"
    | "display"
    | "position"
    | "textTransform"
    | "zIndex",
): Promise<string> {
  return page
    .locator(selector)
    .evaluate((element, name) => getComputedStyle(element)[name], property);
}

/**
 * A dark screen paints its edge on an `::after` overlay above the fragment, so
 * the hairline is read from the pseudo-element rather than the screen itself.
 */
function overlayStyle(
  page: Page,
  selector: string,
  property: "boxShadow" | "position",
): Promise<string> {
  return page
    .locator(selector)
    .evaluate(
      (element, name) => getComputedStyle(element, "::after")[name],
      property,
    );
}

test("durable links load complete server-rendered views", async ({ page }) => {
  await page.goto("/view/screens/welcome.html");
  await expect(page.locator("#mb-main h2")).toHaveText("Welcome");
  await expect(page.locator(".mbk-frame-mobile iframe")).toHaveAttribute(
    "sandbox",
    "allow-same-origin",
  );
  await expect(page.locator(welcomeRow)).toHaveAttribute(
    "aria-current",
    "page",
  );
});

test("catalogue separates pages and components into collapsible sections", async ({
  page,
}) => {
  await page.goto("/");
  const pages = page.locator('[data-nav-section="pages"]');
  const components = page.locator('[data-nav-section="components"]');
  await expect(pages.locator(":scope > summary")).toHaveText("Pages");
  await expect(components.locator(":scope > summary")).toHaveText("Components");
  await expect(pages).toHaveAttribute("open", "");
  await expect(components).toHaveAttribute("open", "");
  await expect(pages.locator('[data-entry-kind="component"]')).toHaveCount(0);
  await expect(
    components.locator(':not([data-entry-kind="component"])[data-nav-row]'),
  ).toHaveCount(0);
  expect(await pages.locator("[data-nav-row]").count()).toBeGreaterThan(0);
  expect(await components.locator("[data-nav-row]").count()).toBeGreaterThan(0);

  await components.locator(":scope > summary").click();
  await expect(components).not.toHaveAttribute("open", "");
  await page.reload();
  await expect(pages).toHaveAttribute("open", "");
  await expect(components).not.toHaveAttribute("open", "");

  await page.getByRole("button", { name: "Collapse all" }).click();
  await expect(pages).not.toHaveAttribute("open", "");
  await expect(components).not.toHaveAttribute("open", "");
});

test("progressive navigation swaps the main view without reloads", async ({
  page,
}) => {
  await page.goto("/");
  await markPage(page);
  await openScreensGroup(page);
  await page.click(welcomeRow);
  await expect(page).toHaveURL(/\/view\/screens\/welcome\.html$/);
  await expect(page.locator("#mb-main h2")).toHaveText("Welcome");
  expect(await hasMarker(page)).toBe(true);
  await expect(page.locator(welcomeRow)).toHaveAttribute(
    "aria-current",
    "page",
  );
  expect(await page.evaluate(() => document.activeElement?.id ?? "")).toBe(
    "mb-main",
  );
  await expect(page.locator("#mb-status")).toContainText("Welcome");

  await page.click(detailsRow);
  await expect(page).toHaveURL(/details\.html$/);
  await page.goBack();
  await expect(page.locator("#mb-main h2")).toHaveText("Welcome");
  await page.goForward();
  await expect(page.locator("#mb-main h2")).toHaveText("Details");
  expect(await hasMarker(page)).toBe(true);
});

test("breadcrumbs track hierarchy through progressive history", async ({
  page,
}) => {
  await page.goto("/view/screens/welcome.html");
  const crumbs = page.getByLabel("Catalogue location");
  await expect(crumbs).toHaveText("Example›Screens");
  await expect(crumbs.locator("a")).toHaveCount(0);

  await page.click(tourRow);
  await expect(page.locator("#mb-main h2")).toHaveText("Example tour");
  await expect(crumbs).toHaveText("Example");
  await page.goBack();
  await expect(crumbs).toHaveText("Example›Screens");
  await page.goForward();
  await expect(crumbs).toHaveText("Example");
});

test("Back and Forward restore each route's stage scroll", async ({ page }) => {
  await page.setViewportSize({ height: 500, width: 1_280 });
  await page.goto("/view/screens/welcome.html");
  await page.click(detailsRow);
  await expect(page.locator("#mb-main h2")).toHaveText("Details");
  const destinationScroll = await page.evaluate(() => {
    const stage = document.querySelector<HTMLElement>(
      '[data-mokly-scroll="stage"]',
    );
    if (!stage) return -1;
    stage.scrollTop = 500;
    stage.dispatchEvent(new Event("scroll"));
    return stage.scrollTop;
  });
  expect(destinationScroll).toBeGreaterThan(100);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (history.state as { scrolls?: { stage?: number } } | null)?.scrolls
            ?.stage,
      ),
    )
    .toBe(destinationScroll);

  await page.goBack();
  await expect(page.locator("#mb-main h2")).toHaveText("Welcome");
  await page.goForward();
  await expect(page.locator("#mb-main h2")).toHaveText("Details");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.querySelector<HTMLElement>('[data-mokly-scroll="stage"]')
            ?.scrollTop,
      ),
    )
    .toBe(destinationScroll);
});

test("search state is retained across in-shell navigation", async ({
  page,
}) => {
  await page.goto("/");
  await markPage(page);
  await page.fill("[data-mokly-search]", "welcome");
  await expect(page.locator(detailsRow)).toBeHidden();
  await page.click(welcomeRow);
  await expect(page.locator("#mb-main h2")).toHaveText("Welcome");
  await expect(page.locator("[data-mokly-search]")).toHaveValue("welcome");
  await expect(page.locator(detailsRow)).toBeHidden();
  expect(await hasMarker(page)).toBe(true);
});

test("search matches authored page ids", async ({ page }) => {
  await page.goto("/");
  await page.fill("[data-mokly-search]", "example-details");

  await expect(page.locator(detailsRow)).toBeVisible();
  await expect(page.locator(welcomeRow)).toBeHidden();
  await expect(page.locator(tourRow)).toBeHidden();
});

test("details starts collapsed and remembers disclosure", async ({ page }) => {
  const details = page.locator("[data-workspace-inspector]");
  await page.goto("/view/screens/welcome.html");
  await expect(details).not.toHaveAttribute("data-open", "true");
  await page.getByRole("tab", { name: "Details", exact: true }).click();
  await expect(details).toHaveAttribute("data-open", "true");

  await page.click(detailsRow);
  await expect(page.locator("#mb-main h2")).toHaveText("Details");
  await expect(details).toHaveAttribute("data-open", "true");

  await page.reload();
  await expect(details).toHaveAttribute("data-open", "true");
  await page.evaluate(() => {
    document
      .querySelector<HTMLElement>('[data-inspector-tab="details"]')
      ?.click();
    window.location.assign("/view/screens/welcome.html");
  });
  await page.waitForURL(/\/view\/screens\/welcome\.html$/);
  await expect(details).not.toHaveAttribute("data-open", "true");
});

test("searching opens groups and clearing restores their disclosure", async ({
  page,
}) => {
  await page.goto("/");
  const screensGroup =
    'details[data-nav-collection="collection:example-screens"]';
  await page.evaluate((selector) => {
    document.querySelector<HTMLDetailsElement>(selector)!.open = false;
  }, screensGroup);
  await page.fill("[data-mokly-search]", "welcome");
  await expect(page.locator(welcomeRow)).toBeVisible();
  expect(
    await page.evaluate(
      (selector) => document.querySelector<HTMLDetailsElement>(selector)!.open,
      screensGroup,
    ),
  ).toBe(true);
  await page.fill("[data-mokly-search]", "");
  await expect
    .poll(() =>
      page.evaluate(
        (selector) =>
          document.querySelector<HTMLDetailsElement>(selector)!.open,
        screensGroup,
      ),
    )
    .toBe(false);
});

test("details tag chips enter, keep, and clear their term", async ({
  page,
}) => {
  await page.goto("/view/screens/welcome.html");
  await expect(page.locator(tourRow)).toBeVisible();
  await markPage(page);

  await page.locator('[data-inspector-tab="details"]').click();
  await page.click(formsChip);
  await expect(page.locator("[data-mokly-search]")).toHaveValue("tag:forms");
  await expect(page.locator(formsChip)).toHaveClass(/active/);
  expect(await computedStyle(page, formsChip, "backgroundColor")).toBe(
    accentFill,
  );
  await expect(page.locator(welcomeRow)).toBeVisible();
  await expect(page.locator(detailsRow)).toBeVisible();
  await expect(page.locator(tourRow)).toBeHidden();

  await page.click(detailsRow);
  await expect(page.locator("#mb-main h2")).toHaveText("Details");
  await expect(page.locator("[data-mokly-search]")).toHaveValue("tag:forms");
  await expect(page.locator(formsChip)).toHaveClass(/active/);

  await page.click(formsChip);
  await expect(page.locator("[data-mokly-search]")).toHaveValue("");
  await expect(page.locator(formsChip)).not.toHaveClass(/active/);
  await expect(page.locator(tourRow)).toBeVisible();
  expect(await hasMarker(page)).toBe(true);
});

test("overlapping navigations are latest-wins", async ({ page }) => {
  await page.goto("/");
  await markPage(page);
  await openScreensGroup(page);
  await page.route("**/view/screens/welcome.html", async (route) => {
    if (route.request().resourceType() !== "fetch") return route.continue();
    await new Promise((resolve) => setTimeout(resolve, 700));
    return route.continue();
  });
  await page.click(welcomeRow);
  await page.click(detailsRow);
  await expect(page.locator("#mb-main h2")).toHaveText("Details");
  await expect(page).toHaveURL(/details\.html$/);
  await page.waitForTimeout(900);
  await expect(page.locator("#mb-main h2")).toHaveText("Details");
  expect(await hasMarker(page)).toBe(true);
});

test("failed enhancement falls back to native navigation", async ({ page }) => {
  await page.goto("/");
  await markPage(page);
  await openScreensGroup(page);
  await page.route("**/view/screens/welcome.html", (route) =>
    route.request().resourceType() === "fetch"
      ? route.abort()
      : route.continue(),
  );
  await page.click(welcomeRow);
  await expect(page.locator("#mb-main h2")).toHaveText("Welcome");
  expect(await hasMarker(page)).toBe(false);
});

test("viewport controls switch device frames", async ({ page }) => {
  await page.goto("/view/screens/welcome.html");
  await expect(
    page.locator(".mbk-screen-head [data-workspace-viewport]"),
  ).toBeVisible();
  await expect(page.locator(".mbk-viewbar")).toHaveCount(0);
  await expect(page.locator(".mbk-frame-mobile")).toBeVisible();
  await expect(page.locator(".mbk-frame-desktop")).toBeVisible();
  await chooseViewport(page, "mobile");
  await expect(page.locator(".mbk-frame-mobile")).toBeVisible();
  await expect(page.locator(".mbk-frame-desktop")).toBeHidden();
  await chooseViewport(page, "desktop");
  await expect(page.locator(".mbk-frame-mobile")).toBeHidden();
  await expect(page.locator(".mbk-frame-desktop")).toBeVisible();
});

test("color scheme switch swaps device frames", async ({ page }) => {
  await page.goto("/view/screens/welcome.html");
  await expectFrameSource(
    page.locator(mobileFrame),
    /screens\/welcome\.mobile\.html$/,
  );
  await expectSchemeSelected(page, "light");

  await chooseScheme(page, "dark");
  await expect(page.locator("body")).toHaveAttribute(
    "data-mokly-color-scheme",
    "dark",
  );
  await expectFrameSource(
    page.locator(mobileFrame),
    /screens\/welcome\.mobile\.dark\.html$/,
  );
  await expectFrameSource(
    page.locator(desktopFrame),
    /screens\/welcome\.desktop\.dark\.html$/,
  );
  await expectSchemeSelected(page, "dark");

  await chooseScheme(page, "light");
  await expect(page.locator("body")).toHaveAttribute(
    "data-mokly-color-scheme",
    "light",
  );
  await expectFrameSource(
    page.locator(mobileFrame),
    /screens\/welcome\.mobile\.html$/,
  );
  await expectFrameSource(
    page.locator(desktopFrame),
    /screens\/welcome\.desktop\.html$/,
  );
  await expectSchemeSelected(page, "light");
});

test("dark device screens keep their surface and edge", async ({ page }) => {
  await page.setViewportSize({ height: 800, width: 1_280 });
  await page.goto("/view/screens/welcome.html");
  const phoneScreen = ".mbk-frame-mobile .phone-screen";
  expect(await overlayStyle(page, phoneScreen, "boxShadow")).toBe("none");

  await chooseScheme(page, "dark");
  expect(await computedStyle(page, phoneScreen, "boxShadow")).toBe("none");
  expect(await overlayStyle(page, phoneScreen, "position")).toBe("absolute");
  expect(await overlayStyle(page, phoneScreen, "boxShadow")).toContain("inset");
  expect(await computedStyle(page, mobileFrame, "backgroundColor")).toBe(
    darkSurface,
  );
  expect(await computedStyle(page, desktopFrame, "backgroundColor")).toBe(
    darkSurface,
  );
  expect(
    await computedStyle(page, ".browser-viewport", "backgroundColor"),
  ).toBe(darkSurface);
});

test("a light-only screen keeps light frames and says so", async ({ page }) => {
  await page.goto("/view/screens/welcome.html");
  await chooseScheme(page, "dark");
  await page.fill("[data-mokly-search]", "home");
  await page.click(designHomeRow);
  await expect(page.locator("#mb-main h2")).toHaveText("Home");

  await expectFrameSource(
    page.locator(mobileFrame),
    /design\/browse\/views\/home\.mobile\.html$/,
  );
  await expectFrameSource(
    page.locator(desktopFrame),
    /design\/browse\/views\/home\.desktop\.html$/,
  );
  await expect(page.locator(".mbk-frame-mobile")).toHaveAttribute(
    "data-color-scheme-fallback",
    "",
  );
  const note = page.locator(".mbk-frame-mobile .mbk-frame-scheme-note");
  await expect(note).toBeVisible();
  await expect(note).toHaveText("— Light only");
  expect(
    await computedStyle(
      page,
      ".mbk-frame-mobile .mbk-frame-label",
      "textTransform",
    ),
  ).toBe("uppercase");
  await expect(
    page.locator(".mbk-frame-desktop .mbk-frame-scheme-note"),
  ).toBeVisible();
  expect(
    await overlayStyle(page, ".mbk-frame-mobile .phone-screen", "boxShadow"),
  ).toBe("none");

  await chooseScheme(page, "light");
  await expect(note).toBeHidden();
});

test("use-case steps follow the selected scheme without a caption", async ({
  page,
}) => {
  await page.goto("/view/screens/welcome.html");
  await chooseScheme(page, "dark");
  await page.fill("[data-mokly-search]", "tour");
  await page.click(tourRow);
  await expect(page.locator("#mb-main h2")).toHaveText("Example tour");

  const steps = page.locator(".mbk-flow-screen iframe");
  await expect(steps).toHaveCount(2);
  await expectFrameSource(
    steps.nth(0),
    /screens\/welcome\.desktop\.dark\.html$/,
  );
  await expectFrameSource(
    steps.nth(1),
    /screens\/details\.desktop\.dark\.html$/,
  );
  await expect(page.locator(".mbk-flow-screen .mbk-frame-label")).toHaveCount(
    0,
  );
});

test("scheme selection survives progressive navigation", async ({ page }) => {
  await page.goto("/view/screens/welcome.html");
  await chooseScheme(page, "dark");
  await page.click(detailsRow);
  await expect(page.locator("#mb-main h2")).toHaveText("Details");
  await expectFrameSource(
    page.locator(mobileFrame),
    /screens\/details\.mobile\.dark\.html$/,
  );
  await expectFrameSource(
    page.locator(desktopFrame),
    /screens\/details\.desktop\.dark\.html$/,
  );
  await expectSchemeSelected(page, "dark");

  await page.goBack();
  await expect(page.locator("#mb-main h2")).toHaveText("Welcome");
  await expectFrameSource(
    page.locator(mobileFrame),
    /screens\/welcome\.mobile\.dark\.html$/,
  );
  await expectSchemeSelected(page, "dark");

  await page.goForward();
  await expect(page.locator("#mb-main h2")).toHaveText("Details");
  await expectFrameSource(
    page.locator(mobileFrame),
    /screens\/details\.mobile\.dark\.html$/,
  );
});

test("Appearance stays reachable at both widths", async ({ page }) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto("/view/screens/welcome.html");
  // Narrow, the control keeps its glyph and drops only its label, so search
  // and the menu keep their room.
  await expect(page.locator(appearance)).toBeVisible();
  // The control renders every face and reveals the current one, so the word is
  // measured on the face the document is actually in.
  expect(
    await computedStyle(page, `${appearance} ${face("auto")}`, "position"),
  ).toBe("absolute");
  await expect(page.locator(".mbk-search")).toBeVisible();
  await expect(page.locator("[data-mokly-menu]")).toBeVisible();

  await chooseScheme(page, "dark");
  await expectFrameSource(
    page.locator(mobileFrame),
    /screens\/welcome\.mobile\.dark\.html$/,
  );

  await page.setViewportSize({ height: 800, width: 1_280 });
  await expect(page.locator(appearance)).toBeVisible();
  expect(
    await computedStyle(page, `${appearance} ${face("dark")}`, "position"),
  ).toBe("static");
  // An explicit choice survives the width change, in the control and in the
  // document mark the previews follow.
  await expect(page.locator(appearanceSelect)).toHaveValue("dark");
  await expectSchemeSelected(page, "dark");
});

test("the catalogue home carries Appearance when narrow", async ({ page }) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto("/");
  // Home has no screen head band, so the one control has to be in the top bar.
  await expect(page.locator(".mbk-screen-head")).toHaveCount(0);
  await expect(page.locator(appearance)).toBeVisible();
  await expect(page.locator("[data-mokly-schemeswitch]")).toHaveCount(0);
});

test("ID chips copy their ID without navigating", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText(text: string) {
          (window as Window & { __copiedId?: string }).__copiedId = text;
          return Promise.resolve();
        },
      },
    });
  });
  await page.goto("/view/screens/welcome.html");
  const url = page.url();
  const idChip = page.locator("[data-copy-id]");

  await expect(idChip).toHaveText("#example-welcome");
  await idChip.hover();
  expect(
    await idChip.evaluate((element) => getComputedStyle(element).cursor),
  ).toBe("pointer");
  await page.mouse.down();
  const pressed = await idChip.evaluate((element) => {
    const style = getComputedStyle(element);
    return { boxShadow: style.boxShadow, transform: style.transform };
  });
  expect(pressed.boxShadow).not.toBe("none");
  expect(pressed.transform).not.toBe("none");
  await page.mouse.up();

  await expect
    .poll(() =>
      page.evaluate(
        () => (window as Window & { __copiedId?: string }).__copiedId,
      ),
    )
    .toBe("example-welcome");
  await expect(page).toHaveURL(url);
  await expect(page.locator("#mb-status")).toHaveText(
    "Copied ID example-welcome",
  );
});

test("the address pill copies its address from its copy icon", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText(text: string) {
          (window as Window & { __copiedUrl?: string }).__copiedUrl = text;
          return Promise.resolve();
        },
      },
    });
  });
  await page.goto("/view/screens/welcome.html");
  const icon = page.locator(".browser-bar .address-copy svg");
  await expect(icon).toBeVisible();
  const box = await icon.boundingBox();
  expect(box?.width).toBe(13);
  expect(box?.height).toBe(13);

  await icon.click();
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as Window & { __copiedUrl?: string }).__copiedUrl,
      ),
    )
    .toBe("example.test/welcome");
  await expect(page.locator(".address-copied")).toHaveText("URL copied");
});

test("the expand toggle swaps its icon while the frame is expanded", async ({
  page,
}) => {
  await page.goto("/view/screens/welcome.html");
  const expandIcon = page.locator(".browser-expand .i-expand svg");
  const collapseIcon = page.locator(".browser-expand .i-collapse svg");
  await expect(expandIcon).toBeVisible();
  await expect(collapseIcon).toBeHidden();
  const box = await expandIcon.boundingBox();
  expect(box?.width).toBe(13);
  expect(box?.height).toBe(13);

  await page.click(".browser-expand");
  await expect(expandIcon).toBeHidden();
  await expect(collapseIcon).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(expandIcon).toBeVisible();
  await expect(collapseIcon).toBeHidden();
});

test("the browser frame expands to an overlay and collapses again", async ({
  page,
}) => {
  await page.goto("/view/screens/welcome.html");
  await page.click(".browser-expand");
  await expect(page.locator(".browser-frame.is-expanded")).toBeVisible();
  expect(
    await page.evaluate(() =>
      document.body.classList.contains("frame-expanded"),
    ),
  ).toBe(true);
  await expect(page.locator(".browser-expand")).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await page.keyboard.press("Escape");
  await expect(page.locator(".browser-frame.is-expanded")).toHaveCount(0);
  await page.click(".browser-expand");
  await expect(page.locator(".browser-frame.is-expanded")).toBeVisible();
  await page.mouse.click(8, 300);
  await expect(page.locator(".browser-frame.is-expanded")).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      document.body.classList.contains("frame-expanded"),
    ),
  ).toBe(false);
  await page.click(detailsRow);
  await expect(page.locator("#mb-main h2")).toHaveText("Details");
});

test("desktop catalogue navigation resizes and remembers its width", async ({
  page,
}) => {
  await page.setViewportSize({ height: 900, width: 1_280 });
  await page.goto("/");
  const nav = page.locator("[data-mokly-nav]");
  const handle = page.locator("[data-mokly-nav-resize]");
  await expect(handle).toBeVisible();
  await expect(handle).toHaveAttribute("role", "separator");

  const start = await nav.boundingBox();
  const grip = await handle.boundingBox();
  expect(start).not.toBeNull();
  expect(grip).not.toBeNull();
  expect(start?.width).toBeCloseTo(248, 0);
  if (!start || !grip) throw new Error("navigation resize bounds unavailable");
  await page.mouse.move(grip.x + grip.width / 2, grip.y + 100);
  await page.mouse.down();
  await page.mouse.move(grip.x + grip.width / 2 + 80, grip.y + 100);
  await page.mouse.up();
  await expect
    .poll(async () => (await nav.boundingBox())?.width)
    .toBeCloseTo(328, 0);

  await page.reload();
  await expect
    .poll(async () => (await nav.boundingBox())?.width)
    .toBeCloseTo(328, 0);

  await handle.focus();
  await page.keyboard.press("Home");
  await expect
    .poll(async () => (await nav.boundingBox())?.width)
    .toBeCloseTo(192, 0);
  await page.keyboard.press("ArrowRight");
  await expect
    .poll(async () => (await nav.boundingBox())?.width)
    .toBeCloseTo(208, 0);
  await page.keyboard.press("End");
  await expect
    .poll(async () => (await nav.boundingBox())?.width)
    .toBeCloseTo(480, 0);
  await expect(handle).toHaveAttribute("aria-valuenow", "480");
});

test("narrow viewports collapse navigation into a drawer", async ({ page }) => {
  await page.setViewportSize({ height: 900, width: 420 });
  await page.goto("/");
  await expect(page.locator("[data-mokly-nav]")).toBeHidden();
  await expect(page.locator("[data-mokly-nav-resize]")).toBeHidden();
  await page.click("[data-mokly-menu]");
  await expect(page.locator("[data-mokly-nav]")).toBeVisible();
  await expect(page.locator("[data-mokly-menu]")).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  expect(await computedStyle(page, ".mbk-topbar", "position")).toBe("relative");
  expect(await computedStyle(page, ".mbk-topbar", "zIndex")).toBe("11");
  await openScreensGroup(page);
  await page.click(welcomeRow);
  await expect(page.locator("#mb-main h2")).toHaveText("Welcome");
  await expect(page.locator("[data-mokly-nav]")).toBeHidden();
});

test("the narrow search bar drops the name and fits its controls", async ({
  page,
}) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto("/");

  const bar = await page.locator(".mbk-topbar").evaluate((element) => ({
    client: element.clientWidth,
    scroll: element.scrollWidth,
  }));
  expect(bar.scroll).toBeLessThanOrEqual(bar.client);
  await expect(page.locator(".mbk-brand .mbk-mark")).toBeVisible();
  await expect(page.locator(".mbk-brand .mbk-mark svg")).toBeVisible();
  await expect(page.locator(".mbk-brand .mbk-mark")).toHaveCSS("width", "24px");
  await expect(page.locator(".mbk-brand .mbk-mark svg")).toHaveCSS(
    "width",
    "17px",
  );
  await expect(page.locator(".mbk-brand .mbk-name")).toBeHidden();
  await expect(page.getByRole("link", { name: "Mokly" })).toBeVisible();
  await expect(page.locator("[data-mokly-menu]")).toBeVisible();
  await expect(page.locator("[data-mokly-search]")).toBeVisible();

  const modes = await page.locator(".mbk-search").boundingBox();
  if (!modes) throw new Error("the search must be laid out");
  expect(modes.x).toBeGreaterThanOrEqual(0);
  expect(modes.x + modes.width).toBeLessThanOrEqual(390);

  await page.setViewportSize({ height: 800, width: 1_280 });
  await expect(page.locator(".mbk-brand .mbk-name")).toBeVisible();
});

test("the removed Review route keeps a usable not-found shell", async ({
  page,
}) => {
  await page.setViewportSize({ height: 844, width: 390 });
  const response = await page.goto("/review");
  expect(response?.status()).toBe(404);
  await expect(page.locator("[data-mokly-search]")).toBeVisible();
  await expect(page.locator("#mb-main h2")).toHaveText("Item not found");
});

test("missing routes keep the catalogue available", async ({ page }) => {
  await page.goto("/view/unknown.html");
  await expect(page.locator("#mb-main h2")).toHaveText("Item not found");
  await expect(page.locator("[data-mokly-nav]")).toBeVisible();
  await openScreensGroup(page);
  await page.click(welcomeRow);
  await expect(page.locator("#mb-main h2")).toHaveText("Welcome");
});

test("the shell is keyboard navigable with a skip link", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.locator(".mbk-skip-link")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#mb-main")).toBeFocused();
  await openScreensGroup(page);
  await page.locator(welcomeRow).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#mb-main h2")).toHaveText("Welcome");
  await expect(page.locator("#mb-main")).toBeFocused();
});

test("the shell works without JavaScript", async ({ baseURL, browser }) => {
  if (!baseURL) throw new Error("Playwright baseURL is required");
  const context = await browser.newContext({
    baseURL,
    javaScriptEnabled: false,
  });
  const page = await context.newPage();
  await page.goto("/");
  await page
    .locator(
      'details[data-nav-collection="collection:example-screens"] summary',
    )
    .click();
  await page.click(welcomeRow);
  await expect(page).toHaveURL(/welcome\.html$/);
  await expect(page.locator("#mb-main h2")).toHaveText("Welcome");
  await expect(page.locator(".mbk-frame-mobile")).toBeVisible();
  await expect(page.locator(".mbk-frame-desktop")).toBeVisible();
  await context.close();
});

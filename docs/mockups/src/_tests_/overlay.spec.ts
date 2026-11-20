import { pathToFileURL } from "node:url";

import { expect, test } from "@playwright/test";

import { githubAccounts, token } from "../fixtures/product";

import { screenFile } from "./catalogue-paths";
import { checkDiskOverlay } from "./disk-overlay-policy";
import { documentViolations } from "./document-policy";
import { viewerDocumentViolations } from "./viewer-document-policy";

/** The mobile settings layer, which a compact row menu's sheet covers whole. */
const settingsLayer = {
  viewport: "mobile",
  role: "region",
  width: 390,
  height: 844,
} as const;

/**
 * The settings frame beneath a confirmation modal: the desktop dialog or the
 * mobile layer, each drawn by its own registered frame.
 */
const settingsFrames = [
  { viewport: "desktop", role: "dialog", width: 1440, height: 900 },
  settingsLayer,
] as const;

/** The two panes that draw a row menu open, each with the row it names. */
const openRowMenus = [
  { path: "product/settings/tokens/revoke/menu", row: token.name },
  { path: "product/settings/github/menu", row: githubAccounts[0].name },
] as const;

for (const { viewport, role, width, height } of settingsFrames)
  test(
    "a settings confirmation keeps focus out of the frame beneath: " + viewport,
    async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto(
        pathToFileURL(screenFile("product/settings/tokens/revoke", viewport))
          .href,
      );
      // The frame beneath is hidden from assistive technology, so only a
      // locator that includes hidden elements still finds its controls.
      const frame = page.getByRole(role, {
        name: "Settings",
        exact: true,
        includeHidden: true,
      });
      const beneath = frame
        .getByRole("link", { includeHidden: true })
        .or(frame.getByRole("button", { includeHidden: true }));
      const modal = page.getByRole("dialog", {
        name: "Revoke GitHub Actions?",
        exact: true,
      });
      const answers = modal.getByRole("link").or(modal.getByRole("button"));
      await expect(beneath).not.toHaveCount(0);
      for (const control of await beneath.all()) {
        await control.focus();
        await expect(control).not.toBeFocused();
      }
      await expect(answers).not.toHaveCount(0);
      for (const control of await answers.all()) {
        await control.focus();
        await expect(control).toBeFocused();
      }
    },
  );

test("an open mobile row menu keeps focus out of the settings layer beneath", async ({
  page,
}) => {
  const { viewport, role, width, height } = settingsLayer;
  await page.setViewportSize({ width, height });
  for (const { path, row } of openRowMenus) {
    await page.goto(pathToFileURL(screenFile(path, viewport)).href);
    // The layer beneath the sheet is hidden from assistive technology, so only
    // a locator that includes hidden elements still finds its Back link.
    const back = page
      .getByRole(role, { name: "Settings", exact: true, includeHidden: true })
      .getByRole("link", {
        name: "Settings",
        exact: true,
        includeHidden: true,
      });
    const cancel = page
      .getByRole("dialog", { name: "Actions for " + row, exact: true })
      .getByRole("button", { name: "Cancel", exact: true });
    await back.focus();
    await expect(back, path + ": the Back link beneath").not.toBeFocused();
    await cancel.focus();
    await expect(cancel, path + ": the sheet's Cancel").toBeFocused();
  }
});

test("viewer document policy rejects a backdrop without inert", async ({
  page,
}) => {
  await page.goto(
    pathToFileURL(screenFile("product/viewer/history", "desktop")).href,
  );
  expect(await page.evaluate(viewerDocumentViolations)).toEqual([]);
  await page
    .locator(".fo-viewer-backdrop")
    .evaluate((backdrop) => backdrop.removeAttribute("inert"));
  expect(await page.evaluate(viewerDocumentViolations)).toContain(
    "the viewer beneath must be inert",
  );
  expect(await page.evaluate(documentViolations)).toContain(
    "the viewer beneath must be inert",
  );
});

test("backdrop focus policy rejects hidden controls and accepts inert controls", async ({
  page,
}) => {
  const fixture =
    '<main><h1>Fixture</h1><div aria-hidden="true"><a href="#panel">Skip to content</a><button>Hidden action</button><input aria-label="Hidden input"></div><button id="panel">Panel</button></main>';
  await page.setContent(fixture);
  expect(await page.evaluate(documentViolations)).toEqual([
    "aria-hidden subtree accepts focus",
    "aria-hidden subtree accepts focus",
    "aria-hidden subtree accepts focus",
  ]);
  await page.setContent(
    fixture.replace('aria-hidden="true"', 'aria-hidden="true" inert'),
  );
  expect(await page.evaluate(documentViolations)).toEqual([]);
});

for (const control of [
  "<button>Hidden</button>",
  '<input aria-label="Hidden" />',
  '<a href="#visible">Hidden</a>',
  '<select aria-label="Hidden"><option>Hidden</option></select>',
  '<textarea aria-label="Hidden"></textarea>',
  "<details><summary>Hidden</summary></details>",
  '<div tabindex="-1">Hidden</div>',
  "<div contenteditable>Hidden</div>",
  '<svg tabindex="0" aria-label="Hidden"></svg>',
])
  test(
    "document policy rejects focus under a renamed hidden subtree: " + control,
    async ({ page }) => {
      await page.setContent(
        '<main><h1>Fixture</h1><div class="renamed-backdrop extra" aria-hidden="true">' +
          control +
          '</div><button id="visible">Visible</button></main>',
      );
      expect(await page.evaluate(documentViolations)).toContain(
        "aria-hidden subtree accepts focus",
      );
    },
  );

test("document policy rejects a hidden focusable root and nested aria-hidden false", async ({
  page,
}) => {
  for (const hidden of [
    '<div aria-hidden="true" tabindex="0">Hidden</div>',
    '<div aria-hidden="true"><div aria-hidden="false"><button>Hidden</button></div></div>',
  ]) {
    await page.setContent("<main><h1>Fixture</h1>" + hidden + "</main>");
    expect(await page.evaluate(documentViolations)).toContain(
      "aria-hidden subtree accepts focus",
    );
  }
});

test("document policy accepts inert descendants, inert ancestors and disabled controls", async ({
  page,
}) => {
  for (const hidden of [
    '<div aria-hidden="true" inert><button>Hidden</button></div>',
    '<div inert><div aria-hidden="true"><button>Hidden</button></div></div>',
    '<div aria-hidden="true"><div inert><button>Hidden</button></div></div>',
    '<div aria-hidden="true"><button disabled>Hidden</button><input disabled /></div>',
  ]) {
    await page.setContent(
      "<main><h1>Fixture</h1>" +
        hidden +
        '<button id="visible">Visible</button></main>',
    );
    await page.locator("#visible").focus();
    expect(await page.evaluate(documentViolations)).toEqual([]);
    await expect(page.locator("#visible")).toBeFocused();
  }
});

for (const later of [false, true])
  test(
    "the shared disk guard rejects Tab outside the viewer panel: " +
      (later ? "later control" : "first control"),
    async ({ page }) => {
      await page.setContent(
        '<main><h1>Fixture</h1><div class="fo-viewer-backdrop" aria-hidden="true" inert><button>Hidden</button></div><button ' +
          (later ? 'tabindex="2"' : "") +
          '>Outside</button><section class="fo-viewer-surface" role="dialog" aria-modal="true"><button ' +
          (later ? 'tabindex="1"' : "") +
          ">Close</button><button " +
          (later ? 'tabindex="3"' : "") +
          ">Action</button></section></main>",
      );
      await expect(checkDiskOverlay(page)).rejects.toThrow(
        "Tab must stay in the viewer panel",
      );
    },
  );

test("the shared disk guard accepts disabled controls inside the panel", async ({
  page,
}) => {
  await page.setContent(
    '<main><h1>Fixture</h1><div class="fo-viewer-backdrop" aria-hidden="true" inert><button>Hidden</button></div><section class="fo-viewer-surface" role="dialog" aria-modal="true"><button>Close</button><button disabled>Disabled</button><button>Action</button></section></main>',
  );
  await checkDiskOverlay(page);
});

test("default body focus is not a focusable control in a hidden subtree", async ({
  page,
}) => {
  await page.setContent(
    '<body aria-hidden="true"><main><h1>Fixture</h1><p>Hidden text</p></main></body>',
  );
  expect(await page.evaluate(documentViolations)).not.toContain(
    "aria-hidden subtree accepts focus",
  );
});

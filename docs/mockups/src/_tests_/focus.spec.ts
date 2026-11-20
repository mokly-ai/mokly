import { resolve } from "node:path";

import { tokens } from "@mokly-cloud/tokens/tokens";
import { expect, test } from "@playwright/test";

import { focusPolicyViolations, markFocusTargets } from "./focus-policy";

/** The shared stylesheet that owns the focus rule. */
const base = resolve(import.meta.dirname, "../../styles/base.css");

/**
 * A build card's two focus targets, as the catalogue draws them: the title
 * that takes focus after Cancel and the output box a keyboard reader scrolls.
 */
const card =
  "<main><h1>Fixture</h1>" +
  '<h2 class="fo-state-title" tabindex="-1">Publishing was cancelled</h2>' +
  '<button type="button">Try again</button>' +
  '<div class="fo-build-log" role="region" aria-label="Output" tabindex="0">' +
  "<pre>$ npm ci</pre></div></main>";

/** The token values the shared rule reads, as the catalogue's documents set them. */
function tokenStyle(scheme: "light" | "dark"): string {
  return (
    ":root { --mk-color-focus: " +
    tokens.color[scheme].focus +
    "; --mk-radius-tight: " +
    tokens.radius.tight +
    "; }"
  );
}

for (const scheme of ["light", "dark"] as const) {
  test(
    "the focus policy rejects targets without the shared rule: " + scheme,
    async ({ page }) => {
      await page.setContent(card);
      await page.addStyleTag({ content: tokenStyle(scheme) });
      const problems = await focusPolicyViolations(page, scheme);
      for (const name of ["h2.fo-state-title", "div.fo-build-log"])
        expect(
          problems.some((problem) => problem.startsWith(name + " draws ")),
          name,
        ).toBe(true);
    },
  );

  test(
    "the shared rule draws the token outline on every target: " + scheme,
    async ({ page }) => {
      await page.setContent(card);
      await page.addStyleTag({ content: tokenStyle(scheme) });
      await page.addStyleTag({ path: base });
      expect(await focusPolicyViolations(page, scheme)).toEqual([]);
    },
  );
}

test("the focus policy answers only for elements tabindex makes focusable", async ({
  page,
}) => {
  await page.setContent(
    "<main><h1>Fixture</h1>" +
      '<a href="#here" tabindex="0">Link</a>' +
      '<iframe title="Frame" tabindex="-1"></iframe>' +
      '<div class="firna-view" role="button" tabindex="0">Control</div>' +
      '<input class="firna-textinput" tabindex="0" aria-label="Field" />' +
      '<div class="mbk mokly-viewer" tabindex="-1">' +
      '<main class="mbk-main" tabindex="-1">Stage</main>' +
      '<div class="mbk-nav-resize" role="separator" tabindex="0"></div>' +
      '<div data-mokly-slot="stageOverlay">' +
      '<div class="fo-slot" role="region" aria-label="Slot" tabindex="0">Slot</div>' +
      "</div></div>" +
      '<div class="fo-hidden" role="region" aria-label="Hidden" tabindex="0" hidden></div>' +
      '<div inert><div class="fo-inert" role="region" aria-label="Inert" tabindex="0">Inert</div></div>' +
      '<h2 class="fo-title" tabindex="-1">Title</h2>' +
      "</main>",
  );
  expect(
    (await page.evaluate(markFocusTargets, "data-fixture-probe")).map(
      ({ name, negative }) => [name, negative],
    ),
  ).toEqual([
    ["div.fo-slot", false],
    ["h2.fo-title", true],
  ]);
});

test("the shared rule leaves registered controls and the package's interface alone", async ({
  page,
}) => {
  await page.setContent(
    "<main><h1>Fixture</h1>" +
      '<div class="firna-view" role="button" tabindex="0">Control</div>' +
      '<div class="mbk mokly-viewer" tabindex="-1">' +
      '<main class="mbk-main" tabindex="-1">Stage</main>' +
      '<div data-mokly-slot="stageOverlay">' +
      '<div class="fo-slot" role="region" aria-label="Slot" tabindex="0">Slot</div>' +
      "</div></div></main>",
  );
  await page.addStyleTag({ content: tokenStyle("light") });
  await page.addStyleTag({ path: base });
  const drawn = async (selector: string) => {
    await page.keyboard.press("Tab");
    await page.locator(selector).focus();
    return page
      .locator(selector)
      .evaluate((node) => [
        node.matches(":focus-visible"),
        getComputedStyle(node).outlineStyle,
      ]);
  };
  // Each is focused from the keyboard; only the cloud's slot content takes
  // the shared outline, and the others keep the browser's own ring.
  expect(await drawn(".firna-view")).toEqual([true, "auto"]);
  expect(await drawn(".mokly-viewer")).toEqual([true, "auto"]);
  expect(await drawn(".mbk-main")).toEqual([true, "auto"]);
  expect(await drawn(".fo-slot")).toEqual([true, "solid"]);
});

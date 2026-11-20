import path from "node:path";

import { expect, type Locator } from "@playwright/test";

import { repositoryRoot } from "../helpers/fixture.js";

import { test } from "./browser_test.js";
import { designFileUrl } from "./design_fixture.js";
import { documentFavicon } from "./document_error_allowance.js";

const NO_FILL = "rgba(0, 0, 0, 0)";
const SELECTED_FILL = "rgb(79, 120, 100)";

function rowFill(row: Locator): Promise<string> {
  return row.evaluate(
    (node) => getComputedStyle(node, "::before").backgroundColor,
  );
}

test.use({
  colorScheme: "light",
  javaScriptEnabled: false,
  viewport: { width: 1440, height: 1000 },
});

test.beforeEach(({ allowBrowserError, baseURL }) => {
  documentFavicon(allowBrowserError, baseURL!);
});

test("a depicted tree row keeps its resting fill and default cursor during hover and press", async ({
  page,
}) => {
  const url = designFileUrl(
    path.join(
      repositoryRoot,
      "examples/basic/mokly-generated",
      "design/browse/variants/variant-selected/index.desktop.html",
    ),
  );
  await page.goto(url.href);
  const navigation = page.getByRole("navigation", { name: "Catalogue" });
  const picture = navigation.getByText("Save failed");
  const selected = navigation.getByRole("link", {
    name: "Empty workspace",
    exact: true,
  });
  await expect(picture).toBeVisible();
  await expect(picture).not.toHaveAttribute("href");
  await expect(selected).toHaveAttribute("aria-current", "page");
  await expect.poll(() => rowFill(picture)).toBe(NO_FILL);
  await expect.poll(() => rowFill(selected)).toBe(SELECTED_FILL);

  await picture.scrollIntoViewIfNeeded();
  const box = await picture.boundingBox();
  if (!box) throw new Error("The Save failed row has no visible bounds");
  const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(point.x, point.y);
  await expect.poll(() => rowFill(picture)).toBe(NO_FILL);
  await expect(picture).toHaveCSS("cursor", "default");
  await expect
    .poll(() =>
      picture.evaluate((node, position) => {
        const target = node.ownerDocument.elementFromPoint(
          position.x,
          position.y,
        );
        return target === null ? null : getComputedStyle(target).cursor;
      }, point),
    )
    .toMatch(/^(auto|default)$/u);

  await page.mouse.down();
  try {
    await expect.poll(() => rowFill(picture)).toBe(NO_FILL);
    await expect.poll(() => rowFill(selected)).toBe(SELECTED_FILL);
  } finally {
    await page.mouse.up();
  }
  await expect(page).toHaveURL(url.href);
  await expect(selected).toHaveAttribute("aria-current", "page");

  const screens = navigation.getByText("Screens", { exact: true });
  await screens.click();
  await expect(picture).toBeHidden();
  await screens.click();
  await expect(picture).toBeVisible();

  const profile = navigation.getByRole("link", {
    name: "Profile",
    exact: true,
  });
  const chevron = navigation.getByRole("img", {
    name: "Show contents of Profile",
    exact: true,
  });
  await expect(profile).toBeVisible();
  await expect(chevron).toBeVisible();
  await chevron.scrollIntoViewIfNeeded();
  const chevronBox = await chevron.boundingBox();
  if (!chevronBox) throw new Error("The Profile chevron has no visible bounds");
  const chevronPoint = {
    x: chevronBox.x + chevronBox.width / 2,
    y: chevronBox.y + chevronBox.height / 2,
  };
  await page.mouse.move(chevronPoint.x, chevronPoint.y);
  await expect.poll(() => rowFill(profile)).toBe(NO_FILL);
  await expect(chevron).toHaveCSS("cursor", "default");
  await expect
    .poll(() =>
      chevron.evaluate((node, position) => {
        const target = node.ownerDocument.elementFromPoint(
          position.x,
          position.y,
        );
        return {
          cursor: target === null ? null : getComputedStyle(target).cursor,
          link: target?.closest("a")?.getAttribute("href") ?? null,
        };
      }, chevronPoint),
    )
    .toEqual({
      cursor: expect.stringMatching(/^(auto|default)$/u),
      link: null,
    });
  await page.mouse.down();
  try {
    await expect.poll(() => rowFill(profile)).toBe(NO_FILL);
    await expect.poll(() => rowFill(selected)).toBe(SELECTED_FILL);
  } finally {
    await page.mouse.up();
  }
  await expect(page).toHaveURL(url.href);
  await expect(selected).toHaveAttribute("aria-current", "page");

  await profile.hover();
  await expect(profile).toHaveCSS("cursor", "pointer");
  await expect.poll(() => rowFill(profile)).toBe("rgba(79, 120, 100, 0.1)");
  await profile.click();
  await expect(page).toHaveURL(
    designFileUrl(
      path.join(
        repositoryRoot,
        "examples/basic/mokly-generated",
        "design/browse/index-entries/screen/index.desktop.html",
      ),
    ).href,
  );
});

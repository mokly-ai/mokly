/**
 * The selected look of a tag chip in the shell stylesheet, which bundles the
 * `@mokly/ui` rules: a link, a toggle button, and the picture of a static
 * depiction show the selection alike, and the pointer's hover fill stays on
 * resting links and buttons.
 */

import fs from "node:fs/promises";

import { expect } from "@playwright/test";
import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { TagChip } from "@mokly/ui/tag-chip";

import { test } from "./browser_test.js";

/** The Light palette's accent, the ink on it, and its soft hover fill. */
const ACCENT = "rgb(79, 120, 100)";
const ON_ACCENT = "rgb(255, 255, 255)";
const ACCENT_SOFT = "rgba(79, 120, 100, 0.1)";
/** The resting chip's fill. */
const CHIP_FILL = "rgb(244, 244, 241)";

test.use({ colorScheme: "light" });

test("a selected tag chip fills with the accent as a link, a button, and a picture, and hover never lowers it", async ({
  page,
}) => {
  const css = await fs.readFile(
    new URL("../../packages/viewer/dist/shell.css", import.meta.url),
    "utf8",
  );
  const chips = renderToStaticMarkup(
    createElement(
      Fragment,
      null,
      createElement(TagChip, { href: "#forms", selected: true, tag: "forms" }),
      createElement(TagChip, { selected: true, tag: "onboarding" }),
      createElement(TagChip, {
        interactive: false,
        selected: true,
        tag: "documents",
      }),
      createElement(TagChip, { selected: false, tag: "guides" }),
      createElement(TagChip, {
        interactive: false,
        selected: false,
        tag: "drafts",
      }),
    ),
  );
  await page.setContent(
    `<html><head><style>${css}</style></head><body>${chips}</body></html>`,
  );
  const link = page.getByRole("link", { name: "forms" });
  const button = page.getByRole("button", { name: "onboarding" });
  const picture = page.getByText("documents", { exact: true });
  for (const chip of [link, button, picture]) {
    await expect(chip).toHaveCSS("background-color", ACCENT);
    await expect(chip).toHaveCSS("border-top-color", ACCENT);
    await expect(chip).toHaveCSS("color", ON_ACCENT);
    await expect(chip.locator("svg")).toHaveCSS("color", ON_ACCENT);
  }

  const resting = page.getByRole("button", { name: "guides" });
  await resting.hover();
  await expect(resting).toHaveCSS("background-color", ACCENT_SOFT);
  for (const chip of [link, button]) {
    await chip.hover();
    await expect(chip).toHaveCSS("background-color", ACCENT);
  }
  const restingPicture = page.getByText("drafts", { exact: true });
  await restingPicture.hover();
  await expect(restingPicture).toHaveCSS("background-color", CHIP_FILL);
});

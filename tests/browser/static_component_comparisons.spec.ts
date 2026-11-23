import { expect } from "@playwright/test";

import { accentColor } from "../helpers/comparison_catalogue.js";

import { comparisonSection, paneFrame } from "./comparison_sections.js";
import {
  COMPARE_MODES,
  expectSectionMode,
} from "./comparison_static_frames.js";
import { comparisonPaths, test } from "./comparison_test.js";
import { chooseMode, comparisonFrames } from "./comparison_ui.js";
import { inspectTitle } from "./inspect_head.js";
import { staticRequests } from "./static_delivery_assertions.js";
import { setFrames } from "./workspace_actions.js";

// A variant set's frames show each row's desktop view, so a component
// compares its desktop views.
for (const scheme of ["light", "dark"] as const) {
  for (const label of ["Side by side", "Overlay", "Difference"] as const) {
    test(`desktop/${scheme}: a copied component comparison presents ${label} with each side's styles`, async ({
      page,
    }) => {
      const requests = staticRequests(page);
      await page.goto(`/view/${comparisonPaths.component}/`);
      await expect(inspectTitle(page)).toHaveText("Card");
      // The Frames filter shows the frames of one scheme; the parent's
      // comparison holds its own example's frame of that scheme.
      await setFrames(page, {
        light: scheme === "light",
        dark: scheme === "dark",
      });
      await chooseMode(page, label);
      const section = comparisonSection(page, "component", scheme);
      await expectSectionMode(
        section,
        COMPARE_MODES[label],
        `Card · ${scheme === "dark" ? "Dark" : "Light"}`,
      );
      await expect(comparisonFrames(page)).toHaveCount(2);
      for (const [title, color, side] of [
        ["Before", accentColor.Before, "before"],
        ["Current", accentColor.After, "after"],
      ] as const) {
        const frame = paneFrame(section, side);
        await expect(frame).toHaveAttribute(
          "title",
          `${title} — desktop — ${scheme}`,
        );
        await expect(frame).toHaveAttribute("sandbox", "allow-same-origin");
        await expect(frame).toHaveAttribute(
          "data-mokly-preview-source",
          new RegExp(
            `/snapshots/${side}/mokly-generated/components/card/index\\.desktop${scheme === "dark" ? "\\.dark" : ""}\\.html$`,
          ),
        );
        await expect(
          frame
            .contentFrame()
            .getByRole("heading", { name: "Card content", exact: true }),
        ).toBeVisible();
        await expect(frame.contentFrame().locator(".accent")).toHaveCSS(
          "color",
          color,
        );
      }
      requests.assert();
    });
  }
}

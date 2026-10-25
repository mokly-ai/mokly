import { expect } from "@playwright/test";

import { accentColor } from "../helpers/comparison_catalogue.js";

import { comparisonPaths, test } from "./comparison_test.js";
import { staticRequests } from "./static_delivery_assertions.js";
import { chooseScheme } from "./workspace_actions.js";

for (const viewport of ["mobile", "desktop"] as const) {
  for (const scheme of ["light", "dark"] as const) {
    for (const [mode, label] of [
      ["side", "Side by side"],
      ["overlay", "Overlay"],
      ["difference", "Difference"],
    ] as const) {
      test(`${viewport}/${scheme}: a copied component comparison presents ${label} with each side's styles`, async ({
        page,
      }) => {
        const requests = staticRequests(page);
        await page.goto(
          `/view/${comparisonPaths.component}/?viewport=${viewport}`,
        );
        await expect(page.locator("#mb-main h2").first()).toHaveText("Card");
        await chooseScheme(page, scheme);
        await page.getByRole("button", { name: label, exact: true }).click();
        const panes = page.locator(
          `[data-diff-viewport="${viewport}"] [data-compare-mode]`,
        );
        await expect(panes).toHaveAttribute("data-compare-mode", mode);
        await expect(
          panes.locator("iframe[data-mokly-comparison-frame]"),
        ).toHaveCount(2);
        for (const [title, color, side] of [
          ["Before", accentColor.Before, "before"],
          ["Current", accentColor.After, "after"],
        ] as const) {
          const frame = panes.locator(
            `iframe[title="${title} — ${viewport} — ${scheme}"]`,
          );
          await expect(frame).toHaveAttribute("sandbox", "allow-same-origin");
          await expect(frame).toHaveAttribute(
            "data-mokly-preview-source",
            new RegExp(
              `/snapshots/${side}/mokly-generated/components/card/index\\.${viewport}${scheme === "dark" ? "\\.dark" : ""}\\.html$`,
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
}

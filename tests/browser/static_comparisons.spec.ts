import { expect } from "@playwright/test";

import { comparisonSection, paneFrame } from "./comparison_sections.js";
import {
  COMPARE_MODES,
  comparedViewports,
  expectSectionMode,
} from "./comparison_static_frames.js";
import { comparisonPaths, test } from "./comparison_test.js";
import { chooseMode, comparisonFrames, modeButton } from "./comparison_ui.js";
import { inspectTitle } from "./inspect_head.js";
import { staticRequests } from "./static_delivery_assertions.js";
import { chooseViewport, setFrames } from "./workspace_actions.js";

/** The frame names of each viewport and scheme, as the canvas labels them. */
const NAMES = { desktop: "Desktop", mobile: "Mobile" } as const;
const SCHEMES = { dark: "Dark", light: "Light" } as const;

for (const viewport of ["mobile", "desktop", "both"] as const) {
  for (const scheme of ["light", "dark"] as const) {
    for (const label of ["Side by side", "Overlay", "Difference"] as const) {
      test(`${viewport}/${scheme}: a copied native comparison presents ${label}`, async ({
        page,
        request,
        baseURL,
      }) => {
        const index = await (
          await request.get(`${baseURL}/mokly-viewer/index.json`)
        ).json();
        expect(index.changesStatus).toBe("ready");
        expect(index.comparisonUrl).toMatch(
          /^mokly-viewer\/diffs\/generations\/[a-f0-9]{64}\/$/,
        );
        expect(index).not.toHaveProperty("live");
        const requests = staticRequests(page);
        await page.goto(`/view/${comparisonPaths.changed}/`);
        await expect(inspectTitle(page)).toHaveText("Changed screen");
        // The Frames filter shows the viewport's frames of one scheme.
        await chooseViewport(page, viewport);
        await setFrames(page, {
          light: scheme === "light",
          dark: scheme === "dark",
        });
        await chooseMode(page, label);
        const mode = COMPARE_MODES[label];
        // The stacked modes compare every shown frame, and Side by side the
        // first one, each with both versions.
        const compared = comparedViewports(1280, viewport, mode);
        await expect(comparisonFrames(page)).toHaveCount(compared.length * 2);
        const generation = new URL(index.comparisonUrl, baseURL).href;
        for (const paneViewport of compared) {
          const section = comparisonSection(page, paneViewport, scheme);
          await expectSectionMode(
            section,
            mode,
            `${NAMES[paneViewport]} · ${SCHEMES[scheme]}`,
          );
          const file = `index.${paneViewport}${scheme === "dark" ? ".dark" : ""}.html`;
          for (const [side, title, text] of [
            ["before", "Before", "Before screen"],
            ["after", "Current", "After screen"],
          ] as const) {
            const frame = paneFrame(section, side);
            await expect(frame).toHaveAttribute(
              "title",
              `${title} — ${paneViewport} — ${scheme}`,
            );
            await expect(frame).toHaveAttribute(
              "data-mokly-preview-source",
              `${generation}snapshots/${side}/mokly-generated/${comparisonPaths.changed}/${file}`,
            );
            await expect(frame).toHaveAttribute("sandbox", "allow-same-origin");
            await expect(frame).not.toHaveAttribute("src");
            await expect(
              frame
                .contentFrame()
                .getByRole("heading", { name: text, exact: true }),
            ).toBeVisible();
          }
          if (mode === "overlay")
            await expect(section.locator(".mb-pane--after")).toHaveCSS(
              "opacity",
              "0.5",
            );
          if (mode === "difference")
            await expect(section.locator(".mb-pane--after")).toHaveCSS(
              "mix-blend-mode",
              "difference",
            );
        }
        await expect(modeButton(page, label)).toHaveAttribute(
          "aria-pressed",
          "true",
        );
        requests.assert();
      });
    }
  }
}

test("a copied comparison reload keeps its non-null generation URL and loads the same snapshots", async ({
  page,
  request,
  baseURL,
}) => {
  const indexUrl = `${baseURL}/mokly-viewer/index.json`;
  const before = await (await request.get(indexUrl)).json();
  expect(before.comparisonUrl).not.toBeNull();
  const requests = staticRequests(page);
  await page.goto(
    `/view/${comparisonPaths.changed}/?viewport=desktop&comparison=side`,
  );
  await expect(
    page.locator(
      '[data-compare-mode="side"] iframe[data-mokly-comparison-frame]',
    ),
  ).toHaveCount(2);
  const source = await page
    .locator("iframe[data-mokly-comparison-frame]")
    .evaluateAll((frames) =>
      frames.map((frame) => frame.getAttribute("data-mokly-preview-source")),
    );
  await page.reload();
  await expect(
    page.locator(
      '[data-compare-mode="side"] iframe[data-mokly-comparison-frame]',
    ),
  ).toHaveCount(2);
  await expect
    .poll(() =>
      page
        .locator("iframe[data-mokly-comparison-frame]")
        .evaluateAll((frames) =>
          frames.map((frame) =>
            frame.getAttribute("data-mokly-preview-source"),
          ),
        ),
    )
    .toEqual(source);
  const after = await (await request.get(indexUrl)).json();
  expect(after.comparisonUrl).toBe(before.comparisonUrl);
  expect(after.deploymentId).toBe(before.deploymentId);
  // Each load reads the same generation's pane documents once.
  for (const address of source)
    expect(requests.urls.filter((url) => url === address)).toHaveLength(2);
  requests.assert();
});

import { expect } from "@playwright/test";

import { files } from "../helpers/static_faults.js";

import { refreshButton } from "./comparison_band.js";
import {
  copiedBytes,
  deliveryIndex,
  deliveryRequests,
} from "./comparison_delivery_assertions.js";
import { comparisonSection, paneFrame } from "./comparison_sections.js";
import {
  comparedViewports,
  expectSectionMode,
} from "./comparison_static_frames.js";
import {
  comparisonPaths,
  copiedComparisonDirectory,
  test,
} from "./comparison_test.js";
import {
  chooseMode,
  COMPARE_MODES,
  comparisonFrames,
  type CompareMode,
} from "./comparison_ui.js";
import {
  chooseViewport,
  openPanelTab,
  setFrames,
  viewportFrame,
} from "./workspace_actions.js";

/** The frame names of each viewport and scheme, as the canvas labels them. */
const NAMES = { desktop: "Desktop", mobile: "Mobile" } as const;
const SCHEMES = { dark: "Dark", light: "Light" } as const;

test("1280px: copied comparisons read lazily and Refresh re-reads the same immutable generation", async ({
  page,
  request,
  baseURL,
}) => {
  const directory = copiedComparisonDirectory();
  const before = await files(directory);
  const { generation } = await deliveryIndex(request, baseURL!);
  const traffic = deliveryRequests(page);
  /**
   * Expect the shown frames of `scheme` to compare in `mode`: each frame
   * that the mode compares holds both versions, and each version's
   * document was read `reads` times. The canvas shows the mode only while
   * Changes is the selected tab, and the Frames filter stands in Inspect,
   * so Changes is selected first.
   */
  const expectSelection = async (
    viewport: "mobile" | "desktop" | "both",
    scheme: "light" | "dark",
    mode: CompareMode,
    reads = 1,
  ) => {
    await openPanelTab(page, "Changes");
    const views = comparedViewports(1280, viewport, mode);
    await expect(comparisonFrames(page)).toHaveCount(views.length * 2);
    await expect(page.locator(`[data-diff-mode="${mode}"]`)).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    for (const view of views) {
      const section = comparisonSection(page, view, scheme);
      await expectSectionMode(
        section,
        mode,
        `${NAMES[view]} · ${SCHEMES[scheme]}`,
      );
      const file = `index.${view}${scheme === "dark" ? ".dark" : ""}.html`;
      for (const [side, text] of [
        ["before", "Before screen"],
        ["after", "After screen"],
      ] as const) {
        const frame = paneFrame(section, side);
        const document = `${generation}snapshots/${side}/mokly-generated/${comparisonPaths.changed}/${file}`;
        await expect(frame).toHaveAttribute(
          "data-mokly-preview-source",
          document,
        );
        await expect(frame.contentFrame().locator("h1")).toHaveText(text);
        await expect
          .poll(() => traffic.urls.filter((url) => url === document).length)
          .toBe(reads);
      }
    }
    // A pinned generation's root is never requested; panes read snapshots.
    expect(
      traffic.urls.filter(
        (url) =>
          url.startsWith(generation) &&
          !url.startsWith(`${generation}snapshots/`),
      ),
    ).toEqual([]);
  };
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/view/${comparisonPaths.changed}/`);
  await expect(
    page.frameLocator(viewportFrame("mobile")).locator("h1"),
  ).toHaveText("After screen");
  expect(traffic.urls.filter((url) => url.includes("/diffs/"))).toEqual([]);

  // The Frames filter shows the Desktop · Light frame alone.
  await setFrames(page, {
    desktop: true,
    mobile: false,
    light: true,
    dark: false,
  });
  for (const label of ["Side by side", "Overlay", "Difference"] as const) {
    await chooseMode(page, label);
    await expectSelection("desktop", "light", COMPARE_MODES[label]);
  }
  for (const viewport of ["mobile", "both", "desktop"] as const) {
    await chooseViewport(page, viewport);
    await expectSelection(viewport, "light", "difference");
  }
  await setFrames(page, { dark: true, light: false });
  await expectSelection("desktop", "dark", "difference");
  await chooseViewport(page, "both");
  await expectSelection("both", "dark", "difference");
  // Refresh presents the same immutable generation again, so each shown
  // document is read a second time.
  await openPanelTab(page, "Changes");
  await refreshButton(page).click();
  await expectSelection("both", "dark", "difference", 2);
  for (const address of new Set(
    traffic.urls.filter((url) => url.includes("/diffs/generations/")),
  ))
    await copiedBytes(request, directory, address);
  expect(await files(directory)).toEqual(before);
  traffic.assert();
});

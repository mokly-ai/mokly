/**
 * A component's compare across its sibling variants on the copied comparison
 * output, under the variant navigation, selected comparison and comparison
 * panes contracts. A variant set compares each row whose shown views are
 * eligible, and an added variant's row keeps its current frames. Navigation
 * to a sibling variant keeps the mode and the rows' comparisons; on an added
 * sibling's route the set still offers its modes while another row compares.
 * While a mode stays chosen, Inspect shows the current frames, so Props shows
 * their controls without a comparison line, and the comparison leaves
 * highlighting alone.
 */

import { expect, type Locator, type Page } from "@playwright/test";

import { comparisonSection, paneFrame } from "./comparison_sections.js";
import { comparisonPaths, test } from "./comparison_test.js";
import {
  awaitRoutedDetail,
  chooseFilter,
  chooseMode,
  comparisonFrames,
  modeButton,
  navRow,
  showMode,
} from "./comparison_ui.js";
import {
  canvasFrame,
  openInspectFold,
  openPanelTab,
  revealInPanel,
} from "./workspace_actions.js";

/** The Highlight components switch of Inspect's Frames filter. */
function highlightSwitch(page: Page): Locator {
  return page.getByRole("switch", {
    name: "Highlight components",
    exact: true,
    includeHidden: true,
  });
}

/** Open a sibling variant through its catalogue row, which Changes lists. */
async function openSibling(page: Page, path: string): Promise<void> {
  await chooseFilter(page, "changed");
  await navRow(page, path).click();
  await awaitRoutedDetail(page, path);
}

/** The heading that a variant set's row shows in its desktop Light frame. */
function rowHeading(page: Page, path: string, name: string): Locator {
  return page
    .frameLocator(`${canvasFrame("desktop")}[data-workspace-variant="${path}"]`)
    .getByRole("heading", { name });
}

test("component comparisons follow changed variants while added variants stay current", async ({
  page,
}) => {
  await page.goto(`/view/${comparisonPaths.component}/`);
  // A variant set's frames show desktop views. Each eligible row compares its
  // Light and Dark frames, each with both versions: the own example's and the
  // changed Featured variant's. The added Fresh variant's row stays current.
  await showMode(page, "Overlay", 8);
  // The comparison details stand in the Changes tab, never on the canvas.
  await expect(
    page.locator("[data-mokly-stage] [data-workspace-evidence]"),
  ).toHaveCount(0);
  await expect(
    page
      .getByRole("tabpanel", { name: "Changes" })
      .locator("[data-workspace-evidence]"),
  ).toHaveCount(1);
  await expect(page.locator("[data-workspace-evidence]")).toHaveCount(1);
  // Inspect shows the current frames, so the comparison leaves highlighting
  // alone; Card renders no registered component.
  await revealInPanel(page, highlightSwitch(page));
  await expect(highlightSwitch(page)).toBeDisabled();
  await expect(highlightSwitch(page)).toHaveAccessibleDescription(
    "No registered components are used in this view.",
  );
  // A changed sibling keeps the mode and compares its own frames, beside
  // Card's, which the canvas shows while Changes is the selected tab.
  await openSibling(page, comparisonPaths.changedVariant);
  await openPanelTab(page, "Changes");
  const featured = paneFrame(
    comparisonSection(page, "component", "light", "Featured"),
    "after",
  );
  await expect(featured).toHaveAttribute(
    "data-mokly-preview-source",
    /card\/featured\/index\.desktop\.html$/,
  );
  await expect(
    featured.contentFrame().getByRole("heading", { name: "Featured After" }),
  ).toBeVisible();
  // The loaded comparison adds the variant's own reasons to Details.
  await expect(page.locator("[data-workspace-evidence]")).toContainText(
    "Rendered content changed.",
  );
  // Current shows the variant set, whose rows show their desktop views.
  await chooseMode(page, "Current");
  await expect(
    rowHeading(page, comparisonPaths.changedVariant, "Featured After"),
  ).toBeVisible();
  await openSibling(page, comparisonPaths.addedVariant);
  await expect(page.locator("[data-workspace-status]")).toHaveText("Added");
  // Card and Featured still compare, so the set offers its modes on Fresh's
  // route too, while Fresh's own frame stays current (decision 16 = B).
  await openPanelTab(page, "Changes");
  await expect(modeButton(page, "Overlay")).toBeVisible();
  await expect(
    rowHeading(page, comparisonPaths.addedVariant, "Fresh card"),
  ).toBeVisible();
});

test("Side by side stays authoritative while switching sibling variants", async ({
  page,
}) => {
  await page.goto(`/view/${comparisonPaths.component}/`);
  await showMode(page, "Side by side", 2);
  await openSibling(page, comparisonPaths.changedVariant);
  await openPanelTab(page, "Changes");
  await expect(modeButton(page, "Side by side")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  // Side by side compares the sibling's first frame, its Light frame.
  await expect(comparisonFrames(page).last()).toHaveAttribute(
    "data-mokly-preview-source",
    /card\/featured\/index\.desktop\.html$/,
  );
  // Inspect shows the current frames, so Props shows their controls, which a
  // static build keeps read-only, without a comparison line, and the
  // comparison leaves highlighting alone: Featured renders no registered
  // component.
  const props = await openInspectFold(page, "props");
  await expect(
    props.getByText("Open this catalogue locally to edit props.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    props.getByText("Comparisons show the saved props.", { exact: true }),
  ).toHaveCount(0);
  await expect(
    props.getByRole("button", { name: "Switch to Current", exact: true }),
  ).toHaveCount(0);
  await expect(props.getByRole("textbox")).toHaveCount(0);
  await expect(highlightSwitch(page)).toBeDisabled();
  await expect(highlightSwitch(page)).toHaveAccessibleDescription(
    "No registered components are used in this view.",
  );
});

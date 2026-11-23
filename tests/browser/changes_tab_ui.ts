/**
 * The parts of the right panel's Changes tab in a browser spec, found the
 * way a reader finds them: the tab's body, the change stepper, Compared, the
 * canvas's frames, and the requests for the comparison documents.
 */

import type { Locator, Page, Request } from "@playwright/test";

/**
 * A frame of the shown entry on the canvas: a figure that its label names,
 * such as `Desktop · Light 1280 × 800`, by the label's start.
 */
export function frameFigure(page: Page, label: string): Locator {
  return page.getByRole("figure", { name: new RegExp(`^${label} `, "u") });
}

/** The body of the Changes tab. */
export function changesPanel(scope: Page | Locator): Locator {
  return scope.getByRole("tabpanel", { name: "Changes" });
}

/** The change stepper's `Change N of M`. */
export function changeCount(scope: Page | Locator): Locator {
  return changesPanel(scope).getByText(/^Change \d+ of \d+$/u);
}

/**
 * A step of the change stepper: a link, or a disabled button at an end of
 * the list.
 */
export function changeStep(
  scope: Page | Locator,
  name: "Previous change" | "Next change",
): Locator {
  const panel = changesPanel(scope);
  return panel
    .getByRole("link", { name, exact: true })
    .or(panel.getByRole("button", { name, exact: true }));
}

/** Compared, the rail of the versions that the tab compares. */
export function comparedRail(scope: Page | Locator): Locator {
  return changesPanel(scope).getByRole("region", { name: "Compared" });
}

/**
 * Count the requests for the pane documents of the comparison generation at
 * `comparisonUrl`, the index's generation root. A document's subresources,
 * which a frame that mounts again requests again, do not count.
 */
export function comparisonDocumentRequests(
  page: Page,
  comparisonUrl: string,
): () => number {
  const documents: Request[] = [];
  page.on("request", (request) => {
    const { pathname } = new URL(request.url());
    if (
      pathname.startsWith(`/${comparisonUrl}snapshots/`) &&
      pathname.endsWith(".html")
    )
      documents.push(request);
  });
  return () => documents.length;
}

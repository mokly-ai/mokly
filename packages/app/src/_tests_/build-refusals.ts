import { tokens } from "@mokly-cloud/tokens/tokens";
import type { TokenColorScheme } from "@mokly-cloud/tokens/tokens";
import type { Page } from "@playwright/test";

import type { BuildScenario } from "./build-scenario";
import { expect, open } from "./harness";
import { build, buildPullRequest } from "./viewer/build-fixtures";

/**
 * The two refusals a pull request's Try again meets. A closed pull request
 * gets no new build, and no build runs for a fork's: neither refusal offers a
 * guide. `product/viewer/standalone/build/refused` draws the closed pull
 * request's; a fork's has the same body with the fork card's title as its
 * sentence, so it has no drawing of its own.
 */
export const refusals = {
  closed: {
    cause: "closed-pull-request",
    sentence: "This pull request is closed.",
  },
  fork: {
    cause: "fork-pull-request",
    sentence: "This pull request is from a fork.",
  },
} as const;

/** One of the two drawn refusals. */
export type RefusalKind = keyof typeof refusals;

/**
 * Open a failed pull request build and press Try again, which the double
 * refuses for the named cause, then wait for the refusal beside the control.
 */
export async function refuseTryAgain(
  page: Page,
  scenario: BuildScenario,
  id: string,
  kind: RefusalKind,
): Promise<void> {
  const { double, projectId } = scenario;
  double.builds.set(
    id,
    build({
      id,
      projectId,
      state: "failed",
      pullRequest: buildPullRequest,
      canCancel: false,
      failure: { step: "install", cause: "exit", exitCode: 1 },
    }),
  );
  double.refuseRequest = {
    reason: "build-ineligible",
    data: { cause: refusals[kind].cause },
  };
  await open(page, scenario.buildAt(id));
  await page.getByTestId("build-try-again").click();
  await expect(
    page.locator(".fo-build-action .fo-write-failure [role=alert]"),
  ).toHaveText(refusals[kind].sentence);
}

/** Enlarge the page's text to 200%, as the 320px refusal checks read it. */
export async function enlargeText(page: Page): Promise<void> {
  await page.addStyleTag({ content: "html { font-size: 200%; }" });
}

/** Whether the document scrolls sideways; nothing a card draws may cause it. */
export function scrollsSideways(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
}

/** Where one card draws a refused control: its write-failure fragment and the control. */
export interface RefusalParts {
  /** The parts whose boxes must stay inside the card's edge. */
  head: string;
  /** The write-failure fragment around the refused control. */
  fragment: string;
  /** The refused control itself. */
  control: string;
}

/** A build card's refused Try again, in the card's head. */
export const buildRefusal: RefusalParts = {
  head: ".fo-build-head *",
  fragment: ".fo-build-action .fo-write-failure",
  control: "[data-testid=build-try-again]",
};

/** The publishing card's refused request, in the stage card's state body. */
export const publishRefusal: RefusalParts = {
  head: ".fo-state *",
  fragment: ".fo-state-action .fo-write-failure",
  control: "[data-testid=stage-publish]",
};

/**
 * Where a refused control put its parts, read in the page: anything in the
 * card that passes the card's edge, whether the guide and Details stay inside
 * the card's box, the order of the refusal, the control and Details, and where
 * the guide stands beside the control.
 */
export function refusalLayout(card: Element, parts: RefusalParts) {
  const edge = card.getBoundingClientRect();
  const within = (box: DOMRect) =>
    box.left >= edge.left - 0.5 &&
    box.right <= edge.right + 0.5 &&
    box.top >= edge.top - 0.5 &&
    box.bottom <= edge.bottom + 0.5;
  const outside = [...card.querySelectorAll(parts.head)]
    .filter((node) => {
      const box = node.getBoundingClientRect();
      return (
        (box.width > 0 || box.height > 0) &&
        (box.left < edge.left - 0.5 || box.right > edge.right + 0.5)
      );
    })
    .map((node) => node.tagName + "." + (node.getAttribute("class") ?? ""));
  const fragment = card.querySelector(parts.fragment);
  const box = (selector: string) =>
    fragment?.querySelector(selector)?.getBoundingClientRect();
  const refusal = box("[role=alert]");
  const control = box(parts.control);
  const details = box("details");
  const guide = box(".fo-site-link");
  const inside: string[] = [];
  if (details && within(details)) inside.push("details");
  if (guide && within(guide)) inside.push("guide");
  const order: string[] = [];
  if (refusal && control && refusal.bottom <= control.top)
    order.push("refusal above the control");
  if (control && details && control.bottom <= details.top)
    order.push("control above the reference");
  let place = "none";
  if (guide && control && details && guide.bottom <= details.top)
    place =
      guide.left >= control.right &&
      guide.top < control.bottom &&
      guide.bottom > control.top
        ? "beside the control"
        : guide.top >= control.bottom
          ? "beneath the control"
          : "overlapping the control";
  else if (guide) place = "below the reference";
  return { outside, inside, order, guide: place };
}

/**
 * The outline a focused build title draws, read in the page, and whether its
 * box hugs its own words, so the outline goes round the title alone.
 */
export function focusOutline(title: Element) {
  const style = getComputedStyle(title);
  const words = document.createRange();
  words.selectNodeContents(title);
  return {
    focused: document.activeElement === title,
    style: style.outlineStyle,
    width: style.outlineWidth,
    color: style.outlineColor,
    offset: style.outlineOffset,
    radius: style.borderTopLeftRadius,
    hugsText:
      Math.abs(
        words.getBoundingClientRect().width -
          title.getBoundingClientRect().width,
      ) <= 1,
  };
}

/** Chromium's computed form of an opaque colour token. */
function rgb(hex: string): string {
  const channels = [1, 3, 5].map((start) =>
    Number.parseInt(hex.slice(start, start + 2), 16),
  );
  return "rgb(" + channels.join(", ") + ")";
}

/**
 * The token focus outline of the build card composition, as Chromium computes
 * it for a focused title in one colour scheme.
 */
export function tokenOutline(scheme: TokenColorScheme) {
  return {
    focused: true,
    style: "solid",
    width: "2px",
    color: rgb(tokens.color[scheme].focus),
    offset: "3px",
    radius: tokens.radius.tight,
    hugsText: true,
  };
}

/**
 * The catalogue focus policy of `mockup-verification.md`. Every element that
 * takes focus only through its `tabindex`, outside a registered control and
 * the `@mokly/ui` parts of a viewer drawing outside its host slots, draws the
 * token focus outline that `design-tokens.md` defines when the keyboard
 * focuses it. One shared rule in `styles/base.css` draws that outline, so this
 * reads what the browser computes rather than what a stylesheet says.
 */

import { tokens } from "@mokly-cloud/tokens/tokens";
import type { Page } from "@playwright/test";

import { rgb } from "./color-metrics";

/** The attribute a sweep marks each target with, so later reads find it. */
const probe = "data-focus-probe";

/** The most Tab presses one page may take before a target counts as unreached. */
const tabLimit = 200;

/** One element the policy focuses, as the page lists it. */
interface FocusTarget {
  /** The mark this sweep gave it. */
  at: string;
  /** Whether its `tabindex` keeps it out of the tab order. */
  negative: boolean;
  /** Its tag and classes, for a failure to name. */
  name: string;
}

/** What one focused target draws, read in the page. */
interface DrawnFocus {
  focused: boolean;
  visible: boolean;
  style: string;
  width: string;
  color: string;
  offset: string;
}

/**
 * Mark and list every target in tree order. An element a browser focuses
 * without `tabindex` is not one, nor is a registered control — Firna marks
 * every element it renders with its own classes — nor any `@mokly/ui` part of
 * a viewer drawing outside the host slots the cloud fills. An element that is
 * inert or not rendered takes no focus. Runs in the page, so it carries its
 * own selectors.
 */
export function markFocusTargets(attribute: string): FocusTarget[] {
  const native =
    "a[href], area[href], button, input, select, textarea, iframe, summary," +
    " audio[controls], video[controls], [contenteditable]:not([contenteditable='false'])";
  const registered = ".firna-view, .firna-text, .firna-textinput";
  const packaged =
    ".mokly-viewer, .mokly-viewer :not([data-mokly-slot], [data-mokly-slot] *)";
  return [...document.querySelectorAll<HTMLElement>("[tabindex]")]
    .filter(
      (node) =>
        !node.matches(native) &&
        !node.matches(registered) &&
        !node.matches(packaged) &&
        node.closest("[inert]") === null &&
        node.getClientRects().length > 0,
    )
    .map((node, index) => {
      node.setAttribute(attribute, String(index));
      return {
        at: String(index),
        negative: node.tabIndex < 0,
        name:
          node.tagName.toLowerCase() +
          [...node.classList].map((name) => "." + name).join(""),
      };
    });
}

/** Read what one marked element draws while it has focus. */
function readFocus([attribute, at]: [string, string]): DrawnFocus | null {
  const node = document.querySelector("[" + attribute + '="' + at + '"]');
  if (!node) return null;
  const style = getComputedStyle(node);
  return {
    focused: document.activeElement === node,
    visible: node.matches(":focus-visible"),
    style: style.outlineStyle,
    width: style.outlineWidth,
    color: style.outlineColor,
    offset: style.outlineOffset,
  };
}

/** Hand focus to one marked element, as a keyboard action's handler does. */
function handOff([attribute, at]: [string, string]): void {
  document
    .querySelector<HTMLElement>("[" + attribute + '="' + at + '"]')
    ?.focus();
}

/** The mark of whatever has focus now, if it is a target. */
function focusedMark(attribute: string): string | null {
  return document.activeElement?.getAttribute(attribute) ?? null;
}

/** What one target drew that the token outline is not, if anything. */
function outlineProblems(
  target: FocusTarget,
  drawn: DrawnFocus | null,
  scheme: "light" | "dark",
): string[] {
  if (drawn === null) return [target.name + " is gone"];
  if (!drawn.focused) return [target.name + " does not take focus"];
  const expected = {
    visible: true,
    style: "solid",
    width: "2px",
    color: rgb(tokens.color[scheme].focus),
    offset: "3px",
  };
  return Object.entries(expected)
    .filter(([key, value]) => drawn[key as keyof DrawnFocus] !== value)
    .map(
      ([key, value]) =>
        target.name +
        " draws " +
        key +
        " " +
        String(drawn[key as keyof DrawnFocus]) +
        ", not " +
        String(value),
    );
}

/**
 * Focus every target on the open page from the keyboard and report each one
 * that does not draw the token outline. Targets in the tab order are reached
 * with Tab from the top of the page; a target out of it takes focus from a
 * handler after keyboard input, as the build card's title does after Cancel.
 */
export async function focusPolicyViolations(
  page: Page,
  scheme: "light" | "dark",
): Promise<string[]> {
  const targets = await page.evaluate(markFocusTargets, probe);
  if (targets.length === 0) return [];
  const problems: string[] = [];
  const check = async (target: FocusTarget) =>
    problems.push(
      ...outlineProblems(
        target,
        await page.evaluate(readFocus, [probe, target.at] as [string, string]),
        scheme,
      ),
    );
  const ordered = targets.filter((target) => !target.negative);
  const reached = new Set<string>();
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement)
      document.activeElement.blur();
  });
  for (
    let press = 0;
    press < tabLimit && reached.size < ordered.length;
    press += 1
  ) {
    await page.keyboard.press("Tab");
    const at = await page.evaluate(focusedMark, probe);
    const target = ordered.find((each) => each.at === at);
    if (target === undefined || reached.has(target.at)) continue;
    reached.add(target.at);
    await check(target);
  }
  for (const target of ordered)
    if (!reached.has(target.at))
      problems.push(target.name + " is not reached by the keyboard");
  for (const target of targets.filter((each) => each.negative)) {
    await page.keyboard.press("Tab");
    await page.evaluate(handOff, [probe, target.at] as [string, string]);
    await check(target);
  }
  return problems;
}

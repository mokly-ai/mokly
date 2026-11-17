import { tokens } from "@mokly-cloud/tokens/tokens";
import type { TokenColorScheme } from "@mokly-cloud/tokens/tokens";
import type { Locator } from "@playwright/test";

import type { BuildLogChunk } from "../api/types";

import { expect } from "./harness";

/**
 * What a build card's output box shows, read in the page: its newest line,
 * the first line wholly in view, and whether the newest line is in view at
 * the box's end, which is what following the output means.
 */
export function outputView(box: Element) {
  const frame = box.getBoundingClientRect();
  const lines = [...box.querySelectorAll(".fo-build-lines > span")];
  const newest = lines[lines.length - 1];
  const first = lines.find(
    (line) => line.getBoundingClientRect().top >= frame.top - 0.5,
  );
  const end = newest?.getBoundingClientRect();
  return {
    newest: newest?.textContent ?? "",
    first: first?.textContent ?? "",
    atEnd:
      end !== undefined &&
      end.top >= frame.top - 0.5 &&
      end.bottom <= frame.bottom + 0.5,
  };
}

/** The outline a focused output box draws, read in the page. */
export function boxOutline(box: Element) {
  const style = getComputedStyle(box);
  return {
    focused: document.activeElement === box,
    style: style.outlineStyle,
    width: style.outlineWidth,
    color: style.outlineColor,
    offset: style.outlineOffset,
    radius: style.borderTopLeftRadius,
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
 * The token focus outline of the shared focus rule round the output box, as
 * Chromium computes it in one colour scheme: the box keeps its own
 * `radius.medium` rather than the rule's `radius.tight`.
 */
export function tokenBoxOutline(scheme: TokenColorScheme) {
  return {
    focused: true,
    style: "solid",
    width: "2px",
    color: rgb(tokens.color[scheme].focus),
    offset: "3px",
    radius: tokens.radius.medium,
  };
}

/** Numbered output lines, one chunk each, for a log a test writes. */
export function numbered(
  from: number,
  to: number,
): Pick<BuildLogChunk, "text">[] {
  const lines: Pick<BuildLogChunk, "text">[] = [];
  for (let line = from; line <= to; line += 1) {
    lines.push({ text: "line " + line + "\n" });
  }
  return lines;
}

/**
 * Wait until the output box stops scrolling: a key or a wheel scrolls it with
 * an animation, and what it shows is read only once the animation ends.
 */
export async function scrollSettled(output: Locator): Promise<void> {
  let last = Number.NaN;
  await expect
    .poll(async () => {
      const now = await output.evaluate((box) => box.scrollTop);
      const still = now === last;
      last = now;
      return still;
    })
    .toBe(true);
}

import assert from "node:assert/strict";
import { registerHooks } from "node:module";

import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { memoryStorage, withWindow } from "./page-window";
import type { TestLocation, TestPage } from "./page-window";
import { forget, seen } from "./press-doubles";
import type { DrawnButton } from "./press-doubles";

/**
 * Server rendering for a logic test of a screen. Importing this module points
 * the package Button and Expo Router at the press doubles, and the resource
 * hook at the answer table of `resource-doubles.ts`, so a screen the test
 * loads afterwards renders in Node with its reads answered and its presses
 * taken. A test therefore imports its screens dynamically, after this module.
 * The hooks belong to the importing test file's own process.
 */
const pressDoubles = new URL("./press-doubles.ts", import.meta.url).href;
const resourceDoubles = new URL("./resource-doubles.ts", import.meta.url).href;
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "@firna/ui/button" || specifier === "expo-router")
      return { url: pressDoubles, shortCircuit: true };
    const resolved = next(specifier, context);
    return resolved.url.endsWith("/src/data/use-resource.ts")
      ? { url: resourceDoubles, shortCircuit: true }
      : resolved;
  },
});

/** Render one screen in one page and answer what it drew. */
export function draw(
  page: TestPage,
  screen: ReactElement,
): { html: string; buttons: DrawnButton[] } {
  forget();
  let html = "";
  withWindow(page, () => {
    html = renderToStaticMarkup(screen);
  });
  return { html, buttons: [...seen.buttons] };
}

/** One page, with every popup it opens and every address it assigns itself. */
export function recordingPage(location: TestLocation) {
  const opened: unknown[][] = [];
  const assigned: string[] = [];
  return {
    opened,
    assigned,
    page: {
      location: {
        ...location,
        assign: (address: string) => void assigned.push(address),
      },
      sessionStorage: memoryStorage(),
      open: (...given: unknown[]) => opened.push(given),
    },
  };
}

/** Wait for a press whose handler awaits a digest; a guard, not a timer. */
export async function until(done: () => boolean): Promise<void> {
  const deadline = Date.now() + 10_000;
  while (!done()) {
    assert.ok(Date.now() < deadline, "the press finished");
    await new Promise((resolve) => setImmediate(resolve));
  }
}

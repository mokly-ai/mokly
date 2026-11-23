/**
 * A screen's section on a canvas stage that happy-dom lays out as a browser
 * would, and the readings of the drawn view.
 */

import type { TestContext } from "node:test";

import { act, screen } from "@testing-library/react";

import type { CanvasStageSection } from "../src/canvas-stage/canvas-stage.js";

/** A screen's four frames, whose nodes stand in for the frames. */
export const SECTION: CanvasStageSection = {
  frames: [
    {
      key: "desktop-light",
      column: 0,
      row: 0,
      width: 1280,
      height: 800,
      node: <i />,
    },
    {
      key: "mobile-light",
      column: 1,
      row: 0,
      width: 390,
      height: 844,
      node: <i />,
    },
    {
      key: "desktop-dark",
      column: 0,
      row: 1,
      width: 1280,
      height: 800,
      node: <i />,
    },
    {
      key: "mobile-dark",
      column: 1,
      row: 1,
      width: 390,
      height: 844,
      node: <i />,
    },
  ],
  kind: "screen",
  path: "example/screens/welcome",
  title: "Welcome",
};

/** The room of the stage box, which happy-dom does not lay out. */
export const room = {
  clientWidth: 860,
  clientHeight: 804,
  offsetLeft: 260,
  offsetTop: 0,
};

/** Lay out the canvas's stage box before the canvas measures it. */
export function laidOut(canvas: HTMLDivElement | null): void {
  const box = canvas?.firstElementChild;
  if (!box) return;
  for (const name of Object.keys(room) as (keyof typeof room)[])
    Object.defineProperty(box, name, {
      configurable: true,
      get: () => room[name],
    });
}

/** Observers that a test triggers, as a browser does when a box resizes. */
export function observeResizes(t: TestContext): () => void {
  const callbacks: (() => void)[] = [];
  const original = globalThis.ResizeObserver;
  globalThis.ResizeObserver = class {
    constructor(callback: () => void) {
      callbacks.push(callback);
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  t.after(() => {
    globalThis.ResizeObserver = original;
    Object.assign(room, { clientWidth: 860, clientHeight: 804 });
  });
  return () => act(() => callbacks.forEach((callback) => callback()));
}

export function zoomText(): string | null | undefined {
  return screen
    .getByRole("group", { name: "Zoom" })
    .querySelector(".mbk-zoom-value")?.textContent;
}

export function placed(container: HTMLElement): string | undefined {
  return container.querySelector<HTMLElement>(".mbk-canvas-world")?.style
    .transform;
}

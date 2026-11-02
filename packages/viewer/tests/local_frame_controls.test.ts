import assert from "node:assert/strict";
import test from "node:test";

import { authenticateRanges } from "../src/client/component_geometry.js";
import { localFrameAccess } from "../src/client/same_origin_access.js";
import { installLocalHighlight } from "../src/client/same_origin_highlight.js";
import type { ComponentViewRecord } from "../src/components/view_types.js";

test("local inspection stays unavailable when the immediate document cannot authenticate", () => {
  const frame = { contentDocument: null } as unknown as HTMLIFrameElement;
  const usage = {
    viewport: "desktop",
    colorScheme: "light",
    instances: [],
    slots: [],
    ranges: [],
    styles: [],
    resources: [],
  } as ComponentViewRecord;
  assert.equal(
    authenticateRanges(frame, "screen/index.desktop.html", usage),
    undefined,
  );
});

test("replacing a local frame preserves the exact query and fragment", () => {
  const replacements: string[] = [];
  const frame = {
    contentWindow: {
      location: { replace: (url: string) => replacements.push(url) },
    },
  } as unknown as HTMLIFrameElement;
  const url = new URL("https://app.test/static/screen.html?revision=2#summary");
  localFrameAccess(frame).replace(url);
  assert.deepEqual(replacements, [url.href]);
});

test("local highlighting cancels pending measurements and listeners on disposal", () => {
  const signals: AbortSignal[] = [];
  const cancelled: number[] = [];
  let scheduled = 0;
  const listener = (
    _name: string,
    _callback: unknown,
    options: AddEventListenerOptions,
  ) => signals.push(options.signal!);
  const root = {
    ownerDocument: {
      addEventListener: listener,
      defaultView: {
        addEventListener: listener,
        requestAnimationFrame: () => ++scheduled,
        cancelAnimationFrame: (id: number) => cancelled.push(id),
      },
    },
  } as unknown as HTMLElement;
  const dispose = installLocalHighlight(
    root,
    [],
    () => {},
    () => {},
    new Set(),
  );
  assert.equal(scheduled, 1);
  assert.equal(signals.length, 2);
  assert.ok(signals.every((signal) => !signal.aborted));
  dispose();
  assert.ok(signals.every((signal) => signal.aborted));
  assert.deepEqual(cancelled, [1]);
});

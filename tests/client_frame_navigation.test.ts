import assert from "node:assert/strict";
import test from "node:test";

import { classifyFrameActivation } from "../packages/viewer/dist/client/frame_navigation.js";

const primary = {
  altKey: false,
  button: 0,
  ctrlKey: false,
  download: false,
  eventType: "click" as const,
  marker: "details#section",
  metaKey: false,
  shiftKey: false,
  target: null,
};

test("trusted frame activation derives canonical catalogue routes", () => {
  assert.deepEqual(classifyFrameActivation(primary), {
    href: "/id/details?fragment=section",
    kind: "navigate",
  });
  assert.deepEqual(classifyFrameActivation({ ...primary, marker: "tour" }), {
    href: "/id/tour",
    kind: "navigate",
  });
  for (const target of ["_top", "_parent"]) {
    assert.deepEqual(classifyFrameActivation({ ...primary, target }), {
      href: "/id/details?fragment=section",
      kind: "navigate",
    });
  }
});

test("modified and explicit new-context activation stays parent-owned", () => {
  for (const modifier of ["metaKey", "ctrlKey", "shiftKey"] as const) {
    assert.deepEqual(
      classifyFrameActivation({ ...primary, [modifier]: true }),
      {
        href: "/id/details?fragment=section",
        kind: "open",
        target: "_blank",
      },
    );
  }
  assert.deepEqual(
    classifyFrameActivation({
      ...primary,
      button: 1,
      eventType: "auxclick",
    }),
    {
      href: "/id/details?fragment=section",
      kind: "open",
      target: "_blank",
    },
  );
  assert.deepEqual(classifyFrameActivation({ ...primary, target: "_blank" }), {
    href: "/id/details?fragment=section",
    kind: "open",
    target: "_blank",
  });
  assert.deepEqual(
    classifyFrameActivation({ ...primary, target: "Report.Frame" }),
    {
      href: "/id/details?fragment=section",
      kind: "open",
      target: "Report.Frame",
    },
  );
});

test("frame activation declines untrusted or ineligible candidates", () => {
  for (const candidate of [
    { ...primary, altKey: true },
    { ...primary, button: 2 },
    { ...primary, download: true },
    { ...primary, eventType: "auxclick" as const, button: 0 },
    { ...primary, marker: "details#1section" },
    { ...primary, marker: "mock:details" },
    { ...primary, target: " invalid" },
  ]) {
    assert.equal(classifyFrameActivation(candidate), undefined);
  }
});

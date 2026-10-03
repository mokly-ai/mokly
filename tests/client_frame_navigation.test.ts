import assert from "node:assert/strict";
import test from "node:test";

import { classifyFrameActivation } from "../packages/viewer/dist/client/same_origin_navigation.js";

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

test("trusted frame activation returns logical catalogue destinations", () => {
  assert.deepEqual(classifyFrameActivation(primary), {
    activation: "primary",
    fragment: "section",
    screenPath: "details",
    target: { kind: "self" },
  });
  assert.deepEqual(classifyFrameActivation({ ...primary, marker: "tour" }), {
    activation: "primary",
    screenPath: "tour",
    target: { kind: "self" },
  });
  for (const target of ["_top", "_parent"]) {
    assert.deepEqual(classifyFrameActivation({ ...primary, target }), {
      activation: "primary",
      fragment: "section",
      screenPath: "details",
      target: { kind: target.slice(1) },
    });
  }
});

test("modified and explicit new-context activation stays parent-owned", () => {
  for (const modifier of ["metaKey", "ctrlKey", "shiftKey"] as const) {
    assert.deepEqual(
      classifyFrameActivation({ ...primary, [modifier]: true }),
      {
        activation: "modified",
        fragment: "section",
        screenPath: "details",
        target: { kind: "self" },
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
      activation: "middle",
      fragment: "section",
      screenPath: "details",
      target: { kind: "self" },
    },
  );
  assert.deepEqual(classifyFrameActivation({ ...primary, target: "_blank" }), {
    activation: "primary",
    fragment: "section",
    screenPath: "details",
    target: { kind: "blank" },
  });
  assert.deepEqual(
    classifyFrameActivation({ ...primary, target: "Report.Frame" }),
    {
      activation: "primary",
      fragment: "section",
      screenPath: "details",
      target: { kind: "named", name: "Report.Frame" },
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

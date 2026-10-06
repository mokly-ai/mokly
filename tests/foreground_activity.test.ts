import assert from "node:assert/strict";
import test from "node:test";

import { ForegroundActivity } from "../packages/mokly/dist/server/demand/activity.js";

test("overlapping Props and preview work stays busy until all current channels finish", () => {
  const transitions: boolean[] = [];
  const activity = new ForegroundActivity((busy) => transitions.push(busy));
  const oldPreview = activity.channel();
  const props = activity.channel();
  const preview = activity.channel();
  oldPreview(true);
  props(true);
  preview(true);
  oldPreview(false);
  props(false);
  oldPreview(false);
  assert.deepEqual(transitions, [true]);
  preview(false);
  assert.deepEqual(transitions, [true, false]);
});

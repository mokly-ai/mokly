/** Open test frames before setup and close them before cleanup assertions. */
import { afterEach, beforeEach } from "node:test";

import countingAssertion from "./assertion-guard-counting.mjs";
import { activeFrames } from "./assertion-guard-state.mjs";

function isAncestor(frame, context) {
  return context.fullName.startsWith(`${frame.fullName} > `);
}

beforeEach((context) => {
  for (const frame of activeFrames.values())
    if (!isAncestor(frame, context))
      throw new Error(
        `assertion guard needs sequential tests: ${frame.fullName} is still running`,
      );
  const frame = { count: 0, fullName: context.fullName };
  for (const method of ["skip", "todo"]) {
    const original = context[method];
    context[method] = (...args) => {
      activeFrames.delete(context);
      return Reflect.apply(original, context, args);
    };
  }
  Object.defineProperty(context, "assert", {
    configurable: true,
    value: countingAssertion(context.assert),
  });
  activeFrames.set(context, frame);
});

afterEach((context) => {
  const frame = activeFrames.get(context);
  activeFrames.delete(context);
  if (frame && frame.count === 0)
    throw new Error(`test made no assertions: ${context.fullName}`);
});

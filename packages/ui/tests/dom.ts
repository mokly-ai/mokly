/**
 * The DOM of the UI package tests: one happy-dom window per test process,
 * React's act environment, and Testing Library cleanup after each test.
 * Import it first: React DOM and Testing Library read the globals when they
 * load. Another import of it changes nothing.
 */
import { afterEach } from "node:test";

import { GlobalRegistrator } from "@happy-dom/global-registrator";

if (!GlobalRegistrator.isRegistered) GlobalRegistrator.register();
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

// Testing Library cleans up by itself only under a runner with a global
// `afterEach`. The import waits for the hook, after the window exists.
afterEach(async () => {
  const { cleanup } = await import("@testing-library/react");
  cleanup();
});

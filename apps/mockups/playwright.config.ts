import "./src/_tests_/clear-git-environment.mjs";

import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "../../docs/mockups/src/_tests_",
  testMatch: [
    "**/disk.spec.ts",
    "**/focus.spec.ts",
    "**/overlay.spec.ts",
    "**/responsive.spec.ts",
    "**/controls.spec.ts",
    "**/folio.spec.ts",
    // Each product spec is named, because a `product-*` pattern would also
    // run the served suite's `product-serve.spec.ts` against files on disk.
    "**/product.spec.ts",
    "**/product-account.spec.ts",
    "**/product-onboarding.spec.ts",
    "**/product-refusals.spec.ts",
    "**/product-row-menu.spec.ts",
    "**/product-settings.spec.ts",
    "**/viewer.spec.ts",
    "**/viewer-ready-stage.spec.ts",
    "**/viewer-recovery.spec.ts",
    "**/viewer-builds.spec.ts",
    "**/viewer-panels.spec.ts",
    "**/emails.spec.ts",
  ],
  tsconfig: "./tsconfig.runtime.json",
  fullyParallel: true,
  workers: 2,
  retries: 0,
  timeout: 45_000,
  outputDir: "../../.context/mockups-playwright",
  reporter: [["line"]],
  use: {
    browserName: "chromium",
    headless: true,
    contextOptions: { reducedMotion: "reduce" },
    trace: "retain-on-failure",
  },
});

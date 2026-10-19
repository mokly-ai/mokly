import { defineConfig } from "@playwright/test";

import browser from "./playwright.config.js";

/** Portable design journeys run unchanged against static HTTP and file URLs. */
export default defineConfig({
  ...browser,
  testMatch: [
    "comparison_design",
    "component_controls",
    "component_design",
    "component_design_inspection",
    "component_design_selection",
    "component_evidence",
    "component_inspector",
    "component_surfaces",
    "component_workspace",
    "design_comparison_eligibility",
    "design_comparison_eligibility_2",
    "design_comparison_eligibility_3",
    "design_comparison_eligibility_4",
    "design_comparison_scrolling",
    "design_comparison_stacks",
    "design_component_stacks",
    "design_index_entries",
    "design_library",
    "design_modern_controls",
    "design_portable",
    "design_scroll_together",
    "design_stylesheet_evidence",
    "design_top_bar",
    "example_links",
    "phone_chrome",
  ].map((name) => `${name}.spec.ts`),
  reporter: [["list"], ["./scripts/verification/static-delivery-reporter.ts"]],
});

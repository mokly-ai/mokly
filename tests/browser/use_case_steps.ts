import type { Locator, Page } from "@playwright/test";

/**
 * The step frames of the routed use case on the canvas, in step order. Each
 * is a figure that its label names by its step, such as `Step 1 Welcome`.
 */
export function useCaseSteps(page: Page): Locator {
  return page.getByRole("figure", { name: /^Step \d+ /u });
}

/** The step frame of one step, by its number from 1. */
export function useCaseStep(page: Page, step: number): Locator {
  return page.getByRole("figure", {
    name: new RegExp(`^Step ${step} `, "u"),
  });
}

/** The document of one step frame, by the step's number from 1. */
export function useCaseStepFrame(page: Page, step: number): Locator {
  return useCaseStep(page, step).locator("iframe");
}

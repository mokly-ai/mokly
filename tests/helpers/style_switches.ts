import { compareComponentView } from "../../dist/review/component_view.js";

import type { FastPathFixture } from "./component_fast_path.js";
import { pageContext } from "./page_comparison.js";
import { selectedStyleViews } from "./style_route.js";

export const styleSwitches = [
  { useFastPath: false, useStylePath: false },
  { useFastPath: false, useStylePath: true },
  { useFastPath: true, useStylePath: false },
  { useFastPath: true, useStylePath: true },
] as const;

export function compareStyleSwitches(
  fixture: FastPathFixture,
  switches: (typeof styleSwitches)[number],
) {
  const { before, after, root } = selectedStyleViews(fixture);
  return compareComponentView(
    { ...pageContext(fixture), ...switches },
    before,
    after,
    root,
  );
}

/** Compare failures as well as results against a fresh per-view oracle context. */
export async function captureStyleSwitches(
  fixture: FastPathFixture,
  switches: (typeof styleSwitches)[number],
) {
  try {
    const { comparisonPath, ...result } = await compareStyleSwitches(
      fixture,
      switches,
    );
    return { kind: "result" as const, comparisonPath, result };
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    return {
      kind: "error" as const,
      name: error.name,
      message: error.message,
      ...("code" in error ? { code: error.code } : {}),
    };
  }
}

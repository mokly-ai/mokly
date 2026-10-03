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

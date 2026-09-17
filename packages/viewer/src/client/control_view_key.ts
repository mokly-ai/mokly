import type { GeneratedComponentView } from "../components/views.js";

export function controlViewKey(
  view: Pick<GeneratedComponentView, "viewport" | "colorScheme">,
): string {
  return `${view.viewport}/${view.colorScheme}`;
}

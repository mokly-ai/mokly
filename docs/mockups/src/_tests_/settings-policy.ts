import { panes } from "../screens/product/settings/panes";
import { drawnComponent } from "./definition-policy";
import type { CatalogueDefinition } from "./load-catalogue";
import { productSituations } from "./product-situations";

/** The mobile index plus every pane of the settings dialog. */
export const settingsSurfaces = [
  "sections",
  ...panes.map((pane) => pane.id),
] as const;

/** Situations a pane owns beyond its four states, each a variant or a screen. */
export const settingsSituations = productSituations.filter(
  (situation) => situation.family === "settings",
);

/**
 * Every pane is registered once, each drawing's two presentations share one
 * component no other drawing reuses, and every pane has its four states plus
 * the situations it declares. What a settings document may open over its frame
 * is `settings-document-policy.ts`'s to check.
 */
export function settingsRegistryViolations(
  entries: readonly CatalogueDefinition[],
): string[] {
  const problems: string[] = [];
  const byPath = new Map(entries.map((entry) => [entry.path, entry]));
  const screens = entries.filter(
    (entry) =>
      entry.kind === "screen" && entry.path.startsWith("product/settings/"),
  );
  for (const surface of settingsSurfaces) {
    const canonical = screens.filter(
      (entry) => entry.path === "product/settings/" + surface,
    );
    if (canonical.length !== 1)
      problems.push("pane registered exactly once: " + surface);
  }
  const owners = new Set<unknown>();
  for (const entry of screens) {
    const drawn = drawnComponent(entry, (path) => byPath.get(path));
    if (drawn === "missing") {
      problems.push("both presentations required: " + entry.path);
      continue;
    }
    if (drawn === "mixed") {
      problems.push("dialog and layer share one component: " + entry.path);
      continue;
    }
    if (owners.has(drawn.type))
      problems.push("pane component reused: " + entry.path);
    owners.add(drawn.type);
  }
  const expected =
    settingsSurfaces.length * 4 +
    settingsSituations.reduce(
      (total, situation) => total + situation.states.length,
      0,
    );
  if (screens.length !== expected)
    problems.push("every pane needs four states");
  return problems;
}

import type { TestContext } from "node:test";

import { compileCatalogue } from "../../dist/build/compile.js";
import { loadConfig } from "../../dist/config/load.js";
import { entryRoute, viewRoute } from "../../packages/viewer/dist/data.js";
import type { ManifestV8 } from "../../packages/viewer/dist/registry/types.js";

import { componentEntrySource } from "./component_fixture.js";
import { createFixture, removeFixture, validEntrySource } from "./fixture.js";

/** Produce a genuine current catalogue and its former stored-path representation. */
export async function historicalLayoutFixture(
  context: TestContext,
  components = false,
) {
  const source =
    (components ? componentEntrySource() : validEntrySource()) +
    `
import { definePage as historicalGuide } from "@mokly/mokly";
mockups.push(historicalGuide({ id: "guide", title: "Guide", description: "Guide document", relatedDocs: [], render: () => "<!doctype html><html><body>Guide</body></html>" }));`;
  const fixture = await createFixture(source, {
    extraConfig: 'colorSchemes: ["light", "dark"],',
  });
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const current = await compileCatalogue(config);
  return {
    ...fixture,
    config,
    current,
    historical: historicalPaths(current.manifest),
  };
}

/** Store canonical paths while preserving all material and removed-field test inputs. */
export function historicalPaths(manifest: ManifestV8, version = 6) {
  const entries = manifest.entries.flatMap(
    (entry): Record<string, unknown>[] => {
      if (entry.kind === "component" && "variantOf" in entry) return [];
      const raw: Record<string, unknown> = {
        ...entry,
        dependencies: [entry.sourcePath],
        declaredDependencies: [entry.sourcePath],
        route: entryRoute(entry.kind, entry.id),
      };
      if (entry.kind === "screen")
        Object.assign(
          raw,
          fragments(entry.kind, entry.id, entry.colorSchemes.includes("dark")),
        );
      if (entry.kind === "component") {
        raw.ownedDependencies = [entry.sourcePath];
        raw.variants = manifest.entries.flatMap((variant) =>
          variant.kind === "component" &&
          "variantOf" in variant &&
          variant.variantOf === entry.id
            ? [
                {
                  id: variant.id,
                  title: variant.title,
                  description: variant.description,
                  props: variant.props,
                  suppliedSlots: variant.suppliedSlots,
                  componentViews: variant.componentViews,
                  ...fragments(
                    "component",
                    variant.id,
                    variant.colorSchemes.includes("dark"),
                  ),
                },
              ]
            : [],
        );
      }
      return [raw];
    },
  );
  return { ...manifest, schemaVersion: version, entries };
}

function fragments(kind: "component" | "screen", id: string, dark: boolean) {
  return {
    viewports: ["mobile", "desktop"],
    fragments: {
      mobile: viewRoute(kind, id, "mobile", "light"),
      desktop: viewRoute(kind, id, "desktop", "light"),
    },
    ...(dark
      ? {
          darkFragments: {
            mobile: viewRoute(kind, id, "mobile", "dark"),
            desktop: viewRoute(kind, id, "desktop", "dark"),
          },
        }
      : {}),
  };
}

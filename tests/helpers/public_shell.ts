import { projectCatalogue } from "../../dist/catalogue/projection.js";
import type { CatalogueReadModel } from "../../packages/viewer/dist/catalogue/types.js";
import type { Catalogue } from "../../packages/viewer/dist/shell/catalogue.js";
import type { ShellContext } from "../../packages/viewer/dist/shell/context.js";

/** Project a private test catalogue into the public model required by SSR. */
export function publicShellContext(
  catalogue: Catalogue,
  context: ShellContext,
): ShellContext & { readModel: CatalogueReadModel } {
  const changesStatus =
    context.changedRoutes === undefined ? "disabled" : "ready";
  const readModel = projectCatalogue({
    catalogue,
    changedRoutes: context.changedRoutes,
    changesStatus,
    comparisonUrl: null,
    configPath: "mokly.config.ts",
    revision: {
      content: context.contentVersion ?? context.updateVersion,
      evidence: context.updateVersion,
    },
  });
  return { ...context, readModel };
}

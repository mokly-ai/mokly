/** Keep Git-call assertions observable while production classification stays in its worker. */
import type { TestContext } from "node:test";

import type { ResolvedConfig } from "../../dist/config/types.js";
import { RepositoryCatalogueChangeClassifier } from "../../dist/server/component_changes.js";
import { BackgroundCompilation } from "../../dist/server/demand/background.js";

export function observeBackgroundClassification(
  context: TestContext,
  config: ResolvedConfig,
): Promise<void> {
  let complete: () => void = () => {};
  const finished = new Promise<void>((resolve) => {
    complete = resolve;
  });
  context.mock.method(
    BackgroundCompilation.prototype,
    "classify",
    async function (
      this: BackgroundCompilation,
      base: string,
      prepared?: { commit: string; selection: "blobs" | "rebuild" },
    ) {
      try {
        const compilation = await this.compilation;
        return await new RepositoryCatalogueChangeClassifier().read(
          config,
          compilation.manifest,
          base,
          undefined,
          prepared ? { ...prepared, outputs: compilation.outputs } : undefined,
        );
      } finally {
        complete();
      }
    },
  );
  return finished;
}

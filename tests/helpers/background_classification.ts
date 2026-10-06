/** Keep Git-call assertions observable while production classification stays in its worker. */
import type { TestContext } from "node:test";

import type { ResolvedConfig } from "../../packages/mokly/dist/config/types.js";
import { RepositoryCatalogueChangeClassifier } from "../../packages/mokly/dist/server/component_changes.js";
import { BackgroundCompilation } from "../../packages/mokly/dist/server/demand/background.js";

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
    async function (this: BackgroundCompilation, base: string) {
      try {
        const compilation = await this.compilation;
        return await new RepositoryCatalogueChangeClassifier().read(
          config,
          compilation.manifest,
          base,
        );
      } finally {
        complete();
      }
    },
  );
  return finished;
}

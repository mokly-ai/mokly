import type { TestContext } from "node:test";

import { reviewFixture, reviewPage } from "./vite_review.js";
import type { ReviewFixture } from "./vite_review.js";

export const pluginInput = 'export const value = "before";';

export async function pluginInputFixture(
  context: TestContext,
  method: "load" | "addWatchFile",
): Promise<ReviewFixture> {
  const fixture = await reviewFixture(context);
  await fixture.write(".context/setups", "");
  await fixture.write(
    "vite.config.ts",
    `
    import fs from "node:fs";
    import path from "node:path";
    const root = import.meta.dirname;
    fs.appendFileSync(path.join(root, ".context/setups"), "setup\\n");
    export default { plugins: [{ name: "plugin-input",
      async transform(code, id) {
        if (!id.endsWith("/review.mockup.ts")) return;
        const file = path.join(root, "src/plugin-input.ts");
        ${method === "load" ? "await this.load({ id: file });" : "this.addWatchFile(file);"}
        return code.replace("__PLUGIN__", JSON.stringify(fs.readFileSync(file, "utf8")));
      },
    }] };
  `,
  );
  await fixture.write("src/plugin-input.ts", pluginInput);
  await fixture.write("src/review.mockup.ts", reviewPage("__PLUGIN__"));
  await fixture.write(
    "src/other.mockup.ts",
    reviewPage("value", 'import { value } from "./plugin-input.ts";'),
  );
  fixture.params.entryFiles.push("src/other.mockup.ts");
  return fixture;
}

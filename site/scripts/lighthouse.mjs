/** Load the separately installed audit tools before starting any server. */
import { access } from "node:fs/promises";

const directory = new URL("../lighthouse/", import.meta.url);
try {
  await Promise.all(
    ["lighthouse", "chrome-launcher"].map((name) =>
      access(new URL(`node_modules/${name}/package.json`, directory)),
    ),
  );
} catch {
  throw new Error(
    "Lighthouse tools are installed separately. With Node 22.19+ (Node 24 in CI), run `npm ci --prefix site/lighthouse --engine-strict` from the repository root, then `npm run site:lighthouse`.",
  );
}
await import(new URL("run.mjs", directory).href);

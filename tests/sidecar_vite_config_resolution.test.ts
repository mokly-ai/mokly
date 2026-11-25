import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { reviewFixture, reviewPage } from "./fixtures/vite_review.js";

test("Vite records and reloads computed config imports and requires", async (context) => {
  const fixture = await reviewFixture(context);
  const helpers = {
    "data/require.cjs": 'module.exports = "commonjs";',
    "data/import.mjs": 'export default "esm";',
    "data/create-require.cjs": 'module.exports = "local-require";',
  };
  for (const [file, source] of Object.entries(helpers))
    await fixture.write(file, source);
  await fixture.write(
    "vite.config.mjs",
    `import { createRequire } from 'node:module';
const local = createRequire(import.meta.url);
export default async () => {
  const required = './data/require.cjs';
  const imported = './data/import.mjs';
  const { default: value } = await import(imported);
  return { define: { __CONFIG__: JSON.stringify([
    require(required), value, local('./data/create-require.cjs'),
  ].join('|')) } };
};`,
  );
  await fixture.write("src/review.mockup.ts", reviewPage("__CONFIG__"));
  const first = await fixture.compile();
  assert.match(
    (await fixture.render(first)).html,
    /<body>commonjs\|esm\|local-require<\/body>/,
  );
  for (const [file, source] of Object.entries(helpers))
    assert.equal(
      first.compiled.metadataInputs[file],
      createHash("sha256").update(source).digest("hex"),
      file,
    );
  await fixture.write("data/import.mjs", 'export default "updated";');
  await assert.rejects(fixture.compile(), { code: "fresh-worker-required" });
  await fixture.replaceWorker();
  const next = await fixture.compile();
  assert.match(
    (await fixture.render(next)).html,
    /<body>commonjs\|updated\|local-require<\/body>/,
  );
  await fixture.sidecar.call("shutdown");
});

test("Vite base config modules resolve from their own files and use import conditions", async (context) => {
  const fixture = await reviewFixture(context, "base");
  const packages = path.join(fixture.parent, "config-packages");
  const installed = path.join(packages, "node_modules", "config-import-only");
  await fs.mkdir(installed, { recursive: true });
  await fs.writeFile(
    path.join(installed, "package.json"),
    '{"name":"config-import-only","exports":{"import":"./entry.mjs"}}',
  );
  await fs.writeFile(
    path.join(installed, "entry.mjs"),
    'export default "selected import";',
  );
  const required = path.join(packages, "node_modules", "config-require");
  await fs.mkdir(required);
  await fs.writeFile(
    path.join(required, "index.js"),
    'module.exports = "selected require";',
  );
  await fs.writeFile(
    path.join(required, "late.js"),
    'module.exports = "late require";',
  );
  fixture.params.moduleResolution.packageRoots.push(packages);
  await fixture.write("config/relative.mjs", 'export default "relative";');
  await fixture.write("parent.mjs", 'export default "parent";');
  await fixture.write(
    "config/helper.mjs",
    `import { createRequire } from 'node:module';
const own = createRequire(import.meta.url);
export async function resolved() {
  const local = import.meta.resolve('./relative.mjs');
  const parent = import.meta.resolve('./parent.mjs', new URL('../vite.config.mjs', import.meta.url));
  const name = 'config-import-only';
  const pkg = import.meta.resolve(name);
  const builtin = 'path';
  const [{ default: relative }, { default: fromParent }, { default: value }, { basename }] =
    await Promise.all([local, parent, name, builtin].map(id => import(id)));
  return [relative, fromParent, value, basename(pkg), own('config-require')].join('|');
}
export const late = () => own('config-require/late');`,
  );
  await fixture.write(
    "vite.config.mjs",
    `import { late, resolved } from './config/helper.mjs';
export default { plugins: [{ name: 'config-lookup',
  async config() {
    return { define: { __CONFIG__: JSON.stringify(await resolved()) } };
  },
  transform(code, id) {
    if (id.endsWith('/src/review.mockup.ts')) return code.replace('__LATE__', JSON.stringify(late()));
  },
}] };`,
  );
  await fixture.write(
    "src/review.mockup.ts",
    reviewPage("__CONFIG__ + '|' + __LATE__"),
  );
  assert.equal(
    (await fixture.render(await fixture.compile())).html,
    "<html><head></head><body>relative|parent|selected import|entry.mjs|selected require|late require</body></html>",
  );
  await fixture.sidecar.call("shutdown");
});

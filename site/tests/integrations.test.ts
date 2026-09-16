import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

test("the configured MDX and React integrations render a component with hooks", async (t) => {
  const site = path.resolve(import.meta.dirname, "..");
  await mkdir(path.join(site, ".astro"), { recursive: true });
  const fixture = await mkdtemp(path.join(site, ".astro", "integration-"));
  t.after(() => rm(fixture, { recursive: true, force: true }));
  await mkdir(path.join(fixture, "src", "pages"), { recursive: true });
  const config = pathToFileURL(path.join(site, "astro.config.mjs")).href;
  await writeFile(
    path.join(fixture, "astro.config.mjs"),
    `import config from ${JSON.stringify(config)}; export default { ...config, root: new URL('.', import.meta.url) };`,
  );
  await writeFile(
    path.join(fixture, "tsconfig.json"),
    JSON.stringify({ extends: path.join(site, "tsconfig.json") }),
  );
  await writeFile(
    path.join(fixture, "src", "Sample.tsx"),
    'import { useId } from "react"; export default function Sample() { const id = useId(); return <p id={id}>Rendered by React</p>; }',
  );
  await writeFile(
    path.join(fixture, "src", "pages", "index.mdx"),
    'import Sample from "../Sample.tsx";\n\n# MDX integration\n\n<Sample />\n',
  );
  const manifestPath = createRequire(import.meta.url).resolve(
    "astro/package.json",
  );
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
    bin: { astro: string };
  };
  await promisify(execFile)(
    process.execPath,
    [
      path.join(path.dirname(manifestPath), manifest.bin.astro),
      "build",
      "--root",
      fixture,
    ],
    {
      cwd: site,
      timeout: 30_000,
    },
  );
  const html = await readFile(path.join(fixture, "dist", "index.html"), "utf8");
  assert.match(html, /<h1[^>]*>MDX integration<\/h1>/);
  assert.match(html, /<p id="[^"]+">Rendered by React<\/p>/);
});

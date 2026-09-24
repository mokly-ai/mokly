import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import type { TestContext } from "node:test";
import { promisify } from "node:util";

import { compileCatalogue } from "../../dist/build/compile.js";
import { loadConfig } from "../../dist/config/load.js";

import { createFixture, removeFixture, validEntrySource } from "./fixture.js";

const execute = promisify(execFile);

/** Historical stub command reproduces real validated fixture output, without tracked HTML. */
export async function derivedFixture(
  t: TestContext,
  source = validEntrySource(),
  publicFiles: Readonly<Record<string, string>> = {},
) {
  const fixture = await createFixture(source);
  t.after(() => removeFixture(fixture));
  await fs.writeFile(
    fixture.configPath,
    `import { defineConfig } from "@mokly/mokly";
export default defineConfig({
  generatedOutput: "derived", entriesDir: "entries", mockupsDir: "mockups",
  review: { outDir: ".review", baselineBuild: [["node", "baseline.mjs"]] }
});\n`,
  );
  for (const [route, content] of Object.entries(publicFiles)) {
    const target = path.join(fixture.mockupsDir, route);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, content);
  }
  const config = await loadConfig(fixture.root);
  const baseline = await compileCatalogue(config);
  await fs.writeFile(
    path.join(fixture.root, "baseline-output.json"),
    JSON.stringify([...baseline.outputs]),
  );
  await fs.writeFile(
    path.join(fixture.root, "baseline.mjs"),
    `import fs from "node:fs/promises";
import path from "node:path";
for (const [route, content] of JSON.parse(await fs.readFile("baseline-output.json", "utf8"))) {
  const target = path.join("mockups", route);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content);
}
`,
  );
  await fs.writeFile(
    path.join(fixture.root, ".gitignore"),
    "mockups/**/*.html\nmockups/mokly-manifest.json\n.mokly-cache/\n",
  );
  const git = (...args: string[]) =>
    execute("git", args, { cwd: fixture.root });
  await git("init", "-q");
  await git("config", "user.email", "test@example.invalid");
  await git("config", "user.name", "Test");
  await git("add", ".");
  await git("commit", "-qm", "test: derived baseline");
  await git("update-ref", "refs/remotes/origin/main", "HEAD");
  const commit = (await git("rev-parse", "HEAD")).stdout.trim();
  return { ...fixture, config, baseline, git, commit };
}

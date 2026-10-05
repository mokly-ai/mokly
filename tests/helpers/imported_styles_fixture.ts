import fs from "node:fs/promises";
import path from "node:path";

import { compileCatalogue } from "../../dist/build/compile.js";
import { loadConfig } from "../../dist/config/load.js";

import { createFixture, type TestFixture } from "./fixture.js";

/** Fixture with an authored stylesheet imported from its registered entry. */
export async function styleFixture(
  css: string,
  options?: { extraConfig?: string; module?: boolean },
): Promise<TestFixture> {
  const fixture = await createFixture(undefined, options);
  const name = options?.module ? "fixture.module.css" : "fixture.css";
  await fs.writeFile(path.join(fixture.entriesDir, name), css);
  await fs.appendFile(fixture.entryPath, `\nimport "./${name}";\n`);
  return fixture;
}

/** Compile in-memory generated routes from an isolated consumer. */
export async function compileFixture(fixture: TestFixture) {
  return compileCatalogue(await loadConfig(fixture.root));
}

/** Root stylesheet route for the fixture's default entry. */
export const entryStyle =
  "mokly-generated/styles/entries/fixture.mockup.tsx.css";

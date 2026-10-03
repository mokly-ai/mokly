import fs from "node:fs/promises";
import path from "node:path";

import { compileCatalogue } from "../../dist/build/compile.js";
import { writeCompilation } from "../../dist/build/transaction.js";

import { createExportFixture } from "./export_fixture.js";

/** Commit an older path layout while leaving canonical copies to prove metadata controls admission. */
export async function nestedBaselineFixture(context: {
  after(callback: () => Promise<void>): void;
}) {
  const fixture = await createExportFixture();
  context.after(() => fixture.close());
  const filename = path.join(fixture.mockupsDir, "mokly-manifest.json");
  const historical = JSON.parse(await fs.readFile(filename, "utf8"));
  historical.schemaVersion = 6;
  for (const entry of historical.entries) {
    entry.route = `legacy/nested/${entry.id}.html`;
    if (entry.kind === "screen") {
      entry.fragments = {
        mobile: `legacy/nested/${entry.id}.mobile.html`,
        desktop: `legacy/nested/${entry.id}.desktop.html`,
      };
    }
  }
  await fs.writeFile(filename, `${JSON.stringify(historical)}\n`);
  await fixture.git("add", "-A");
  await fixture.git("commit", "-qm", "test: older nested baseline");
  await fixture.git("update-ref", "refs/remotes/origin/main", "HEAD");
  await writeCompilation(
    await compileCatalogue(fixture.config),
    fixture.config,
  );
  return fixture;
}

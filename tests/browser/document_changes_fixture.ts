import fs from "node:fs";
import path from "node:path";

import { compileCatalogue } from "../../packages/mokly/dist/build/compile.js";
import { writeCompilation } from "../../packages/mokly/dist/build/transaction.js";
import { loadConfig } from "../../packages/mokly/dist/config/load.js";
import { loadCatalogueSnapshot } from "../../packages/mokly/dist/server/catalogue_snapshot.js";
import { startCatalogueServer } from "../../packages/mokly/dist/server/http.js";
import {
  createFixture,
  removeFixture,
  type TestFixture,
} from "../helpers/fixture.js";

/** A served catalogue whose Changes hold a folder member and a removed document. */
export interface DocumentChangesFixture {
  fixture: TestFixture;
  url: string;
  close(): Promise<void>;
}

/** A Markdown document deleted on this branch. */
const REMOVED_DOCUMENT = {
  folderTitles: ["Guide"],
  entry: {
    colorSchemes: ["light" as const],
    declaredDependencies: [],
    description: "The terms before this branch.",
    kind: "document" as const,
    path: "guide/old-terms",
    relatedDocs: [],
    resources: [],
    sourcePath: "entries/guide/old-terms.md",
    title: "Old terms",
  },
};

/** Profile is its folder's own page, listing a variant and two members. */
const SOURCE = `import { defineScreen } from "@mokly/mokly";
import React from "react";
const metadata = { dependencies: [], relatedDocs: [] };
const shot = (id: string) => ({ ...metadata, mobile: <main id={id}>{id}</main>, desktop: <main id={id}>{id}</main> });
export const profile = defineScreen({ ...shot("profile"), path: "account/profile", slug: "index", title: "Profile", description: "Profile", relatedDocs: ["entries/guide/terms.md"], variants: [{ ...shot("unverified"), slug: "unverified", title: "Unverified email", description: "Unverified email" }] });
export const security = defineScreen({ ...shot("security"), path: "account/profile/security", title: "Security", description: "Security" });
export const notifications = defineScreen({ ...shot("notifications"), path: "account/profile/notifications", title: "Notifications", description: "Notifications" });
`;

const README = `---
description: The guide's own page.
tags: ["handbook"]
---
# Guide

Read the [payment terms](terms.md).
`;

const TERMS = `---
description: When an invoice is due.
---
# Payment terms

Every invoice is due 30 days after it is issued.
`;

/** Build and serve the fixture with a fixed Changes snapshot. */
export async function startDocumentChangesFixture(): Promise<DocumentChangesFixture> {
  const fixture = await createFixture(SOURCE);
  try {
    const guide = path.join(fixture.entriesDir, "guide");
    await fs.promises.mkdir(guide, { recursive: true });
    await fs.promises.writeFile(path.join(guide, "README.md"), README);
    await fs.promises.writeFile(path.join(guide, "terms.md"), TERMS);
    await fs.promises.writeFile(
      fixture.configPath,
      `export default { colorSchemes: ["light", "dark"], roots: [{ dir: "entries" }], mockupsDir: "mockups", repoRoot: "." };\n`,
    );
    const config = await loadConfig(fixture.root);
    await writeCompilation(await compileCatalogue(config), config);
    const server = await startCatalogueServer(config, {
      base: "origin/main",
      snapshot: await loadCatalogueSnapshot(config, async () => ({
        movedEntries: [],
        schemaVersion: 2,
        baseRef: "origin/main",
        baseCommit: "a".repeat(40),
        changedEntries: ["account/profile/security", "guide/old-terms"],
        removedEntries: [REMOVED_DOCUMENT],
      })),
      port: 0,
    });
    return {
      async close(): Promise<void> {
        await server.close();
        await removeFixture(fixture);
      },
      fixture,
      url: server.url,
    };
  } catch (error) {
    await removeFixture(fixture);
    throw error;
  }
}

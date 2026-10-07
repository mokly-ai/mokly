import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { readCatalogue } from "@mokly/viewer";

import { compileCatalogue } from "../../dist/build/compile.js";
import { writeCompilation } from "../../dist/build/transaction.js";
import { loadConfig } from "../../dist/config/load.js";
import { serve } from "../../dist/server/serve.js";
import { createFixture, removeFixture } from "../helpers/fixture.js";
import { waitUntil } from "../helpers/wait_until.js";

const execute = promisify(execFile);

/** A served catalogue whose branch deleted a document captured before Dark. */
export interface LightOnlyDocumentHost {
  url: string;
  close(): Promise<void>;
}

const SOURCE = `import { defineScreen } from "@mokly/mokly";
import React from "react";
export const home = defineScreen({ path: "home", title: "Home", description: "Home", dependencies: [], relatedDocs: [], mobile: <main>Home</main>, desktop: <main>Home</main> });
`;

const OLD_TERMS = `---
description: The terms before this branch.
---
# Old terms

Every invoice was due 14 days after it was issued.
`;

async function waitForChanges(url: string): Promise<void> {
  await waitUntil(
    async () => {
      const model = readCatalogue(
        await (await fetch(`${url}/__mokly/catalogue.json`)).json(),
      );
      return model.changesStatus === "ready";
    },
    {
      timeoutMs: 30_000,
      intervalMs: 50,
      message: "The fixture did not publish its removed document",
    },
  );
}

/**
 * Commit a light-only catalogue with `guide/old-terms`, then add Dark and
 * delete the document on the working tree, so its retained version has no
 * dark render while the catalogue has a dark axis.
 */
export async function startLightOnlyDocument(): Promise<LightOnlyDocumentHost> {
  const fixture = await createFixture(SOURCE, {
    extraConfig: `colorSchemes: ["light"],`,
  });
  try {
    const document = path.join(fixture.entriesDir, "guide/old-terms.md");
    await fs.mkdir(path.dirname(document), { recursive: true });
    await fs.writeFile(document, OLD_TERMS);
    const baseline = await loadConfig(fixture.root);
    await writeCompilation(await compileCatalogue(baseline), baseline);
    const git = (...args: string[]) =>
      execute("git", args, { cwd: fixture.root });
    await git("init", "-q", "-b", "main");
    await git("config", "user.email", "test@example.invalid");
    await git("config", "user.name", "Test");
    await git("add", ".");
    await git("commit", "-qm", "test: light-only document baseline");
    const baseCommit = (await git("rev-parse", "HEAD")).stdout.trim();
    await git("update-ref", "refs/remotes/origin/main", baseCommit);
    const source = await fs.readFile(fixture.configPath, "utf8");
    await fs.writeFile(
      fixture.configPath,
      source.replace(
        `colorSchemes: ["light"],`,
        `colorSchemes: ["light", "dark"],`,
      ),
    );
    await fs.rm(document);
    const config = await loadConfig(fixture.root);
    await writeCompilation(await compileCatalogue(config), config);
    const running = await serve(config, {
      base: "origin/main",
      port: 0,
      watch: false,
    });
    try {
      await waitForChanges(running.url);
    } catch (error) {
      await running.close();
      throw error;
    }
    return {
      url: running.url,
      close: async () => {
        await running.close();
        await removeFixture(fixture);
      },
    };
  } catch (error) {
    await removeFixture(fixture);
    throw error;
  }
}

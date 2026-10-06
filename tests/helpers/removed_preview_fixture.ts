import { execFile, type PromiseWithChild } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { compileCatalogue } from "../../packages/mokly/dist/build/compile.js";
import { writeCompilation } from "../../packages/mokly/dist/build/transaction.js";
import { loadConfig } from "../../packages/mokly/dist/config/load.js";
import type { ResolvedConfig } from "../../packages/mokly/dist/config/types.js";

import { createFixture, removeFixture, type TestFixture } from "./fixture.js";

type CreateRemovedPreviewFixtureResult = TestFixture & {
  baseCommit: string;
  config: ResolvedConfig;
  git: (
    ...args: string[]
  ) => PromiseWithChild<{ stdout: string; stderr: string }>;
  output: string;
  close: () => Promise<void>;
};

const execute = promisify(execFile);

/**
 * A Git fixture whose baseline holds one page and two screens that the working
 * tree deletes. Their previous versions carry links, a form and enough content
 * to scroll, so read-only behavior can be exercised in a real browser. One
 * screen was captured in both schemes and the other in Light alone, so the
 * catalogue offers a theme control and the light-only fallback is reachable.
 */
export async function createRemovedPreviewFixture(): Promise<CreateRemovedPreviewFixtureResult> {
  const fixture = await createFixture(removedPreviewSource(false), {
    extraConfig: `colorSchemes: ["light", "dark"],`,
  });
  try {
    await fs.mkdir(path.join(fixture.mockupsDir, "assets"), {
      recursive: true,
    });
    await fs.writeFile(
      path.join(fixture.mockupsDir, "assets/archive.css"),
      "body { background: #f4efe4; } main { max-width: 42rem; margin: 0 auto; }",
    );
    const config = await loadConfig(fixture.root);
    await writeCompilation(await compileCatalogue(config), config);
    const git = (...args: string[]) =>
      execute("git", args, { cwd: fixture.root });
    await git("init", "-q", "-b", "main");
    await git("config", "user.email", "test@example.invalid");
    await git("config", "user.name", "Test");
    await git("add", ".");
    await git("commit", "-qm", "test: removed preview baseline");
    const baseCommit = (await git("rev-parse", "HEAD")).stdout.trim();
    await git("update-ref", "refs/remotes/origin/main", baseCommit);
    await fs.writeFile(fixture.entryPath, removedPreviewSource(true));
    await writeCompilation(await compileCatalogue(config), config);
    await fs.rm(path.join(fixture.mockupsDir, "assets/archive.css"));
    return {
      ...fixture,
      baseCommit,
      config,
      git,
      output: path.join(fixture.root, "site"),
      close: () => removeFixture(fixture),
    };
  } catch (error) {
    await removeFixture(fixture);
    throw error;
  }
}

const paragraphs = Array.from(
  { length: 40 },
  (_, index) => `<p>Archived paragraph ${index + 1}.</p>`,
).join("");

const links = `
  <meta http-equiv="refresh" content="3600; url=../current/index.mobile.html">
  <p><a href="mock:current">Marked catalogue link</a></p>
  <p><a href="../current/index.mobile.html">Relative link</a></p>
  <p><a href="https://example.invalid/away" target="_blank">External link</a></p>
  <p><a href="https://example.invalid/plain">Plain external link</a></p>
  <p><a download href="../assets/archive.css">Download link</a></p>
  <div><template shadowrootmode="open"><a href="../current/index.mobile.html">Shadow link</a></template></div>
  <svg viewBox="0 0 120 24" width="120" height="24"><a xlink:href="../current/index.mobile.html"><text x="0" y="18" font-size="16">SVG link</text></a></svg>
  <p><a href="#foot">Jump to the end</a></p>
  <form action="/submitted" method="get"><button type="submit">Send</button></form>
`;

function removedPreviewSource(current: boolean): string {
  const removed = current
    ? ""
    : `defineScreen({ ...metadata, path: "removed-screen", title: "Removed screen",
    colorSchemes: ["light"],
    mobile: <main id="top"><h1>Previous mobile screen</h1><div dangerouslySetInnerHTML={{ __html: ${JSON.stringify(links)} }} /><p id="foot">End of the archived screen.</p></main>,
    desktop: <main id="top"><h1>Previous desktop screen</h1><div dangerouslySetInnerHTML={{ __html: ${JSON.stringify(links)} }} /><p id="foot">End of the archived screen.</p></main>,
    useCasePaths: [] }),
  defineScreen({ ...metadata, path: "removed-dark", title: "Removed dark screen",
    colorSchemes: ["light", "dark"],
    mobile: <main><h1>Previous themed mobile screen</h1></main>,
    desktop: <main><h1>Previous themed desktop screen</h1></main>,
    useCasePaths: [] }),
  definePage({ ...metadata, path: "removed-page", title: "Removed page",
    render: () => ${JSON.stringify(
      `<!doctype html><html><head><link rel="stylesheet" href="../assets/archive.css"></head><body><main id="top"><h1>Previous page</h1>${links}${paragraphs}<p id="foot">End of the archived page.</p></main></body></html>`,
    )} }),`;
  return `import React from "react";
import { definePage, defineScreen } from "@mokly/mokly";
const metadata = { description: "Fixture", dependencies: [], relatedDocs: [] };
export const mockups = [
  defineScreen({ ...metadata, path: "current", title: "Current", colorSchemes: ["light"], mobile: <main>Current mobile</main>, desktop: <main>Current desktop</main>, useCasePaths: [] }),
  ${removed}
];`;
}

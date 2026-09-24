import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { compileCatalogue } from "../../dist/build/compile.js";
import { writeCompilation } from "../../dist/build/transaction.js";
import { loadConfig } from "../../dist/config/load.js";

import { createFixture, removeFixture } from "./fixture.js";

const execute = promisify(execFile);

/**
 * A Git fixture whose baseline holds one page and two screens that the working
 * tree deletes. Their previous versions carry links, a form and enough content
 * to scroll, so read-only behavior can be exercised in a real browser. One
 * screen was captured in both schemes and the other in Light alone, so the
 * catalogue offers a theme control and the light-only fallback is reachable.
 */
export async function createRemovedPreviewFixture() {
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
  <meta http-equiv="refresh" content="3600; url=../screens/current.mobile.html">
  <p><a href="mock:current">Marked catalogue link</a></p>
  <p><a href="../screens/current.mobile.html">Relative link</a></p>
  <p><a href="https://example.invalid/away" target="_blank">External link</a></p>
  <p><a href="https://example.invalid/plain">Plain external link</a></p>
  <p><a download href="../assets/archive.css">Download link</a></p>
  <div><template shadowrootmode="open"><a href="../screens/current.mobile.html">Shadow link</a></template></div>
  <svg viewBox="0 0 120 24" width="120" height="24"><a xlink:href="../screens/current.mobile.html"><text x="0" y="18" font-size="16">SVG link</text></a></svg>
  <p><a href="#foot">Jump to the end</a></p>
  <form action="/submitted" method="get"><button type="submit">Send</button></form>
`;

function removedPreviewSource(current: boolean): string {
  const removed = current
    ? ""
    : `defineScreen({ ...metadata, id: "removed-screen", title: "Removed screen", route: "screens/removed.html",
    colorSchemes: ["light"],
    mobile: <main id="top"><h1>Previous mobile screen</h1><div dangerouslySetInnerHTML={{ __html: ${JSON.stringify(links)} }} /><p id="foot">End of the archived screen.</p></main>,
    desktop: <main id="top"><h1>Previous desktop screen</h1><div dangerouslySetInnerHTML={{ __html: ${JSON.stringify(links)} }} /><p id="foot">End of the archived screen.</p></main>,
    useCaseIds: [] }),
  defineScreen({ ...metadata, id: "removed-dark", title: "Removed dark screen", route: "screens/removed-dark.html",
    colorSchemes: ["light", "dark"],
    mobile: <main><h1>Previous themed mobile screen</h1></main>,
    desktop: <main><h1>Previous themed desktop screen</h1></main>,
    useCaseIds: [] }),
  definePage({ ...metadata, id: "removed-page", title: "Removed page", route: "archive/removed.html",
    render: () => ${JSON.stringify(
      `<!doctype html><html><head><link rel="stylesheet" href="../assets/archive.css"></head><body><main id="top"><h1>Previous page</h1>${links}${paragraphs}<p id="foot">End of the archived page.</p></main></body></html>`,
    )} }),`;
  return `import React from "react";
import { defineCollection, definePage, defineScreen } from "@mokly/mokly";
const metadata = { description: "Fixture", relatedDocs: [] };
export const mockups = [
  defineCollection({ ...metadata, id: "fixture", title: "Fixture", childIds: ["current"${current ? "" : ', "removed-screen", "removed-dark", "removed-page"'}] }),
  defineScreen({ ...metadata, id: "current", title: "Current", route: "screens/current.html", colorSchemes: ["light"], mobile: <main>Current mobile</main>, desktop: <main>Current desktop</main>, useCaseIds: [] }),
  ${removed}
];`;
}

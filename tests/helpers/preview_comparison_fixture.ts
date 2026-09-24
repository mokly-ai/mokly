import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

import { compileCatalogue } from "../../dist/build/compile.js";
import { writeCompilation } from "../../dist/build/transaction.js";
import { loadConfig } from "../../dist/config/load.js";

import { comparisonEntrySource } from "./comparison_source.js";
import { createFixture, removeFixture, repositoryRoot } from "./fixture.js";

const execute = promisify(execFile);

/** Build a published catalogue against a real Git baseline and changed assets. */
export async function createPreviewComparisonFixture(
  entrySource: (changed: boolean) => string = comparisonDocumentSource,
) {
  const fixture = await createFixture(entrySource(false), {
    extraConfig:
      'colorSchemes: ["light", "dark"], stylesheets: [{ match: "**/*.html", stylesheets: ["styles.css"] }],',
  });
  try {
    const config = await loadConfig(fixture.root);
    await fs.promises.writeFile(
      path.join(fixture.root, ".gitignore"),
      ".context/\n.review/\n",
    );
    await fs.promises.writeFile(
      path.join(fixture.mockupsDir, "styles.css"),
      'body { color: red; background: url("./pixel.png"); }\n',
    );
    await fs.promises.writeFile(
      path.join(fixture.mockupsDir, "pixel.png"),
      Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZkcAAAAAASUVORK5CYII=",
        "base64",
      ),
    );
    await writeCompilation(await compileCatalogue(config), config);
    const git = (...args: string[]) =>
      execute("git", args, { cwd: fixture.root });
    await git("init", "-q");
    await git("config", "user.email", "test@example.invalid");
    await git("config", "user.name", "Test");
    await git("add", ".");
    await git("commit", "-qm", "test: published baseline");
    await git("update-ref", "refs/remotes/origin/main", "HEAD");
    await fs.promises.writeFile(fixture.entryPath, entrySource(true));
    await fs.promises.writeFile(
      path.join(fixture.mockupsDir, "styles.css"),
      'body { color: blue; background: url("./pixel.png"); }\n',
    );
    await writeCompilation(await compileCatalogue(config), config);
    await fs.promises.mkdir(config.review.outDir);
    await fs.promises.writeFile(
      path.join(config.review.outDir, "keep.txt"),
      "another server's comparison\n",
    );
    const output = path.join(fixture.root, ".context/published");
    const build = () =>
      execute(
        process.execPath,
        [
          "--input-type=module",
          "--eval",
          'import { loadConfig } from "./dist/config/load.js"; import { buildPreview } from "./scripts/preview/catalogue.mjs"; await buildPreview(await loadConfig(process.argv[1]), process.argv[2], { includeChanges: true });',
          fixture.root,
          output,
        ],
        { cwd: repositoryRoot },
      );
    await build();
    return {
      ...fixture,
      config,
      output,
      build,
      git,
      close: () => removeFixture(fixture),
    };
  } catch (error) {
    await removeFixture(fixture);
    throw error;
  }
}

/** Default fixture source: comparison screens plus whole-document pages. */
function comparisonDocumentSource(changed: boolean): string {
  return comparisonEntrySource(changed) + documentEntries(changed);
}

function documentEntries(current: boolean): string {
  return `
import { definePage } from "@mokly/mokly";
const documentMetadata = { description: "Document", dependencies: [], relatedDocs: [], tags: ["documents"] };
mockups.push(definePage({ ...documentMetadata, id: "handbook", title: "Handbook", route: "handbook.html", render: () => '<html><body><main id="overview">Handbook</main><a href="mock:home">Home</a></body></html>' }));
${current ? "" : 'mockups.push(definePage({ ...documentMetadata, navPath: ["Documents"], id: "removed-document", title: "Former handbook", route: "removed-document.html", render: () => "<html><body>Previous document</body></html>" }));'}
`;
}

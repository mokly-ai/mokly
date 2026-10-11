import fs from "node:fs/promises";
import path from "node:path";
import type { TestContext } from "node:test";

import { changedFixture } from "./changed_fixture.js";
import { validEntrySource, type TestFixture } from "./fixture.js";

export type InventoryKind =
  | "page"
  | "screen"
  | "Markdown"
  | "CSS"
  | "generated asset"
  | "copied asset"
  | "authored HTML";
export type InventoryEdit = "added" | "removed" | "renamed";
export const imageBytes = Buffer.from([0, 255, 128, 13, 10, 195, 40]);

/** Change real authored inputs; both sides compile through the normal producer. */
export async function inventoryComparisonFixture(
  t: TestContext,
  kind: InventoryKind,
  edit: InventoryEdit,
) {
  const fixture = await changedFixture(
    t,
    validEntrySource(),
    undefined,
    async (fixture) => install(fixture, kind, edit !== "added", "embed"),
  );
  const before = fixture.compilation;
  await install(
    fixture,
    kind,
    edit !== "removed",
    edit === "renamed" ? "next" : "embed",
    edit === "renamed",
  );
  await fixture.build();
  return { ...fixture, before, after: fixture.compilation };
}

async function install(
  fixture: TestFixture,
  kind: InventoryKind,
  present: boolean,
  name: string,
  moved = false,
) {
  for (const file of [
    "embedded.mockup.tsx",
    "embed.md",
    "next.md",
    "picture.png",
    "next.png",
    "guide.pdf",
    "entry.css",
  ])
    await fs.rm(path.join(fixture.entriesDir, file), { force: true });
  for (const file of ["embed.css", "next.css", "embed.html", "next.html"])
    await fs.rm(path.join(fixture.mockupsDir, file), { force: true });
  let body = "<p>Home</p>";
  let imports = "";
  if (kind === "page" || kind === "screen") {
    if (present) {
      const renderer =
        kind === "page"
          ? 'render: () => "<!doctype html><html><head><title>Embedded</title></head><body><p>Embedded</p></body></html>"'
          : "mobile: <main>Embedded</main>, desktop: <main>Embedded</main>, useCasePaths: []";
      await fs.writeFile(
        path.join(fixture.entriesDir, "embedded.mockup.tsx"),
        `import React from "react"; import { ${kind === "page" ? "definePage" : "defineScreen"} } from "@mokly/mokly";
export default ${kind === "page" ? "definePage" : "defineScreen"}({path:${JSON.stringify(name)},title:"Embedded",description:"Embedded",relatedDocs:[],${moved ? 'movedFrom:"embed",' : ""}${renderer}});`,
      );
      body += `<iframe title="Embedded" src="../${name}/index${kind === "screen" ? ".mobile" : ""}.html"/>`;
    }
  } else if (kind === "Markdown" || kind === "copied asset") {
    if (present || kind === "copied asset") {
      const entry = kind === "copied asset" ? "embed" : name;
      const image = name === "next" ? "next.png" : "picture.png";
      const markdown = `${moved && kind === "Markdown" ? "---\nmovedFrom: embed\n---\n" : ""}# Embedded\n\nBody.${present ? `\n\n![Picture](${image})\n\n[PDF](guide.pdf)` : ""}\n`;
      await fs.writeFile(
        path.join(fixture.entriesDir, `${entry}.md`),
        markdown,
      );
      if (present) {
        await fs.writeFile(path.join(fixture.entriesDir, image), imageBytes);
        await fs.writeFile(
          path.join(fixture.entriesDir, "guide.pdf"),
          "%PDF-1.4\nbytes",
        );
      }
      body += `<iframe title="Document" src="../${entry}/index.html"/>`;
    }
  } else if (kind === "generated asset") {
    imports = '\nimport "./entry.css";';
    const image = name === "next" ? "next.png" : "picture.png";
    await fs.writeFile(
      path.join(fixture.entriesDir, "entry.css"),
      present ? `main{background:url("./${image}")}` : "main{color:blue}",
    );
    if (present)
      await fs.writeFile(path.join(fixture.entriesDir, image), imageBytes);
  } else if (present) {
    const extension = kind === "CSS" ? "css" : "html";
    await fs.writeFile(
      path.join(fixture.mockupsDir, `${name}.${extension}`),
      kind === "CSS" ? "main{color:purple}" : "<p>Embedded authored HTML</p>",
    );
    body +=
      kind === "CSS"
        ? `<link rel="stylesheet" href="../../${name}.css"/>`
        : `<iframe title="Authored" src="../../${name}.html"/>`;
  }
  await fs.writeFile(fixture.entryPath, validEntrySource({ body }) + imports);
}

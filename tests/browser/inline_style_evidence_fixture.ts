import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

import { compileCatalogue } from "../../dist/build/compile.js";
import { writeCompilation } from "../../dist/build/transaction.js";
import { loadConfig } from "../../dist/config/load.js";
import { serve } from "../../dist/server/serve.js";
import { createFixture, removeFixture } from "../helpers/fixture.js";
import { waitForClassifiedCount } from "../helpers/watched_catalogue.js";

const BEFORE =
  "<style>.entry{color:red}.action{color:red}.unused{color:red}</style>";
const AFTER =
  "<style>.entry{color:blue}.action{color:blue}.unused{color:blue}</style>";

function entrySource(): string {
  return `import React from "react";
import { defineCollection, defineComponent, defineScreen } from "@mokly/mokly";
const metadata = { dependencies: ["notes.md"], relatedDocs: [] };
const action = defineComponent({ ...metadata,
  id: "action", title: "Action", description: "A shared action", route: "components/action.html",
  propSchema: { kind: "object", properties: { label: { schema: { kind: "string" } } } },
  render: (props) => <button className="action">{props.label}</button>,
  variants: [{ id: "default", title: "Default", props: { label: "Continue" } }]
});
export const mockups = [
  defineCollection({ ...metadata, id: "fixture", title: "Fixture", description: "Inline style evidence", childIds: ["matched", "excluded", "affected", "action"] }),
  defineScreen({ ...metadata, id: "matched", title: "Matched", description: "Entry-owned styles", route: "screens/matched.html",
    mobile: <main className="entry">Matched</main>, desktop: <main className="entry">Matched</main> }),
  defineScreen({ ...metadata, id: "excluded", title: "Welcome", description: "Excluded page styles", route: "screens/excluded.html",
    mobile: <main className="plain">Welcome</main>, desktop: <main className="plain">Welcome</main> }),
  defineScreen({ ...metadata, id: "affected", title: "Affected", description: "Component-owned styles", route: "screens/affected.html",
    mobile: <main><action.Component label="Affected" /></main>, desktop: <main><action.Component label="Affected" /></main> }),
  action.entry
];`;
}

function renderer(styles: string): string {
  return `import { renderToStaticMarkup } from "react-dom/server";
export default (input) => '<!doctype html><html><head>${styles}</head><body>' + renderToStaticMarkup(input.node) + '</body></html>';`;
}

/** Serve component-aware classification derived from three real inline cases. */
export async function inlineStyleEvidenceFixture() {
  const fixture = await createFixture(entrySource(), {
    extraConfig: 'renderer: "renderer.tsx",',
  });
  await fs.writeFile(path.join(fixture.root, "renderer.tsx"), renderer(BEFORE));
  const config = await loadConfig(fixture.root);
  await writeCompilation(await compileCatalogue(config), config);
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: fixture.root, stdio: "pipe" });
  git("init", "-q", "-b", "main");
  git("config", "user.name", "Mokly Test");
  git("config", "user.email", "mokly@example.invalid");
  git("add", ".");
  git("commit", "-qm", "test: catalogue baseline");
  await fs.writeFile(path.join(fixture.root, "renderer.tsx"), renderer(AFTER));
  await writeCompilation(await compileCatalogue(config), config);
  const running = await serve(config, { base: "main", port: 0, watch: false });
  try {
    await waitForClassifiedCount(running.url, 2);
  } catch (error) {
    await running.close();
    await removeFixture(fixture);
    throw error;
  }
  return {
    url: running.url,
    async close() {
      await running.close();
      await removeFixture(fixture);
    },
  };
}

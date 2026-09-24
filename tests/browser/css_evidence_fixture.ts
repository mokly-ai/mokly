import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

import { compileCatalogue } from "../../dist/build/compile.js";
import { writeCompilation } from "../../dist/build/transaction.js";
import { loadConfig } from "../../dist/config/load.js";
import { serve } from "../../dist/server/serve.js";
import { createFixture, removeFixture } from "../helpers/fixture.js";
import { waitForClassifiedCount } from "../helpers/watched_catalogue.js";

const BASELINE_CSS = ".auth { color: black; }\n.guide { color: black; }\n";
/** The Home screen's own copy, which a material fixture edits after baseline. */
const HOME_LABEL = "Sign in";

/**
 * Screens sharing a stylesheet, with optional component registration.
 *
 * Screen-only catalogues also carry `compact`, whose sign-in button exists on
 * mobile only, so one screen can hold a retained mobile view and a released
 * desktop view of the same stylesheet.
 */
function evidenceEntrySource(components: boolean, home: string): string {
  return `import React from "react";
import { defineComponent, defineScreen } from "@mokly/mokly";
const metadata = { dependencies: ["notes.md"], relatedDocs: [] };
const badge = defineComponent({ ...metadata,
  id: "badge", title: "Badge", description: "A shared badge", route: "components/badge.html", navPath: ["Fixture"],
  propSchema: { kind: "object", properties: { label: { schema: { kind: "string" } } } },
  render: (props) => <span className="badge">{props.label}</span>,
  variants: [{ id: "default", title: "Default", props: { label: "New" } }]
});
export const mockups = [
  ${components ? "badge.entry," : ""}
  defineScreen({ ...metadata, navPath: ["Fixture"], id: "home", title: "Home", description: "Home screen", route: "screens/home.html",
    mobile: <main id="home"><button className="auth">${home}</button></main>,
    desktop: <main id="home"><button className="auth">${home}</button></main> }),
  defineScreen({ ...metadata, navPath: ["Fixture"], id: "details", title: "Details", description: "Detail screen", route: "screens/details.html",
    mobile: <main id="details"><p className="guide">Guide</p></main>,
    desktop: <main id="details"><p className="guide">Guide</p></main> })${
      components
        ? ""
        : `,
  defineScreen({ ...metadata, navPath: ["Fixture"], id: "compact", title: "Compact", description: "Compact screen", route: "screens/compact.html",
    mobile: <main id="compact"><button className="auth">Sign in</button></main>,
    desktop: <main id="compact"><p className="note">Sign in on mobile</p></main> })`
    }
];
`;
}

/**
 * Serve a Git-backed catalogue whose shared stylesheet gained `rule`.
 *
 * `material` also edits the Home screen's own markup after the baseline
 * commit, so one view carries both a rendered change and stylesheet evidence.
 */
export async function cssEvidenceFixture(
  rule: string,
  changed: number,
  components = true,
  options: { material?: boolean } = {},
) {
  const fixture = await createFixture(
    evidenceEntrySource(components, HOME_LABEL),
    {
      extraConfig:
        'colorSchemes: ["light", "dark"], stylesheets: [{ match: "**/*.html", stylesheets: ["shared.css"] }],',
    },
  );
  const stylesheet = path.join(fixture.mockupsDir, "shared.css");
  await fs.writeFile(stylesheet, BASELINE_CSS);
  const config = await loadConfig(fixture.root);
  await writeCompilation(await compileCatalogue(config), config);
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: fixture.root, stdio: "pipe" });
  git("init", "-q", "-b", "main");
  git("config", "user.name", "Mokly Test");
  git("config", "user.email", "mokly@example.invalid");
  git("add", ".");
  git("commit", "-qm", "test: catalogue baseline");
  if (options.material)
    await fs.writeFile(
      fixture.entryPath,
      evidenceEntrySource(components, `${HOME_LABEL} now`),
    );
  await fs.appendFile(stylesheet, rule);
  await writeCompilation(await compileCatalogue(config), config);
  const running = await serve(config, { base: "main", port: 0, watch: false });
  try {
    await waitForClassifiedCount(running.url, changed);
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

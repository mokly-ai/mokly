import fs from "node:fs/promises";
import path from "node:path";

import { componentEntrySource } from "./component_fixture.js";
import { createFixture } from "./fixture.js";

export const declared = (action = "action.css", pane = "pane.css") =>
  componentEntrySource({
    body: '<pane.Component><action.Component label="Go" /></pane.Component><action.Component moklyInstance="hidden" label="Hidden" hidden />',
  })
    .replace(
      'id: "action",',
      `id: "action", stylesheets: [${JSON.stringify(action)}],`,
    )
    .replace(
      'id: "pane",',
      `id: "pane", stylesheets: [${JSON.stringify(pane)}],`,
    );

export async function fixtureWithSheets(source = declared(), rule?: string) {
  const fixture = await createFixture(source, {
    extraConfig:
      rule ?? 'stylesheets: [{ match: "**", stylesheets: ["base.css"] }],',
  });
  await fs.writeFile(
    path.join(fixture.mockupsDir, "action.css"),
    ".action{color:red}",
  );
  await fs.writeFile(
    path.join(fixture.mockupsDir, "pane.css"),
    ".pane{color:blue}",
  );
  await fs.writeFile(
    path.join(fixture.mockupsDir, "base.css"),
    "body{margin:0}",
  );
  return fixture;
}

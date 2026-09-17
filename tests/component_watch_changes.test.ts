import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { serve } from "../dist/server/serve.js";
import type { WorkspaceData } from "../packages/viewer/dist/shell/workspace_data.js";

import { changedFixture } from "./helpers/changed_fixture.js";
import { componentEntrySource } from "./helpers/component_fixture.js";
import {
  catalogue,
  changedCount,
  version,
  waitForChangedCount,
  waitForClassifiedCount,
} from "./helpers/watched_catalogue.js";

test(
  "watched component source and owned CSS stay out of consumer Changes until screen props change",
  { timeout: 60_000 },
  async (t) => {
    const source = componentEntrySource().replace(
      'id: "action",',
      'id: "action", dependencies: ["mockups/action.css"], ownedDependencies: ["mockups/action.css"],',
    );
    const fixture = await changedFixture(
      t,
      source,
      {
        extraConfig:
          'colorSchemes: ["light", "dark"], stylesheets: [{ match: "**", stylesheets: ["action.css"] }],',
      },
      async ({ mockupsDir }) => {
        await fs.writeFile(
          path.join(mockupsDir, "action.css"),
          "button{color:red}",
        );
      },
    );
    const server = await serve(fixture.config, {
      port: 0,
      base: "main",
      watch: true,
    });
    t.after(() => server.close());
    let html = await waitForClassifiedCount(server.url, 0);
    assert.equal(changedCount(html), 0);
    const workspace = async (route: string): Promise<WorkspaceData> => {
      const page = await catalogue(server.url + "/view/" + route);
      return JSON.parse(
        page.match(/data-workspace-data="">(.*?)<\/script>/s)![1]!,
      );
    };
    const edited = source.replace(
      "<button data-viewport=",
      '<button className="action" data-viewport=',
    );
    await fs.writeFile(fixture.entryPath, edited);
    html = await waitForChangedCount(server.url, version(html), 1);
    assert.equal((await workspace("screens/home.html")).change, undefined);
    assert.ok(
      (await workspace("components/action.html")).affected.some(
        (item) => item.route === "screens/home.html",
      ),
    );
    await fs.writeFile(
      path.join(fixture.mockupsDir, "action.css"),
      "button{color:green}",
    );
    html = await waitForChangedCount(server.url, version(html), 1);
    assert.equal((await workspace("screens/home.html")).change, undefined);
    await fs.writeFile(
      fixture.entryPath,
      edited.replaceAll('label="Finish"', 'label="Purchase"'),
    );
    await waitForChangedCount(server.url, version(html), 2);
    assert.equal(
      (await workspace("screens/home.html")).change?.after?.id,
      "home",
    );
    await assert.rejects(fs.stat(path.join(fixture.root, ".review")), {
      code: "ENOENT",
    });
    const response = await fetch(server.url + "/__mokly/diffs/review.json");
    assert.equal(response.status, 200);
    const review = await response.json();
    assert.equal(review.schemaVersion, 3);
    assert.deepEqual(
      review.changes
        .map((entry: { after: { id: string } }) => entry.after.id)
        .sort(),
      ["action", "home"],
    );
    assert.equal(changedCount(await catalogue(server.url)), 2);
  },
);

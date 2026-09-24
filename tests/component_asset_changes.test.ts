import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { writeCompilation } from "../dist/build/transaction.js";
import { loadConfig } from "../dist/config/load.js";
import { compareReview } from "../dist/review/compare.js";
import { computeChangedRoutes } from "../dist/server/changed.js";

import { componentEntrySource } from "./helpers/component_fixture.js";
import { componentGit } from "./helpers/component_review_fixture.js";
import { createFixture, removeFixture } from "./helpers/fixture.js";

for (const exact of [false, true])
  test(`owned dependency beats broad shared impact; exact screen dependency=${exact}`, async (t) => {
    const source = componentEntrySource()
      .replace('dependencies: ["notes.md"]', 'dependencies: ["shared"]')
      .replace(
        'id: "action",',
        'id: "action", ownedDependencies: ["shared/button.ts"], dependencies: ["shared/button.ts"],',
      )
      .replace(
        'id: "home",',
        `id: "home", ${exact ? 'dependencies: ["shared/button.ts"],' : ""}`,
      );
    const fixture = await createFixture(source);
    t.after(() => removeFixture(fixture));
    await fs.mkdir(path.join(fixture.root, "shared"));
    await fs.writeFile(
      path.join(fixture.root, "shared/button.ts"),
      "export const size = 1;",
    );
    await fs.writeFile(
      fixture.configPath,
      (await fs.readFile(fixture.configPath, "utf8")).replace(
        '["notes.md"]',
        '["shared/**"]',
      ),
    );
    const config = await loadConfig(fixture.root);
    const before = await compileCatalogue(config);
    await writeCompilation(before, config);
    const git = componentGit(before, ["shared/button.ts"]);
    const { result } = await compareReview(before, config, git, "main");
    assert.equal(result.schemaVersion, 3);
    if (result.schemaVersion !== 3) return;
    const expected = exact
      ? ["components/action.html", "screens/home.html"]
      : ["components/action.html"];
    assert.deepEqual(
      result.changes.map((entry) => entry.after!.route),
      expected,
    );
    assert.deepEqual(await computeChangedRoutes(config, "main", git), expected);
    assert.ok(
      result.affectedConsumers.some((item) => item.consumer.kind === "screen"),
    );
  });

for (const ownership of [
  "dependency",
  "renderer",
  "declared",
  "unowned",
] as const)
  test(`external styles retain real snapshots with ${ownership} attribution`, async (t) => {
    const source = componentEntrySource()
      .replace(
        "<button data-viewport=",
        '<button className="action" data-viewport=',
      )
      .replace(
        'id: "action",',
        ownership === "dependency"
          ? 'id: "action", ownedDependencies: ["mockups/action.css"], dependencies: ["mockups/action.css"],'
          : ownership === "declared"
            ? 'id: "action", stylesheets: ["action.css"],'
            : 'id: "action",',
      );
    const fixture = await createFixture(source, {
      extraConfig:
        ownership === "renderer"
          ? 'renderer: "renderer.tsx", stylesheets: [{ match: "**", stylesheets: ["action.css"] }],'
          : ownership === "declared"
            ? "stylesheets: [],"
            : 'stylesheets: [{ match: "**", stylesheets: ["action.css"] }],',
    });
    t.after(() => removeFixture(fixture));
    await fs.writeFile(
      path.join(fixture.mockupsDir, "action.css"),
      ".action{color:red}",
    );
    if (ownership === "renderer")
      await fs.writeFile(
        path.join(fixture.root, "renderer.tsx"),
        `import { renderToStaticMarkup } from "react-dom/server"; export default (input) => ({ html: '<html><head><link rel="stylesheet" href="' + input.stylesheets[0] + '"></head><body>' + renderToStaticMarkup(input.node) + '</body></html>', resources: [{ path: "action.css", componentIds: ["action"] }] });`,
      );
    const config = await loadConfig(fixture.root);
    const before = await compileCatalogue(config);
    const baseline = {
      ...before,
      outputs: new Map([
        ...before.outputs,
        ["action.css", ".action{color:red}"],
      ]),
    };
    await fs.writeFile(
      path.join(fixture.mockupsDir, "action.css"),
      ".action{color:green}",
    );
    const after = await compileCatalogue(config);
    await writeCompilation(after, config);
    const git = componentGit(baseline, ["mockups/action.css"]);
    const artifact = await compareReview(after, config, git, "main");
    assert.equal(artifact.result.schemaVersion, 3);
    if (artifact.result.schemaVersion !== 3) return;
    const expected =
      ownership === "unowned"
        ? [
            "components/action.html",
            "components/pane.html",
            "screens/home.html",
          ]
        : ["components/action.html"];
    assert.deepEqual(
      artifact.result.changes.map((entry) => entry.after!.route),
      expected,
    );
    assert.deepEqual(await computeChangedRoutes(config, "main", git), expected);
    assert.equal(
      Buffer.from(
        artifact.files.get("snapshots/before/action.css")!,
      ).toString(),
      ".action{color:red}",
    );
    assert.equal(
      Buffer.from(artifact.files.get("snapshots/after/action.css")!).toString(),
      ".action{color:green}",
    );
  });

for (const owned of [false, true])
  test(`head styling uses exact ownership; owned=${owned}`, async (t) => {
    const fixture = await createFixture(componentEntrySource(), {
      extraConfig: 'renderer: "renderer.tsx",',
    });
    t.after(() => removeFixture(fixture));
    const renderer = (color: string) =>
      `import { renderToStaticMarkup } from "react-dom/server"; export default (input) => { const css = '.action{color:${color}}'; const html = '<html><head><style>.global{display:block}' + css + '</style></head><body>' + renderToStaticMarkup(input.node) + '</body></html>'; return { html, ${owned ? 'styles: [{ startOffset: html.indexOf(css), endOffset: html.indexOf(css) + css.length, componentIds: ["action"] }]' : ""} }; };`;
    await fs.writeFile(
      path.join(fixture.root, "renderer.tsx"),
      renderer("red"),
    );
    const config = await loadConfig(fixture.root);
    const before = await compileCatalogue(config);
    await fs.writeFile(
      path.join(fixture.root, "renderer.tsx"),
      renderer("green"),
    );
    const after = await compileCatalogue(config);
    await writeCompilation(after, config);
    const git = componentGit(before, ["renderer.tsx"]);
    const { result } = await compareReview(after, config, git, "main");
    assert.equal(result.schemaVersion, 3);
    if (result.schemaVersion !== 3) return;
    assert.deepEqual(
      result.changes.map((entry) => entry.after!.route),
      owned
        ? ["components/action.html"]
        : [
            "components/action.html",
            "components/pane.html",
            "screens/home.html",
          ],
    );
  });

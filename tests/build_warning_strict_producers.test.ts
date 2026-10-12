import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { PlainReporter } from "../dist/cli/reporter/plain.js";
import { run } from "../dist/cli/run.js";
import { MoklyError } from "../dist/errors.js";

import {
  declared,
  fixtureWithSheets,
} from "./helpers/component_stylesheet_fixture.js";
import { removeFixture } from "./helpers/fixture.js";
import { memoryTerminal } from "./helpers/terminal.js";

const renderer = (
  owners: boolean,
) => `import { renderToStaticMarkup } from "react-dom/server";
export default (input) => ({ html: '<html><head></head><body>' + renderToStaticMarkup(input.node) + '</body></html>'${owners ? ', resources: [{ path: "action.css", componentIds: ["action"] }]' : ""} });`;

for (const producer of [
  "dependencies",
  "ownedDependencies",
  "sharedImpact",
  "folder",
  "duplicate",
  "missing",
  "owner",
] as const) {
  for (const command of ["build", "check"] as const) {
    test(`${command} --strict counts ${producer} warnings before writing or comparing`, async (t) => {
      let source = declared();
      if (producer === "dependencies")
        source = source.replace(
          'path: "home",',
          'path: "home", dependencies: [],',
        );
      if (producer === "ownedDependencies")
        source = source.replace(
          'path: "action",',
          'path: "action", ownedDependencies: [],',
        );
      if (producer === "folder")
        source =
          source.replace('path: "home",', 'path: "area/home",') +
          '\nimport { defineFolder } from "@mokly/mokly"; export const folder = defineFolder({ path: "area", dependencies: [] });';
      if (producer === "duplicate")
        source = source.replace(
          'stylesheets: ["action.css"]',
          'stylesheets: ["action.css", "action.css"]',
        );
      const fixture = await fixtureWithSheets(
        source,
        producer === "missing"
          ? 'renderer: "renderer.tsx", stylesheets: [{ match: "**", stylesheets: ["base.css"] }],'
          : producer === "owner"
            ? 'renderer: "renderer.tsx", stylesheets: [],'
            : "stylesheets: [],",
      );
      t.after(() => removeFixture(fixture));
      if (producer === "sharedImpact")
        await fs.writeFile(
          fixture.configPath,
          (await fs.readFile(fixture.configPath, "utf8")).replace(
            'review: { outDir: ".review" }',
            'review: { outDir: ".review", sharedImpact: [] }',
          ),
        );
      if (producer === "owner" || producer === "missing")
        await fs.writeFile(
          path.join(fixture.root, "renderer.tsx"),
          renderer(producer === "owner"),
        );
      const before = await fs.readdir(fixture.mockupsDir);
      const terminal = memoryTerminal({ isTTY: false });
      const reporter = new PlainReporter(terminal.environment);
      try {
        await assert.rejects(
          run(
            [command, "--strict", "--config", fixture.configPath],
            fixture.root,
            terminal.environment,
            reporter,
          ),
          (error: unknown) => {
            const count = terminal
              .stderr()
              .split("\n")
              .filter((line) => line.startsWith("[mokly/warning]")).length;
            assert.ok(count > 0, terminal.stderr());
            assert.ok(error instanceof MoklyError);
            assert.equal(error.code, "build-invalid");
            assert.equal(
              error.message,
              `[mokly/build-invalid] ${count} build ${count === 1 ? "warning" : "warnings"} with --strict`,
            );
            return true;
          },
        );
        assert.deepEqual(await fs.readdir(fixture.mockupsDir), before);
        assert.doesNotMatch(terminal.stdout(), /Generated|current|untracked/);
      } finally {
        reporter.close();
      }
    });
  }
}

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import test from "node:test";

import { PlainReporter } from "../dist/cli/reporter/plain.js";
import { RichReporter } from "../dist/cli/reporter/rich.js";
import { run } from "../dist/cli/run.js";

import {
  declared,
  fixtureWithSheets,
} from "./helpers/component_stylesheet_fixture.js";
import { createExportFixture } from "./helpers/export_fixture.js";
import {
  createFixture,
  removeFixture,
  validEntrySource,
} from "./helpers/fixture.js";
import { memoryTerminal } from "./helpers/terminal.js";

const entryWarning =
  '[mokly/warning] dependencies has been removed; ignoring it on entry "home". Delete the field.\n';
const configWarning =
  "[mokly/warning] review.sharedImpact has been removed; ignoring it. Delete the field.\n";
const expectedWarnings = entryWarning + configWarning;

function sourceWithRemovedField(): string {
  return validEntrySource().replace(
    'id: "home",',
    'dependencies: undefined, id: "home",',
  );
}

async function addRemovedConfigField(configPath: string): Promise<void> {
  const source = await fs.readFile(configPath, "utf8");
  assert.match(source, /review: \{ outDir: "\.review" \}/);
  await fs.writeFile(
    configPath,
    source.replace(
      'review: { outDir: ".review" }',
      'review: { outDir: ".review", sharedImpact: undefined }',
    ),
  );
}

async function execute(
  root: string,
  configPath: string,
  command: readonly string[],
  mode: "plain" | "rich" = "plain",
  extraEnv: NodeJS.ProcessEnv = {},
) {
  const terminal = memoryTerminal({
    isTTY: false,
    ...(mode === "rich" ? { columns: 120 } : {}),
    env: { ...process.env, MOKLY_OUTPUT: mode, NO_COLOR: "1", ...extraEnv },
  });
  const reporter =
    mode === "plain"
      ? new PlainReporter(terminal.environment)
      : new RichReporter(terminal.environment);
  try {
    const code = await run(
      [...command, "--config", configPath],
      root,
      terminal.environment,
      reporter,
    );
    return { code, stdout: terminal.stdout(), stderr: terminal.stderr() };
  } finally {
    reporter.close();
  }
}

test("build and check ignore removed fields, warn once and keep plain success bytes", async (context) => {
  const fixture = await createFixture(sourceWithRemovedField());
  context.after(() => removeFixture(fixture));
  await addRemovedConfigField(fixture.configPath);
  const built = await execute(fixture.root, fixture.configPath, ["build"]);
  assert.equal(built.code, 0);
  assert.match(built.stdout, /^Generated \d+ Mokly files\.\n$/);
  assert.equal(built.stderr, expectedWarnings);
  const checked = await execute(fixture.root, fixture.configPath, ["check"]);
  assert.equal(checked.code, 0);
  assert.match(checked.stdout, /^Mokly output is current \(\d+ files\)\.\n$/);
  assert.equal(checked.stderr, expectedWarnings);
});

test("rich build reports the same warnings without an error or exit change", async (context) => {
  const fixture = await createFixture(sourceWithRemovedField());
  context.after(() => removeFixture(fixture));
  await addRemovedConfigField(fixture.configPath);
  const result = await execute(
    fixture.root,
    fixture.configPath,
    ["build"],
    "rich",
  );
  assert.equal(result.code, 0);
  assert.match(result.stdout, /Generated \d+ files/);
  assert.equal(
    result.stderr,
    expectedWarnings.replaceAll("[mokly/warning]", "  !"),
  );
});

test("build warnings redact configured CLI secrets before terminal output", async (context) => {
  const fixture = await createFixture(sourceWithRemovedField());
  context.after(() => removeFixture(fixture));
  const result = await execute(
    fixture.root,
    fixture.configPath,
    ["build"],
    "plain",
    { MOKLY_TOKEN: "home" },
  );
  assert.equal(result.code, 0);
  assert.match(result.stderr, /entry "\[REDACTED\]"/);
  assert.doesNotMatch(result.stderr, /entry "home"/);
});

test("export collects config and registry warnings without changing delivery", async (context) => {
  const fixture = await createExportFixture();
  context.after(() => fixture.close());
  await fs.writeFile(fixture.entryPath, sourceWithRemovedField());
  await addRemovedConfigField(fixture.configPath);
  const result = await execute(fixture.root, fixture.configPath, [
    "export",
    "--out",
    "site",
  ]);
  assert.equal(result.code, 0);
  assert.match(result.stdout, /Exported Mokly to /);
  assert.equal(result.stderr, expectedWarnings);
  assert.ok(await fs.stat(path.join(fixture.output, "index.html")));
});

test("publish collects warnings through export and still uploads successfully", async (context) => {
  const fixture = await createExportFixture();
  context.after(() => fixture.close());
  await fs.writeFile(fixture.entryPath, sourceWithRemovedField());
  await addRemovedConfigField(fixture.configPath);
  let uploads = 0;
  const receiver = http.createServer((_request, response) => {
    uploads += 1;
    response.writeHead(204).end();
  });
  await new Promise<void>((resolve) =>
    receiver.listen(0, "127.0.0.1", resolve),
  );
  context.after(
    () => new Promise<void>((resolve) => receiver.close(() => resolve())),
  );
  const port = (receiver.address() as { port: number }).port;
  const result = await execute(fixture.root, fixture.configPath, [
    "publish",
    "--no-changes",
    "--out",
    "site",
    "--endpoint",
    `http://127.0.0.1:${port}/upload`,
    "--token",
    "fixture-token",
    "--repository",
    "github.com/example/catalogue",
  ]);
  assert.equal(result.code, 0);
  assert.match(result.stdout, /Published Mokly catalogue/);
  assert.equal(result.stderr, expectedWarnings);
  assert.equal(uploads, 1);
});

test("one build reports duplicate declarations, missing anchors and ignored owners once per identity", async (context) => {
  const source = declared().replace(
    'stylesheets: ["action.css"]',
    'stylesheets: ["action.css", "action.css"]',
  );
  const fixture = await fixtureWithSheets(
    source,
    'renderer: "renderer.tsx", stylesheets: [{ match: "**", stylesheets: ["base.css"] }],',
  );
  context.after(() => removeFixture(fixture));
  await fs.writeFile(
    path.join(fixture.root, "renderer.tsx"),
    `import { renderToStaticMarkup } from "react-dom/server";
export default (input) => ({ html: '<html><head></head><body>' + renderToStaticMarkup(input.node) + '</body></html>', resources: [{ path: "action.css", componentIds: ["action"] }] });`,
  );
  const result = await execute(fixture.root, fixture.configPath, ["build"]);
  assert.equal(result.code, 0);
  const lines = result.stderr.trim().split("\n");
  assert.equal(
    lines.filter((line) =>
      line.includes(
        'duplicate component stylesheet "action.css" on component "action"',
      ),
    ).length,
    1,
  );
  assert.equal(
    lines.filter((line) =>
      line.includes(
        'configured stylesheet link "../base.css" is absent from "screens/home.mobile.html"',
      ),
    ).length,
    1,
  );
  assert.equal(
    lines.filter((line) =>
      line.includes(
        'renderer resources for declared stylesheet "action.css" on "screens/home.mobile.html"',
      ),
    ).length,
    1,
  );
  assert.ok(lines.every((line) => line.startsWith("[mokly/warning] ")));
});

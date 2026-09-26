import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test, { type TestContext } from "node:test";

import { fixtureWithSheets } from "./helpers/component_stylesheet_fixture.js";
import {
  createFixture,
  removeFixture,
  repositoryRoot,
  validEntrySource,
} from "./helpers/fixture.js";

const cli = path.join(repositoryRoot, "dist/cli/bin.js");

async function startServe(
  context: TestContext,
  root: string,
  configPath: string,
  watch: boolean,
) {
  const child = spawn(
    process.execPath,
    [
      cli,
      "serve",
      "--config",
      configPath,
      "--port",
      "0",
      ...(watch ? [] : ["--no-watch"]),
    ],
    {
      cwd: root,
      env: { ...process.env, MOKLY_OUTPUT: "plain", NO_COLOR: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk: Buffer) => {
    stdout += chunk.toString();
  });
  child.stderr.on("data", (chunk: Buffer) => {
    stderr += chunk.toString();
  });
  context.after(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGTERM");
      await new Promise((resolve) => child.once("exit", resolve));
    }
  });
  await waitFor(
    () => /Mokly listening at (http:\/\/127\.0\.0\.1:\d+)/.test(stdout),
    () => stderr,
    child,
  );
  const url = stdout.match(
    /Mokly listening at (http:\/\/127\.0\.0\.1:\d+)/,
  )![1]!;
  return { child, url, stderr: () => stderr, stdout: () => stdout };
}

async function waitFor(
  ready: () => boolean,
  stderr: () => string,
  child: ChildProcess,
): Promise<void> {
  for (let attempt = 0; attempt < 1_200; attempt += 1) {
    if (ready()) return;
    if (child.exitCode !== null) assert.fail(`Serve exited: ${stderr()}`);
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  assert.fail(`Serve timed out: ${stderr()}`);
}

test(
  "unwatched Serve warns about removed inputs before readiness without failing",
  { timeout: 45_000 },
  async (context) => {
    const source = validEntrySource().replace(
      'id: "home",',
      'dependencies: undefined, id: "home",',
    );
    const fixture = await createFixture(source);
    context.after(() => removeFixture(fixture));
    await fs.writeFile(
      fixture.configPath,
      (await fs.readFile(fixture.configPath, "utf8")).replace(
        'review: { outDir: ".review" }',
        'review: { outDir: ".review", sharedImpact: undefined }',
      ),
    );
    const running = await startServe(
      context,
      fixture.root,
      fixture.configPath,
      false,
    );
    assert.match(running.stdout(), /Mokly listening at .*\n$/);
    assert.equal(
      running.stderr(),
      '[mokly/warning] dependencies has been removed; ignoring it on entry "home". Delete the field.\n' +
        "[mokly/warning] review.sharedImpact has been removed; ignoring it. Delete the field.\n",
    );
    assert.equal((await fetch(`${running.url}/`)).status, 200);
  },
);

test(
  "watched Serve forwards and deduplicates child render warnings",
  { timeout: 60_000 },
  async (context) => {
    const fixture = await fixtureWithSheets(
      undefined,
      'renderer: "renderer.tsx", stylesheets: [],',
    );
    context.after(() => removeFixture(fixture));
    await fs.writeFile(
      path.join(fixture.root, "renderer.tsx"),
      `import { renderToStaticMarkup } from "react-dom/server";
export default (input) => { const html = '<html><head></head><body>' + renderToStaticMarkup(input.node) + '</body></html>'; return input.entry.id === "home" ? { html, resources: [{path: "action.css", componentIds: ["action"]}] } : { html }; };`,
    );
    const running = await startServe(
      context,
      fixture.root,
      fixture.configPath,
      true,
    );
    const warning =
      '[mokly/warning] renderer resources for declared stylesheet "action.css" on "screens/home.mobile.html" are ignored; Mokly derives owners from rendered components.';
    for (let attempt = 0; attempt < 2; attempt += 1)
      assert.equal(
        (await fetch(`${running.url}/static/screens/home.mobile.html`)).status,
        200,
      );
    await waitFor(
      () => running.stderr().includes(warning),
      running.stderr,
      running.child,
    );
    assert.equal(running.stderr().split(warning).length - 1, 1);
    assert.doesNotMatch(running.stderr(), /\[mokly\/build-invalid\]/);
  },
);

test(
  "watched reconfiguration reports a removed config field once per rebuild",
  { timeout: 60_000 },
  async (context) => {
    const fixture = await createFixture();
    context.after(() => removeFixture(fixture));
    const original = await fs.readFile(fixture.configPath, "utf8");
    const configured = original.replace(
      'review: { outDir: ".review" }',
      'review: { outDir: ".review", sharedImpact: undefined }',
    );
    await fs.writeFile(fixture.configPath, configured);
    const running = await startServe(
      context,
      fixture.root,
      fixture.configPath,
      true,
    );
    const warning =
      "[mokly/warning] review.sharedImpact has been removed; ignoring it. Delete the field.";
    assert.equal(running.stderr().split(warning).length - 1, 1);
    await fs.writeFile(
      fixture.configPath,
      configured.replace("sharedImpact: undefined", "sharedImpact: []"),
    );
    await waitFor(
      () => running.stderr().split(warning).length - 1 >= 2,
      running.stderr,
      running.child,
    );
    assert.equal(running.stderr().split(warning).length - 1, 2);
  },
);

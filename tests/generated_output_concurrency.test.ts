import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { compileCatalogue, type Compilation } from "../dist/build/compile.js";
import { generatedBytes } from "../dist/build/generated_file.js";
import { writeCompilation } from "../dist/build/transaction.js";
import { loadConfig } from "../dist/config/load.js";
import { exportCatalogue } from "../dist/export/run.js";

import {
  createFixture,
  removeFixture,
  repositoryRoot,
  type TestFixture,
} from "./helpers/fixture.js";
import {
  allSettledOrThrow,
  screensSource,
  treeFiles,
} from "./helpers/generated_output_fixture.js";

async function assertTree(
  fixture: TestFixture,
  compilation: Compilation,
): Promise<void> {
  assert.deepEqual(
    await treeFiles(fixture.mockupsDir),
    [...compilation.outputs.keys()].sort(),
  );
  const screens = compilation.manifest.entries.filter(
    (entry) => entry.kind === "screen",
  );
  assert.ok(
    screens.every((entry) =>
      compilation.outputs.has(`${entry.path}/index.mobile.html`),
    ),
  );
  assert.deepEqual(
    (await fs.readdir(path.join(fixture.mockupsDir, "fixture/nested"))).sort(),
    screens.map((entry) => path.posix.basename(entry.path)).sort(),
    "completed transactions prune every obsolete screen directory",
  );
  for (const [route, content] of compilation.outputs)
    assert.deepEqual(
      await fs.readFile(path.join(fixture.mockupsDir, route)),
      generatedBytes(content),
      route,
    );
}

function module(relative: string): string {
  return JSON.stringify(
    pathToFileURL(path.join(repositoryRoot, "dist", relative)).href,
  );
}

/** Another process that compiles the fixture, then writes it on request. */
function writerProcess(root: string, rounds: number): ChildProcess {
  const script = `import { compileCatalogue } from ${module("build/compile.js")};
import { writeCompilation } from ${module("build/transaction.js")};
import { loadConfig } from ${module("config/load.js")};
const root = ${JSON.stringify(root)};
const compilation = await compileCatalogue(await loadConfig(root));
process.send({ type: "ready" });
process.once("message", async () => {
  try {
    for (let round = 0; round < ${rounds}; round += 1)
      await writeCompilation(compilation, await loadConfig(root));
    process.send({ type: "done" }, () => process.disconnect());
  } catch (error) {
    process.send({ type: "failed", message: String(error?.message ?? error) }, () => process.disconnect());
  }
});`;
  return spawn(process.execPath, ["--input-type=module", "-e", script], {
    cwd: root,
    stdio: ["ignore", "ignore", "inherit", "ipc"],
  });
}

function nextMessage(child: ChildProcess, expected: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const onMessage = (message: { type?: string; message?: string }) => {
      child.off("exit", onExit);
      if (message.type === expected) resolve();
      else reject(new Error(`writer process failed: ${message.message}`));
    };
    const onExit = (code: number | null) => {
      child.off("message", onMessage);
      reject(new Error(`writer process exited (${code}) before ${expected}`));
    };
    child.once("message", onMessage);
    child.once("exit", onExit);
  });
}

test(
  "concurrent generated-output writers leave exactly the later complete compilation",
  { timeout: 120_000 },
  async (context) => {
    const fixture = await createFixture(screensSource(120, "Alpha"));
    context.after(() => removeFixture(fixture));
    const alpha = await compileCatalogue(await loadConfig(fixture.root));
    await fs.writeFile(fixture.entryPath, screensSource(80, "Beta"));
    const beta = await compileCatalogue(await loadConfig(fixture.root));
    assert.ok(alpha.outputs.size > beta.outputs.size);
    for (let round = 0; round < 4; round += 1) {
      const finished: Compilation[] = [];
      await allSettledOrThrow(
        [alpha, beta].map(async (compilation) => {
          await writeCompilation(compilation, await loadConfig(fixture.root));
          finished.push(compilation);
        }),
      );
      await assertTree(fixture, finished.at(-1)!);
    }
  },
);

test(
  "generated-output writers in two processes complete without interleaving",
  { timeout: 120_000 },
  async (context) => {
    const fixture = await createFixture(screensSource(120, "Shared"));
    context.after(() => removeFixture(fixture));
    const compilation = await compileCatalogue(await loadConfig(fixture.root));
    const child = writerProcess(fixture.root, 4);
    context.after(() => {
      if (child.exitCode === null) child.kill();
    });
    await nextMessage(child, "ready");
    const done = nextMessage(child, "done");
    child.send("write");
    await allSettledOrThrow([
      done,
      (async () => {
        for (let round = 0; round < 4; round += 1)
          await writeCompilation(compilation, await loadConfig(fixture.root));
      })(),
    ]);
    await assertTree(fixture, compilation);
  },
);

test(
  "export captures complete generated output while another writer rewrites it",
  { timeout: 120_000 },
  async (context) => {
    const fixture = await createFixture(
      `${screensSource(60, "Export")}import "./fixture.css";\n`,
    );
    context.after(() => removeFixture(fixture));
    await fs.writeFile(
      path.join(fixture.entriesDir, "fixture.css"),
      'main{background:url("./large.png")}',
    );
    await fs.writeFile(
      path.join(fixture.entriesDir, "large.png"),
      Buffer.alloc(2 * 1024 * 1024, 7),
    );
    const compilation = await compileCatalogue(await loadConfig(fixture.root));
    assert.ok(
      compilation.outputs.has("mokly-generated/assets/entries/large.png"),
    );
    await writeCompilation(compilation, await loadConfig(fixture.root));
    let exporting = true;
    let writes = 0;
    const writer = (async () => {
      while (exporting) {
        await writeCompilation(compilation, await loadConfig(fixture.root));
        writes += 1;
      }
    })();
    const exported = exportCatalogue(await loadConfig(fixture.root), {
      outDir: "site",
      noChanges: true,
    }).finally(() => {
      exporting = false;
    });
    const [result] = await allSettledOrThrow<unknown>([exported, writer]);
    assert.ok(result);
    assert.ok(writes > 0, "the other writer ran during the export");
    await assertTree(fixture, compilation);
  },
);

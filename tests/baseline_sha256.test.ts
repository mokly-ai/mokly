import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { compileCatalogue } from "../dist/build/compile.js";
import { generatedBytes } from "../dist/build/generated_file.js";
import { writeCompilation } from "../dist/build/transaction.js";
import { loadConfig } from "../dist/config/load.js";
import { NodeGitCommandRunner } from "../dist/review/git.js";
import { prepareReviewRepository } from "../dist/review/prepare.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";

const execute = promisify(execFile);
const binary = Buffer.from([0, 255, 128, 13, 10, 0, 195, 40]);
for (const state of ["complete", "missing", "stale", "extra"] as const) {
  test(`SHA-256 Git inventory selects ${state} output and retains opaque blob bytes`, async (t) => {
    const fixture = await createFixture();
    t.after(() => removeFixture(fixture));
    const git = (...args: string[]) =>
      execute("git", args, { cwd: fixture.root });
    await git("init", "-q", "--object-format=sha256");
    await git("config", "user.name", "Test");
    await git("config", "user.email", "test@example.invalid");
    await fs.appendFile(fixture.entryPath, '\nimport "./binary.css";');
    await fs.writeFile(
      path.join(fixture.entriesDir, "binary.css"),
      'main{background:url("./binary.png")}',
    );
    await fs.writeFile(path.join(fixture.entriesDir, "binary.png"), binary);
    await fs.writeFile(
      fixture.configPath,
      (await fs.readFile(fixture.configPath, "utf8")).replace(
        'sharedImpact: ["notes.md"]',
        'sharedImpact: ["notes.md"], baselineBuild: [["node", "baseline.mjs"]]',
      ),
    );
    const config = await loadConfig(fixture.root);
    const compiled = await compileCatalogue(config);
    assert.equal(compiled.manifest.blobHashAlgorithm, "sha256");
    assert.ok(
      compiled.manifest.generatedFiles.every((file) =>
        /^[a-f0-9]{64}$/.test(file.blobHash),
      ),
    );
    await writeCompilation(compiled, config);
    const resource = "assets/entries/binary.png";
    const expectedHash = compiled.manifest.generatedFiles.find(
      (file) => file.path === resource,
    )!.blobHash;
    assert.equal(
      (
        await git("hash-object", path.join(config.generatedDir, resource))
      ).stdout.trim(),
      expectedHash,
    );
    await fs.writeFile(
      path.join(fixture.root, "baseline-output.json"),
      JSON.stringify(
        [...compiled.outputs].map(([route, value]) => [
          route,
          generatedBytes(value).toString("base64"),
        ]),
      ),
    );
    await fs.writeFile(
      path.join(fixture.root, "baseline.mjs"),
      `import fs from "node:fs/promises"; import path from "node:path";
await fs.rm("mockups/mokly-generated", {recursive:true,force:true});
for(const [route, base64] of JSON.parse(await fs.readFile("baseline-output.json","utf8"))) {
const file=path.join("mockups/mokly-generated",route);await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,Buffer.from(base64,"base64")); }
`,
    );
    if (state === "missing")
      await fs.rm(path.join(config.generatedDir, resource));
    if (state === "stale")
      await fs.writeFile(
        path.join(config.generatedDir, resource),
        Buffer.from([1, 2, 3]),
      );
    if (state === "extra")
      await fs.writeFile(path.join(config.generatedDir, "extra.txt"), "extra");
    await git("add", ".");
    await git("add", "-f", "mockups/mokly-generated");
    await git("commit", "-qm", "test: SHA-256 baseline");
    const runner = new NodeGitCommandRunner(fixture.root);
    const commands: readonly string[][] = [];
    const selected = await prepareReviewRepository(config, "HEAD", {
      runner: {
        run(args) {
          (commands as string[][]).push([...args]);
          return runner.run(args);
        },
        runBytes: (args) => runner.runBytes(args),
      },
      notice() {},
    });
    assert.match(selected.commit, /^[a-f0-9]{64}$/);
    assert.equal(
      selected.selection,
      state === "complete" ? "blobs" : "rebuild",
    );
    assert.equal(commands.filter((args) => args[0] === "ls-tree").length, 1);
    const filename = `mockups/mokly-generated/${resource}`;
    assert.deepEqual(
      Buffer.from(
        await selected.reader.readFileBytes(selected.commit, filename),
      ),
      binary,
    );
    const files = await selected.reader.readFiles!(selected.commit, [filename]);
    const file = files.get(filename);
    assert.equal(file?.kind, "regular");
    if (file?.kind === "regular")
      assert.deepEqual(Buffer.from(file.bytes), binary);
  });
}

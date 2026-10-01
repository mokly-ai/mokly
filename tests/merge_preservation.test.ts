import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const script = path.resolve("scripts/verification/merge-preservation.mjs");

async function repository(context: {
  after(cleanup: () => Promise<void>): void;
}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-preservation-"));
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  const lines = Array.from({ length: 30 }, (_, index) => `Line ${index + 1}`);
  const document = path.join(root, "contract.md");
  git("init", "-q", "-b", "main");
  git("config", "user.name", "Mokly Test");
  git("config", "user.email", "mokly@example.invalid");
  await fs.writeFile(document, `${lines.join("\n")}\n`);
  git("add", ".");
  git("commit", "-qm", "baseline");
  git("branch", "feature");
  return { root, git, lines, document };
}

function check(root: string, ...args: string[]) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    encoding: "utf8",
  });
}

async function change(
  document: string,
  lines: readonly string[],
  edits: readonly [number, string][],
) {
  const changed = [...lines];
  for (const [line, value] of edits) changed[line - 1] = value;
  await fs.writeFile(document, `${changed.join("\n")}\n`);
  return changed;
}

test("a clean automatic merge passes in-progress and committed modes", async (context) => {
  const { root, git, lines, document } = await repository(context);
  git("checkout", "-q", "feature");
  await change(document, lines, [[3, "Feature-specific passage"]]);
  git("add", ".");
  git("commit", "-qm", "feature passage");
  git("checkout", "-q", "main");
  await change(document, lines, [[25, "Main-specific passage"]]);
  git("add", ".");
  git("commit", "-qm", "main passage");
  git("checkout", "-q", "feature");
  git("merge", "--no-commit", "--no-ff", "main");
  assert.equal(check(root).status, 0);
  git("commit", "-qm", "merge passages");
  assert.equal(check(root).status, 0);
});

test("taking one side of a conflict reports the other side's independent hunk", async (context) => {
  const { root, git, lines, document } = await repository(context);
  git("checkout", "-q", "feature");
  const ours = await change(document, lines, [
    [2, "Feature conflict"],
    [20, "Feature independent passage"],
  ]);
  git("add", ".");
  git("commit", "-qm", "feature passages");
  git("checkout", "-q", "main");
  await change(document, lines, [
    [2, "Main conflict"],
    [25, "Main independent passage"],
  ]);
  git("add", ".");
  git("commit", "-qm", "main passages");
  git("checkout", "-q", "feature");
  const merge = spawnSync("git", ["merge", "--no-commit", "--no-ff", "main"], {
    cwd: root,
    encoding: "utf8",
  });
  assert.notEqual(merge.status, 0);
  await fs.writeFile(document, `${ours.join("\n")}\n`);
  git("add", "contract.md");
  const missing = check(root);
  assert.equal(missing.status, 1);
  assert.match(
    missing.stderr,
    /contract\.md \(theirs, base lines 25-25\):\n {4}Main independent passage/u,
  );
  git("commit", "-qm", "merge with missing passage");
  const mergeCommit = git("rev-parse", "HEAD");
  assert.equal(check(root, mergeCommit).status, 1);
  const repaired = [...ours];
  repaired[24] = "Main independent passage";
  await fs.writeFile(document, `${repaired.join("\n")}\n`);
  git("add", "contract.md");
  git("commit", "-qm", "restore passage");
  assert.equal(check(root, mergeCommit, "--result", "HEAD").status, 0);
});

test("moving one-sided text to another path is still reported", async (context) => {
  const { root, git, lines, document } = await repository(context);
  git("checkout", "-q", "feature");
  await change(document, lines, [[3, "A feature-only paragraph moved later"]]);
  git("add", ".");
  git("commit", "-qm", "feature paragraph");
  git("checkout", "-q", "main");
  await change(document, lines, [[25, "A separate main paragraph"]]);
  git("add", ".");
  git("commit", "-qm", "main paragraph");
  git("checkout", "-q", "feature");
  git("merge", "--no-commit", "--no-ff", "main");
  git("commit", "-qm", "merge paragraphs");
  const mergeCommit = git("rev-parse", "HEAD");
  const result = (await fs.readFile(document, "utf8")).replace(
    "A feature-only paragraph moved later",
    "Line 3",
  );
  await fs.writeFile(document, result);
  await fs.writeFile(
    path.join(root, "moved.md"),
    "A feature-only paragraph moved later\n",
  );
  git("add", ".");
  git("commit", "-qm", "move paragraph");
  const missing = check(root, mergeCommit, "--result", "HEAD");
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /contract\.md \(ours, base lines 3-3\)/u);
});

test("Markdown reflow preserves an added passage", async (context) => {
  const { root, git, lines, document } = await repository(context);
  const phrase =
    "A long meaningful paragraph whose words must survive wrapping in another line";
  git("checkout", "-q", "feature");
  await change(document, lines, [[3, phrase]]);
  git("add", ".");
  git("commit", "-qm", "feature paragraph");
  git("checkout", "-q", "main");
  await change(document, lines, [[25, "Main-specific paragraph"]]);
  git("add", ".");
  git("commit", "-qm", "main paragraph");
  git("checkout", "-q", "feature");
  git("merge", "--no-commit", "--no-ff", "main");
  await fs.writeFile(
    document,
    (await fs.readFile(document, "utf8")).replace(
      phrase,
      "A long meaningful paragraph whose words must survive\nwrapping in another line",
    ),
  );
  assert.equal(check(root).status, 0);
});

test("adapted code hunks pass when every added line survives", async (context) => {
  const { root, git, lines } = await repository(context);
  const code = path.join(root, "example.ts");
  await fs.writeFile(code, `${lines.join("\n")}\n`);
  git("add", "example.ts");
  git("commit", "-qm", "add code file");
  git("branch", "-f", "feature");
  git("checkout", "-q", "feature");
  const ours = await change(code, lines, [
    [3, "const first = resolve();"],
    [4, "const second = render(first);"],
  ]);
  git("add", "example.ts");
  git("commit", "-qm", "feature code");
  git("checkout", "-q", "main");
  await change(code, lines, [[25, "const main = true;"]]);
  git("add", "example.ts");
  git("commit", "-qm", "main code");
  git("checkout", "-q", "feature");
  git("merge", "--no-commit", "--no-ff", "main");
  const adapted = [...ours];
  adapted[3] = "Line 4";
  adapted[10] = "const second = render(first);";
  adapted[24] = "const main = true;";
  await fs.writeFile(code, `${adapted.join("\n")}\n`);
  assert.equal(check(root).status, 0);
});

test("code hunks report only their missing added lines", async (context) => {
  const { root, git, lines } = await repository(context);
  const code = path.join(root, "example.ts");
  await fs.writeFile(code, `${lines.join("\n")}\n`);
  git("add", "example.ts");
  git("commit", "-qm", "add code file");
  git("branch", "-f", "feature");
  git("checkout", "-q", "feature");
  await change(code, lines, [
    [3, "const first = resolve();"],
    [4, "const second = render(first);"],
  ]);
  git("add", "example.ts");
  git("commit", "-qm", "feature code");
  git("checkout", "-q", "main");
  await change(code, lines, [[25, "const main = true;"]]);
  git("add", "example.ts");
  git("commit", "-qm", "main code");
  git("checkout", "-q", "feature");
  git("merge", "--no-commit", "--no-ff", "main");
  const adapted = await fs.readFile(code, "utf8");
  await fs.writeFile(
    code,
    adapted.replace("const second = render(first);", "Line 4"),
  );
  const missing = check(root);
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /example\.ts \(ours, base lines 3-4\)/u);
  assert.match(missing.stderr, /const second = render\(first\);/u);
  assert.doesNotMatch(missing.stderr, /const first = resolve\(\);/u);
});

test("Markdown passages stay contiguous even when individual lines survive", async (context) => {
  const { root, git, lines, document } = await repository(context);
  git("checkout", "-q", "feature");
  await change(document, lines, [
    [3, "First half of a contract passage"],
    [4, "Second half of a contract passage"],
  ]);
  git("add", ".");
  git("commit", "-qm", "feature passage");
  git("checkout", "-q", "main");
  await change(document, lines, [[25, "Main paragraph"]]);
  git("add", ".");
  git("commit", "-qm", "main paragraph");
  git("checkout", "-q", "feature");
  git("merge", "--no-commit", "--no-ff", "main");
  const adapted = (await fs.readFile(document, "utf8")).replace(
    "Second half of a contract passage",
    "Line 4",
  );
  await fs.writeFile(document, `${adapted}Second half of a contract passage\n`);
  const missing = check(root);
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /First half of a contract passage/u);
  assert.match(missing.stderr, /Second half of a contract passage/u);
});

test("reports show at most three missing lines per hunk", async (context) => {
  const { root, git, lines } = await repository(context);
  const code = path.join(root, "example.ts");
  await fs.writeFile(code, `${lines.join("\n")}\n`);
  git("add", "example.ts");
  git("commit", "-qm", "add code file");
  git("branch", "-f", "feature");
  git("checkout", "-q", "feature");
  await change(code, lines, [
    [3, "const one = 1;"],
    [4, "const two = 2;"],
    [5, "const three = 3;"],
    [6, "const four = 4;"],
    [7, "const five = 5;"],
  ]);
  git("add", "example.ts");
  git("commit", "-qm", "feature code");
  git("checkout", "-q", "main");
  await change(code, lines, [[25, "const main = true;"]]);
  git("add", "example.ts");
  git("commit", "-qm", "main code");
  git("checkout", "-q", "feature");
  git("merge", "--no-commit", "--no-ff", "main");
  await fs.writeFile(code, `${lines.join("\n")}\n`);
  const missing = check(root);
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /const one = 1;[\s\S]*const three = 3;/u);
  assert.match(missing.stderr, /\+2 more/u);
  assert.doesNotMatch(missing.stderr, /const four = 4;/u);
});

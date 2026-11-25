import fs from "node:fs/promises";
import path from "node:path";

import { digest, hashFiles } from "./build-digest.mjs";
import { PACKAGE_STEPS, SHARED_INPUTS } from "./build-steps.mjs";

/** The records of the last successful build of each package step. */
export const BUILD_RECORDS = "node_modules/.cache/mokly-build";
const RECORD_SCHEMA = 1;

/**
 * Build the native binary and every package step. Cargo decides itself what
 * the native build needs. A package step runs when its key differs from the
 * record of its last successful build, or when its outputs no longer hold
 * the recorded bytes. The key is a digest of the step's inputs, of the
 * outputs that it reads from earlier steps, directly or through the outputs
 * of another earlier step, and of the manifests of those steps. Steps without
 * a dependency between them run at the same time. A failed step starts no
 * step that reads its outputs, and the other steps still run. Resolve the
 * names of the failed steps.
 */
export async function runWorkspaceBuild(repositoryRoot, { run, report }) {
  const steps = PACKAGE_STEPS;
  const byName = new Map(steps.map((step) => [step.name, step]));
  const shared = await hashFiles(repositoryRoot, SHARED_INPUTS);
  const environment = [process.version, process.platform, process.arch];
  const failed = [];
  const native = run(["cargo", "xtask", "build-native"]).then((status) => {
    if (status !== 0) failed.push("native");
  });
  const outputs = new Map();
  const started = new Map();
  const build = async (step) => {
    const ready = await Promise.all(
      step.after.map(({ step: name }) => start(byName.get(name))),
    );
    if (ready.includes(false)) return false;
    try {
      const read = readSteps(step, byName);
      const upstream = read.map(([name, declarations]) =>
        digest(
          [name, declarations ? "declarations" : "outputs"],
          declarationsOnly(outputs.get(name), declarations),
        ),
      );
      const inputs = await hashFiles(repositoryRoot, [
        ...step.inputs,
        ...read.map(([name]) => ({ path: byName.get(name).manifest })),
      ]);
      const key = digest([...environment, ...upstream], merge(shared, inputs));
      const built = await buildStep(repositoryRoot, step, key, run, report);
      if (built) outputs.set(step.name, built);
      else failed.push(step.name);
      return Boolean(built);
    } catch (error) {
      report(`${step.name} failed: ${error.message}`);
      failed.push(step.name);
      return false;
    }
  };
  const start = (step) => {
    if (!started.has(step.name)) started.set(step.name, build(step));
    return started.get(step.name);
  };
  await Promise.all([native, ...steps.map(start)]);
  return failed;
}

/**
 * Every earlier step that a step reads, sorted by name, each with whether the
 * step reads only its declarations. A step reached only through declarations
 * is read for its declarations alone.
 */
function readSteps(step, byName) {
  const found = new Map();
  const visit = (current, onlyDeclarations) => {
    for (const { step: name, declarations = false } of current.after) {
      const only = onlyDeclarations || declarations;
      if (found.has(name) && (found.get(name) === false || only)) continue;
      found.set(name, only);
      visit(byName.get(name), only);
    }
  };
  visit(step, false);
  return [...found].sort(([left], [right]) => left.localeCompare(right));
}

/** Run one step unless its record proves its outputs; resolve their hashes. */
async function buildStep(repositoryRoot, step, key, run, report) {
  const file = path.join(repositoryRoot, BUILD_RECORDS, recordName(step.name));
  const record = await readRecord(file);
  if (record?.key === key) {
    const present = await hashFiles(repositoryRoot, step.outputs);
    if (digest([], present) === record.outputs) {
      report(`${step.name} is up to date`);
      return present;
    }
  }
  report(`building ${step.name}`);
  await fs.rm(file, { force: true });
  if (
    (await run(["npm", "run", "-s", "build", "--workspace", step.name])) !== 0
  )
    return undefined;
  const written = await hashFiles(repositoryRoot, step.outputs);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(
    file,
    `${JSON.stringify({ schema: RECORD_SCHEMA, key, outputs: digest([], written) })}\n`,
  );
  return written;
}

async function readRecord(file) {
  let text;
  try {
    text = await fs.readFile(file, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return undefined;
    throw error;
  }
  try {
    const record = JSON.parse(text);
    return record?.schema === RECORD_SCHEMA ? record : undefined;
  } catch {
    // A damaged record proves nothing, so the step builds again.
    return undefined;
  }
}

function recordName(name) {
  return `${name.replace(/^@/u, "").replace(/[^a-z0-9.-]/giu, "-")}.json`;
}

function declarationsOnly(hashes, declarations) {
  if (!declarations) return hashes;
  return new Map([...hashes].filter(([file]) => file.endsWith(".d.ts")));
}

function merge(first, second) {
  return new Map([...first, ...second]);
}

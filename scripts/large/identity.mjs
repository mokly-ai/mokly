/** Length-framed whole-template identity; README measurement edits are excluded. */
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { promisify } from "node:util";

const execute = promisify(execFile);
export const identityFilename = ".mokly-large-fixture.json";
export const renderingDependencyNames = [
  "react",
  "react-dom",
  "react-native-web",
  "@firna/ui",
  "lightningcss",
  "parse5",
  "css-select",
  "css-what",
];

export async function renderingDependencies(
  repository,
  fixtureRoot = repository,
) {
  const versions = {};
  for (const [index, name] of renderingDependencyNames.entries()) {
    const require = createRequire(
      path.join(index < 4 ? fixtureRoot : repository, "package.json"),
    );
    for (const directory of require.resolve.paths(name) ?? []) {
      const metadata = await fs
        .readFile(path.join(directory, name, "package.json"), "utf8")
        .then(JSON.parse)
        .catch((error) => {
          if (error.code === "ENOENT") return undefined;
          throw error;
        });
      if (!metadata) continue;
      if (metadata.name !== name || typeof metadata.version !== "string")
        throw new Error(`Invalid installed rendering dependency ${name}`);
      versions[name] = metadata.version;
      break;
    }
    if (!versions[name])
      throw new Error(`Cannot resolve installed rendering dependency ${name}`);
  }
  return versions;
}

export async function templateDigest(directory) {
  const files = [];
  async function visit(relative) {
    for (const entry of await fs.readdir(path.join(directory, relative), {
      withFileTypes: true,
    })) {
      const name = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isSymbolicLink())
        throw new Error(`Fixture template symlink is not allowed: ${name}`);
      if (entry.isDirectory()) await visit(name);
      else if (entry.isFile() && name !== "README.md") files.push(name);
      else if (!entry.isFile())
        throw new Error(`Fixture template is not a regular file: ${name}`);
    }
  }
  await visit("");
  files.sort((left, right) =>
    Buffer.compare(Buffer.from(left), Buffer.from(right)),
  );
  const hash = createHash("sha256");
  for (const relative of files) {
    const name = Buffer.from(relative, "utf8");
    const content = await fs.readFile(path.join(directory, relative));
    const nameLength = Buffer.alloc(4);
    nameLength.writeUInt32BE(name.length);
    const contentLength = Buffer.alloc(8);
    contentLength.writeBigUInt64BE(BigInt(content.length));
    hash.update(nameLength).update(name).update(contentLength).update(content);
  }
  return hash.digest("hex");
}

export async function moklyIdentity(repository) {
  const [commit, status] = await Promise.all([
    execute("git", ["rev-parse", "HEAD"], { cwd: repository }),
    execute("git", ["status", "--porcelain"], { cwd: repository }),
  ]);
  return {
    moklyCommit: commit.stdout.trim(),
    moklyDirty: status.stdout.length > 0,
  };
}

export function preparationCommand(size, generatedOutput = "committed") {
  return `npm run fixture:large -- --areas ${size.areas} --screens ${size.screens} --rows ${size.rows} --stylesheets ${size.stylesheets} --stylesheet-share ${size.stylesheetShare}${size.inlineStyles ? " --inline-styles" : ""}${generatedOutput === "derived" ? " --derived" : ""}`;
}

export async function readFixtureIdentity(
  repository,
  root,
  requestedSize,
  generatedOutput,
) {
  let record;
  let preparationSize = requestedSize;
  let preparationMode = generatedOutput;
  try {
    record = JSON.parse(
      await fs.readFile(path.join(root, identityFilename), "utf8"),
    );
    validateFixtureDimensions(record);
    preparationSize = record;
    preparationMode = record.generatedOutput;
    const digest = await templateDigest(
      path.join(repository, "tests/fixtures/large"),
    );
    if (
      record.schemaVersion !== 1 ||
      record.templateDigest !== digest ||
      !/^[a-f0-9]{40}$/.test(record.moklyCommit) ||
      !/^[a-f0-9]{40}$/.test(record.fixtureCommit) ||
      typeof record.moklyDirty !== "boolean" ||
      !record.renderingDependencies ||
      renderingDependencyNames.some(
        (name) => typeof record.renderingDependencies[name] !== "string",
      )
    )
      throw new Error("Missing or mismatched large-fixture template identity");
    if (
      generatedOutput !== undefined &&
      generatedOutput !== record.generatedOutput
    )
      throw new Error("Fixture output mode changed");
    return record;
  } catch (error) {
    throw new Error(
      `${error.message}. Prepare this fixture first: ${preparationCommand(preparationSize, preparationMode)}`,
      { cause: error },
    );
  }
}

function validateFixtureDimensions(record) {
  if (!record || typeof record !== "object" || Array.isArray(record))
    throw new Error("Invalid fixture identity record");
  for (const name of ["areas", "screens", "rows", "stylesheets"])
    if (
      !Number.isSafeInteger(record[name]) ||
      record[name] < (name === "stylesheets" ? 0 : 1)
    )
      throw new Error(`Invalid fixture ${name}`);
  if (
    record.screens < 2 ||
    typeof record.inlineStyles !== "boolean" ||
    !Number.isFinite(record.stylesheetShare) ||
    record.stylesheetShare < 0 ||
    record.stylesheetShare > 1 ||
    !["committed", "derived"].includes(record.generatedOutput)
  )
    throw new Error("Invalid fixture dimensions/output mode");
}

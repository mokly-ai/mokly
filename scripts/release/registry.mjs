import fs from "node:fs";
import path from "node:path";

import { writeWorkflowOutput } from "./context.mjs";
import { verifyRegistry } from "./registry_verifier.mjs";

const options = parseOptions(process.argv.slice(2));
const repositoryRoot = path.resolve(import.meta.dirname, "../..");
const localReport = JSON.parse(
  await fs.promises.readFile(
    path.resolve(repositoryRoot, options.report),
    "utf8",
  ),
);
const spec = `${localReport.name}@${localReport.version}`;
const published = await verifyRegistry({
  distTag: options.distTag,
  localReport,
  mode: options.mode,
  repositoryRoot,
});
writeWorkflowOutput("published", published ? "true" : "false");
if (published) {
  process.stdout.write(
    `${spec} matches the immutable checked artifact and registry proof.\n`,
  );
} else {
  process.stdout.write(
    `${spec} is not published; the checked tarball may publish.\n`,
  );
}

function parseOptions(args) {
  const values = {};
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (!key?.startsWith("--") || !value) {
      throw new Error("release registry options require values");
    }
    values[key.slice(2)] = value;
  }
  if (!new Set(["guard", "verify"]).has(values.mode) || !values.report) {
    throw new Error(
      "usage: registry.mjs --mode guard|verify --report <path> [--dist-tag <tag>]",
    );
  }
  return {
    distTag: values["dist-tag"],
    mode: values.mode,
    report: values.report,
  };
}

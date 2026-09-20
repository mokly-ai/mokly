import fs from "node:fs";
import path from "node:path";

export default class VerificationReporter {
  constructor() {
    this.assignedTests = [];
    this.errors = [];
    this.observedTests = [];
  }

  onBegin(config, suite) {
    this.root = config.rootDir;
    this.assignedTests = suite
      .allTests()
      .map((test) => identity(test, this.root));
  }

  onTestEnd(test, result) {
    const testIdentity = identity(test, this.root);
    this.observedTests.push({
      ...testIdentity,
      durationMs: result.duration,
      status: result.status,
      errors: result.errors.map((error) => errorEvidence(error)),
    });
    const marker = result.status === "passed" ? "✔" : "✖";
    process.stdout.write(`${marker} ${testIdentity.title}\n`);
    for (const error of result.errors)
      process.stderr.write(
        `${error.stack ?? error.message ?? String(error)}\n`,
      );
  }

  onError(error) {
    const diagnostic = error.stack ?? error.message ?? String(error);
    this.errors.push(diagnostic);
    process.stderr.write(`${diagnostic}\n`);
  }

  onStdOut(chunk) {
    process.stdout.write(chunk);
  }

  onStdErr(chunk) {
    process.stderr.write(chunk);
  }

  onEnd(result) {
    const output = process.env.MOKLY_PLAYWRIGHT_EVENT_REPORT;
    if (!output) throw new Error("MOKLY_PLAYWRIGHT_EVENT_REPORT is required");
    fs.writeFileSync(
      output,
      `${JSON.stringify(
        {
          reporterComplete: true,
          status: result.status,
          assignedTests: this.assignedTests,
          observedTests: this.observedTests,
          errors: this.errors,
        },
        null,
        2,
      )}\n`,
    );
  }

  printsToStdio() {
    return true;
  }
}

function identity(test, root) {
  const location = test.location;
  const relative = path.relative(path.resolve(root, "../.."), location.file);
  const project = test.parent.project()?.name ?? "unknown";
  return {
    id: `${project}:${test.id}`,
    project,
    file: relative.split(path.sep).join("/"),
    line: location.line,
    column: location.column,
    title: test.titlePath().filter(Boolean).join(" › "),
  };
}

function errorEvidence(error) {
  const evidence = {};
  for (const field of ["message", "stack", "value", "snippet"])
    if (typeof error[field] === "string") evidence[field] = error[field];
  if (error.location)
    evidence.location = {
      file: error.location.file,
      line: error.location.line,
      column: error.location.column,
    };
  if (Object.keys(evidence).length === 0) evidence.message = String(error);
  return evidence;
}

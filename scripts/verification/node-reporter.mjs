import fs from "node:fs";

export default async function* verificationReporter(source) {
  const output = process.env.MOKLY_NODE_EVENT_REPORT;
  if (!output) throw new Error("MOKLY_NODE_EVENT_REPORT is required");
  const summaries = [];
  const failures = [];
  let reporterComplete = false;
  try {
    for await (const event of source) {
      if (event.type === "test:summary" && event.data?.file)
        summaries.push(event.data);
      if (event.type === "test:fail")
        failures.push({
          name: event.data.name,
          diagnostic: failureDiagnostic(event.data.details?.error),
        });
      const line = outputLine(event);
      if (line) yield line;
    }
    reporterComplete = true;
  } finally {
    fs.writeFileSync(
      output,
      `${JSON.stringify({ reporterComplete, summaries, failures }, null, 2)}\n`,
    );
  }
}

function outputLine(event) {
  if (event.type === "test:stdout") return event.data.message;
  if (event.type === "test:stderr") {
    process.stderr.write(event.data.message);
    return undefined;
  }
  if (event.type === "test:diagnostic") return `ℹ ${event.data.message}\n`;
  if (event.type === "test:fail") {
    const diagnostic = failureDiagnostic(event.data.details?.error);
    return `✖ ${event.data.name}\n${diagnostic}\n`;
  }
  if (event.type === "test:pass" && event.data.nesting === 0)
    return `✔ ${event.data.name}\n`;
  if (event.type === "test:summary" && !event.data?.file) {
    const counts = event.data?.counts ?? event.data ?? {};
    return `tests ${counts.tests ?? 0}, passed ${counts.passed ?? 0}, failed ${counts.failed ?? 0}, skipped ${counts.skipped ?? 0}, cancelled ${counts.cancelled ?? 0}\n`;
  }
  return undefined;
}

function failureDiagnostic(error) {
  const diagnostics = [];
  for (let current = error; current; current = current.cause) {
    const value = current.stack ?? current.message ?? String(current);
    if (!diagnostics.includes(value)) diagnostics.push(value);
  }
  return diagnostics.join("\nCaused by:\n") || "unknown failure";
}

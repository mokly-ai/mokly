/** Construct a message issue at the boundary that knows its cause. */
export function auditIssue(kind, message) {
  return { kind, message };
}

/** Assemble a strict evaluation without discarding any issue or notice. */
export function auditEvaluation(issues = [], notices = []) {
  return { ok: issues.length === 0, issues, notices };
}

/** Retain nested Git/process diagnostics without losing the audit action. */
export function auditCause(error) {
  const messages = [];
  const seen = new Set();
  for (let cause = error; cause && !seen.has(cause); cause = cause.cause) {
    seen.add(cause);
    const message = cause.message ?? String(cause);
    if (message) messages.push(message);
    const stderr = cause.stderr?.toString().trim();
    if (stderr) messages.push(stderr);
  }
  return [...new Set(messages)].join(" ");
}

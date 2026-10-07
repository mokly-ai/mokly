const BODY_LIMIT = 65_536;
const RECOVERY =
  "If CI did not start on this pull request, push a commit to the branch or close and reopen the pull request.";
const TRUNCATION = "Audit log truncated; only the final part is shown.\n\n";

function fenceFor(log) {
  let longest = 2;
  for (const match of log.matchAll(/`+/gu))
    longest = Math.max(longest, match[0].length);
  return "`".repeat(longest + 1);
}

function logTail(log, length) {
  let start = log.length - length;
  const code = log.charCodeAt(start);
  const previous = log.charCodeAt(start - 1);
  if (
    code >= 0xdc00 &&
    code <= 0xdfff &&
    previous >= 0xd800 &&
    previous <= 0xdbff
  )
    start++;
  return log.slice(start);
}

/** Retain the latest evidence with safe fences and a UTF-16 body size bound. */
export function renderPrBody({ log, now, configuration }) {
  const protocol = `${configuration.serverUrl}/${configuration.repository}/blob/main/docs/protocol/dependency-audit-update-pr.md`;
  const header =
    [
      `Strict dependency audit of main on ${now.toISOString().slice(0, 10)} (UTC).`,
      `[Audit run](${configuration.runUrl})`,
      "Actions:",
      [
        "- Fix the dependencies with compatible updates.",
        "- Change a pinned-parent override after review when needed.",
        "- Request an exact dev-only reviewed exception when needed. Do not extend exception dates automatically.",
        `- ${RECOVERY}`,
      ].join("\n"),
      `[Dependency update protocol](${protocol})`,
      "Audit log:",
    ].join("\n\n") + "\n\n";
  const render = (tail, truncated) => {
    const fence = fenceFor(tail);
    return `${header}${truncated ? TRUNCATION : ""}${fence}text\n${tail}\n${fence}\n`;
  };
  const complete = render(log, false);
  if (complete.length <= BODY_LIMIT) return complete;
  if (render("", true).length > BODY_LIMIT)
    throw new Error(
      "Dependency audit links exceed the pull request body limit. Fix the workflow input and retry.",
    );
  let low = 0;
  let high = Math.min(log.length, BODY_LIMIT);
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (render(logTail(log, middle), true).length <= BODY_LIMIT) low = middle;
    else high = middle - 1;
  }
  return render(logTail(log, low), true);
}

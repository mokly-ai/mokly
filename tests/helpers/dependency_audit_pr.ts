import type { AuditFindingIssue } from "../../scripts/verification/dependency-audit-evaluation.mjs";
import type { PrPullRequest } from "../../scripts/verification/dependency-audit-pr-github.mjs";
import type { DependencyAuditPrDependencies } from "../../scripts/verification/dependency-audit-pr.mjs";

/** A valid uncovered issue, independent of registry state. */
export const prFinding: AuditFindingIssue = {
  kind: "finding",
  message: "Update vulnerable dependencies.",
  package: "braces",
  advisoryUrl: "https://github.com/advisories/GHSA-grv7-fg5c-xmjg",
  advisoryId: "GHSA-grv7-fg5c-xmjg",
  severity: "high",
  title: "Uncontrolled resource consumption",
  installLocations: ["node_modules/braces"],
};

/** A matching update pull request; overrides represent unrelated requests. */
export function updatePullRequest(
  number = 7,
  overrides: Partial<PrPullRequest> = {},
): PrPullRequest {
  return {
    number,
    state: "open",
    head: {
      ref: "dependency-audit/main",
      repo: { full_name: "mokly-ai/mokly" },
    },
    ...overrides,
  };
}

/** Captured REST call; headers contain only fixture credentials. */
export interface PrRequest {
  method: string;
  url: string;
  path: string;
  body: unknown;
  headers: Headers;
}

/** In-memory command and HTTP boundaries. No unit test runs Git or npm. */
export function prHarness(success = false) {
  const files = new Map([
    [
      "report.json",
      JSON.stringify({
        mode: "strict",
        ok: success,
        issues: success ? [] : [prFinding],
      }),
    ],
    ["audit.log", "Uncovered finding.\nAction: Update dependencies.\n"],
  ]);
  const state = {
    tip: null as string | null,
    commits: ["b".repeat(40)],
    identities: new Map<string, string>(),
    changes: " M package-lock.json\0",
    labelExists: false,
    pulls: [] as PrPullRequest[],
    commandFailure: "",
  };
  const botIdentity = [
    "github-actions[bot]",
    "41898282+github-actions[bot]@users.noreply.github.com",
    "github-actions[bot]",
    "41898282+github-actions[bot]@users.noreply.github.com",
  ].join("\0");
  const commands: Parameters<DependencyAuditPrDependencies["runCommand"]>[0][] =
    [];
  const requests: PrRequest[] = [];
  const responses = new Map<
    string,
    { status: number; body: unknown; headers?: Record<string, string> }
  >();
  const output = { notices: [] as string[], errors: [] as string[] };
  const events: string[] = [];
  const dependencies: DependencyAuditPrDependencies = {
    args: [
      "--outcome",
      success ? "success" : "failure",
      "--log",
      "audit.log",
      "--report",
      "report.json",
    ],
    cwd: "/repo",
    env: {
      GITHUB_TOKEN: "fixture-token",
      GH_TOKEN: "fixture-gh-token",
      GITHUB_REPOSITORY: "mokly-ai/mokly",
      GITHUB_SERVER_URL: "https://github.com",
      GITHUB_RUN_ID: "1234",
      PATH: "/bin",
    },
    readFile: async (file) => {
      events.push(`read:${file}`);
      const value = files.get(file);
      if (value === undefined) throw new Error(`Missing ${file}`);
      return value;
    },
    clock: () => new Date("2026-10-07T23:45:00-03:00"),
    logger: {
      notice: (message) => output.notices.push(message),
      error: (message) => output.errors.push(message),
    },
    runCommand: async (command) => {
      commands.push(command);
      const operation = `${command.file} ${command.args.join(" ")}`;
      events.push(operation);
      const result = { exitCode: 0, signal: null, stdout: "", stderr: "" };
      if (operation === state.commandFailure)
        return { ...result, exitCode: 1, stderr: "fixture command failed" };
      if (command.args[0] === "ls-remote")
        result.stdout = state.tip
          ? `${state.tip}\trefs/heads/dependency-audit/main\n`
          : "";
      if (command.args[0] === "rev-list")
        result.stdout = `${state.commits.join("\n")}\n`;
      if (command.args[0] === "log")
        result.stdout = `${state.identities.get(command.args.at(-1)!) ?? botIdentity}\n`;
      if (command.args[0] === "status") result.stdout = state.changes;
      return result;
    },
    fetch: async (url, init) => {
      const parsed = new URL(url);
      const path = `${parsed.pathname}${parsed.search}`;
      const method = init.method ?? "GET";
      requests.push({
        method,
        url,
        path,
        body: init.body ? JSON.parse(String(init.body)) : undefined,
        headers: new Headers(init.headers),
      });
      events.push(`${method} ${path}`);
      const override = responses.get(`${method} ${path}`);
      let body: unknown = {};
      let status = 200;
      if (path.includes("/pulls?")) body = state.pulls;
      else if (method === "GET" && path.endsWith("/labels/dependency-audit")) {
        status = state.labelExists ? 200 : 404;
        body = { message: "Not Found" };
      } else if (method === "POST" && path.endsWith("/pulls"))
        body = { number: 8 };
      return new Response(JSON.stringify(override?.body ?? body), {
        status: override?.status ?? status,
        ...(override?.headers ? { headers: override.headers } : {}),
      });
    },
  };
  return {
    dependencies,
    files,
    state,
    commands,
    requests,
    responses,
    output,
    events,
    botIdentity,
  };
}

/** Name only commands that write to the checkout or remote branch. */
export function gitWrites(commands: ReturnType<typeof prHarness>["commands"]) {
  return commands.filter(
    (command) =>
      command.file === "git" &&
      command.args.some((argument) =>
        ["checkout", "add", "commit", "push"].includes(argument),
      ),
  );
}

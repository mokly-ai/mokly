import { sample } from "./product";
import { publicationAddress } from "./publication-screens";

/**
 * What the fixture builds wrote, as the build log read returns it: the
 * runner's own `system` lines around every process, and each process's own
 * `stdout` and `stderr`. Commands follow the runner contract's argv exactly,
 * and the output is what git, npm and `mokly publish` print in CI mode. No
 * line holds a credential: the runner removes both token values before a
 * chunk is stored, and nothing below prints one.
 */

/** One line of output and the stream that wrote it. */
export interface OutputLine {
  stream: "system" | "stdout" | "stderr";
  text: string;
}

/** Where retained output was dropped, with the bytes the log no longer keeps. */
export interface OutputElision {
  elided: number;
}

/** One entry of a build's output window, in order. */
export type OutputEntry = OutputLine | OutputElision;

/** The commit a build checks out and the comparison base it fetches with it. */
export interface CheckoutHead {
  /** The 40-character head SHA. */
  head: string;
  /** The branch `git checkout -B` names: the reference's, or a pull request's head. */
  branch: string;
  /** Present when the build compares against the default branch. */
  compared: boolean;
}

const root = "/workspace/repo";
const credentials = "/home/user/.mokly-git-credentials";
const remote = "https://github.com/" + sample.repository;
const cli = root + "/node_modules/.bin/mokly";
const lockfiles =
  "pnpm-lock.yaml yarn.lock package-lock.json npm-shrinkwrap.json bun.lock bun.lockb";
/** The default branch's tip, where every compared fixture branch starts. */
const mergeBase = "3e81b6c5a0f24d97e3b16c8a2d5f09e47b1c3a68";
const baseRef = "+refs/heads/main:refs/remotes/origin/main";

const system = (text: string): OutputLine => ({ stream: "system", text });
const stdout = (text: string): OutputLine => ({ stream: "stdout", text });
const stderr = (text: string): OutputLine => ({ stream: "stderr", text });

/**
 * One process: the command line the runner prints, what the process wrote,
 * and the result line, which a process still running or stopped has none of.
 */
function run(
  command: string,
  printed: readonly OutputLine[] = [],
  result: string | null = "exit 0",
): OutputLine[] {
  return [
    system("$ " + command),
    ...printed,
    ...(result === null ? [] : [system(result)]),
  ];
}

/** What `git fetch --progress` prints once the pack has arrived. */
function fetched(checkout: CheckoutHead): OutputLine[] {
  return [
    stderr("remote: Enumerating objects: 2148, done."),
    stderr("remote: Counting objects: 100% (2148/2148), done."),
    stderr("remote: Compressing objects: 100% (1406/1406), done."),
    stderr(
      "remote: Total 2148 (delta 618), reused 1517 (delta 497), pack-reused 0 (from 0)",
    ),
    stderr(
      "Receiving objects: 100% (2148/2148), 3.42 MiB | 21.37 MiB/s, done.",
    ),
    stderr("Resolving deltas: 100% (618/618), done."),
    stderr("From " + remote),
    stderr(" * branch            " + checkout.head + " -> FETCH_HEAD"),
    ...(checkout.compared
      ? [stderr(" * [new branch]      main       -> origin/main")]
      : []),
  ];
}

function fetchCommand(checkout: CheckoutHead): string {
  return (
    "git fetch --no-tags --progress --depth=50 origin " +
    checkout.head +
    (checkout.compared ? " " + baseRef : "")
  );
}

/** The processes before the fetch, which never print anything. */
function prepare(): OutputLine[] {
  return [
    ...run("git init --quiet " + root),
    ...run(
      "git config --local credential.helper 'store --file=" + credentials + "'",
    ),
    ...run("git remote add origin " + remote + ".git"),
  ];
}

/** The whole checkout step, through the comparison base and the branch. */
export function checkoutOutput(checkout: CheckoutHead): OutputLine[] {
  return [
    ...prepare(),
    ...run(fetchCommand(checkout), fetched(checkout)),
    ...(checkout.compared
      ? run("git merge-base -- origin/main " + checkout.head, [
          stdout(mergeBase),
        ])
      : []),
    ...run(
      "git checkout --quiet --force -B " +
        checkout.branch +
        " " +
        checkout.head +
        " --",
    ),
  ];
}

/** A checkout still fetching, or stopped while it fetched. */
export function fetchingOutput(checkout: CheckoutHead): OutputLine[] {
  return [
    ...prepare(),
    ...run(
      fetchCommand(checkout),
      [
        stderr("remote: Enumerating objects: 2148, done."),
        stderr("remote: Counting objects: 100% (2148/2148), done."),
        stderr("remote: Compressing objects:  64% (900/1406)"),
      ],
      null,
    ),
  ];
}

/** A fetch GitHub answered with a server error, which the build retries. */
export function unreachableOutput(checkout: CheckoutHead): OutputLine[] {
  return [
    ...prepare(),
    ...run(
      fetchCommand(checkout),
      [
        stderr(
          "fatal: unable to access '" +
            remote +
            ".git/': The requested URL returned error: 502",
        ),
      ],
      "exit 128",
    ),
  ];
}

const deprecated = [
  stderr(
    "npm warn deprecated inflight@1.0.6: This module is not supported, and leaks memory. Do not use it. Check out lru-cache if you want a good and tested way to coalesce async requests by a key value, which is much more comprehensive and powerful.",
  ),
  stderr(
    "npm warn deprecated glob@7.2.3: Glob versions prior to v9 are no longer supported",
  ),
];

const install = "npm ci --no-audit --no-fund";

/** Finding the lockfile, which every install begins with. */
function lockfile(tracked = "package-lock.json"): OutputLine[] {
  return run("git ls-files -z -- " + lockfiles, [stdout(tracked)]);
}

/**
 * A repository whose only tracked lockfile is Bun's: the search finds it, and
 * the build ends there, before any install command runs.
 */
export function unsupportedLockfileOutput(): OutputLine[] {
  return lockfile("bun.lock");
}

/** An install that finished, or one still running. */
export function installOutput(finished: boolean): OutputLine[] {
  return [
    ...lockfile(),
    ...run(
      install,
      finished
        ? [...deprecated, stdout(""), stdout("added 1094 packages in 31s")]
        : deprecated,
      finished ? "exit 0" : null,
    ),
  ];
}

/**
 * The install npm refused, because the lockfile no longer matches. `logged`
 * names the debug log npm wrote, which carries the time the install ran.
 */
export function lockfileMismatchOutput(logged: string): OutputLine[] {
  return [
    ...lockfile(),
    ...run(
      install,
      [
        "npm error code EUSAGE",
        "npm error",
        "npm error `npm ci` can only install packages when your package.json and package-lock.json or npm-shrinkwrap.json are in sync. Please update your lock file with `npm install` before continuing.",
        "npm error",
        "npm error Missing: @firna/ui@4.0.0 from lock file",
        "npm error",
        "npm error Clean install a project",
        "npm error",
        "npm error Usage:",
        "npm error npm ci",
        "npm error",
        "npm error aliases: clean-install, ic, install-clean, isntall-clean",
        "npm error",
        'npm error Run "npm help ci" for more info',
        "npm error A complete log of this run can be found in: /home/user/.npm/_logs/" +
          logged +
          "-debug-0.log",
      ].map(stderr),
      "exit 1",
    ),
  ];
}

/** Finding the repository's own CLI and reading its version. */
export function cliOutput(version: string): OutputLine[] {
  return [
    ...run("test -x " + cli),
    ...run(cli + " --version", [stdout(version)]),
  ];
}

/** The publish command a build runs, compared or current-only. */
function publishCommand(compared: boolean): string {
  return (
    cli +
    " publish --config " +
    sample.config +
    " --repository github.com/" +
    sample.repository +
    (compared ? " --base origin/main" : " --no-changes")
  );
}

/** A publish that is running; the CLI prints nothing until its result. */
export function publishingOutput(compared: boolean): OutputLine[] {
  return run(publishCommand(compared), [], null);
}

/** A publish the attempt deadline stopped. */
export function publishStoppedOutput(compared: boolean): OutputLine[] {
  return run(publishCommand(compared), [], "stopped at the time limit");
}

/** A publish Mokly accepted, with the result line and the viewer address. */
export function publishedOutput(compared: boolean): OutputLine[] {
  return run(publishCommand(compared), [
    stdout("Published Mokly catalogue. 3 files uploaded, 41 unchanged."),
    stdout(publicationAddress),
  ]);
}

/**
 * A long install keeps the first part of the log and its newest output, and
 * the log reports the bytes it dropped between them.
 */
export function elidedInstallOutput(elided: number): OutputEntry[] {
  return [
    ...lockfile(),
    system("$ " + install),
    ...deprecated,
    { elided },
    stderr(
      "npm warn deprecated rimraf@3.0.2: Rimraf versions prior to v4 are no longer supported",
    ),
    stdout(""),
    stdout("added 1094 packages in 33s"),
    system("exit 0"),
  ];
}

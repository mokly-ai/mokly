# Cloud Build Runner

The runner executes one [cloud build](./cloud-builds.md) attempt in a one-shot
E2B sandbox. `mkc-build-interface` owns the `BuildRunner` trait (one `run`
operation returning a boxed, cancellable future), `BuildRequest`, `BuildLogSink`, `BuildStep` and `BuildOutcome`.
`mkc-build-sandbox` implements the runner over `sandbox-interface` capabilities;
`mkc-api` alone constructs the `sandbox-e2b` backend.
The runner knows no database, HTTP route or schedule. It runs the published
`@mokly/mokly` CLI exactly as CI does and imports nothing from Mokly. The
runner is a library; `infra/e2b/build` owns the template.
[Cloud build sandbox](./cloud-build-sandbox.md) defines the sandbox, the output
stream and the reconciliation of stray sandboxes.

## Request And Outcomes

`BuildRequest` carries the build ID, the attempt operation ID, the project ID,
the repository's canonical `owner/name`, `head_sha`, `branch`, the comparison
(`CurrentOnly` or `Base { base_ref }`), `config_path`, the absolute attempt
deadline, the upload endpoint
`<MKC_API_ORIGIN>/v1/projects/<project id>/publications`, the upload token and
the installation token. `config_path` is the project's repository-relative
config path, which ends in `.json`, as
[Platform model](./platform-model.md#projects-and-visibility) defines.
A request with another config path is invalid.
The plan's blob and completion URLs start with the
same `MKC_API_ORIGIN`, so the CLI presents the upload token on every request of
the [upload exchange](./publication-upload-exchange.md). The two tokens are secret types whose `Debug` prints
`[redacted]`; no request, argv or error formats either value.

| Outcome                                     | Meaning                                                       |
| ------------------------------------------- | ------------------------------------------------------------- |
| `Completed`                                 | Every step exited 0                                           |
| `StepFailed { step, exit_code, cli_error }` | A step's process exited nonzero, or reported no exit status   |
| `UnsupportedLockfile`                       | The nearest lockfile belongs to a package manager builds lack |
| `UnsupportedMoklyVersion`                   | The installed CLI failed its compatibility check              |
| `TimedOut { step, budget }`                 | A step hit the attempt deadline or its idle budget            |
| `OutputOverflow { step }`                   | A stream passed its 64 MiB cap                                |
| `Infrastructure(InternalError)`             | Sandbox, transport, backpressure, sink or file-write failure  |

The [lifecycle](./cloud-builds.md#claims-leases-and-retries) maps outcomes to
build states. A sink failure ends the run as `Infrastructure`. For the publish
step, the sandbox boundary parses the last plain stderr error into
[`cli_error`](#cli-failure-codes).
Infrastructure errors retain safe typed facts, excluding provider and sink
error text and source chains that could contain a token.

## CLI Failure Codes

`cli_error` is `Option<MoklyCliCode>`, a typed value owned by
`mkc-build-interface`. The runner parses the published plain grammar
`[mokly/<code>] <message>` at the start of a stderr line, across stream events,
and keeps the last such line's code. Detail lines are not codes. It converts
an unrecognized code to `Unrecognized`; no matching line is `None`.

Only a failed publish step with no recorded upload outcome uses this table.
The worker matches typed variants, never strings:

| CLI code          | Typed value      | Worker result                   |
| ----------------- | ---------------- | ------------------------------- |
| `upload-failed`   | `UploadFailed`   | Infrastructure failure          |
| `git-uncommitted` | `GitUncommitted` | `failed`, `uncommitted-changes` |
| Any other code    | `Unrecognized`   | `failed`, `exit`                |
| No code           | `None`           | `failed`, `exit`                |

The CLI has no `build-stale` code. The runner gives that
code no typed value, so it is `Unrecognized` like any other unknown code, and
no build records a `stale-generated-output` cause.

The [CLI-code fixture](./mokly-fixture-regeneration.md#cli-failure-codes)
captures the two named codes from the workspace CLI. A contract test fails
if any mapped code is absent, and fixture drift catches a renamed code before
a package upgrade can silently change the result.

## Template

The template, `mokly-build-v<N>`, is 2 vCPU and 4 GiB with `/bin/sh`,
coreutils, Python 3, git, curl, CA certificates, an exact Node release with
npm and corepack on the template `PATH`, the non-root workload `user`, and
`/workspace` owned by it. The template contains no file at C, so the credential
write creates a new 0600 file rather than preserving a pre-existing mode.
`infra/e2b/build/e2b.Dockerfile` pins its `e2bdev/base` image by a SHA-256
digest, so a new tag cannot change a template release's base.
Its Node release is the repository's pin in
`.nvmrc`, which `toolchain-pins` compares with the template definition, so the
template satisfies the CLI's engines. The CLI is a native binary
with no musl build and no JavaScript fallback. The template
therefore runs Linux x64 with glibc 2.28 or newer, and the candidate assertion
checks that floor. `docs/ops/build-template.md`
records its release procedure and its live probe. The template sets
`HOME=/home/user`, and E2B sets the process `PATH`. A build command gets the
template environment with its own entries added, not replaced. The probe
checks the added entry, `HOME` and the tools on `PATH`, not the exact `PATH`
(decided 2026-11-24), because E2B sets its own `PATH` order.

## Steps

Every process runs through `stream_process` as the workload user with an
explicit argv, a `cwd` and an environment map; no step uses a shell. `R` is
`/workspace/repo`, `C` is `/home/user/.mokly-git-credentials` and `B` is the
base branch. Every step's environment is `CI=1`, `NO_COLOR=1`,
`FORCE_COLOR=0`, `GIT_TERMINAL_PROMPT=0` and
`COREPACK_ENABLE_DOWNLOAD_PROMPT=0`; publish adds its two variables.

| Step       | Process (cwd)                                                                                                                                                                                                                                                                                                                                             |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `checkout` | `git init --quiet R` (`/workspace`)                                                                                                                                                                                                                                                                                                                       |
|            | `git config --local credential.helper` with the one argument `store --file=C` (R)                                                                                                                                                                                                                                                                         |
|            | `git remote add origin https://github.com/<owner>/<name>.git` (R)                                                                                                                                                                                                                                                                                         |
|            | `git fetch --no-tags --progress --depth=50 origin <head_sha>` (R), adding `+refs/heads/B:refs/remotes/origin/B` for a comparison                                                                                                                                                                                                                          |
|            | Comparison only: `git merge-base -- origin/B <head_sha>` (R); on a normal nonzero exit `git fetch --no-tags --progress --deepen=1000 origin <head_sha> +refs/heads/B:refs/remotes/origin/B` and check again; on another normal nonzero exit, when `git rev-parse --is-shallow-repository` prints `true`, the same fetch with `--unshallow`; then continue |
|            | `git checkout --quiet --force -B <branch> <head_sha> --` (R)                                                                                                                                                                                                                                                                                              |
| `install`  | `git ls-files -z -- <lockfile candidates>` (R), then one install command below                                                                                                                                                                                                                                                                            |
| `publish`  | `test -x <dir>/node_modules/.bin/mokly` per candidate directory, then the publish command below (R)                                                                                                                                                                                                                                                       |

Before `checkout`, `write_file` writes C (root `/home/user`, path
`.mokly-git-credentials`) as `https://x-access-token:<installation
token>@github.com` and a newline; the file is 0600 and owned by the workload
user. The runner never formats that request. Only the local
`credential.helper` names the file, so git reads the token and nothing else
does unless the consumer's own code looks for it.

The decision probes use normal nonzero exits: `git merge-base` moves down
the ladder (after it, the CLI reports a missing merge base itself), and
`test -x` moves to the next candidate. The local CLI's `--version` uses the
unsupported-version rule below. Every other nonzero exit fails its step.
The sink is told when each step starts, before its first process.

**Install.** Candidate directories are the config file's directory and each
ancestor up to R. The nearest directory with a tracked lockfile wins; within
it `pnpm-lock.yaml`, then `yarn.lock`, then `package-lock.json` or
`npm-shrinkwrap.json`. With no lockfile install is skipped; a directory whose
only lockfile is `bun.lock` or `bun.lockb` is `UnsupportedLockfile`. In that
directory `D` (as cwd): pnpm runs `corepack pnpm install --frozen-lockfile`;
Yarn runs `corepack yarn --version`, then `corepack yarn install
--frozen-lockfile --non-interactive` when the major version is 1 and
`corepack yarn install --immutable` otherwise; npm runs `npm ci --no-audit
--no-fund`. Lifecycle scripts run: they are the consumer's build.
No install command omits optional dependencies. The CLI's native binary
is an optional dependency of `@mokly/mokly`, so an install that omits optional
dependencies leaves a local CLI without its binary. That CLI fails its version
probe, and the run ends as `UnsupportedMoklyVersion`.
A successful Yarn version probe with malformed SemVer is an infrastructure
failure; the runner does not guess an install generation.

**Publish.** Candidates are the config file's directory and each ancestor up
to D (or R without an install). The first `node_modules/.bin/mokly` found is
the repository's CLI. The runner first runs `<that path> --version`; a
nonzero exit, output that is not a SemVer, or a version below
`MIN_MOKLY_VERSION` ends the run as `UnsupportedMoklyVersion`.
`MIN_MOKLY_VERSION` is 0.18.0, the first release that writes upload envelope 3
with catalogue index 9, the only versions the receiver accepts.
Otherwise it runs `<that path> publish --config
<config_path> --repository github.com/<owner>/<name> <mode>`. When no candidate has a CLI, the runner uses the newest npm release:
`npm exec --yes --package=@mokly/mokly@latest -- mokly publish` with the same
arguments. `--config` names the project's JSON configuration file.
`<mode>` is `--no-changes` or `--base origin/B`. The environment
adds `MOKLY_ENDPOINT` (the upload endpoint) and `MOKLY_TOKEN` (the upload
token). The runner never runs bare `npx mokly`, which can resolve the
unregistered unscoped `mokly` name. A fixed release pin and the workspace CLI
were rejected for this fallback. It must use the newest published release.
Accepted risk: if npm publishes a release whose cloud deploy fails, the
fallback CLI can be newer than the running cloud until the next deploy. The
[build toolchain checks](./repository-layout.md#build-toolchain-checks) also
validate the version in the failure sentence.
In CI mode the CLI keeps the counted result line, such as
`Published Mokly catalogue. 3 files uploaded, 41 unchanged.`, and the viewer
URL. A replay prints `Mokly catalogue already published for this commit.`
and the existing viewer URL.

**Comparison.** With `--base origin/B`, the CLI renders both sides from
sources with its own version: the head from R and the base from the merge
base's Git tree. When the base's lockfiles or manifests differ
from the head's, the CLI may install the base's locked dependencies into its
own cache under the workload user's cache directory, outside R.
That install reaches the registry through the build profile's public egress.
It starts from the CLI's own environment allowlist, which holds
neither token. It runs no lifecycle script unless the
repository's configuration enables them. The runner passes no
option that changes that setting. The install runs inside the publish process,
so it counts against the attempt deadline. A base whose sources
fail the CLI's current validation makes Changes unavailable, and the CLI then
uploads the current catalogue without a comparison.

**Clean checkout.** The CLI checks HEAD and Git status before its build
and again before Plan. The runner adds no files to the
checked-out worktree. Git setup writes Git metadata only; the credential file
is at C, outside R. The CLI builds in a private directory outside R and keeps
its caches outside R. The install step and its lifecycle scripts
can create or change worktree files. Install output and build output that Git
does not ignore fail publish with `git-uncommitted`. Mokly excludes its own
caches and temporary files from this check. The consumer must ignore install
files and every build output directory before a build can publish.

This CLI code stops before an upload request. Its build cause follows
the [publish-step rule](./cloud-builds.md#claims-leases-and-retries).

## Budgets

The attempt deadline is absolute. Each process receives the remaining time,
capped at 3600 seconds, as its deadline; no time left is `TimedOut` with the
deadline budget. Idle budgets count time without stdout or stderr bytes:
two minutes for every `checkout` process, five minutes for every `install`
process, and none for `publish`, whose CI output reports only its result, so
its idle timeout equals its deadline. No idle budget exceeds its process
deadline.
`stdout_limit` and `stderr_limit` are 64 MiB. A stream outcome maps as
follows: `Completed` with an exit code continues or fails the step,
`IdleTimeout` and `DeadlineExpired` are `TimedOut`, overflow is
`OutputOverflow`, and `ConsumerBackpressure` or `TransportFailure` is
`Infrastructure`. The 64 MiB cap is a failure limit for each stream, separate
from the [one MiB retained log](./cloud-build-api.md#listbuildlog). Dropping
retained output alone does not fail a build, including a successful one.

## Configuration

The chart delivers an all-or-none builds group: `MKC_E2B_API_KEY` (secret,
CSI-mounted), `MKC_E2B_BUILD_TEMPLATE` (the verified build reference,
`TEMPLATE_ID:BUILD_ID`, which starts only that build) and
`MKC_E2B_DEPLOYMENT_ID` (1–63 lowercase letters, digits and hyphens, unique
per environment). With the group present, the GitHub App group is required;
startup fails otherwise. The upload endpoint uses the API's existing
`MKC_API_ORIGIN`. Optional settings are `MKC_E2B_DENIED_DESTINATIONS`
(comma-separated IPs or CIDRs, at most 32) and `MKC_BUILDS_PER_PROCESS` (1–16,
default 4). The denied destinations must not cover the API origin's public
addresses, or uploads fail. `mkc-api` builds the adapter with backend ID
`e2b`, the fixed HTTPS E2B API base, the `build` profile, an idle timeout of 60
seconds (unused by one-shot sandboxes) and the adapter's default runtime
conventions. No value is logged or serialized.

Denied IPs contain no IPv6 zone ID. CIDRs use a decimal prefix length, not a
dotted netmask. IPv4 prefixes have one or two digits; IPv6 prefixes have one
through three digits. CIDR decimal octets can have leading zeros, as the
runtime's `ipnet` parser permits; bare IPs use the strict IP grammar. The chart
and release renderer enforce these runtime rules.

## Verification

Unit tests drive `mkc-build-sandbox` through the capability mocks, and no test
contacts E2B without the credentialed live feature: credential write and argv,
cwd and environment of every process; the fetch ladder; lockfile, Yarn
generation, local CLI discovery and the version floor; every stream outcome;
budget accounting across steps; and that no token appears in any argv, chunk,
error or `Debug` output. The
[sandbox verification](./cloud-build-sandbox.md#verification) lists the
sandbox and output cases of the same tests. The build template's
assertion script and the credentialed live proof are operational checks.
CLI-code tests cover split lines, multiple errors, unknown codes and missing
codes.

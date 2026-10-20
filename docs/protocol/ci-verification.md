# CI Verification

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

## Verification Boundary

`cargo xtask check` is the complete repository and release gate. The local
executor runs the local suites sequentially in one checkout. Native runs only
when selected. The local gate starts with the live
baseline workspace audit, which fails on new issues and reports inherited ones
as notices. `--dependency-audit strict` selects strict mode for the complete
gate or the repository suite;
[baseline auditing](./dependency-audit-baseline.md) owns the CLI and CI mode
rules. The complete gate can instead run on Testboxes under the
[remote verification contract](./remote-verification.md). Only active reviewed
path exceptions cover findings;
[dependency security](./dependency-security.md) defines their UTC expiry and
31-day limit. A selected suite is partial evidence and never claims a complete
pass. CI's validated aggregate is complete evidence for its exact tree.
[Release evidence](./npm-release-evidence.md) defines reuse.

The CLI is:

```bash
cargo xtask check
cargo xtask check --dependency-audit strict
cargo xtask check --suite repository
cargo xtask check --suite viewer
cargo xtask check --suite native
cargo xtask check --suite browser
cargo xtask check --suite browser --shard 1/4
```

`--shard INDEX/TOTAL` uses one-based positive integers, requires
`INDEX <= TOTAL`, limits both values to JavaScript's maximum safe integer, and
is valid only with `browser`. Browser sharding is delegated to Playwright's
`--shard`. Omitting `--shard` runs the complete selected suite. Unknown suites,
malformed shards, missing values, and attempts to shard the repository or
viewer suite fail before any subprocess starts.

## Gate Ownership

| Gate             | Commands and owned behavior                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repository       | Live audit first: baseline for ordinary pull requests, pushes, and local checks; strict for release and dependency update pull requests. Prettier; ESLint; the JavaScript and TypeScript, protocol, and Rust file-length audits; the protocol-cap, unused-internal-export, unused-member, and public-package-export ratchets; the public API report check; Rust formatting; workspace Clippy with warnings denied; the Rust tests of every crate. |
| Viewer           | The viewer typecheck, then every discovered Node test file, including the inspector size test of the [published inspector contract](./mokly-published-inspector.md), with at most the [shared file concurrency](./ci-suite-evidence.md#test-concurrency) active. The suite has no shard.                                                                                                                                                          |
| Browser          | Every Playwright spec against one `mokly serve` of the example catalogue per worker, with `fullyParallel: false`, the [shared worker count](./ci-suite-evidence.md#test-concurrency), the configured Playwright timeouts, and zero retries. A shard runs its whole-file partition.                                                                                                                                                                |
| Native platforms | On macOS and Windows, build the `mokly` binary once, check Rust formatting and workspace Clippy with warnings denied, and run the Rust tests of every crate.                                                                                                                                                                                                                                                                                      |
| Required CI      | Evaluate the result and evidence from the repository job, the viewer job and every browser shard on each runtime selected for the event, and both native platforms.                                                                                                                                                                                                                                                                               |

Complete and selected local suites share gate definitions. Every Native
command has local coverage; `npm run build` covers `cargo xtask build-native`.
In-process auditors fail like subprocesses.
The local Repository and Viewer suites cover the native build and Rust checks
once. The selected Native suite repeats those checks on the hosted macOS and
Windows runners. Required CI requires both native jobs.

Viewer and Browser build the binary and viewer bundle first through
`npm run build`. Native builds the host binary through
`cargo xtask build-native`. No suite prepares a baseline, a compiled example, a generated
tree, or a packed archive. Serve renders the example catalogue from its sources
into the render cache, and the tests read nothing back from the repository.

File-length, protocol-cap, and unused-internal-export ratchets use
`git merge-base HEAD origin/main`; the public-package-export ratchet instead
uses the newest matching release tags reachable from `HEAD`. The
[owning contract](./verification-ratchets.md) defines the module extensions,
shrink-only baselines, and recursive `docs/protocol/**` scan excluding
`fixtures/`.

The repository suite also runs the workspace-root source and protocol length
audit. It covers changed TypeScript and JavaScript files, changed protocol
Markdown, and non-ignored untracked files. Protocol pages over 250 lines use
only the exact reviewed caps in `xtask/protocol-document-caps.json`;
`cargo xtask source-file-length-lint --all` audits every scoped file. This is in
addition to the repository ratchets. The full scope and failure semantics are in
[Repository Gate And Length Audits](./ci-verification-repository.md).

ESLint derives global ignores from `.gitignore` before adding its broader
ESLint-only ignores. Ignored build, cache, report, and tool scratch paths cannot
make a later complete gate fail.

The [developer test commands](./developer-test-commands.md) define the public
Node test and browser entry points, selection, and the developer skip policy.
Strict Node test discovery recursively includes `.test.ts` and `.test.tsx` files
under `tests/` and `packages/viewer/tests/`: the tooling tests and the viewer
tests. The strict runners and every `cargo xtask check` suite reject skips and
todos. Node test files stay outside Playwright's `tests/browser/` directory.
Playwright matches only `**/*.spec.ts` in its one `chromium` project.

The strict runners skip the build, reject arguments other than the optional
browser shard, and fail when the build output is missing. Xtask builds once per
gate and calls only the strict runners.

## Deterministic Test Repository Inputs

The [test repository contract](./ci-test-repository-inputs.md) defines
fixture-owned Git state, checked-out lockfiles, and remote-state protection.

## Pull Request Title Contract

A separate pull-request workflow validates titles on `opened`, `edited`,
`reopened` and `synchronize`. It passes the untrusted title through an
environment variable to a repository script; workflow expressions never
interpolate the title into shell source. The workflow runs
`scripts/verification/pull-request-title.mjs`, which reads only
`PULL_REQUEST_TITLE` and needs no installed dependencies.

The complete title is at most 72 Unicode code points, has no leading or
trailing whitespace or newline, and has this Conventional Commits shape:

```text
<type>(<optional-scope>)<optional-!>: <description>
```

`type` is exactly one of `build`, `chore`, `ci`, `docs`, `feat`, `fix`, `perf`,
`refactor`, `revert`, `style` or `test`. When present, `scope` is lowercase
ASCII matching `[a-z0-9._/-]+`. `!` may follow the type or closing scope. The
separator is exactly colon plus one space. `description` is nonempty, begins
and ends with a non-whitespace character, and contains no newline. Examples
include `fix: preserve upload counts`, `chore(main): release 0.13.0` and
`feat(publish)!: upload catalogue content deltas`.

This type list is fixed. A tooling test asserts the list directly; it does not
derive policy from Git history, remote-tracking references, or the commit
examples in the shared `git-commit` skill.

An invalid title exits unsuccessfully and prints exactly:

```text
Pull request titles must use type(scope)!: description with type build, chore, ci, docs, feat, fix, perf, refactor, revert, style, or test. Keep any scope lowercase and the whole title to 72 characters or fewer.
```

The check protects release notes because this repository squash-merges pull
requests and release-please reads the squash title on `main`. A breaking title
keeps its `BREAKING CHANGE:` explanation in the squash body; title validation
does not inspect or synthesize that body.

## CI Workflow Graph

The hosted job graph, checkout ownership, runtime profiles, runner policy,
job timeouts, and stable `Required CI` status follow the separate
[CI workflow graph contract](./ci-workflow.md). The suites below own the report
evidence that status validates. Inventory and evidence rules live here because
local xtask suites and hosted jobs share them.

## Inventory And Report Evidence

Node test and Playwright inventories are discovered on the executing runtime,
not fixed in advance. Browser discovery asks Playwright; an empty suite fails. A
failed browser discovery reports the load errors from Playwright's JSON output
as well as its standard error. Browser error assertions accept only Chrome's
report that a viewer-owned sandboxed frame (`/static/`, a temporary render, or
`about:srcdoc`) blocked a script, as the browser suite's console notice rule
defines.

Each suite report records the commit SHA, runtime, suite, optional shard,
complete discovered file inventory, assigned file inventory, observed executed
files, per-file timing, process outcome, and skipped or cancelled evidence.
Browser reports also record the spec inventory and every test by project, spec
file, defining file, line, column, and title path; the Playwright reporter
records each observed test's result, duration, and serialized errors. A test's
spec file is the `*.spec.ts` file that Playwright loaded. Its defining file,
line, and column locate the `test()` call, which can be in a helper module that
the spec imports. Every Playwright file inventory, assignment, observed file,
and per-file timing names spec files, so a shared helper never joins an
inventory or spans shards. Node test reports keep the Node reporter's failure
names and diagnostics. Once execution starts, the wrapper writes a report after
the test process exits on success or failure, then validates it. A discovery or
build failure before execution may leave no report; the job and the aggregate
still fail. Reporter callback failures or missing output can therefore never
turn into success.

For an unsharded report for a complete suite, the observed file set must equal
independent discovery exactly. For the sharded browser suite, the aggregate
requires all four reports for each runtime, proves assignments are non-empty
and pairwise disjoint, and compares their union and observed execution against
a separately discovered complete suite inventory. Browser evidence also
requires the observed test IDs across the four shards to equal independent
unsharded discovery exactly once. Each runtime requires one viewer report. A
missing file or test, duplicate assignment or observed test, unexpected file or
test, skipped or cancelled test, browser shard above the
[share limit](./ci-suite-evidence.md#browser-shard-balance), non-zero exit,
signal exit, or absent or invalid report fails verification. Per-file and
per-test durations are kept so imbalance can be measured without changing
whole-file partitioning.

Report artifacts have stable, unique suite, runtime, and shard names and use
replacement uploads. A failed-job rerun can therefore replace its own report
while successful reports from an earlier attempt in the same workflow run stay
available; whole-workflow reruns replace all report artifacts. The aggregate
downloads only the `verification-*` report namespace. Browser trace artifacts
are attempt-specific. Viewer and browser jobs keep inventory, timing, and
failure details; Playwright failures also keep traces and Playwright error
context. A successful `Required CI` job plus its revalidated complete report
aggregate is reusable complete verification for the tree the reports name
within that event's runtime profile; individual reports are partial evidence.
Release publication accepts only the dual-runtime Release Please profile, then
applies the additional tree, live Node test inventory, and live Playwright
inventory checks in the [release evidence contract](./npm-release-evidence.md).
The ordinary five-report profile cannot skip the complete publish gate. Reports
are kept for 14 days, which bounds their release reuse; missing or expired
evidence falls back to the complete gate.

The cache and audit continuation is
[Dependency Cache And Security](./ci-verification-security.md).

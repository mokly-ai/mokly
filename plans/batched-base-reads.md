# Batched Base Reads

Status: Active. [PR #229](https://github.com/mokly-ai/mokly/pull/229) is open
for design A. Design B continues on the stacked branch
`conductor/perf-2b-base-reads-from-the-extraction`, with no pull request yet.
The plan closes when its pull requests merge.

Changes renders the base commit a second time and compares it with the
working tree. Mokly never checks out the base. It reads each base file through
Git with the checkout conversion that the commit's attributes select, so both
sides compare like with like. Today each converted file costs its own
`git cat-file --filters` process. This repository's `.gitattributes` starts
with `* text=auto eol=lf`, so all 4,219 tracked files are converted. The base
extraction, the copy of the base commit's files in the OS cache that the
sidecar bundles from, therefore starts about 4,400 Git processes. No timing
span covers it. When the extraction is already cached, the core still reads
every base file through Git: about five processes for each file read, and
three for the metadata of each new path.

This plan applies option A and then option B of perf item 3, "One Git process
per file for base reads". A converts one batch of files with one
`git cat-file --batch --filters -Z` process. B reads base files from the
extraction when the preparation holds a lease on one. The plan does not change
the sidecar bundle (perf 1), the background pass (perf 3), render keys
(perf 4), CSS bundling (perf 5), or the retained base generation (perf 6). It
does not change the Serve base watcher, which runs two `rev-parse` commands
about once a second, or the 5 ms poll of the Git runner in
`crates/mokly-git/src/system.rs`.

Besides the files that the item names, the plan edits
`crates/mokly-git/src/extraction.rs`, `disk.rs`, and `repository.rs`,
`crates/mokly-compare/src/extraction.rs`, `sources.rs`, `cache.rs`, and
`cache_types.rs`, `crates/mokly-cli/src/base_dependencies.rs`,
`serve_changes_base.rs`, and `serve_trace_stages.rs`, and
`crates/mokly-render/src/side.rs`. No sibling item lists these files. perf 0
also edits `docs/protocol/mokly-timings.md`, so this plan changes only one row
there.

Decision (2026-10-27, the user, in the orchestrator's item): apply option A,
then option B. Git stays the authority on conversion. HTML-only catalogues
have no extraction and keep Git reads, which A batches. The questions that the
item left open are decisions 1 to 5 below. The user answered them and approved
the plan on 2026-10-27.

Contract owners:

- [Git command runtime](../docs/protocol/mokly-git.md): batch conversion,
  its failure confinement, and its time limit.
- [Base preparation contract](../docs/protocol/mokly-base-preparation.md):
  base reads from a leased extraction.
- [Base cache contract](../docs/protocol/mokly-base-cache.md): a lease of a
  complete entry without a build.
- [Timings contract](../docs/protocol/mokly-timings.md): the
  `review.base-extraction` span.
- The [mokly-git README](../crates/mokly-git/README.md), the
  [mokly-compare README](../crates/mokly-compare/README.md), the
  [mokly-cli README](../crates/mokly-cli/README.md), and the
  [mokly-render README](../crates/mokly-render/README.md).

## Item corrections

The item text came from a reading of commit `89c12ef1`. These points differ
from the code at `a9dd1e81` or from Git's behaviour:

1. The extraction loop is in `crates/mokly-git/src/extraction.rs:22`, not in
   `batches.rs:22`. `batches.rs` only splits path arguments into bounded
   command batches.
2. With `--filters`, each batch input line must be `{object} {path}`. A line
   with only `{commit}:{path}` stops Git with `fatal: missing path`, exit 128.
   The batch uses the blob id from the tree listing, as the per-file command
   does with `--path`.
3. The `--batch --filters` header prints the raw blob size, not the converted
   size. Git 2.50.1 printed `blob 8` before ten converted bytes. A decoder
   cannot use that size to find the end of a converted file. The design below
   ends each file with a sentinel record instead.
4. Git strips leading spaces and tabs from the path of a batch line. A path
   that starts with a space or a tab must keep the per-file command.
5. One uncached base read starts about five Git processes, and the metadata
   lookup of a new path starts three more. The item counted three in total.
   The base `config.load` started 74 Git processes for one file read and 22
   lookups.
6. The base configuration and discovery load before the dependency step
   leases the extraction. B needs an earlier lease to cover them. See open
   decision 2.
7. This machine is faster than the item's machine: the cold extraction takes
   68 to 85 s, not 131 s. The acceptance thresholds stay as the item states.

## Design A: one Git process per batch

- `Checkout::new` converts a batch of at most 48 MiB with one
  `git --attr-source={commit} cat-file --batch --filters -Z` process. Each file
  adds two NUL-terminated input lines: `{blob id} {path}`, then a sentinel name
  `mokly-end-{32 hex digits}`. Git answers the sentinel with
  `{sentinel} missing`.
- A streaming decoder implements `Write`, so the batch uses the runner's
  existing bounded stream with its deadline and cancellation. The decoder
  checks each header's blob id and type, writes the content to the file's
  store, and ends the file at the sentinel record. A read keeps its files in
  memory. The extraction keeps them in a private temporary directory. A wrong
  id, an unexpected record, trailing bytes, or a truncated stream give
  `MalformedOutput`. The decoder counts content bytes against the batch bound.
- The sentinel is new for each batch. It comes from the standard library's
  randomly seeded hasher, so no file content can predict it. Rejected: a
  fixed sentinel, because a file can contain it. Rejected: checkout of a
  temporary index with `checkout-index`, because it is a different Git path
  than the decided `cat-file --batch --filters`, and needs an index file and
  more process steps.
- A path that starts with a space or a tab streams alone with
  `--filters --path`.
- Every file of a call above 48 MiB keeps the per-file stream: raw
  `cat-file blob` for an unconverted path and `--filters` for a converted
  path. The extraction forms such a call only for one large file, but the
  dependency input read can form one with many files. `converted_paths` stays for this case and for opaque
  digests.
- When a batch reaches its deadline, each of its files converts again alone
  with its own deadline, and a failure names its file. A batch that fails or
  exceeds a bound returns `Conversion`, and the extraction and the prefetch
  convert one file at a time, as before, so a failure stays with its file. An
  optional filter failure prints `external filter ... failed`, which the
  stream check already maps to `CheckoutFailed`.
- After this change, the raw `--batch -Z` capture and its decoder
  `decode_batch` have no caller. Delete them as dead code and record the
  search in the commit.
- `CachedExtraction` emits a `review.base-extraction` span over the source
  key, the cache lookup, and the build when no complete entry exists. The span
  records `action`, `reuse` or `extract`. The CLI timing layer already forwards
  `action`. Only the stage list in `crates/mokly-cli/src/serve_trace_stages.rs`
  changes.

## Design B: base reads from the extraction

- `mokly-git` reads extracted files back. A new `Repository` read takes the
  extraction root and keeps the count and byte checks and the error kinds of
  the Git read. A file read goes through `Disk`, which rejects a link below
  the root, a nonregular file, a host-unsupported name, and a file above the
  byte bound. A file that the extraction does not hold as a regular file reads
  through Git. See decision 3. `Disk` gains a confined streaming digest
  for opaque resources.
- `Sources` gains a method that attaches a leased extraction. `GitSources`
  then expands its index over the whole tree once, so a later projection
  needs no Git lookup. Its reads and digests use the extraction. `GitTree`
  keeps its repository-root path namespace, its confinement, its index, its
  byte cache, and its failure reports. See decision 1.
- `BaseSide.sources` becomes `Arc<Lease>`, so the base sources and the base
  side hold the same lease.
- `Cache` gains a lookup that leases a complete entry and never builds one. It
  creates no directory, and it announces the cache only when it leases an
  entry. `Extraction` and `BaseDependencies` gain matching methods. The
  dependency step accepts that early lease, so it computes no second source
  key.
- `NativeBase::prepare` leases an existing extraction before the base
  configuration loads, when the working configuration names a renderer or a
  PostCSS module. It attaches that lease. After the dependency step, it
  attaches the dependency step's lease when no lease is attached yet. See open
  decision 2.

## Baseline

Release build of `a9dd1e81`, the merge base with `origin/main`, on
2026-10-27. Eight cores. `git` on `PATH` is the Conductor shell wrapper, the
same for every run. Cold means that the Mokly cache directory was removed
before the run. The values are medians of three cold and four warm runs.

| Measure on `examples/basic`               | Cold        | Warm       |
| ----------------------------------------- | ----------- | ---------- |
| `serve.ready`                             | 14.6 s      | 13.7 s     |
| `serve.background`                        | 12.9 s      | 13.2 s     |
| `changes.classify`                        | 129.6 s     | 51.4 s     |
| of which the extraction gap, no span      | 74.6 s      | 0.5 s      |
| of which `review.capture-side`            | 5.0 s       | 4.8 s      |
| of which `review.compare-views`           | 21.1 s      | 18.2 s     |
| base `config.load`                        | 1.2 s       | 1.1 s      |
| base `catalogue.discover`                 | 3.0 s       | 3.0 s      |
| base `graph.prepare`                      | 11.0 s      | 10.2 s     |
| base `css.bundle`, 39 bundles, union      | 6.1 s       | 6.0 s      |
| the four base spans above together, union | 16.9 s      | 16.1 s     |
| `sidecar.render` count, whole run         | 2,164       | 2,040      |
| `css.bundle` count and union, whole run   | 152, 10.5 s | 152, 9.9 s |

The edit run appends one comment line to one screen module. The medians of
three edit runs were a `watch.action` of 10.2 s, a `serve.background` of
14.5 s after the edit, a second `changes.classify` of 68.6 s, and 93.5 s from
the edit to the end of the second classification. The small React fixture
gave `serve.ready` 8.4 s,
`serve.background` 2.4 s, and `changes.classify` 11.4 s, of which
`review.capture-side` 1.4 s. The small HTML fixture gave a `changes.classify`
of 1.0 s, and 1.2 s after a commit of `* text=auto`.

Evidence: `.context/batched-base-reads/baseline.md`.

## Decisions

The user answered each decision on 2026-10-27 with the recommended option.

1. The extraction reads use `GitTree` with an extraction byte source, option
   B. Rejected: A, a `WorkingTree` over the extraction directory, because it
   needs a new path map and loses the commit's link and submodule metadata.
2. Base preparation leases an existing complete extraction before the base
   configuration loads, without a build, when the working configuration names
   a renderer or a PostCSS module, option C. Rejected: A, a switch only after
   the dependency step, because configuration and discovery then keep about
   4 s of warm Git reads. Rejected: B, a build before the configuration loads,
   because it changes the rule that only a base that needs a sidecar gets an
   extraction.
3. A file that the extraction does not hold reads through Git, option A.
   Rejected: B, unavailable with a warning, because Windows comparisons would
   lose files that the core reads today. Rejected: C, missing, because Changes
   could show a false removal.
4. Two stacked pull requests ship the work, option B. Design A opens from this
   branch after milestone 4. Design B opens from a second branch on top of it.
   Rejected: A, one pull request, because design A is complete on its own and
   its byte framing deserves a focused review.
5. No follow-up for an HTML-only base prefetch, option A. Rejected: B, a
   follow-up, because the small HTML fixture classifies in 1.2 s with
   `* text=auto`, and design A already batches its prefetch reads.
6. Review finding 1 of 2026-10-28: when a batch reaches its deadline, the
   conversion engine converts each of its files again alone, option E of the
   options check. Applied with the recommended option under the user's rule
   for decisions that come up during the work. Reason: every caller,
   including the dependency input read, keeps 120 seconds for each file.
   Rejected: A, a retry only in the dependency input read, because a later
   caller would share one deadline again. Rejected: D, a per-file result API,
   because it is Large.
7. Review finding 4 of 2026-10-28: a read converts into memory, and only the
   extraction keeps a temporary directory, option D of the options check.
   Applied under the same rule. Reason: with decision 6, the fallback needs
   unit tests without disk IO, and a read no longer writes and reads back a
   temporary file. Rejected: B, a file sink parameter for the batch only,
   because the single-file path of a read would still need the disk.
8. Review 2 finding 2 of 2026-10-28: the repository session records each file
   whose own conversion reached its deadline, and a later call fails at once
   for that file, option D of the options check. Applied with the recommended
   option under the user's rule. Reason: with decision 6, a hanging filter
   waited for three deadlines in the extraction and the prefetch; the record
   brings it back to two and stops every later repeat in the same
   preparation. Rejected: A, keeping three deadlines, and C, per-file results
   for every caller, because it is Large.
9. Review 2 finding 3 of 2026-10-28: the deadline tests stop the mocked batch
   at every byte of its output, and a Unix integration test runs a real
   filter that hangs, under a clock that jumps past the deadline when the
   filter logs a hang, option E of the options check. Applied under the same
   rule. It replaces the milestone 3 decision against a hanging-filter test:
   the event-driven clock never times out a fast conversion. Rejected: B, a
   runner wrapper that only fakes the deadline.

## Milestone 1: Documentation and protocol for batch conversion

State the batch conversion requirements before the code changes.

- [x] Update `docs/protocol/mokly-git.md`, section "Tree, Blob, And Source
      Archive Reads": one Git process converts a bounded batch of files with
      the same bytes as a conversion of each file alone; a failed, timed-out,
      or oversized batch converts its files again one at a time, so a failure
      stays with its file; each conversion keeps the 120-second limit. Add the
      decision in force: one process for each batch, rejected: one process
      for each converted file, because process start-up dominated base reads.
      The sentinel framing is a mechanism, so it goes to the README.
- [x] Add the `review.base-extraction` row to `docs/protocol/mokly-timings.md`
      under `review.base-tree`, with the `action` field. perf 0 also edits this
      page, so keep the change to the row.
- [x] Add the status line of the repository rules to each changed page. The
      milestone that implements the behaviour removes it.

## Milestone 2: Extraction timing span

Make the extraction visible before its time changes.

- [x] Emit `review.base-extraction` from `CachedExtraction` in
      `crates/mokly-compare/src/extraction.rs`. Start with status `error` and
      record `ok` after success. Record `action`.
- [x] Allow the stage in `crates/mokly-cli/src/serve_trace_stages.rs`.
- [x] Tests: `crates/mokly-cli/src/_tests_/extraction_trace_tests.rs` runs
      `CachedExtraction` with a mocked cache and repository under the timing
      layer. It checks `action` for a cache hit and for a build, and the
      `error` status without an action for a failure. `mokly-compare` has no
      span test harness, so the CLI test covers the span end to end.
- [x] Update `crates/mokly-compare/README.md`.

## Milestone 3: Batched conversion

Replace the per-file conversion of a batch with one process. Write each
failing test first.

- [x] Integration test in `crates/mokly-git/tests`: a temporary repository
      with `* text=auto` and one `eol=crlf` pattern, so that conversion
      changes the length of some files. Add a file committed with CRLF line
      endings, an LF file under the `eol=crlf` pattern, a binary file with NUL
      bytes, a file whose content holds `missing` records and fake headers, an
      empty file, a path with an inner space, a path with a leading space, and
      an `ident` file. Assert that `read_many` and `extract` give the bytes of
      `git cat-file --filters --path={path} {blob}` for each file.
- [x] Operation-count test with the recording runner: `read_many` of 4 and of
      16 small files starts one filtered batch command each, and no per-file
      conversion.
- [x] Failure tests: a required filter and an optional filter that fail
      inside a batch. The extraction keeps the other files and records one
      `base-conversion` warning. A read of the failing file returns
      `Conversion`. A unit test with a mocked runner covers a batch that
      reaches its deadline. Decision (2026-10-28, recommended option under the
      user's rule for new decisions): no integration test with a hanging
      filter, because the runner's poll loop spins under the fast test clock
      and would also time out fast conversions on a slow machine.
- [x] Unit tests of the decoder, with no process: each split point of one
      stream into two chunks, one-byte chunks, a sentinel split across chunks,
      a wrong blob id, an unexpected record, trailing bytes, a truncated
      stream, and the byte bound.
- [x] Implement the batch request and the decoder. Route a leading-space path
      and a batch above 48 MiB to the per-file stream.
- [x] Delete `decode_batch` and the raw batch capture. Save the search under
      `.context/batched-base-reads/`.
      Evidence: `.context/batched-base-reads/milestone-3-dead-code-search.md`.
- [x] Update `crates/mokly-git/README.md`: the batch conversion, the
      sentinel, and the per-file cases. Remove the status line from the
      milestone 1 pages.

## Milestone 4: Verification and measurement of batch conversion

- [x] Run `cargo test -p mokly-git`, `cargo test -p mokly-compare`,
      `cargo test -p mokly-cli`, `cargo xtask check --suite repository`,
      `npm run format:check`, and `tests/markdown_links.test.ts`.
- [x] Measure with the shared method on the release build: cold and warm
      `examples/basic`, the edit run, and both small fixtures. Acceptance: the
      `review.base-extraction` span of a cold run is under 5 s. Save the
      records under `.context/perf/` and the summary under
      `.context/batched-base-reads/`.
- [x] Build `examples/basic` with `--strict --base fc8535b0` with the
      baseline binary and with the new binary. Compare the two output
      directories byte for byte. Record the result.
- Results of the final binary of `cc41de93`, interleaved run by run with
  the baseline binary on 2026-10-28, because the machine had slowed since
  the morning baseline. Medians, baseline first:
  - Cold `examples/basic`: `changes.classify` 155.8 s and 58.6 s. The
    untimed extraction gap of 98.1 s became a `review.base-extraction` span
    of 1.1 s.
  - Warm `examples/basic`: `changes.classify` 73.6 s and 67.7 s. The four
    base spans together 24.5 s and 21.0 s.
  - Edit run: second `changes.classify` 96.9 s and 80.6 s. Edit to the end
    of the second classification 125.4 s and 111.5 s.
  - Small React fixture, one run each: `changes.classify` 13.2 s and 13.9 s
    cold, 13.2 s and 12.9 s warm. Small HTML fixture with `* text=auto`:
    1.5 s and 0.9 s.
  - The build with base `fc8535b0` wrote identical output, 2,382 files, in
    53 s; the baseline took 98 s in the earlier run.
- Evidence: `.context/batched-base-reads/after-a-final.md`,
  `.context/batched-base-reads/after-a.md`, and the gate logs
  `.context/batched-base-reads/gate-a.log` and `gate-a2.log`.
- [x] Merge `origin/main` with the `git-merge` skill. Commit and push.
      Merge `d385bb75` took #221 with no conflict and an empty remerge diff.
- [x] Review the complete diff against `origin/main` with the
      `implementation-review` skill. Apply the review-fix rule: fix the
      `Auto-fix: yes` findings, re-review once, and report the rest.
  - Review 1 of `c7202754` found four Low findings. The validity check
    confirmed all four. The fix round fixed findings 2 and 3, and applied
    decisions 6 and 7 for findings 1 and 4. Reports:
    `.context/batched-base-reads/review-1.md`.
  - Review 2 of `86fc7df7` confirmed the four fixes and found three new Low
    findings; the validity check confirmed all three. Finding 1, a
    single-file stream that dropped the store's typed error, is fixed with a
    shared stream helper, option B. Findings 2 and 3 are decisions 8 and 9.
    Reports: `.context/batched-base-reads/review-2.md` and the validity and
    options reports beside it. No third review runs, under the review-fix
    rule.
  - Outside the scope: `crates/mokly-git/src/extraction.rs` and
    `crates/mokly-compare/src/git_prefetch.rs` convert each file of a failed
    batch in its own call, at about three Git processes each. Separate
    branch.
  - Outside the scope: `crates/mokly-git/src/extraction.rs` and
    `crates/mokly-compare/src/git_prefetch.rs` repeat the 48 MiB batch bound as
    a literal. Separate branch.
  - Outside the scope: `crates/mokly-git/src/checkout.rs`, a failed batch
    still names the first file of the call in its `Conversion` error.
    Separate branch.
- [x] Open the first pull request, for design A, with the before and after
      table in its body. Put its link in the status paragraph.

## Milestone 5: Documentation and protocol for extraction reads

- [x] Update `docs/protocol/mokly-base-preparation.md`, section "Sources":
      while a preparation leases a complete extraction of the base commit,
      base reads use its files; a file that it does not hold reads through
      Git, under decision 3; the early lease rule of decision 2,
      with its rejected options as the decision in force.
- [x] Update `docs/protocol/mokly-base-cache.md`: a lookup can lease a
      complete entry without a build, and it creates no entry.
- [x] Add the status line to each changed page.

## Milestone 6: Extraction byte source

- [x] Tests first: a `mokly-git` integration test reads an extraction back
      with the same bytes as the Git read, falls back to Git for a removed
      file and for a link, and keeps the byte-limit error kinds. A unit test
      covers the confined digest.
- [x] A `mokly-compare` unit test with mocks: after the attach, the index
      expands once, a projection makes no lookup, and reads and digests use
      the extraction root.
- [x] A `mokly-compare` integration test with a real repository: a `GitTree`
      with an attached extraction returns the same bytes as one without it,
      and the recording runner sees no `cat-file` command after the attach.
- [x] Implement the extracted read and digest in `mokly-git`, the attach in
      `GitSources`, and `Arc<Lease>` in `BaseSide`. Split `sources.rs` if it
      passes 300 lines.
- [x] Update `crates/mokly-git/README.md`, `crates/mokly-compare/README.md`,
      and `crates/mokly-render/README.md`.
- Notes: the confined digest is covered by the `mokly-git` integration test,
  because a unit test of real files would need disk IO. The `mokly-compare`
  integration test hides `.git` after the attach, so any Git command would
  fail; it then reads, hashes, and projects every base file. `sources.rs` has
  290 lines, so it stays one file. Tests ran green at `8f2d811a`.

## Milestone 7: Early lease

- [x] Tests first: a cache test leases a complete entry without a build, and
      a missing entry returns none, creates no directory, and makes no
      announcement. A `mokly-cli` test checks the call order: the early
      lease, the attach, and then the configuration read, for a working
      configuration with a renderer. A second test checks that an HTML-only
      working configuration makes no early lookup, and that the dependency
      step's lease is attached before graph preparation.
- [x] Implement the cache lookup, the `Extraction` and `BaseDependencies`
      methods, the forwarding in `PreparingDependencies`, and the attach calls
      in `NativeBase`.
- [x] Update `crates/mokly-cli/README.md`. Remove the status line from the
      milestone 5 pages.
- Notes: the HTML-only case is the first `NativeBase` test, whose working
  configuration names no renderer, so a lookup would fail the mock. A third
  test covers a failed lookup, which keeps the base reads on Git. After the
  merge of the final design A at `0fd0351f`, the four crate suites passed:
  856 tests.

## Milestone 8: Verification, measurement, review, and pull request

- [ ] Run the targeted tests, then `cargo xtask check --suite repository`,
      then the complete gate `cargo xtask check`.
- [ ] Smoke test: serve `examples/basic`, wait for Changes, and open the
      Changes list and one comparison in the browser. Save a screenshot under
      `.context/batched-base-reads/`.
- [ ] Measure with the shared method: cold and warm `examples/basic`, the
      edit run, and both small fixtures. Acceptance: the warm base
      `config.load`, `catalogue.discover`, `graph.prepare`, and base
      `css.bundle` spans take under 3 s together. Repeat the byte-for-byte
      build comparison of milestone 4.
- [ ] Commit with Conventional Commits and push the branch.
- [ ] Review the complete local diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings,
      then apply the review-fix rule: fix the `Auto-fix: yes` findings,
      re-review once, and report the rest.
- [ ] Open the pull request when every other milestone TODO is ticked, with
      the before and after table in its body. This is the second pull
      request, from the stacked branch. Put its link in the status paragraph.

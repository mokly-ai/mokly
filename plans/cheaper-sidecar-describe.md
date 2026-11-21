# Cheaper sidecar describe

Status: Active. On branch `calummoore/mokly-cheaper-sidecar-describe-dlz0`, no
pull request yet. The pull request that completes the work deletes this plan,
as the `plans` skill says.

The render sidecar is the Node process that evaluates catalogue modules for the
Mokly binary. Its `describe` request evaluates one bundle generation and
returns every exported definition. After a Serve edit, the binary describes the
new generation once and keeps that result. Each other process that renders the
generation gets a prerequisite `describe` from `restore` in
`crates/mokly-sidecar/src/pool_preparation.rs`, and the pool drops its result.
The first `describe` of a generation in a process parses every entry module
with Babel in `orderedExports` of `packages/mokly/src/sidecar/export-order.ts`,
also when its text did not change. The parse gives only the source order of
the export names.

Part A keeps those names in a bounded cache in each process. Part B lets a
prerequisite `describe` return nothing. Neither part changes a published byte,
a warning, a diagnostic, or the order of definitions. Evaluation keeps its cost.

Contract owners:

- The [render sidecar](../docs/protocol/mokly-sidecar.md) and its
  [definition transport](../docs/protocol/mokly-sidecar-definitions.md).
- The [render sidecar README](../packages/mokly/src/sidecar/README.md).

## Approved scope and design calls of 2026-11-21

- The user approved Part A and Part B. Implementation waits only for
  Milestone 2.
- Part A: an exact, bounded, per-process cache of the export names from the
  AST. Its key is the exact source text and the parser plugin set. The work
  that reads the namespace values runs on every call: append, filter, order,
  and registration. The bound is latest-generation retention or an explicit
  byte cap, and a test proves it.
- Orchestrator call: keep Part A in `export-order.ts`, an optional helper,
  and the injection through `describe` and stories. Keep `session.ts` and
  `compiled.ts` outside Part A to limit upstream conflicts.
- Part B: an optional prepare-only `describe`. It evaluates and registers in
  full, keeps the same failures and state, and returns no definitions. Rust
  owns the wire types and the generated TypeScript. The protocol doc changes
  with the code.
- Part A comes first. When Part A alone saves at least 30 ms of mean time per
  warm Cloud edit, ask the orchestrator whether Part B gets its own pull
  request.
- Part B code waits until workspace 220,
  `calummoore/mokly-restored-bundle-reuse-answer-pspj`, and workspace 221,
  `calummoore/mokly-sidecar-bundle-tail-mge9`, merge into `main`. Then this
  branch merges `origin/main` once.
- The parent orchestrator owns the official measurements and every merge. This
  branch does not merge its own pull request.
- Acceptance:
  - The Cloud fixture is `/home/user/describe-cloud` at `194fdb78`, with
    `npm ci` in `ts/` and this branch's release core and `dist` installed. Runs
    use `mokly.config.json` and `--base HEAD`. A warm edit changes the title at
    line 35 of `docs/mockups/src/screens/product/settings/slug-editor.tsx`.
  - The peak memory of the whole process tree over a cold start and ten edits
    stays at or below 102% of `main`.
  - Every published byte, warning, and diagnostic stays the same on Cloud,
    `examples/basic`, and the HTML and React fixtures of the
    [large fixture README](../tests/fixtures/large/README.md).

## Design

- `orderedExports` asks the cache for the names of one parser mode and one
  source text. The mode comes from the module-path test that selects the Babel
  plugins today. The other parse options are constants.
- A miss parses, keeps the result when it fits, and returns it. A parse that
  throws keeps nothing, evicts nothing, and throws the same error.
- A hit refreshes the entry using its stored source key. A second parser
  mode parses that stored string and fits both mode lists within the cap.
- A kept list is frozen. Each call copies it, appends the namespace keys that
  it does not name, filters by the current values, and maps to entries.
- Requests in a process run in order, and the cache work is synchronous. Head,
  base, and older generations share the entries of equal text.
- Part B marks only the prerequisite calls of `restore`, which the warm-up also
  uses. The binary's own call in `crates/mokly-render/src/bundle.rs` stays full.
- A prepare-only call runs the same collection, `serialize` included, because
  `serialize` fills `generation.savedSlots`. It keeps the definitions on the
  generation and returns `null`. A later full call returns them.

## Design calls

Each call below is a call of the planning agent on 2026-11-21. Each waits for
the options check of Milestone 2. No condition of the decision test holds,
because the user decisions above choose each approach.

### 1. Bound of the cache memory

How does each process reuse the names of unchanged entry modules within a
memory limit that a test can prove? Cloud has 167 entry modules with 196,517
UTF-8 bytes, so their text charges at most 393,034 bytes at 2 bytes per code
unit. The user's guidance prefers a cap of about 1 MiB and suggests FIFO order as an initial suggestion.

- **A.** A fixed cap of 1 MiB, evicted in insertion order. An entry charges 2
  bytes per UTF-16 code unit of its text and names, plus 64 bytes per entry
  and 16 per name. An entry whose charge passes the cap is returned but not
  kept. A hit changes nothing. Effort: Small.
- **B.** The same cap in least-recently-used order. A hit moves its entry to
  the newest end, so old versions of edited modules go first. Effort: Small.
- **C.** Latest-generation retention: keep only the entries that the last
  completed `describe` used. One generation of text has no fixed size. A
  describe of the other side replaces the set. A failure needs a cleanup rule.
  Effort: Medium.
- **D.** A cap on the entry count. One large module then holds more memory
  than the count suggests. Effort: Small.
- **Left out:** No bound, because the user asked for one. Expiry by time,
  because it needs a timer and gives no fixed bound.
- **Shared assumptions:** One cache per process, from the user decision. Equal
  text and mode give equal names, from the code: the other options are fixed.
- **E.** Protect two recent describes and cap other entries at 1 MiB. This
  keeps larger live sets, but its bound grows with those sets. Effort: Medium.
- **Recommendation:** B, changed from A after the fresh options check. It
  retains recently used sources when edited versions fill the cap. The cap
  bounds charged retained data, not measured V8 heap overhead. The memory
  acceptance run checks the actual process-tree peak.

### 2. Owner of the cache

Where does the cache live so that it lasts for the process and a test can count
parses and prove the bound without a protocol flag?

- **A.** A module-level instance only, with exported test hooks to read and
  reset it. Cost: test-only exports and state shared between tests.
  Effort: Small.
- **B.** A cache class with an injectable cap and parse operation, and a
  module-level default instance. `orderedExports` and `describe` take an
  optional instance, and `describe` passes it to `describeStories`.
  Effort: Small.
- **C.** `Session` owns the instance and passes it to `describe`. Cost: it
  changes `session.ts` before the upstream merges. Effort: Small.
- **Left out:** The generation as owner. It needs `compiled.ts`, and it is the
  latest-generation bound of the bound call, option C.
- **Shared assumptions:** None beyond the user decisions.
- **Call:** B. It keeps the process lifetime and the file limits, and each test
  uses its own instance. `toolchain.ts` already keeps one module-level value.

### 3. Shape of the cache key

How does a lookup find the exact result for one text and one parser mode
within one charge budget?

- **A.** One map keyed by the exact source string. Each entry holds one name
  list for each mode that parsed it. Effort: Small.
- **B.** One map for each mode with a shared charge and order list. Cost: two
  structures to keep in step, and a text in both modes charges twice.
  Effort: Small.
- **C.** One map keyed by the mode joined to the text. Cost: each lookup builds
  a copy of the text. Effort: Small.
- **Left out:** A digest of the text, because the user chose an exact text key.
  The module path, because a changed text would return stale names.
- **Shared assumptions:** None beyond the user decisions.
- **Call:** A. It copies no text, and both modes share one charge and one order.
  Reuse the stored source on hits and second-mode parses. Babel names can keep
  slices of that source alive. Do not retain a second list that exceeds the cap.

### 4. Wire shape of a prepare-only describe

How does the pool ask a process to prepare a generation without its
definitions? This call applies only when Part B goes ahead. `describe` uses
`GenerationParams` today, which `dispose` shares, and `wire.rs` selects the
result decoder by method.

- **A.** A new `DescribeParams` with `generation` and an optional `prepareOnly`
  flag. `dispose` keeps `GenerationParams`. A prepare-only call returns
  `result: null`, and the decoder selects the empty result. Effort: Medium.
- **B.** A new method, such as `prepareGeneration`, with the same evaluation
  and no result. The decoder keeps one result type per method. Cost: a new
  method row, dispatch case, and timeout rule. Effort: Medium.
- **Left out:** A decode skip in Rust only, because the user chose a call that
  also removes the sidecar encoding and the transfer. A call that skips
  `serialize`, because the saved slots would then differ.
- **Shared assumptions:** Only the pool's prerequisite calls use it, from the
  code: the binary keeps only its own `describe` result.
- **Call:** A. It matches the user's optional prepare-only `describe`, and one
  method keeps one evaluation path. The `timings` flag of `hello` is the model.
- **Options-check additions:** C encodes and discards the full reply before
  sending null, preserving Node encoding and frame-limit failures. D changes
  the contract to validate only the binary's first full reply. E skips only
  the Rust decode and keeps the full transfer. C and E still remove the
  preparation process's Rust definitions-decode check. Effort: Small for each
  addition. No failure-path exception is approved. Recheck this concern after
  the prerequisite merges and before Part B. Keep Part B conditional until
  its full error contract can be met or the user chooses a change.

## Milestone 1: Contract check

Depends on: none

The `docs implementor` action confirms that Part A changes no requirement.

- [x] Confirm the Part A contract change covered by the user approval. The
      purpose section must permit bounded export-name data. Narrow it in
      place with the implementation, within its 250-line cap.
- [x] Confirm that the definition transport and the
      [memory rules](../docs/protocol/mokly-sidecar-memory.md) need no change,
      and that Part A changes no wire type, generated module, or fixture.
- [x] Record that the Part B doc edits land with its code in Milestone 6, only
      when Part B goes ahead.

## Milestone 2: Measurement split and options check

Depends on: 1

The orchestrator owns this milestone. Part A starts only after it completes.

- [x] Save the measured warm Cloud split from a copied-dist temporary probe.
      Evidence: `.context/cheaper-describe/split-warm-summary.json`.
- [x] Run the fresh Opus max options check and merge its result.
      Evidence: `.context/cheaper-describe/options-check.md`.
      Cache bound recommendation changed from A to B. Other Part A calls stand.
- [x] Confirm that unchanged entry parsing has a measurable cost and send the
      split to the parent orchestrator.

## Milestone 3: Red tests for Part A

Depends on: 2

The `non-ui implementor` action writes these tests first. The count and bound
tests fail on `main`. The differential tests pass before and after Part A.

- [ ] Compare cached and uncached `orderedExports` on a first and a second
      call. Cover default exports, string names, export lists, `export *`,
      type-only exports, unnamed declarations, duplicate names, and JSX in
      each mode.
- [ ] Call twice for one text with different namespace values. Each result
      follows its own values. A change to a returned list does not reach the
      cache.
- [ ] With an injected parse operation, show that equal text and mode parse
      once, and that a changed text or the other mode parses again.
- [ ] With a small injected cap, show that the charge never passes the cap,
      the least recently used entry goes first, an oversized entry is returned but not kept,
      and a failed parse keeps nothing and throws the same error.
- [ ] Compare byte-identical describe results and identical registrations with
      and without the cache across a sequence of generations in one process.
      Include an unchanged entry, a changed entry, a new export, a removed
      export, a duplicated value across two entry modules, TypeScript, and JSX.
      Cover a stories file because it also uses export order.

## Milestone 4: Part A

Depends on: 3

- [ ] Add the cache class and its default instance in a helper file, as the
      bound, owner, and key calls settle them. Take the names in
      `orderedExports` from it, and keep the namespace work on every call.
- [ ] Let `describe` take an optional instance and pass it to `orderedExports`
      and `describeStories`. Add the cache to the sidecar README Key Code.
      Permit bounded export-name retention in the protocol purpose paragraph.
- [ ] Run the new tests and the describe tests with `npm test -- {file}`, then
      `cargo xtask check --suite repository`.

## Milestone 5: Early push and the measurement decision

Depends on: 4

- [ ] Commit with the `git-commit` skill and push. Give the source SHA to the
      orchestrator for the official measurements.
- [ ] Compare local warm Cloud edits with `main`. Save the result under
      `.context/cheaper-describe/`.
- [ ] When Part A saves at least 30 ms of mean time per warm Cloud edit, ask
      the orchestrator whether Part B gets its own pull request. When it does,
      move the Milestone 6 TODOs to a follow-up item.

## Milestone 6: Part B, prepare-only describe

Depends on: 5, the merges of workspaces 220 and 221 into `main`, and the
orchestrator's answer when Milestone 5 asks.

- [ ] Merge `origin/main` once with the `git-merge` skill.
- [ ] Write red tests first. In Rust, the decoder selects the empty result,
      `restore` and the warm-up send prepare-only calls, and the binary's own
      call stays full. In Node, a prepare-only call returns `null`, fails with
      the same code and message, and leaves the same handles, registrations,
      saved slots, and stories. A later full call equals a fresh call.
- [ ] Add the wire shape of the wire-shape call in `methods.rs`, and move every
      `Call::Describe` use to it. Regenerate the TypeScript modules with the
      `shared-types` skill.
- [ ] Select the empty result in `wire.rs`, send prepare-only calls from
      `restore`, and return `null` in `session.ts` after the same collection.
- [ ] With the `documentation` skill, change the `describe` row of
      `docs/protocol/mokly-sidecar.md` in place within its cap. Add the rule
      and its decision in force to the definition transport page. Update the
      Key Code lists of the sidecar and `mokly-sidecar` READMEs.
- [ ] Run `cargo test -p mokly-sidecar`, `cargo test -p mokly-render`, the new
      Node tests, and `cargo xtask check --suite repository`.

## Milestone 7: Verification and push

Depends on: 4, and 6 when Part B stays in this branch

- [ ] Run `cargo xtask check`. Run `cargo xtask mokly-fixtures`, and commit its
      output when it changes. Then commit, push, and give the SHA to the
      orchestrator.
- [ ] Compare local warm Cloud edits and the memory rule with `main`. Prove
      equal bytes, warnings, and diagnostics of strict builds and ready Changes
      on the four acceptance fixtures. Save each result under
      `.context/cheaper-describe/`.

## Milestone 8: Review and pull request

Depends on: 7

- [ ] Review the complete diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings. Then
      fix the `fix now` findings, record follow-up items under
      `plans/follow-ups/` for the rest, re-review once, and report.
- [ ] Delete this plan when the `plans` skill says, under "Deleting the plan".
- [ ] Open the pull request with the `finish-work` skill. Its description gives
      the user decisions and design calls with their dates, a permalink to
      this plan, and the follow-up items that the change adds.
- [ ] Wait for Required CI with `scripts/ci-wait.sh` of the `finish-work`
      skill. Do not merge. The parent orchestrator merges.

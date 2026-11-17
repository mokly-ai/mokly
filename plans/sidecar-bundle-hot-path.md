# Sidecar bundle hot path

Status: Active. On branch `calummoore/mokly-sidecar-bundle-hot-path-8efp`, no pull request yet. The pull request that completes this work deletes this plan.

Mokly compiles catalogue JavaScript in its Node sidecar. Each compile sends many imports through a style callback that handles only three libraries. Path scope checks also repeat general path operations for normalized absolute POSIX paths.

Reduce this JavaScript work with an alias-aware style filter, an exact POSIX path fast path, and callback-based asynchronous file reads. Preserve compiled code, metafiles, inputs, module digests, dependency usage, loaders, read errors, and all public behaviour. The target is at least 200 ms less bundle time on `mokly-cloud`. The performance orchestrator measures that catalogue after the implementation push.

Authorization: the task message approves this plan and its implementation without another approval step. The performance orchestrator owns the design calls below, dated 2026-11-17. Its authority comes from the user's 2026-11-16 request to improve Changes speed and reliability across multiple pull requests. That request forbids changes that can exhaust memory. The orchestrator of this workspace checks each call against the code and records any necessary correction.

Contract owners:

- [Sidecar bundling](../docs/protocol/mokly-sidecar.md#bundling).
- [Module sources and compiled recipes](../docs/protocol/mokly-sidecar-modules.md).
- [Sidecar timings](../docs/protocol/mokly-sidecar-timings.md).
- [Package entry points](../packages/mokly/README.md).
- [Developer test commands](../docs/protocol/developer-test-commands.md).

## Design and decisions

Shared assumptions: the task and its follow-up require byte-identical results and these three optimizations. Existing protocol requirements remain in force. No callback may miss an import that it handled before. Reads stay asynchronous and parallel. No new persistent cache is needed.

### 1. Avoid irrelevant style resolve callbacks

- **Severity:** Medium. **Effort:** Small.
- **Source:** Design.
- **Category:** performance.
- **Location:** `packages/mokly/src/sidecar/style-adapters-plugin.ts`.
- **Background:** The style adapter captures the registry of styled-components, react-native-web, and @emotion/react. Its broad resolve callback receives almost every import.
- **Problem:** The callback sends unnecessary work across esbuild's callback protocol.
- **Impact if no action:** Bundle compiles retain avoidable callback cost.
- **Root question:** How can a compile avoid style work for imports that cannot need a style adapter?
- **Options:**
  - **A.** Compute one alias-aware esbuild filter in setup. Keep every callback check. Effort: Small.
- **Left out:** Keep the broad filter: fails the required optimization. Rewrite resolution outside the plugin: exceeds the three-change scope and risks output changes. A library-only filter: misses aliases. These constraints leave one eligible approach.
- **Wider fix:** A centralizes the eligible specifiers in one filter for this callback.
- **Previous examples:** None found.
- **Recommendation:** A. It removes callback traffic while preserving resolution checks.
- **Action:** fix now, apply A. Performance orchestrator's call of 2026-11-17 under the authorization above.

Use the existing longest-name-first alias list. Include each library name and each alias whose target equals a library, lies below it, or is its parent scope. Use one library list for the callback pattern and the filter. Escape alias names as literal Go regular expression text. Match names only at the start and at a slash or end boundary. Keep the reserved style-source callback unchanged. A safe superset is acceptable where overlapping aliases require callback checks.

### 2. Avoid general path work for normalized paths

- **Severity:** Medium. **Effort:** Small.
- **Source:** Design.
- **Category:** performance.
- **Location:** `packages/mokly/src/sidecar/path-scope.ts`.
- **Background:** Path scope checks determine source ownership and logical module names. Most compile paths are normalized absolute POSIX paths.
- **Problem:** General relative-path resolution repeats work for those paths.
- **Impact if no action:** Bundle compiles retain avoidable path processing cost.
- **Root question:** How can path scope checks cost less while preserving every result?
- **Options:**
  - **A.** Use lexical containment and slicing for normalized absolute POSIX paths. Keep the current relative-path fallback. Effort: Small.
- **Left out:** Keep only `path.relative`: fails the required optimization. Cache path pairs: adds retained memory without the requested exact fast path. Replace all relative-path handling: breaks fallback requirements. These constraints leave one eligible approach.
- **Wider fix:** A applies one exact eligibility predicate to the shared path scope functions.
- **Previous examples:** None found.
- **Recommendation:** A. The fast case is lexical and needs no retained cache.
- **Action:** fix now, apply A. Task-selected approach of 2026-11-17, checked by this workspace's orchestrator.

Both paths must start with `/`. They have no empty, `.` or `..` segment and no trailing slash, except `/`. Gate the fast path on `path.sep === "/"`. All Windows paths use the fallback. On POSIX, containment is `root === "/"`, equality, or a root prefix followed by `/`. Logical names slice the contained path after the root separator. Files outside the root keep `path.relative`, also when both paths are normalized.

### 3. Preserve consumer resolution coverage

- **Severity:** High. **Effort:** Small.
- **Source:** Design.
- **Category:** code structure.
- **Location:** `packages/mokly/src/sidecar/plugins.ts`.
- **Background:** The consumer plugin maps source and dependency imports. Native-mode decisions use the importer, import kind, and plugin data.
- **Problem:** An esbuild path filter cannot express those decisions.
- **Impact if no action:** None when the callback keeps its broad filter. Narrowing it can change bundle output.
- **Root question:** How should this change preserve consumer resolution correctness?
- **Options:**
  - **A.** Keep the consumer callback unchanged. Effort: Small.
- **Left out:** Narrow its filter: cannot represent importer and plugin data. Rewrite consumer resolution: exceeds the authorized change and adds correctness risk. These constraints leave one eligible approach.
- **Wider fix:** None. Existing resolution checks remain the correct boundary.
- **Previous examples:** The native-mode callback already uses importer context.
- **Recommendation:** A. It preserves required resolution coverage.
- **Action:** fix now, apply A. Performance orchestrator's call of 2026-11-17 under the authorization above.

### 4. Reduce source read overhead

- **Severity:** Medium. **Effort:** Small.
- **Source:** Design.
- **Category:** performance.
- **Location:** `packages/mokly/src/sidecar/plugins.ts`.
- **Background:** The file load callback reads source files with `fs.promises.readFile`. The performance orchestrator measured alternative read forms on `mokly-cloud`.
- **Problem:** Promise-based filesystem reads add avoidable overhead to each compile.
- **Impact if no action:** Bundle time retains about 115 ms of measured overhead.
- **Root question:** How can source reads cost less while preserving parallel reads and every result?
- **Options:**
  - **A.** Wrap callback `fs.readFile` from `node:fs` in one promise for the file load callback. Preserve the cached-input branch. Effort: Small.
- **Left out:** Keep `fs.promises.readFile`: fails the approved optimization. Use `readFileSync`: blocks the event loop and serializes slow storage reads. Add a read cache: exceeds scope and retains memory. These constraints leave one eligible approach.
- **Wider fix:** None. Apply the change at the measured read boundary.
- **Previous examples:** None found.
- **Recommendation:** A. It saves measured bundle time while retaining libuv read parallelism.
- **Action:** fix now, apply A. Performance orchestrator's replacement call of 2026-11-17 under the authorization above.

This replaces the earlier call to keep `fs.promises.readFile` pending measurement. In three interleaved rounds with the filter and path changes, the promise form averaged 2,472 ms. The callback form averaged 2,358 ms. The synchronous form averaged 2,246 ms. An earlier run gave 2,423 ms for the promise form and 2,144 ms for synchronous reads. Synchronous reads are rejected despite that local-disk gain. Slow storage, including WSL2 mounts and Docker bind mounts, must retain asynchronous parallel reads. The completed contract audit found only 0 to 3 CSS load reads per compile on the measured catalogues. Keep that read on `fs.promises.readFile`. Look up callback `readFile` on the `node:fs` default export at call time.

### 5. Keep read error details exact

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Small.
- **Source:** Implementation.
- **Category:** product bug.
- **Location:** `packages/mokly/src/sidecar/plugins.ts:56-57`.
- **Background:** Decision 4 replaces the promise read in the file load
  callback with callback `fs.readFile` in one promise. When a read fails, the
  callback throws the read error. esbuild turns the error into a message with a
  stack-derived location. `bundleDetail` prints that location first.
- **Problem:** A promise read error carries async frames, so esbuild picks its
  own handler frame, `lib/main.js:1552:22`. A callback read error carries no
  frames, so esbuild uses the import statement. The first line of the
  `bundle-failed` detail changes, and the importer note line disappears.
- **Impact if no action:** A read failure after resolution shows a different
  detail. Examples are EACCES and a file that disappears during the compile.
  This breaks the exact read error requirement of the task.
- **Root question:** How can the faster read keep every read error detail, with
  no extra read and no work on success?
- **Options:**
  - **A.** Catch the read rejection in the async file load callback, after the
    await. Call `Error.captureStackTrace` on the same error, then rethrow it. It
    adds no work on success. It differs from the baseline only when
    `Error.stackTraceLimit` is 2 or 3. Effort: Small.
  - **B.** Keep `fs.promises.readFile` in the file load callback. It is exact
    in every case. It gives up the measured gain of about 114 ms. Effort: Small.
  - **C.** Do A, but capture with a stack limit two frames lower than the
    current limit. By reasoning, it also matches limits 2 and 3 for open
    failures on Node 22 and 24. I did not run it. It needs a constant for
    Node's internal frame count and a temporary change of a process-wide
    setting. Effort: Small.
- **Left out:**
  - Plain callback read: fails the exact error requirement, as the proof shows.
  - A second read with `fs.promises.readFile` after a failure: adds a read,
    which the task forbids. The file can also change between the two reads.
  - A built esbuild error with a set location: must copy esbuild's internal
    handler position. Its `detail` object and its notes also differ.
  - A stack capture on every read: adds work on success, which the task
    forbids.
  - Synchronous reads: decision 4 rejects them for event-loop blocking and slow
    storage.
- **Wider fix:** None. The location comes from esbuild's stack parser. A wider
  fix in `bundleDetail` would change today's detail, which the task forbids.
- **Previous examples:** None found.
- **Related:** Decision 4: the same code. This item sets the failure branch of
  its option A.
- **Recommendation:** A. It keeps the measured gain and matches the baseline in
  every tested case at the default stack limit. C covers only a consumer-set
  limit of 2 or 3, but it adds a Node-internal constant.
- **Action:** fix now, apply A. Performance orchestrator's approved call of
  2026-11-17 under the user's delegation of 2026-11-16. It keeps the user's error-detail requirement and adds no boundary
  behaviour.

The performance orchestrator accepted the residual difference when consumer code sets `Error.stackTraceLimit` to 2 or 3 on 2026-11-17. Mokly never sets that limit. The error code and message remain equal. The alternative copies a Node-internal frame count and changes a process-wide setting. Capture only after an awaited rejection in the async file load callback. Do not perform another read or capture a stack on success.

The completed options check supports A. Its clarifications also keep all assertions in `tests/sidecar_bundle_snapshot.test.ts`. Change only its read patch to callback `node:fs` `readFile`. Sort `compiled.peers` keys in the one-time byte comparison, because their existing insertion order varies.

The existing read-failure diagnostic starts with esbuild's internal `main.js` location. Its separate follow-up is `plans/follow-ups/sidecar-read-failure-location.md`. This change preserves the current detail.

## Milestone 1: Documentation and contract audit

Status: Complete.

Depends on: none

Delegate the contract audit to the docs implementor. This is an internal optimization. Update a document only if it contradicts the preserved behaviour.

- [x] Confirm that the bundling, module source, and recipe contracts need no requirement change.
- [x] Check each supplied design call against the current code. Record any correction with its owner, date, and reason.

Evidence: `.context/sidecar-bundle-hot-path/docs-audit/contract-audit.md` and `.context/sidecar-bundle-hot-path/docs-audit/options-check.md`. Both audits are complete. No tracked protocol document needs an edit.

## Milestone 2: Exact compile optimizations

Depends on: 1

Delegate these changes and their focused tests to the non-ui implementor. Keep the implementation and shared build output under one owner.

- [ ] Add assertion-red tests of the registered style filter. Cover direct libraries, subpaths, library and parent-scope aliases, nonmatches, literal regex characters, and overlapping aliases.
- [ ] Compute and register the style filter once in setup. Keep every callback check.
- [ ] Add a generated path table against the existing `path.relative` form. Cover equality, children, prefix siblings, `/`, trailing separators, dot segments, relative paths, and Windows semantics where available.
- [ ] Prove the path optimization's new operation behaviour fails before the change. Add the normalized absolute POSIX fast path to `inside` and `logical`.
- [ ] Keep the consumer resolve callback unchanged.
- [ ] Replace the file load callback read with callback `fs.readFile` wrapped in one promise. Apply decision 5 to its failure branch. Look up `readFile` on the `node:fs` default export at call time. Keep the CSS load read unchanged.
- [ ] Prove equal source bytes, loader selection, and cache-hit reads. Prove against the baseline sidecar on Node 22 and 24 that a read error keeps its code, message, and bundle failure detail. Change only the snapshot test read patch and preserve every assertion. Use assertion-red checks for new read-operation behaviour.
- [ ] Run a one-time before/after byte comparison for direct and aliased imports of all three libraries. Compare code, metafiles, inputs, module digests, and dependency usage. Compare `compiled.peers` with sorted keys. Save the proof under `.context/`.
- [ ] Run unchanged sidecar tests. Repeat each new asynchronous test 10 times. Record the cost and failure proof of each new test.

Evidence: `.context/sidecar-bundle-hot-path/implementation-report.md` and the evidence files that it names.

## Milestone 3: Measurements and verification

Depends on: 2

The workspace orchestrator owns the combined checks. Use built sidecars from the last merged main and this branch. Use the same inputs and dependency installation. Run measured processes one at a time.

- [ ] Measure `sidecar.bundle` and `sidecar.bundle.compile` with `--debug-timings` on `examples/basic` and the generated large React fixture from `scripts/large/`. Save interleaved before/after samples and their means.
- [ ] Run the required example build and Serve smoke check.
- [ ] Put Git 2.45 or later first on PATH. Install Git LFS. Check disk and memory before every large Cargo build. Set `CARGO_INCREMENTAL=0`, limit build concurrency, and use one Cargo target directory per checkout.
- [ ] Run targeted tests, `cargo xtask check --suite repository`, and `cargo xtask check`. Record each failure and any machine blocker. Rerun an unrelated failure once without weakening the check.

Evidence: `.context/sidecar-bundle-hot-path/measurements.md`, `verification.md`, and command logs.

## Milestone 4: Commit, review, and pull request

Depends on: 1, 2, 3

The workspace orchestrator owns this milestone. Merge new main changes with the git-merge skill when needed. Preserve the nearby bundle disk cache change if it merges first. Do not merge this pull request.

- [ ] Commit with Conventional Commits and push the implementation. Send its SHA to the performance orchestrator at once for the `mokly-cloud` measurement.
- [ ] Review the complete local diff against `origin/main` after the push with the implementation-review skill. Run the finding checks. Apply its two-fix-round limit, record follow-up items for remaining findings, and re-review.
- [ ] Confirm the performance orchestrator's `mokly-cloud` result and the 200 ms target before the final report. Report uncertainty if measurements do not establish it.
- [ ] Finish CI with the finish-work skill's `scripts/ci-wait.sh`. Fix each branch-caused failure. Send the final report to the performance orchestrator.
- [ ] Delete this plan under the plans skill after every other required task is complete, except CI and the report that need the pull request.
- [ ] Open the pull request into `main`. Keep its dated decisions, design calls, plan permalink, evidence summary, and follow-up items in the description. Leave it unmerged.

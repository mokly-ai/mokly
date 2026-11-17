# Lint scope test misses unnamed directories

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-31, from [PR #74](https://github.com/mokly-ai/mokly-cloud/pull/74), post-push review 1, finding 1.
- **Location:** `docs/mockups/src/_tests_/lint-scope.test.ts:10-23` and `xtask/tests/cli/javascript_tests.rs:75-86`.
- **Reason:** The review-fix rule sends a finding about test coverage to the user, and the user has not chosen an option yet.
- **Category:** Test.

- **Terms:**
  - **Lint script:** The `lint` script in `ts/package.json`. It runs `eslint . --max-warnings 0` from the repository root, and gate stage 11 runs it.
  - **Stage test:** A Rust test in `xtask/tests/cli/` that runs one gate stage in a scratch repository and proves that the stage rejects a violation.
  - **Probe:** A small file that holds one lint error, `const unused = 1;`. A test writes it to see whether the lint reads that path.
- **Background:**
  - `docs/protocol/repository-typescript.md`, section Tooling, requires that ESLint lints every JavaScript and TypeScript file in the repository.
  - The same section rejects a fixed list of linted directories, because a directory missing from the list goes unlinted without a warning.
  - Before PR #74, the lint script ran `eslint ts`. ESLint never read the catalogue sources under `docs/mockups/src`, and no test failed.
  - The stage test `eslint_stage_rejects_unused_typescript` writes its only probe at `ts/app/src/failure.ts`. It also passed with the old lint script.
  - PR #74 added `lint-scope.test.ts` to the mockup policy suite, which gate stage 15 runs through `npm run mockups:test`.
  - That test copies `.gitignore`, `eslint.config.js` and `ts/package.json` into a scratch Git repository, and it links `ts/node_modules`.
  - It writes probes at five source paths and at two Mokly output paths. It runs the lint script and expects only the five source probes to fail.
  - It runs in about 0.75 seconds.
- **Problem:** The new test passes when the lint script goes back to a fixed list that includes `docs/`, for example `eslint ts docs mokly.config.ts`. A review replayed this case on 2026-10-27. Two tests now build the same lint setup, and the `testing` skill asks for one test of each requirement.
- **Impact if no action:** A later fixed list of directories can again leave `infra/`, `xtask/`, `crates/`, `scripts/` or a new directory unlinted, and no test fails. Two suites must also keep the same lint setup in step.
- **Root question:** How does the repository prove that the lint keeps reading every source directory?
- **Options:**
  - **A.** Keep `lint-scope.test.ts`. Add probes in a new top-level directory, in `infra/` and in `xtask/scripts/`. Effort: Small.
  - **B.** Keep `lint-scope.test.ts`. Write one probe for each tracked top-level directory, taken from `git ls-files`. Each deliberate exclusion of a whole directory then needs a test edit. Effort: Small.
  - **C.** Delete `lint-scope.test.ts`. Make `eslint_stage_rejects_unused_typescript` write its probe at three paths, one at a time: `ts/app/src/`, `docs/mockups/src/` and a new top-level directory. The stage must fail for each path. This drops the check that Mokly output stays ignored. Effort: Small.
  - **D.** Delete `lint-scope.test.ts`, and add no check. Only the protocol doc and code review then protect the lint scope. Effort: Small.
- **Left out:** A check of every tracked file through the `isPathIgnored` API of ESLint. It checks the ignore rules but not the lint target of the script, so it misses the original defect.
- **Wider fix:** None. The structural fix is to lint the repository root by default with the ignore rules of Git, and `eslint.config.js` and the lint script already do this.
- **Previous examples:**
  - The original defect: the lint script ran `eslint ts` until commit `fe944f97`, so ESLint never read `docs/mockups/src`.
  - Commit `6893e1cf` made `xtask/tests/cli/support.rs` copy every directory that `sgconfig.yml` names, in place of a hand-listed subset.
- **Recommendation:** C. It keeps one test of the requirement, where each gate stage proves its rejections, and its new-directory probe catches a fixed list. Option B gives the codebase the best protection.
- **Action:** ask the user, because condition 6 holds: the finding is about test coverage, and the review-fix rule sends such findings to the user.

Facts for the work:

- On 2026-10-27, ESLint ran with `--no-ignore` on the built outputs `ts/site/dist`, `ts/desktop/dist`, `ts/site/.astro`, `ts/desktop/bundle` and `ts/app/dist`. It reported 32,592 errors in 25 of 35 files.
- So a lint that loses the `.gitignore` import fails on the next local run after a build. This is why option C drops the check that Mokly output stays ignored.
- The stage test fixture writes its own `.gitignore` with `target/` and `node_modules/`. It copies `eslint.config.js` and `ts/package.json`, and it links `ts/node_modules`.

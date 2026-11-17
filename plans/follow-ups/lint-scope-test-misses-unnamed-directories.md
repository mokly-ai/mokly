# Lint scope test misses unnamed directories

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-31, from [PR #74](https://github.com/mokly-ai/mokly-cloud/pull/74), post-push review 1, finding 1.
- **Location:** `docs/mockups/src/_tests_/lint-scope.test.ts:13-18`, the probe paths of the source files.
- **Reason:** The review-fix rule sends a finding about test coverage to the user, and the user has not chosen an option yet.
- **Checked:** 2026-11-17, in this repository after the cloud moved in. One lint now covers Mokly and the cloud. The lint scope test is the only test that probes the lint script, and it still writes source probes only under `docs/mockups/` and `apps/mockups/`.
- **Category:** Test.

- **Terms:**
  - **Lint script:** The `lint` script in the root `package.json`. It runs `eslint .` from the repository root, and the Repository suite of `cargo xtask check` runs it once.
  - **Probe:** A small file that holds one lint error, `const unused = 1;`. A test writes it to see whether the lint reads that path.
- **Background:**
  - The Tooling section of `docs/protocol/cloud/repository-typescript.md` requires that ESLint lints every JavaScript and TypeScript file in the repository.
  - The same section rejects a fixed list of linted directories, because a directory missing from the list goes unlinted without a warning.
  - In the old cloud repository, before PR #74, the lint script ran `eslint ts`. ESLint never read the catalogue sources under `docs/mockups/src`, and no test failed.
  - PR #74 added `lint-scope.test.ts` to the mockup policy suite. The `cloud-mockups` suite runs it through `npm run mockups:test`.
  - The test copies `.gitignore`, `eslint.config.js`, `package.json`, `apps/eslint-rules.mjs` and the modules under `scripts/eslint/` into a scratch Git repository, and it links the root `node_modules`.
  - It writes probes at four source paths and at three Mokly output paths. It runs the lint script and expects only the four source probes to fail. The source probes are under `docs/mockups/src/entries/`, `docs/mockups/src/screens/`, `docs/mockups/src/_tests_/` and `apps/mockups/src/`.
  - On 2026-10-31 the test ran in about 0.75 seconds.
  - The old cloud runner also had the stage test `eslint_stage_rejects_unused_typescript`, with one probe at `ts/app/src/failure.ts`. That test did not move into this repository.
  - `tests/eslint_gitignore.test.ts` checks, through the `isPathIgnored` API of ESLint, that ESLint ignores a path that Git ignores. It does not run the lint script.
- **Problem:** The test passes when the lint script goes back to a fixed list that includes `docs/` and `apps/`, for example `eslint apps docs`. A review replayed the same case with the old list `eslint ts docs mokly.config.ts` on 2026-10-27.
- **Impact if no action:** A later fixed list of directories can leave `packages/`, `tests/`, `scripts/`, `xtask/`, `infra/` or a new directory unlinted, and no test fails.
- **Root question:** How does the repository prove that the lint keeps reading every source directory?
- **Options:**
  - **A.** Keep `lint-scope.test.ts`. Add probes in a new top-level directory, in `infra/`, in `packages/`, and in `xtask/scripts/`. Effort: Small.
  - **B.** Keep `lint-scope.test.ts`. Write one probe for each tracked top-level directory, taken from `git ls-files`. Each deliberate exclusion of a whole directory then needs a test edit. Effort: Small.
  - **D.** Delete `lint-scope.test.ts`, and add no check. Only the protocol doc and code review then protect the lint scope. Effort: Small.
- **Left out:**
  - The earlier option C: move the probes into `eslint_stage_rejects_unused_typescript` and delete `lint-scope.test.ts`. That stage test did not move into this repository, so only one test of the requirement remains.
  - A check of every tracked file through the `isPathIgnored` API of ESLint. It checks the ignore rules but not the lint target of the script, so it misses the original defect.
- **Wider fix:** None. The structural fix is to lint the repository root by default with the ignore rules of Git, and `eslint.config.js` and the lint script already do this.
- **Previous examples:**
  - The original defect: in the old cloud repository, the lint script ran `eslint ts` until commit `fe944f97`, so ESLint never read `docs/mockups/src`.
  - Commit `6893e1cf` of the old cloud repository made its stage test fixture, `xtask/tests/cli/support.rs`, copy every directory that `sgconfig.yml` names, in place of a hand-listed subset.
- **Recommendation:** B. It gives the codebase the best protection. The earlier recommendation was C, because it kept one test of the requirement, and that test is now the only one.
- **Action:** ask the user, because condition 6 holds: the finding is about test coverage, and the review-fix rule sends such findings to the user.

Facts for the work:

- On 2026-10-27, ESLint ran with `--no-ignore` on the built outputs `apps/site/dist`, `apps/desktop/dist`, `apps/site/.astro`, `apps/desktop/bundle` and `apps/app/dist`. It reported 32,592 errors in 25 of 35 files.
- So a lint that loses the `.gitignore` import fails on the next local run after a build. The output probes of `lint-scope.test.ts` and `tests/eslint_gitignore.test.ts` both check that Git-ignored output stays out of the lint.

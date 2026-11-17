# Mockup determinism check rebuilds in the same checkout

- **Severity:** Medium. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-30, from the closed [PR #68](https://github.com/mokly-ai/mokly-cloud/pull/68), which re-landed findings P1 and P2 of the closed PR #39. On 2026-10-31 it took in the allow-list record from the review of PR #68, finding 1. On 2026-11-01 the Mokly 0.18.0 upgrade applied its decided Git isolation, dropped its 0.14.0 parts, and found that the moved second build conflicts with the exact comparison.
- **Location:** `ts/mockups/scripts/check-determinism.mjs:11-24`, `ts/mockups/scripts/determinism.mjs:99-136` and `docs/protocol/mockup-verification.md`, section "Build Determinism".
- **Reason:** Mokly 0.18.0 makes the decided moved second build conflict with the protocol's exact comparison of every file, so the user must choose how the check catches output that depends on the checkout path.
- **Category:** Test.

- **Terms:**
  - **Determinism check:** `test:determinism`, the first step of `mockups:test`. It builds the catalogue a second time and compares every file of both builds by exact bytes.
  - **Moved checkout:** a copy of the repository at another absolute path below `.context/mockups-determinism/<run>/`: a shared clone of `HEAD` with every tracked and unignored file of the working tree copied in.
  - **Document key:** the `documentKey` of each view in `mokly-viewer/index.json`, Mokly's hash of the inputs of one rendered document. The index's `deploymentId` hashes the output files, the keys included.
- **Background:**
  - Path-dependent output means rendered bytes that change with the checkout's absolute path, such as a render that prints `process.cwd()`.
  - Mokly 0.18.0 renders the base side of a comparison from an extraction in its cache, at another path. Path-dependent output therefore shows as false Changes.
  - On 2026-10-12 the user decided that the second build runs in a moved checkout, so the check catches path-dependent output.
  - `docs/protocol/mockup-verification.md` requires an exact comparison of every file, the index included, and forbids normalizing JSON or hashes.
- **Problem:**
  - In a moved checkout, Mokly 0.18.0 changes every document key, and so the `deploymentId`, `mokly-viewer/deployment.json` and the ownership marker `.mokly-export-artifact`. This happens also when every document is byte-identical.
  - The installed `ts/node_modules/@mokly/mokly/docs/protocol/mokly-watch.md` says that the key moves with "the selected dependency installation, or the resolved path of a package that the sidecar loads at render time, such as React", and that these "move every key". A moved checkout that links the same installation as one directory also moves every key.
  - So a moved second build fails the exact comparison on every run, and the decided moved checkout cannot run under the rule in force.
- **Impact if no action:** The second build stays in the same checkout, so the check cannot catch path-dependent output. Such output shows as false Changes on every affected screen in previews and pull request checks.
- **Root question:** How does the determinism check catch output that depends on the checkout path, when Mokly's own document keys depend on it?
- **Options:**
  - **A.** Keep the second build in the same checkout, and drop the moved checkout. The source policy of `docs/protocol/mockup-source-policy.md`, which the user decided on 2026-10-12, rejects `process`, `import.meta`, `__dirname` and Node built-in modules in drawings, the known ways for a drawing to read its path. A package that embeds a path still passes. Effort: Small.
  - **B.** Run the second build in the moved checkout. Compare every file by exact bytes except the document keys and the `deploymentId` in the index, and the two files that only repeat them, `mokly-viewer/deployment.json` and `.mokly-export-artifact`. It changes the rule that the check normalizes no JSON or hashes. Effort: Medium.
  - **C.** Keep the same-checkout second build with its exact comparison of every file. Add a third build in the moved checkout, which must match every file except the index, the deployment file and the marker. Nothing is normalized, but each `mockups:test` builds the catalogue once more, about 20 seconds. Effort: Medium.
  - **D.** Ask the Mokly repository to keep document keys and the deployment identity independent of the checkout location. After that release and a pin bump, run the second build in the moved checkout with the exact comparison of every file. Until then, apply A. Effort: Large.
- **Left out:**
  - Link the installed packages into the moved checkout, as the 0.14.0 design did. Mokly 0.18.0 refuses a module whose real path lies outside the checkout and its own `node_modules`: per-package links gave 60 such errors, and one link to the whole installation gave 7, through the workspace package `@mokly-cloud/tokens`.
  - Copy the installed packages. `ts/node_modules` holds 1.7 GB in 93,649 files. Hard links give the same layout in about one second.
  - Compare only the documents in a moved second build. It drops the index from the exact comparison, which the protocol requires. C keeps both.
- **Wider fix:** D, because it removes the cause, the location-dependent keys. C is the strongest check that is possible now.
- **Previous examples:**
  - The closed PR #39 found the same-checkout rebuild as findings P1 and P2 in the review of PR #36.
  - The closed branch `calummoore/reland-mockup-rebuild-isolation`, commit `f34f79d5`, ran the second build in a moved checkout for Mokly 0.14.0, whose output had no location-dependent keys.
- **Related:**
  - `plans/follow-ups/mockup-determinism-builds-share-time-zone.md`, same code. Both determinism builds keep the caller's environment except `GIT_*` variables, so they share the time zone and the locale. Its option A sets another time zone and locale for a second build, which fits every option here.
  - `docs/protocol/mockup-source-policy.md` states the source policy that option A relies on.
  - `plans/follow-ups/pr-39-doc-fixes-still-apply.md` marks its edit of `docs/protocol/mockup-verification.md` as done.
- **Recommendation:** C. It is the only option that applies the 2026-10-12 decision and keeps the rule that the check normalizes nothing, for one more build per test run. D best protects the codebase.
- **Action:** ask the user, because the options trade test time and a protocol rule against the coverage that the 2026-10-12 decision asked for, and A and B change a decision or a requirement in force.

Decided on 2026-10-12, applied on 2026-11-01:

- Every Node and Playwright test process removes each inherited `GIT_*` variable first. `ts/mockups/src/_tests_/clear-git-environment.mjs` does it, loaded by `ts/mockups/src/_tests_/register-web.mjs` and both Playwright configs.
- Each process that a test runs in a fixture checkout runs with `fixtureGitEnvironment` of `ts/mockups/src/_tests_/git-environment.mjs`: no `GIT_*` variable, `GIT_CONFIG_GLOBAL=/dev/null` and `GIT_CONFIG_NOSYSTEM=1`.
- The Publish test stages every file after each Publish, then asserts that the index holds no output.
- `docs/mockups/src/_tests_/git-environment.test.ts` holds the tests. `docs/protocol/mockup-verification.md` states the rules.

Decided on 2026-10-12, waiting for this item: the moved checkout, and with it the rule that each mockup-script Git call drops every `GIT_*` variable. No mockup script runs Git yet. The moved checkout adds the first calls: `git ls-files`, `git clone --shared` and `git read-tree`. Its build must also run without `GIT_*` variables, because Mokly runs Git in the moved checkout.

Dropped on 2026-11-01, because Mokly 0.18.0 makes them obsolete:

- The cloud's copy of the base-rebuild environment allow-list, with `CI=1` and `MOKLY_BASELINE_COMMIT` for the second build. They reproduced the environment of the 0.14.0 `review.baselineBuild` command. 0.18.0 has no such command: its configuration schema allows only `review.base` and `review.baseInstallScripts`, and no installed file names `MOKLY_BASELINE_COMMIT`.
- The base side of a 0.18.0 comparison renders in Mokly's own sidecars, which inherit the build's environment, as the installed `ts/node_modules/@mokly/mokly/docs/protocol/mokly-sidecar.md` says. The only 0.18.0 allow-list covers base dependency installs, which a `--no-changes` build never runs. So no environment rule of 0.18.0 applies to a determinism build.
- The earlier options C, D and E: an upstream export of the filter, a review step at each pin bump, and a fixture probe of the variable names. All three kept the allow-list copy aligned, and no copy remains.

Facts of 2026-11-01 for the moved checkout:

- A moved build of an unchanged catalogue differs in exactly three files: `mokly-viewer/index.json`, in every document key and the `deploymentId`, `mokly-viewer/deployment.json` and `.mokly-export-artifact`. Documents, CSS, assets and entry details match.
- A render that prints `process.cwd()` changes the documents in a moved build. A render that prints `import.meta.url` does not.
- A moved checkout needs `ts/node_modules` recreated inside it: each file as a hard link, and each symbolic link with its own relative target. The workspace links then point at the moved `ts/tokens`. It takes about one second to create and one second to remove.
- For the dogfood catalogue, creating the moved checkout takes about 3 seconds and its build about 17 seconds.

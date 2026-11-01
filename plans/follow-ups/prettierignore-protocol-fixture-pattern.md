# Restore the protocol fixture pattern in prettierignore

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from PR #221 and its completed plan, which put the
  problem outside the scope of its second review.
- **Location:** `.prettierignore:10`.
- **Reason:** The stale comment dates from PR #199, and PR #221 did not
  change `.prettierignore`.

- **Source:** Review.
- **Category:** Repository rule.
- **Terms:**
  - **Protocol fixture:** a JSON file under `docs/protocol/fixtures/`, such
    as `upload-plan-v1.json`. Tests and receivers read it as an example of
    a public format.
- **Background:**
  - Before PR #199, `.prettierignore` held the comment "Canonical protocol
    bytes are verified by catalogue conformance tests." Below it, it listed
    `docs/protocol/fixtures/catalogue-v4.json`, `catalogue-v5.json`, and
    `catalogue-v6.json`.
  - PR #199 deleted those three fixtures on 2026-10-25. It replaced the
    comment with "Protocol fixtures keep their canonical bytes." at
    `.prettierignore:10`, with no path below it.
  - The current fixtures are pretty-printed JSON: `catalogue-v9.json`,
    `entry-details-v4.json`, `export-ownership-v3.json`, and
    `upload-plan-v1.json`.
  - `tests/installed_receiver_fixtures.test.ts` reads
    `upload-plan-v1.json` with `JSON.parse`.
- **Problem:** The comment says that the fixtures keep their canonical
  bytes, but no pattern excludes them. Prettier therefore formats every
  protocol fixture.
- **Impact if no action:** A reader can trust a rule that does not exist. A
  fixture that needs exact bytes would be changed by `npm run format`.
- **Root question:** Do the protocol fixtures need exact bytes, and does
  `.prettierignore` say so correctly?
- **Options:**
  - **A.** Remove the stale comment. The fixtures stay under Prettier.
    Effort: Small.
  - **B.** Add `docs/protocol/fixtures` below the comment, so that Prettier
    keeps the exact bytes of every fixture. Effort: Small.
  - **C.** Change nothing. Effort: Small.
- **Left out:** None. The three options cover each answer to the root
  question.
- **Wider fix:** None. The file has one stale comment, and no class of
  repeated defect was found.
- **Previous examples:** None found.
- **Recommendation:** A. The current fixtures are already
  Prettier-formatted, and the test found reads them as parsed JSON.
- **Action:** fix after merge, apply A, because the comment
  contradicts the configuration, and A keeps the current formatting.

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/gzip-blob-uploads.md?plain=1#L387).

# Static CORS spec reads its own host's headers

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-28, from the check of finding 11 of the review of the branch `calummoore/embedded-access-start-page-worker-and-1p13`.
- **Location:** `tests/browser/static_cors.spec.ts:101-118` and the test host `tests/helpers/static_server.ts:23-33` and `:51-71`.
- **Reason:** The assertions are older than the branch that found them.

- **Source:** Review.
- **Category:** Test.
- **Terms:**
  - **Static test host:** the small HTTP server in `tests/helpers/static_server.ts` that the browser suite uses to serve a static build. It sets its own CORS, `Vary`, `nosniff`, and content type headers.
- **Background:**
  - The test "the public test host applies exact-origin CORS and headers to copied files and missing paths" requests copied files and missing paths from the static test host.
  - Most of its header assertions check the CORS, `Vary`, `nosniff`, and JSON type headers, and the denied-origin CORS answer, which the test host itself sets. They copy the host rules of `docs/protocol/mokly-export-delivery.md`, section "Headers, Caching, And Revalidation". No product code writes these headers for a static build, because a static build is deployed by the user's own host.
  - The content checks at lines 121-129 (`index.schemaVersion` and the missing `live` field) read the copied output. No assertion reads the bytes of a copied file. `crates/mokly-cli/tests/static_output_tests.rs:80-82` and `:92` already check the copied output.
  - On 2026-11-28 the branch above removed two type assertions of the same kind, for the start page and the worker file, under the removal rule of the `testing` skill (commit `1bcd3837f`).
- **Problem:** These assertions check the test double, so no product change can make them fail.
- **Impact if no action:** The suite spends time on checks that look like coverage of static delivery and give none.
- **Root question:** What does this spec prove about the product that no other test proves?
- **Options:**
  - **A.** Remove the assertions that read headers which the test host sets, under the removal rule of the `testing` skill, keep the status and content checks of lines 121-129, and rename the test to what it then checks. Risk: none, because no product code sets those headers. Effort: Small.
  - **B.** Remove the whole test, after moving its status and content checks to `crates/mokly-cli/tests/static_output_tests.rs`, as step 5 of the removal rule says. Risk: the browser suite then has no static-host check of the copied paths. Effort: Small.
- **Left out:** Moving the header rules into product code, because a static build has no server of its own.
- **Wider fix:** None, because the removal rule of the `testing` skill already covers tests of test doubles.
- **Previous examples:** Commit `1bcd3837f` removed two such assertions from the same spec. `plans/follow-ups/pool-tests-assert-worker-double-values.md` is an earlier case of the same class.
- **Recommendation:** A. It keeps the checks of the copied output.
- **Action:** fix after merge, apply A, because the assertions are older than the branch that found them.

# Two invitation tests hit the sign-in link limit

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Small. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-06, seen in a whole app suite run on `calummoore/skeleton-sizing-mismatch` during the fix of review finding 82.
- **Location:** `ts/app/src/_tests_/invitation.spec.ts` ("the delivered invitation accepts the invited address after sign-in" and "a different signed-in address can switch to the invited address").
- **Reason:** The tests and their sign-in steps are older than the change that saw them fail, which did not touch their admission handling.
- **Category:** Test.

- **Terms:**
  - **Link admission:** The API's limit of 20 sign-in link requests per client address per minute, answered with 429 and a Retry-After header.
- **Background:** Every browser test signs in for itself through the real magic link, and `admitLinkRequest` in `ts/app/src/_tests_/sign-in-links.ts` waits out the API's Retry-After when the admission window closes.
- **Problem:** In one whole-suite run each test failed once and passed on its retry. The first received 429, not 202, on a sign-in link request. The second timed out at the acceptance step, then passed 10 of 10 alone. Both tests send a second sign-in link request that does not go through the admission wait.
- **Impact if no action:** The gate fails now and then when the suite reaches these tests with a full admission window.
- **Root question:** How do the invitation tests send their second sign-in request within the API's limit?
- **Options:**
  - **A.** Send every sign-in link request of these tests through `admitLinkRequest`, so a 429 waits out the API's Retry-After. Reproduce first by filling the admission window before the test. Effort: Small.
- **Left out:** A retry or a longer limit. The testing rules forbid both as fixes for a flaky test.
- **Wider fix:** A, for every test that sends a sign-in link request outside the shared helper.
- **Previous examples:** `admitLinkRequest`, which the other sign-in steps already use.
- **Recommendation:** A.
- **Action:** fix after merge, apply A, because the tests are outside the change that saw them fail.

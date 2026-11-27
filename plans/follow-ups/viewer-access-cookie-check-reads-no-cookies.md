# The publication cookie check reads no cookies

- **Severity:** Medium. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-26, from branch `calummoore/test-audit-app-and-cloud-rust-fl63`, review finding 4, which its finding check moved outside the scope.
- **Location:** `packages/app/src/_tests_/viewer/access.spec.ts:31` and `:67`.
- **Reason:** The same header read was already on `origin/main` (`access.spec.ts:19` before the audit). The audit only moved it into a merged test, so its fix belongs in its own branch.

- **Source:** Review.
- **Category:** Test.
- **Terms:**
  - **Publication host:** the separate host that serves one published catalogue, on the catalogue origin.
  - **App session cookie:** the `mkc_session` cookie that signs the reader in to the App API on the App origin.
- **Background:** `docs/protocol/cloud/viewer-read-model.md` and the access rules keep the App's session on the App origin. The browser test "a private publication is opened with the publication host's own cookie, renewed once, and confirmed before a switch loads" in `packages/app/src/_tests_/viewer/access.spec.ts` collects the Cookie header of every request to the publication host. It then checks that there is at least one request and that no Cookie header contains `mkc_session`.
- **Problem:** The test reads `request.headers().cookie`. Playwright documents that `request.headers()` leaves out security-related headers, among them cookies (`node_modules/playwright-core/types/types.d.ts`, the `headers()` doc, which points to `allHeaders()`). So every collected value is likely the empty string, and the `mkc_session` check passes without reading any Cookie header that Chromium sent. The comparison step of the same file, at about line 222, already reads `allHeaders()`.
- **Impact if no action:** If the App session cookie reached the publication host, this test would not fail, so it gives false assurance about the credential boundary.
- **Root question:** How does the test verify the cookie names that Chromium sent to the publication host?
- **Options:**
  - **A.** Read each matching request's real Cookie header with `await request.headerValue("cookie")` or `await request.allHeaders()`, and assert the cookie names. Keep the positive request count. Effort: Small.
  - **B.** Do A through one small helper in the file that both this check and the comparison check use. Effort: Small.
  - **C.** Record the cookie names at the fixture catalogue server, and assert those records. Effort: Medium.
- **Left out:** Reading only the browser's stored cookies, because that leaves the outgoing requests unchecked.
- **Wider fix:** B. One reader of complete headers for both checks removes the provisional-header path from the file.
- **Previous examples:** None found.
- **Recommendation:** B. Both checks read the same request boundary, and one helper keeps them alike.
- **Action:** fix after merge, apply B, because the problem was on `origin/main` before the audit and needs its own branch.

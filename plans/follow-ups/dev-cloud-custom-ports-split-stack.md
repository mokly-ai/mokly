# Dev cloud custom ports split the stack

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-25, from the review of branch `calummoore/testing-locally-dev-jkf5` (findings 2 and 10).
- **Location:** `packages/app/scripts/dev.mjs`, `scripts/cloud/dev-publication-env.sh:6`, `packages/app/scripts/build-web.mjs:23`.
- **Reason:** A Medium product bug with the likelihood Rare. The fix rule defers it.
- **Category:** product bug.

- **Background:** `npm run dev:cloud` starts the API, the catalogue server and the app. It reads `MKC_API_ORIGIN`, `MKC_CATALOGUE_BIND` and `MKC_APP_PORT` for its own health checks and for the sign-up link that it prints. The child processes read their own settings: the API and the catalogue server take `MKC_APP_ORIGIN` and `MKC_CATALOGUE_ORIGIN`, and the app build takes `MKC_API_PORT`.
- **Problem:** A custom port moves only part of the stack. With `MKC_APP_PORT=8181`, the app and the printed link move, but the API and the catalogue server still admit the app origin on port 8081, so sign-in fails. A custom `MKC_CATALOGUE_BIND` moves the catalogue listener, but `MKC_CATALOGUE_ORIGIN` keeps port 8082.
- **Also:** With `MKC_API_ORIGIN=http://localhost:8080/`, which the API accepts, the launcher checks `//v1/health`, gets 404, and never starts the app. The API check uses the public origin, so a tunnel origin, as in `docs/ops/github-app-smoke.md`, also sends the check through the tunnel. The catalogue check already uses its bind address. The readiness wait has no time limit and prints nothing while it waits.
- **Impact if no action:** A developer who sets a port variable sees a stack that reports that it runs, but the browser cannot sign in.
- **Root question:** How can the one local cloud command take one set of addresses and give the same addresses to every server, the app build, and its own health checks?
- **Options:**
  - **A.** Keep fixed ports. Stop reading the port variables in `dev.mjs`, and give every child the default addresses. Two worktrees cannot run the command at the same time. Effort: Small.
  - **B.** Read only `MKC_API_PORT`, `MKC_APP_PORT` and `MKC_CATALOGUE_PORT`, which the app browser tests already use. Derive every origin and bind address once, set them as child defaults, and use the bind addresses, not the public origins, for the health checks. Print the health URL and the last error once when a check has not answered after about 30 seconds. An explicit origin setting still wins. Effort: Small.
  - **C.** Do B, and move the code that turns ports into origins out of `packages/app/src/_tests_/origins.ts` into a shared script module that the tests and the launcher both use. Effort: Medium.
- **Left out:** Widening the API's allowed origins. The app build and the email links stay on their old addresses.
- **Wider fix:** C. The tests, the app build and the launcher then turn ports into addresses in one way.
- **Previous examples:** The app browser suite gives its servers and its export one set of addresses in `packages/app/src/_tests_/origins.ts`.
- **Related:** None.
- **Recommendation:** B. It aligns the addresses with the variables that the repository already uses, at Small effort.
- **Action:** fix after merge, apply B, because it is a rare developer-only setup and the fix rule defers a Medium Rare product bug.

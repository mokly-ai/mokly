# Dev cloud accepts an old listener as ready

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-25, from the review of branch `calummoore/testing-locally-dev-jkf5` (finding 12).
- **Location:** `packages/app/scripts/dev-stack.mjs` (`waitUntilReady`), `packages/app/scripts/dev.mjs`.
- **Reason:** It needs a port that another process already uses, and the fix reaches the readiness of all three servers.
- **Category:** product bug.

- **Background:** `npm run dev:cloud` checks the API and the catalogue server before it starts the app, then checks the app before it prints the sign-up link. The app builds its web export before it listens. Each check accepts any 2xx answer at its address.
- **Problem:** An older listener on the app port answers the check while the new app still builds, so the launcher prints "Mokly Cloud runs" too early. The new app then fails to listen and exits. The launcher probes `localhost`, but the servers bind `127.0.0.1`, so an old listener on `[::1]` gives no bind conflict at all.
- **Impact if no action:** A developer can open an older app or another service.
- **Root question:** How can the launcher confirm that the services from this run are the ones that answer?
- **Options:**
  - **A.** Check for occupied ports before the build, with the `listening` helper, and report the conflict. Effort: Small.
  - **B.** Read the "listening" line that each child already prints (`API listening`, `Catalogue listening`, and the `serving` line of `serve-dist.mjs`). Accept the HTTP check only after that line, and probe the address that it reports. Effort: Medium.
  - **C.** Give each child a per-run token and have each health endpoint return it. Effort: Medium.
- **Left out:** Asking the operating system which process owns the port. It depends on the platform and a tool.
- **Wider fix:** B. Each check depends on a signal from the child of this run, with no server change.
- **Previous examples:** `scripts/verification/serve-process.mjs` takes the listening address from its own child.
- **Related:** `dev-cloud-custom-ports-split-stack.md` also changes the readiness targets. Agree on one source for them.
- **Recommendation:** B with A. B proves ownership, and A reports the conflict before the long build.
- **Action:** fix after merge, apply B, because the case needs an occupied port and the fix reaches all three servers.

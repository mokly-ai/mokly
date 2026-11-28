# Dev cloud stop skips the server drain

- **Severity:** Low. **Likelihood:** Rare. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-25, from the review of branch `calummoore/testing-locally-dev-jkf5` (finding 11).
- **Location:** `packages/app/scripts/dev-processes.mjs` (`startService`, `stop`), `crates/mkc-api/src/application_server.rs:60`, `crates/mkc-catalogue-server/src/application.rs:133`.
- **Reason:** A Low product bug with the likelihood Rare. The fix rule defers it.
- **Category:** product bug.

- **Background:** `npm run dev:cloud` runs each server in its own process group, so the terminal's Ctrl+C reaches only the launcher. The launcher then sends SIGTERM to each group. The API and the catalogue server drain their active requests only on SIGINT, which a terminal sends when you start them alone.
- **Problem:** SIGTERM ends both Rust servers at once, without the drain.
- **Impact if no action:** A Ctrl+C at the moment of an upload or a download cuts it off. The same request finishes when the server runs alone in a terminal.
- **Root question:** Which stop signal should the local stack use, so that each server shuts down as it does when you start it alone in a terminal?
- **Options:**
  - **A.** Send SIGINT to every service group on the first stop. All three services stop cleanly on SIGINT. Change the stop test so that its child traps SIGINT. Effort: Small.
  - **B.** Give each service its own first stop signal, SIGINT for the Rust servers. Effort: Small.
  - **C.** Make both Rust servers drain on SIGINT or SIGTERM through one shared stop function, as `crates/mkc-github-double/src/cli.rs` does. Effort: Medium.
- **Left out:** A longer grace period. The first signal stays the same.
- **Wider fix:** C. The default stop of any supervisor then reaches the drain.
- **Previous examples:** Both cloud images set `STOPSIGNAL SIGINT` for these binaries.
- **Related:** None.
- **Recommendation:** A. It matches the manual terminal steps for all three services in a one-line change.
- **Action:** fix after merge, apply A, because the fix rule defers a Low Rare product bug.

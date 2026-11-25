# Dev cloud ignores a stop while it prepares

- **Severity:** Medium. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-25, from the review of branch `calummoore/testing-locally-dev-jkf5` (finding 4).
- **Location:** `packages/app/scripts/dev-stack.mjs` (`runStack`, `step`), `packages/app/scripts/dev-processes.mjs` (`runCommand`), `packages/app/scripts/dev.mjs` (`prepare`).
- **Reason:** A Medium product bug with the likelihood Rare. The fix rule defers it.
- **Category:** product bug.

- **Background:** `npm run dev:cloud` installs and builds, starts Postgres when needed, and builds the two Rust servers before it starts any server. Ctrl+C in a terminal reaches every process of the foreground group, so the active build exits and the launcher stops with "failed".
- **Problem:** A signal that reaches only the launcher, such as `kill` or an IDE stop, does not reach the active one-shot command, and `runStack` does not read the stop until preparation ends. The launcher then still starts the API and the catalogue server before it stops them. A stop during preparation also reports "failed" with status 1, but a stop after the servers start exits with 0. The messages from `prepareDevelopment` also name `npm run dev`, not `npm run dev:cloud`.
- **Impact if no action:** A stop from an IDE can wait for a long Rust build and start servers that it then stops at once.
- **Root question:** How can a developer stop the local cloud command during any part of startup?
- **Options:**
  - **A.** Check for a stop before each step and before the servers start, and forward the signal to the active command. Effort: Small.
  - **B.** Pass one `AbortController` to `run` and to the service start. `run` refuses to start after the abort, signals the active command on abort, and returns a stopped result. `runStack` reports a stop with status 0. Effort: Small.
  - **C.** One process manager for one-shot commands and services, with the group stop rule of `startService`. Effort: Medium.
- **Left out:** Installing the signal listeners only after preparation. A lone SIGTERM would then leave an orphaned build.
- **Wider fix:** B. Every one-shot step goes through `run`, so a new step gets the same rule.
- **Previous examples:** Commit `44eda16b8` fixed a cancellation that left a comparison install running during cleanup.
- **Related:** None.
- **Recommendation:** B. It gives one cancellation point and one exit status for a stop, at Small effort.
- **Action:** fix after merge, apply B, because a terminal Ctrl+C already stops preparation and the fix rule defers a Medium Rare product bug.

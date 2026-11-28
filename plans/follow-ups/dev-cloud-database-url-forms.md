# Dev cloud misreads some database URLs

- **Severity:** Low. **Likelihood:** Rare. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-25, from the finding checks of branch `calummoore/testing-locally-dev-jkf5` (checks of findings 1, 6 and 7).
- **Location:** `packages/app/scripts/dev-stack.mjs` (`ensurePostgres`), `packages/app/scripts/dev-settings.mjs`.
- **Reason:** A rare developer-only setup with a workaround. The fix rule defers it.
- **Category:** product bug.

- **Background:** `npm run dev:cloud` reads the host and the port of `MKC_DATABASE_URL`. When nothing answers there, it starts the Compose `postgres` service, which listens on `127.0.0.1:5432` with the `mkc_test` database.
- **Problem:** The launcher starts Compose for any URL that does not answer, also when the URL names another port or a remote host that Compose does not provide. A Unix-socket URL that the API accepts, such as `postgres:///mkc_test?host=/var/run/postgresql`, has an empty host, so the probe tries `localhost:5432` in place of the socket.
- **Impact if no action:** Docker can start a container that nothing uses, and the API then fails with a less clear error. The workaround is a TCP URL with the default host and port.
- **Root question:** How can the launcher tell whether the configured database answers, and start Compose only when Compose provides that database?
- **Options:**
  - **A.** Start Compose only when the URL names a loopback host and port 5432. For any other URL that does not answer, stop with a message that names the host and the port. Effort: Small.
  - **B.** Do A, and read the `host` query parameter of a socket URL, then probe the socket path. Effort: Small.
  - **C.** Probe with the API's own connection code through a small check command, after the Rust builds. Effort: Medium.
- **Left out:** Removing the automatic Docker start. It loses the convenience that the guide gives.
- **Wider fix:** C. The probe and the servers then read the URL in the same way.
- **Previous examples:** None found.
- **Related:** None.
- **Recommendation:** B. It covers both reproduced forms at Small effort.
- **Action:** fix after merge, apply B, because the setup is rare and has a workaround.

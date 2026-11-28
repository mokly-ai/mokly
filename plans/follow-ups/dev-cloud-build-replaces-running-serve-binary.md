# Dev cloud build fails while Serve runs

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-25, from the review of branch `calummoore/testing-locally-dev-jkf5` (finding 3).
- **Location:** `xtask/src/artifacts.rs:42`, `packages/app/scripts/dev.mjs`, `docs/protocol/mokly-watch.md:216`.
- **Reason:** A Medium product bug with the likelihood Rare. The fix also reaches the Rust `xtask` and a protocol decision outside the diff.
- **Category:** product bug.

- **Background:** `npm run dev:cloud` always runs `npm run build`, which starts with `cargo xtask build-native`. That step copies the native `mokly` binary into `packages/native-{host}/bin/mokly` with `fs::copy`, which writes in place. `npm run dev` runs Serve from that same path.
- **Problem:** On Linux, the copy over a running binary fails with `Text file busy`, also when Cargo has nothing to rebuild. So `npm run dev:cloud` stops at the build while `npm run dev` runs in the same checkout. On macOS, an in-place overwrite of a signed binary can kill the running Serve (not tested).
- **Impact if no action:** A developer must stop the example server before starting the cloud stack, or start the cloud servers one at a time.
- **Root question:** How can one checkout rebuild the native binary while another process runs it, and should `dev:cloud` rebuild that binary at all?
- **Options:**
  - **A.** Give `dev:cloud` a build that covers only the workspace packages that the app uses (`@mokly/ui`, `model`, `frame` and `viewer`), and keep the install check. Effort: Medium.
  - **B.** On Unix, stage the binary beside its destination and rename it into place. A running Serve keeps the old file, and a new process gets the new one. Update the reason of the decision at `docs/protocol/mokly-watch.md:216` in the same change. Effort: Medium.
  - **C.** Skip the copy when the destination already has the same bytes. A Mokly source change while Serve runs still fails. Effort: Small.
- **Left out:** Warning and continuing on `Text file busy`. `npm run build` would then succeed with an old binary, which is wrong output.
- **Wider fix:** B. Every caller of the native build gets a complete binary without overwriting the one in use.
- **Previous examples:** Commit `e9c20225a` recorded the same Linux failure as the reason why `npm run dev` builds only when stale.
- **Related:** None.
- **Recommendation:** B. It fixes the class for every builder, also a plain `npm run build` while Serve runs.
- **Action:** fix after merge, apply B, because the fix rule defers a Medium Rare product bug and the fix reaches the Rust `xtask` outside this diff.

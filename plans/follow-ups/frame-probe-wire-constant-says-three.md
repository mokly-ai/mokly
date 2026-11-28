# Rust probe wire constant says version 3

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-27, from the review of the branch `calummoore/embedded-access-start-page-worker-and-1p13`.
- **Location:** `crates/mokly-model/src/versions.rs:16`, and the probe schema `packages/frame/src/probe/schema.ts:112`, `:121` and `:297`.
- **Reason:** The constant was wrong before that branch, which did not change the probe wire.

- **Source:** Review.
- **Category:** Docs or spec.
- **Terms:**
  - **Probe wire:** the `postMessage` envelope between the frame probe in a published screen and the viewer's frame adapter. `docs/protocol/mokly-frame-probe-wire.md` defines it.
- **Background:** `crates/mokly-model/README.md:195-196` says that `versions.rs` holds every independent format number. `crates/mokly-model/src/versions.rs` documents `FRAME_PROBE_WIRE` as the "Frame probe message envelope version" and sets it to 3. The probe's schema uses version 4. A search of `crates/` and `packages/` finds no reader of the Rust constant. `cargo xtask generate-types` generates five other versions into `packages/model/src/generated/model.ts:102-106` from Rust (`crates/mokly-model/src/typescript.rs:33-41`), and its check finds drift. The crate is not published (`crates/mokly-model/Cargo.toml:7`).
- **Problem:** A public Rust constant names a version that no current probe sends.
- **Impact if no action:** A Rust consumer that reads the constant checks for the wrong wire version.
- **Root question:** Where does the current probe wire version live for Rust code?
- **Options:**
  - **A.** Set the constant to 4. Nothing then stops the next drift. Effort: Small.
  - **B.** Remove the constant, because nothing reads it and the crate is not published. The README line above may count as keeping it on purpose, so update that line too. Effort: Small.
  - **C.** Set the constant to 4 and generate it into `packages/model` with the other versions, and make the probe schema read the generated value. One source then holds the number. Effort: Small.
- **Left out:** A test that compares the Rust value with the TypeScript source, because C removes the second copy instead of watching it.
- **Wider fix:** C, because one generated source cannot drift.
- **Previous examples:** None found.
- **Recommendation:** C. It keeps the README's promise and removes the copy. B is the choice if the README line goes.
- **Action:** fix after merge, apply C, because the drift is older than the branch that found it.

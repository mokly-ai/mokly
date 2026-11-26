# PostCSS read inventory hashes the esbuild binary

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-26, from the branch `calummoore/ci-speed-product-hot-spots-found-by-slow-o47c`.
- **Location:** `packages/mokly/src/sidecar/postcss-path-hooks.ts:24`, `packages/mokly/src/sidecar/postcss-evidence.ts:89`, and `crates/mokly-render/src/postcss_read_inventory.rs:138`.
- **Reason:** The fix removes one cache invalidation case that is on `origin/main`, so the user must choose.

- **Terms:**
  - **PostCSS worker:** the child Node process of the render sidecar that runs one PostCSS context.
  - **Read inventory:** the `readEvidence` of a worker result. Its `modules` list holds each module path that the worker resolved or loaded, also without an observed read. The Rust side hashes each mapped module again as a late digest, and the digests enter the stylesheet graph key.
- **Background:** The first esbuild call of a context is `build` in `packages/mokly/src/sidecar/postcss-module.ts:18`. esbuild's `generateBinPath` (`node_modules/esbuild/lib/main.js:1985`) calls `require.resolve("@esbuild/linux-x64/bin/esbuild")` and then starts that file as a process; it never loads it as a module. In Node 24, `require.resolve` runs the `module.registerHooks` resolve hooks. The resolve hook of `observeModulePaths` (`postcss-path-hooks.ts:24`) calls `recordModulePath`, so the binary enters `modules`. `ModuleDigests::late` (`crates/mokly-render/src/postcss_read_inventory.rs:68`) then hashes the 11,427,952-byte file once for each context: three times in `changed_postcss_module_keeps_the_historical_plugin_output`, about 0.2 s each in a debug test build.
- **Problem:** Each PostCSS context hashes an 11 MB file that is not a module input. esbuild already checks that the binary reports the version of `esbuild/lib/main.js` (`main.js:928`), and `lib/main.js`, `esbuild/package.json`, and `@esbuild/linux-x64/package.json` stay in the inventory with their digests, so a real esbuild upgrade still invalidates. Only a changed binary with the same version, the same `main.js`, and the same manifests would lose its invalidation if the binary leaves the inventory.
- **Impact if no action:** Each PostCSS context keeps the extra hash, which costs CPU time in every test and every real build with PostCSS.
- **Root question:** May the read inventory skip the esbuild binary, which esbuild only starts as a process, when the esbuild JavaScript and manifests stay in it?
- **Options:**
  - **A.** In `observeModulePaths`, compute the URL of Mokly's own esbuild `main.js` once, and skip `recordModulePath` when the resolve `context.parentURL` equals it. A consumer's own esbuild copy has another parent URL and stays recorded. Effort: Small (estimate). A prototype on a copy of the built worker removed only the binary (285 to 284 modules) and kept the output.
  - **B.** Record only the URLs that a load hook sees. Effort: Medium (estimate). It also drops the late digest of each resolve-only file, such as a data file that a plugin resolves and reads natively.
  - **C.** No change.
- **Left out:** Skipping `@esbuild/*/bin/esbuild` names on the Rust side, because it also drops a consumer's own copy and depends on platform package names. Setting `ESBUILD_BINARY_PATH` in the worker, because it applies to every esbuild copy in the process and breaks a consumer plugin with another esbuild version.
- **Wider fix:** None found.
- **Recommendation:** A (estimate). It removes only a file that is started and never loaded, and `main.js` plus both manifests still catch every real upgrade.
- **Action:** ask the user, because A removes an invalidation case that is on `origin/main`: a changed esbuild binary with an unchanged version.

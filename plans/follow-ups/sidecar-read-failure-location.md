# Sidecar read failures name esbuild first

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-17, from the sidecar bundle hot path contract audit on `calummoore/mokly-sidecar-bundle-hot-path-8efp`.
- **Location:** `packages/mokly/src/sidecar/plugins.ts`, `packages/mokly/src/sidecar/bundle-errors.ts`, and `docs/protocol/mokly-sidecar-modules.md`.
- **Reason:** The performance change must preserve the existing read-error detail, so diagnostic changes need a separate branch.

- **Terms:**
  - **Sidecar:** Mokly's Node process that bundles and evaluates catalogue modules.
  - **esbuild:** The JavaScript bundler that calls Mokly's source-file load callback.
  - **Bundle detail:** The diagnostic text that Mokly returns with a `bundle-failed` error.
- **Background:** The file load callback reads each bundled source file. A read failure can occur after resolution succeeds. esbuild uses the error stack to select a diagnostic location. Mokly's bundle error formatter prints that location first.
- **Problem:** A read failure starts with esbuild's internal `main.js` location instead of the authored importer. The importer appears only in a later note. This behaviour predates the bundle performance change.
- **Impact if no action:** An unreadable or removed file can make the first diagnostic line point into the bundler installation. The later importer note provides a workaround.
- **Root question:** Which source should a bundle read failure name first?
- **Options:**
  - **A.** Keep the internal location and the later importer note. This preserves existing diagnostic text but retains the misleading first line. Effort: Small.
  - **B.** Report the authored import location first for source read failures. Preserve the read error's code, message, and file path. This changes diagnostic text. Effort: Small.
  - **C.** Give load errors explicit source information at the plugin boundary and use it in the shared formatter. This can cover other load errors too, but needs a broader diagnostic contract. Effort: Medium.
- **Left out:** A copied esbuild line number depends on an internal implementation detail. A second filesystem read can observe a changed file and adds unnecessary work. These approaches do not improve source attribution.
- **Wider fix:** C separates authored source information from stack parsing across load diagnostics.
- **Previous examples:** The existing source-file read failure already uses this stack-derived location. No other example was found.
- **Recommendation:** B. It directly improves the first line for the known failure. C best protects the wider load-diagnostic boundary.
- **Action:** ask the user, because changing the first diagnostic location changes visible behaviour that the existing load-error contract does not choose.

Evidence from esbuild 0.28.2 on Node 22.23.2 and 24.22.1:

```text
main.js:1552:22: EACCES: permission denied, open '…/locked.js'
… onLoad registration note …
nested.js:2:8: The plugin "mokly-consumer" was triggered by this import
```

The same shape occurs for an unreadable entry and a nested import. The sidecar protocol requires source information and a diagnostic for `bundle-failed`. The module protocol excludes bundler implementation paths only for resolution diagnostics. It does not choose the first location for load errors.

The bundle performance change uses callback `fs.readFile`. On failure, it captures the same error's stack after the awaited rejection. This preserves the existing detail at the default stack limit. Consumer code that sets `Error.stackTraceLimit` to 2 or 3 can change that location. The performance orchestrator accepted this residual on 2026-11-17. Mokly never sets that limit. A future diagnostic change must test both read failure placement and the unchanged error code and message.

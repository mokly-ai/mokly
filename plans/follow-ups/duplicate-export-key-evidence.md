# Duplicate export keys can disagree with capture

- **Severity:** High. **Likelihood:** Rare. **Effort:** Small. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-19, from the options check of the Serve plan editor-invalidation work at `51c4a8d6b`.
- **Location:** `packages/mokly/src/sidecar/config-json.ts`, `parseJson`; `packages/mokly/src/sidecar/resolution-evidence.ts`, export target capture.
- **Reason:** Main has the same parser and shared export walk. Nobody reproduced changed output. Reproduce the owner outcomes before choosing a repair.

- **Source:** Implementation.
- **Category:** Product bug.
- **Terms:**
  - **Captured evidence:** The files, absent paths, links, and directory memberships checked before compiled reuse.
  - **Duplicate export key:** The same property name written more than once in one package export object.
- **Background:** Esbuild selects package export targets during compilation. Mokly separately reads package metadata to capture resolution evidence. These readers must agree on every target that can change module selection.
- **Problem:** `parseJson` ends with `JSON.parse`, which keeps the last duplicate property. Audited esbuild 0.28.2 retains duplicate export properties and its exact lookup selects the first. The shared walk can therefore observe another target's candidates.
- **Impact if no action:** A missing earlier candidate observation might permit stale compiled reuse. A persistent cache could retain that result across restarts. Nobody reproduced either outcome.
- **Root question:** How can export evidence remain exact when the manifest contains duplicate export keys?

## Reproduction hypothesis

Use one package with this manifest. Preserve the duplicate properties in the file.

```json
{
  "name": "duplicate-targets",
  "exports": {
    "./value": "./one/value.js",
    "./value": "./two/value.js"
  }
}
```

Create `one/value/index.js` and `two/value/index.js` with distinct exports.
Import `duplicate-targets/value` from a dependency file, so native plan capture can include the import.
Capture a successful compilation while `one/value.ts` is absent.
Then add `one/value.ts` with a different export and change no existing source file.
Compare reused and fresh module selections, output, recorded inputs, and errors.

First establish which target esbuild selects. Check all three compiled owners:

1. Reuse the compilation in its current sidecar process.
2. Restore it from the same bundle cache in a new process.
3. Run a strict build with that cache and compare a fresh-cache strict build.

Also inspect full evidence, consumed-directory checks, and plan admission.
A separate observed directory can already reject the addition. Do not claim stale reuse without this proof.

The source mismatch comes from esbuild v0.28.2 `internal/js_parser/json_parser.go:154` and `internal/resolver/package_json.go:631`.
The options check read those pinned upstream sources. It ran no owner reproduction.

- **Options:**
  - **A.** Reproduce first. Record actual selected targets and the three owner outcomes. Keep current behavior until a defect is proved. Effort: Small.
  - **B.** Mark evidence incomplete when resolution metadata has relevant duplicate keys. This prevents stale reuse conservatively and loses reuse for that form. Effort: Medium.
  - **C.** Preserve duplicate-key order in the metadata reader and capture every native-selectable target. This keeps reuse but needs a larger parser and source proof. Effort: Large.
- **Left out:** Changing only plan candidate names cannot repair compiled or stored evidence. Rejecting the build adds a new user-visible error. Rewriting dependencies does not solve capture's reader mismatch.
- **Shared assumptions:** Exact output, current bounds, and disk-cache rules stay. Source: the reuse contracts in `docs/protocol/mokly-sidecar-recipes.md` and `docs/protocol/mokly-base-cache.md`. The assumption that a parsed object matches native metadata is a code choice. B and C remove it.
- **Wider fix:** C removes the reader mismatch. It requires proof that the other metadata readers use compatible ordering too.
- **Previous examples:** [self-package-folder-export-evidence.md](./self-package-folder-export-evidence.md) records a different missing export-target observation with reproduced stale compiled output.
- **Related:** [self-package-folder-export-evidence.md](./self-package-folder-export-evidence.md), the same export capture owner. A folder expansion repair does not prove duplicate-key handling.
- **Recommendation:** A. The source mismatch is confirmed, but current memberships may already prevent stale output.
- **Action:** fix after merge, apply A. Decide on a capture repair after the owner probes establish its need.

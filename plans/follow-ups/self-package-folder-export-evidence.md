# Self-package folder exports miss candidate membership

- **Severity:** High. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-19, from the implementation checks of branch `calummoore/mokly-plan-reuse-editor-files-6dni` at `51c4a8d6b`.
- **Location:** `packages/mokly/src/sidecar/resolution-evidence.ts`, methods `capture`, `targets`, and `exports`; `packages/mokly/src/sidecar/compiled.ts`, function `reuse`.
- **Reason:** Main has the same missing observations. The performance orchestrator owns a separate repair and directed the exact Serve plan work to continue.

- **Source:** Implementation.
- **Category:** Product bug.
- **Terms:**
  - **Self-package import:** An import whose package name equals the name in the importing package's own manifest.
  - **Folder export:** A package export whose key ends with `/` and maps a requested subpath by appending its remaining tail.
  - **Captured compilation:** Compiled JavaScript with the files, directory lists, metadata, and resolution evidence used to check later reuse.
  - **Bundle cache:** The persistent store that restores a captured compilation in another core and sidecar process.
- **Background:** Mokly compiles catalogue JavaScript before it renders pages. Reuse must select the modules that a fresh compile selects. Shared resolution evidence records files, absent paths, links, and directory membership. Each reuse owner checks only the observations that capture recorded.
- **Problem:** A self-package folder export can omit the parent directory of an earlier candidate. Adding that candidate leaves all captured observations current. In-process reuse and a restarted strict build then keep the old module.
- **Impact if no action:** A successful strict build can emit old HTML after a preferred source file appears. The bundle cache preserves the wrong result across restarts.
- **Root question:** How can captured reuse observe every candidate that a self-package folder export can select?

## Test-ready reproduction

Create these files in one isolated fixture. Create `.context/` before the initial build.

`package.json`:

```json
{ "name": "chosen", "exports": { "./sub/": "./sub/" } }
```

`tsconfig.json`:

```json
{ "compilerOptions": { "strict": true } }
```

`mokly.config.json`:

```json
{ "roots": [{ "dir": "specs" }] }
```

`entry.mjs`:

```js
export { value } from "chosen/sub/value";
```

`sub/value/index.js`:

```js
export const value = "original-index";
```

`specs/home.mockup.ts`:

```ts
import { definePage } from "@mokly/mokly";
import { value } from "../entry.mjs";

export default definePage({
  title: "Home",
  description: "",
  relatedDocs: [],
  render: () =>
    '<!doctype html><html><head><title>Home</title></head><body><h1 data-probe="value">' +
    value +
    "</h1></body></html>",
});
```

Use a matching built core, sidecar, and viewer. Run from the fixture root.
Set `MOKLY_PACKAGE_ROOT`, `MOKLY_VIEWER_DIST`, and `MOKLY_NODE_EXECUTABLE` when using repository build artifacts.
Use one fresh `XDG_CACHE_HOME` for the initial and restarted commands.

1. Run `mokly build --config mokly.config.json --no-changes --strict --sidecars=1 --debug-timings --out .context/initial`.
2. Verify that its bundle recipe has complete and durable evidence. Its HTML contains `original-index`.
3. Add `sub/value.ts` with `export const value = "preferred-file";`. Change no existing file.
4. Restart the same command with output `.context/restarted` and the same cache.
5. Run it once more with output `.context/fresh` and a separate fresh cache.
6. Compare the HTML. The cached restart contains `original-index`. The fresh build contains `preferred-file`.

The imported file's parent `sub/` already exists before capture.
The addition therefore changes no member of the observed source root or `sub/value/` directory.
No editor file, timestamp race, package manifest edit, or configuration edit is needed.

## Owner outcomes

All outcomes below were measured on 2026-11-19 at `51c4a8d6b`.
The release core and all 2,217 package dist files matched that commit's recorded build inventory.

| Owner                     | Cached or reused result                                                          | Fresh result                                                  |
| ------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| In-process compiled reuse | Same restored compilation and runtime key, zero compiles, `original-index`       | Two compiles, `preferred-file`                                |
| Disk cache after restart  | One restore, cache `hit`, zero esbuild calls, same runtime key, `original-index` | Fresh cache, `no-record`, two esbuild calls, `preferred-file` |
| Public strict build       | Exit 0, HTML `original-index`                                                    | Exit 0, HTML `preferred-file`                                 |
| Checked Serve plan        | One compile, consumer resolves the uncovered self import, `preferred-file`       | Two compiles, `preferred-file`                                |

The checked plan and native results have equal output, module graph, recorded inputs, and errors.
The captured plan holds only the configured entry edge. It omits the self-package edge.
The consumer therefore resolves that edge again. The plan optimization does not introduce the stale result.
The compiled reuse outcomes have no compiler or evaluation error, but their values and module selections differ.

The strict initial build used core PID 591631 and sidecar PID 591639.
The restarted build used core PID 591678 and sidecar PID 591686.
The fresh-cache build used core PID 591702 and sidecar PID 591710.
The original strict capture had 767 recorded inputs, with `complete=true` and `durable=true`.
Whole-harness RSS peaked at 346,108 KiB. The unchanged 4,500,000 KiB stop did not fire.

## Missing observation and repair

The shared evidence omits `sub/`, `sub/value`, and `sub/value.ts` under the actual self-package root.
The legacy compiled directory map holds the source root and `sub/value/`. It omits `sub/` too.
The selected `sub/value/index.js` and all recorded metadata remain unchanged.

`ResolutionEvidence.capture` sends the self-package manifest directly to `targets`.
Installed-package capture also observes a raw package-subpath candidate. The self-package route has no corresponding observation.
The export walk uses exact or star substitution. That substitution does not append a tail for a folder key.
It therefore records no candidate membership at the actual mapped self-package target.

The relevant capture and compiled validation blocks match main `6ae96ed08` by source-section hashes.
These probes executed the branch, not a separate main binary. Candidate selectors were absent in the failing owner checks.
The stable missing observation predates the plan-only candidate filter and is distinct from a capture-window race.

- **Options:**
  - **A.** Mark the evidence incomplete when a request can select an unproved folder export. This prevents memory and disk reuse for that form. It preserves fresh output but loses reuse. Effort: Small.
  - **B.** Record the actual mapped folder target and its appended request tail before resolution. Use the existing bounded candidate capture for installed, self-package, and aliased-self routes. Preserve the original observations and whole comparisons. Prove the owner outcomes against fresh builds. Effort: Medium.
- **Left out:** Changing only the plan filter cannot repair compiled reuse or a stored compilation. A new resolve on every reuse adds the resolver operation that the recipe contract rejects. Disabling all compiled reuse exceeds this defect's scope. Only conservative rejection and complete mapped-target capture address the missing observation.
- **Shared assumptions:** Existing exactness, both capture bounds, and disk durability rules stay. Source: `docs/protocol/mokly-sidecar-recipes.md` and `docs/protocol/mokly-base-cache.md`. The present complete flag for this unsupported form is a code choice. A drops it.
- **Wider fix:** B puts folder-target capture in the shared export owner so all package routes receive the same evidence. It still needs the audited folder expansion rule.
- **Previous examples:** [PR #343](https://github.com/mokly-ai/mokly/pull/343) fixed another complete evidence record that omitted a mapped candidate. Its earlier `absolute-paths-target-evidence.md` item is resolved.
- **Related:** [in-process-resolution-coherence.md](./in-process-resolution-coherence.md) concerns the same reuse owners and a different cause, a capture-window change. This item concerns an observation that no check records. Each repair can merge alone.
  [duplicate-export-key-evidence.md](./duplicate-export-key-evidence.md) records a separate, unproved reader mismatch in the same export capture owner. Folder expansion does not settle duplicate-key ordering.
- **Recommendation:** B. It observes the actual candidate and preserves reuse. A is a smaller safe mitigation if that capture proof is not ready.
- **Action:** fix after merge, apply B in the performance orchestrator's separate repair. Its call of 2026-11-19 keeps this pre-existing gap outside the Serve plan branch.

Delete this item when the shared capture repair covers the recipe above and all three compiled owners return fresh output.
If that repair merges first, remove this item at the next main merge instead of retaining a resolved duplicate.

# Respect export conditions in workspace bundle recovery

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-24, from finding 6 on branch `calummoore/mokly-website-redesign-plan-v2-xnnj`.
- **Location:** `packages/mokly/src/sidecar/importer-resolution.ts`, `packages/mokly/src/sidecar/workspace-imports.ts`, and `packages/mokly/src/sidecar/package-map.ts`.
- **Reason:** The last fix round preserves Node's exact require error. Bundle recovery needs a separate condition rule and parity checks against esbuild.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Export condition:** A manifest key such as `import` or `require` that controls which requests can use a package export.
- **Background:** A workspace package can export build files that the Git base lacks. After esbuild lookup fails, Mokly checks the declared targets for matching sources. It recovers only when all non-declaration targets agree. The plugin API gives the same diagnostic for an absent file and an ineligible export.
- **Problem:** The recovery checks inactive targets. It can load a source for a bundled require of an import-only export, a browser-only export, or an active `null` branch. It can also block a valid import. For `{"types":"./src/index.ts","import":"./dist/index.js"}`, the inactive `types` target has no build-to-source mapping. The active target does map to `src/index.ts`, but the bundle reports `Could not resolve`.
- **Impact if no action:** A bundled request can load a source that the export disallows. A valid import can also fail when its build file is missing.
- **Root question:** How can bundle recovery use a missing build target that the active export conditions select?
- **Options:**
  - **B.** Confirm that an active branch selects a missing build target, then keep the all-target agreement check. Inactive targets can still block valid recovery. Effort: Large.
  - **E.** Run esbuild again without a resolve plugin and use its missing-target diagnostic. This copies no condition rules. It needs an extra build per failed lookup and depends on the text of the diagnostic. Effort: Large.
  - **F.** Walk the matched export key in order and select the first active target. Use `default`, `node`, the `import` or `require` kind, and the configured conditions. Add `module` only when the conditions setting is absent. Stop at an active `null`. Apply source recovery only to the single eligible target when its build file is missing. Record the resolution probes for reuse. Effort: Medium.
- **Left out:** Checking if any declared file is absent cannot establish that the request can use its export. A clean base can lack every target.
- **Wider fix:** E. It uses the native resolver's chosen target. F avoids the extra compile and verifies the copied rule with built fixtures.
- **Previous examples:** Commit `70a565d46` corrected a copy of esbuild's export precedence. The shared target walker captures export evidence in `package-map.ts`.
- **Related:**
  - [workspace-import-resolution-record.md](./workspace-import-resolution-record.md): work that waits. Its shared record of each workspace import needs the active export target of a failed lookup, which option F selects.
  - [vite-base-workspace-export.md](./vite-base-workspace-export.md): same code. Its recommended option D applies this recovery under the Vite adapter, where Mokly's configured conditions do not apply. So F needs its own rule for the adapter when it lands after that option.
- **Recommendation:** F. The single active target resolves both the invalid recovery and the inactive-`types` failure.
- **Action:** fix after merge, apply F. The bundle rule needs its own review and esbuild parity checks.
- **Done when:** A table compares the active target with esbuild on built fixtures. It covers kind-specific and configured conditions, `null`, and `module` with absent or supplied conditions. Recovery declines an ineligible export. A missing active `import` target recovers with the inactive `types` example above. Update `docs/protocol/mokly-comparison-packages.md`.

# Upgrade Expo to SDK 58

- **Severity:** High. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Post-merge task.
- **Added:** 2026-11-17, from branch `calummoore/combine-mokly-cloud-into-repo-704s`.
- **Location:** `packages/app/package.json`, `package-lock.json`, and `scripts/verification/dependency-audit-exceptions.json`.
- **Reason:** Cal deferred the Expo migration on 2026-11-17 and accepted reviewed private-app risks for at most 31 days.

- **Terms:**
  - **Expo SDK:** The coordinated Expo, React Native, and Expo Router versions used by the private cloud app.
  - **Private-app exception:** A reviewed advisory record for a private workspace under `apps/`, excluded from every published workspace's production dependencies.
- **Background:** The cloud app uses Expo 56.0.21 and Expo Router 56.2.20.
  Expo's dependency chains have these advisory records:
  - `decode-uri-component`: GHSA-vcc3-ghjq-m6fr and GHSA-qr28-fpjm-wq7f, through Expo Router and `query-string`.
  - `glob`: GHSA-3g3m-2fjr-6pw4, through Expo configuration, fingerprinting, Metro configuration, and CLI packages.
  - `minimatch`: GHSA-g3hv-75wg-m249, through Expo fingerprinting and the shared hoisted install.
  - `picomatch`: GitHub withdrew GHSA-fc5q-39xc-vjpf on 2026-11-18. Its ten exceptions are gone.
  - `zod`: GHSA-mrhx-c7xc-m3w5, through Expo CLI.
    Reviewed records end on 2026-12-18 UTC. Published Mokly packages cannot reach an excepted install through production, optional, or peer dependencies.
    Expo Router can decode attacker-supplied navigation URLs in the browser. A crafted URL can block the affected tab.
    The other Expo records cover build tools that use repository-authored patterns and project inputs.
- **Task:** Upgrade Expo and Expo Router to the SDK 58 line. Update their coordinated React Native and React dependencies as required.
  Keep one React instance in the cloud app and preserve the workspace Mokly package links.
  Regenerate the root npm lockfile with its pinned npm version.
  Remove each private-app exception whose advisory or install location disappears.
  Recheck the shared `minimatch` install used by `eslint-plugin-import-x`; an Expo upgrade does not prove that the plugin's risk disappeared.
  SDK 58 must remove the affected Expo chains or select fixed releases before their records can go.
  Retain and review any still-live Electron, Astro, Vite, Vitest, or shared-install records separately.
  Never extend an exception automatically.
- **Impact if no action:** The audit fails after the review window. The cloud app retains a known browser denial-of-service risk.
- **Needs:** Expo SDK 58 and its compatible Expo Router release. A fixed upstream chain is needed for each removed exception.
- **Done when:** The SDK 58 app builds and its browser and desktop viewer tests pass.
  A fresh strict `npm run dependencies:check` passes with no stale exception records.
  The complete `cargo xtask check` gate passes.

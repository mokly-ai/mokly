# npm audit reports vulnerable dependencies

- **Severity:** Medium (estimate). **Effort:** Medium (estimate). **Confidence:** High. **Harder later:** Yes.
- **Kind:** Needs decision.
- **Added:** 2026-10-30, from the outside-the-scope note of the Milestone 16 review TODO in the deleted `plans/html-emails.md`, and from the Milestone 11 record of the deleted `plans/cloud-builds.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** `ts/package-lock.json`, `ts/package.json` and the `package.json` of each npm workspace under `ts/`.
- **Reason:** The warnings are in dependencies that the recording changes did not touch, and the pull request with the compatible fixes closed unmerged on 2026-10-30.
- **Checked:** 2026-10-31, at commit `f568853e`. The choice is still open. The standard audit reports 64 alerts. Nobody has checked which of them reach shipped or server code.
- **Category:** Security.

- **Terms:**
  - **npm workspace:** One of the TypeScript packages under `ts/`, which share `ts/package-lock.json`.
- **Background:** The list below gives the current snapshot first, then the history.
  - Current snapshot, 2026-10-31: `npm --prefix ts audit --json` reported 64 alerts. They are 3 low, 41 moderate, 17 high and 3 critical.
  - The three critical alerts are `shell-quote`, `tinypool` and `vitest`. The report offers a fix without a major version change for each one. For `tinypool` and `vitest` the fix is Vitest 3.2.7.
  - A lockfile-only audit on the same day reported 117 alerts. Its mode differs from the standard audit, and nobody checked why.
  - History, 2026-10-30: a successful `npm --prefix ts ci` reported 34 vulnerabilities. They were 7 low, 6 moderate, 18 high and 3 critical.
  - History, 2026-10-04: npm reported 41 dependency alerts, one of them critical.
  - History, 2026-10-19: the review of PR #47 recorded 44 audit vulnerabilities in unchanged dependencies.
  - PR #38 applied the compatible fixes and closed unmerged on 2026-10-30. It grouped the rest under two migrations: Worker, Vitest and Miniflare, and Expo, React Native and Metro.
- **Problem:** The lockfile holds packages with known vulnerabilities. Nobody has recorded which of them reach production code and which only reach build and test tools. An audit of the lockfile does not show which advisories reach the installed desktop app.
- **Impact if no action:** A vulnerable package can reach a shipped bundle or a CI runner. Each later upgrade gets larger, because the pins fall further behind.
- **Root question:** Which vulnerable dependencies must change, and in which change?
- **Options:**
  - **A.** Run `npm --prefix ts audit`, record which findings reach shipped code, and accept the rest with a reason. Effort: Small.
  - **B.** Do A, then apply the compatible fixes in one change. Keep the exact pins and the pinned Mokly releases. Effort: Medium.
  - **C.** Do B, then plan the two migrations, Worker tooling and Expo, each in its own change. Effort: Large.
- **Left out:** `npm audit fix --force`. It moves major versions without review and can break the exact pins.
- **Wider fix:** None. Newer toolchains remove today's alerts, but no version change prevents later ones.
- **Previous examples:** The closed branch `calummoore/npm-audit-fixes` of PR #38 applied the compatible fixes and pinned Vitest 3.2.7 and Sharp 0.35.5.
- **Recommendation:** B (estimate). The source recommended C, because it assumed that a critical finding needs the two migrations. The current report offers a non-major fix for all three critical alerts. A is the first step of B, and its triage shows whether C is still needed.
- **Action:** ask the user, because condition 4 holds: the user closed the compatible-fix pull request on 2026-10-30 without a recorded reason. B may repeat a change that the user rejected, and C is Large.

Source: [the Milestone 16 review TODO](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/html-emails.md?plain=1#L474-L486) of the deleted plan.

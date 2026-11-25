# Windows desktop build has no plan

- **Severity:** Low (estimate). **Effort:** Small (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-30, from the post-merge tasks of the deleted `plans/desktop-app-shell.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** `.github/workflows/desktop-release.yml:35-39` and `:111-116`, `packages/desktop`, `docs/protocol/cloud/desktop-app.md:3-16` and `docs/protocol/cloud/desktop-distribution.md:18-22`.
- **Reason:** The desktop shell chose macOS and Linux first, and the plan for Windows closed unmerged without a recorded decision.
- **Checked:** 2026-10-31, at commit `f568853e`. The choice is still open. Both release matrices still build macOS and Linux only, as the desktop contract allows.
- **Category:** Process.

- **Terms:**
  - **Authenticode:** The Windows code signing that installers need so that Windows does not warn the user.
- **Background:** The desktop shell decided "macOS and Linux first", with Windows signing and its runner in a later plan. PR #53 proposed that plan and closed unmerged on 2026-10-26. The list below gives its proposal.
  - One NSIS installer for x64 and one for arm64.
  - The `windows-2025` runner in the release workflow.
  - Authenticode signing through Azure Artifact Signing with a federated credential.
  - The Windows path of the updater, the Windows behaviours of the shell, and portable build and packaging scripts.
  - Two open decisions: the signing provider and the application icon. `docs/protocol/cloud/desktop-distribution.md:18-22` now chooses the icon artwork, so only its Windows format remains, which is an implementation detail.
  - The closure of PR #53 does not show that the user rejected Windows.
- **Problem:** Windows users cannot install the shell, and no plan says whether or when they can.
- **Impact if no action:** The desktop app reaches only macOS and Linux users.
- **Root question:** Does Mokly ship a Windows desktop build, and when?
- **Options:**
  - **A.** Keep macOS and Linux only for now, and delete this item. Effort: Small.
  - **B.** Write the Windows plan from the proposal above, with its signing decision, after local mode exists. Writing the plan changes no code. The later implementation and its signing dependency may be Large. Effort: Small (estimate).
  - **C.** Write the Windows plan now. Effort: Small (estimate), with the same later implementation.
- **Left out:** None. The options cover now, later and never.
- **Wider fix:** None.
- **Previous examples:** None found.
- **Recommendation:** B. Local mode is the reason for the shell, so a Windows build adds little before it.
- **Action:** ask the user, because condition 4 holds: the timing trades reach against signing cost, and the user closed the earlier plan without a reason.

Source: [the decisions](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/desktop-app-shell.md?plain=1#L153-L154) and [the post-merge tasks](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/desktop-app-shell.md?plain=1#L796-L825) of the deleted plan.

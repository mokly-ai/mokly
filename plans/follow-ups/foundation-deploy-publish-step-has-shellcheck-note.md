# Deploy publish step uses four separate redirects

- **Severity:** Low (estimate). **Effort:** Small (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-30, from the outside-the-scope list of the first two reviews of [PR #54](https://github.com/mokly-ai/mokly-cloud/pull/54), kept in the deleted `plans/foundation-terraform-from-ci.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** `.github/workflows/deploy.yml:148-156`.
- **Reason:** The review found the note outside the scope of PR #54, and no stage of the gate runs shellcheck, so no check fails on it.
- **Checked:** 2026-10-31, at commit `f568853e`. The choice is still open. The step still writes `$GITHUB_OUTPUT` with four separate redirects. Nobody ran actionlint on the current workflow.
- **Category:** Code structure (estimate).

- **Terms:**
  - **actionlint:** A linter for GitHub Actions workflow files, which passes each `run:` script to shellcheck when shellcheck is installed.
  - **SC2129:** The shellcheck style note that asks for one grouped redirect, such as `{ cmd1; cmd2; } >> file`, instead of individual redirects.
- **Background:**
  - The `publish` job of `.github/workflows/deploy.yml` has the step "Push immutable digest" at lines 148-156.
  - That step writes four image references to `$GITHUB_OUTPUT` with four separate `>> "$GITHUB_OUTPUT"` redirects, at lines 153-156.
  - During PR #54, actionlint 1.7.7 with shellcheck 0.10.0 passed the Foundation and Deploy workflows. It reported only this SC2129 style note.
  - The gate, `cargo xtask check`, does not run actionlint or shellcheck.
- **Problem:** The step opens `$GITHUB_OUTPUT` four times where one grouped redirect does the same work. actionlint reported SC2129 for it during PR #54. A current linter run would show whether this is still the only note.
- **Impact if no action:** The note stays in every actionlint report of the Deploy workflow, so a reader must separate it from new notes. The step itself works.
- **Root question:** How do the Deploy workflow scripts stay free of shellcheck notes?
- **Options:**
  - **A.** Group the four `echo` commands into one `{ ...; } >> "$GITHUB_OUTPUT"` block. Effort: Small (estimate).
  - **B.** Change nothing. The note is about style, and no check runs shellcheck. Effort: Small (estimate).
  - **C.** Add actionlint with shellcheck to the gate as a new stage, so that a new note fails the check. It adds a gate and a pinned tool. Effort: Large (estimate).
- **Left out:** None.
- **Wider fix:** C. It is a detection fix for every shellcheck note in the workflows.
- **Previous examples:** None found.
- **Recommendation:** A. It removes the only note that actionlint reported during PR #54, at almost no cost. The user has not chosen it. C best protects the class, but it adds a gate, which waits for the user.
- **Action:** ask the user, because condition 6 holds: the review-fix rule leaves a code-structure item to the user.

The reviews gave no severity, effort, options, recommendation or action. Those judgments and all options were added on 2026-10-30, and they are estimates. Nobody ran actionlint for this item. The four redirects are still at lines 153-156 on 2026-10-30.

Source: [the outside-the-scope list](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/foundation-terraform-from-ci.md?plain=1#L467-L468) of the deleted plan.

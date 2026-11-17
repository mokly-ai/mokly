# GitHub identity 403 has no typed reason

- **Severity:** Medium (estimate). **Effort:** Large (estimate). **Confidence:** High. **Harder later:** Yes.
- **Kind:** Needs decision.
- **Added:** 2026-10-30, from Milestones F6, F6A and F6B of the deleted `plans/mokly-cloud-follow-ups.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** `crates/mkc-api/src/github/mapping.rs:7-21`, `crates/mkc-github/src/identity.rs:73-89`, `apps/app/src/screens/account/github-callback-screen.tsx:80-107`, `docs/protocol/cloud/auth-callbacks.md:181-188` and `docs/protocol/cloud/rest-api.md`.
- **Reason:** The fix adds an API reason, a recovery row and its drawing, which is Large, and no user decision picks the design.
- **Checked:** 2026-10-31, at commit `f568853e`. The decision is still open. Every provider `Forbidden` still maps to `PermissionDenied`, and no `github-permission-missing` reason exists. The audit did not check the App permissions of a live deployment.
- **Category:** UX wording.

- **Terms:**
  - **Error reason:** The stable kebab-case `reason` of the error envelope, recorded in the reason table of `docs/protocol/cloud/rest-api.md`.
- **Background:** The list below gives the facts.
  - On 2026-09-20 the production App lacked the Email addresses read permission. `GET /user/emails` answered 403.
  - The API mapped it to the bare `permission-denied`, "Ask an administrator for access". The landing then showed "GitHub sign-in failed".
  - `docs/ops/deploy.md:682-688` records it. That incident is history, not proof that the App lacks the permission today.
  - Every provider `Forbidden` still maps to `PermissionDenied` in `mapping.rs`. No `github-permission-missing` reason exists.
  - A 403 can also have other causes than a missing App permission.
- **Problem:** When the App lacks a permission, the reader sees a message about their own access, not about the App's configuration.
- **Impact if no action:** A missing App permission looks like a user error, so an operator searches in the wrong place.
- **Root question:** What does the reader see when GitHub refuses the identity read because the App lacks a permission?
- **Options:**
  - **A.** Map a provider 403 on identity reads to the recovery of `github-email-unverified`, with copy that names the App permission. It reuses an email-verification reason for a different cause. Effort: Medium.
  - **B.** Add the reason `github-permission-missing`, then give it a recovery and a drawing. It keeps a separate typed meaning. It must first define how the API tells a missing App permission from other 403 causes. Effort: Large.
    - Record it in the reason table of `docs/protocol/cloud/rest-api.md` and the OpenAPI document.
    - Add its recovery row to the GitHub callback table in `docs/protocol/cloud/auth-callbacks.md:174-184`.
    - Draw its state first, then add it to the callback screen.
    - Cover it with a recorded 403 fixture.
- **Left out:** Keep `permission-denied`. Its copy blames the reader.
- **Wider fix:** B. A typed reason lets every caller choose the right recovery.
- **Previous examples:** The 403 of 2026-09-20 on `GET /user/emails`.
- **Recommendation:** B. The reason table is where every refusal gets its own recovery. The new reason, its callback row and its drawing are not approved.
- **Action:** ask the user, because condition 3 holds: B is Large and adds a reason at the API boundary.

Source: [Milestone F6](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/mokly-cloud-follow-ups.md?plain=1#L920-L1009) of the deleted plan.

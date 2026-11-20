# Validation refusals do not name their field

- **Severity:** Medium (estimate). **Likelihood:** Common. **Effort:** Large (estimate). **Confidence:** High. **Harder later:** Yes.
- **Kind:** Needs decision.
- **Added:** 2026-10-30, from Milestones 12L and 12M of the deleted `plans/mokly-cloud-follow-ups.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** `crates/mkc-api/src/error.rs:29-36`, `crates/mkc-api/src/error_mapping.rs:51-55`, `crates/mkc-api/src/error_data.rs:38-52`, `apps/app/src/api/form-error.ts:114-125`, `apps/app/src/screens/account/cli-form-screen.tsx:118-125`, `apps/app/src/screens/account/choose-repository-screen.tsx:154-161` and `docs/protocol/cloud/rest-api.md:62`.
- **Reason:** The fix changes the API and the app together, which is Large, and no recorded user decision approves it.
- **Checked:** 2026-10-31, at commit `f568853e`. The decision is still open. `ValidationFailed` still carries no data, and both account forms still report it above the controls.
- **Category:** Product bug.

- **Terms:**
  - **Error data:** The optional `data` of the error envelope. PR #64 typed it in the generated contract on 2026-10-27.
- **Background:** The API answers a bad field with the reason `validation-failed`, which carries no data. Only `SlugConflict` names its field today, through `SlugField` in `error_data.rs`. The forms map reasons to fields themselves in `form-error.ts`. The CLI form and the repository step report `validation-failed` above the control, because the reason does not say which field was refused.
- **Problem:** A refusal of one field cannot mark that field. The reader must guess which input to fix.
- **Impact if no action:** Refusals stay above the control instead of on the field, and each form keeps its own mapping. Each new form adds another mapping.
- **Root question:** How does a form learn which field a validation refusal names?
- **Options:**
  - **A.** Keep the form maps, and report every `validation-failed` above the control. Effort: Small.
  - **B.** Name the field in the error data, then read it in the forms. Its field names and its domain error design are a proposal that no decision approves yet. Effort: Large.
    - Add `data.field` to `validation-failed`, spelled as the body spells it: `configPath`, `repository`, `name` or `email`. Omit it when no single field owns the refusal.
    - Record it beside the `duplicate-project` and `version-conflict` data in `docs/protocol/cloud/rest-api.md` and in the Rust error-data schema.
    - Produce the reason and the field together in `mkc-domain`, with no string lookup in `mkc-api`.
    - Populate it for every project, workspace and account `validation-failed`. Add unit tests per field and an API smoke for a refused `configPath`.
    - In the forms, prefer the named field over the form's map. Keep the map for reasons with no field. Report a field that the form does not render above the control.
    - Regenerate with `cargo xtask openapi`, and update the crate READMEs.
- **Left out:** Parse the message text for a field name. Messages are copy, not contract.
- **Wider fix:** B. The contract then names the field for every form.
- **Previous examples:** `SlugConflict` already carries `SlugField`.
- **Recommendation:** B. A refusal then lands on the field that caused it.
- **Action:** ask the user, because condition 3 holds: B is Large, because it crosses the backend and frontend boundary.

The source named a "naming stage" and a "listed stage" of Choose a repository. PRs #69 and #77 replaced them. Today a refused `configPath` should mark Config path on both forms, and a refused `repository` should mark Repository on the CLI form. Do the backend part before the forms.

Source: [Milestone 12L](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/mokly-cloud-follow-ups.md?plain=1#L535-L568) and [Milestone 12M](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/mokly-cloud-follow-ups.md?plain=1#L569-L606) of the deleted plan.

# Preview password rollout after the merge

- **Severity:** Medium. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Post-merge task.
- **Added:** 2026-11-26, from the post-merge tasks of the plan of the branch `calummoore/preview-password-sign-in-jofl`.
- **Location:** `infra/terraform/foundation/preview.tf`, `infra/scripts/preview-lifecycle.py`, `docs/ops/preview.md`.
- **Reason:** The preview release job runs the scripts of `main`, so previews use the password deploy only after the merge, and the Secret Manager ID exists only after the Foundation workflow applies it from `main`.

- **Terms:**
  - **Preview password:** one shared password that signs in the shared account `preview@mokly.ai` in every PR preview, typed in the Password field of the preview app's Sign in.
  - **Verifier:** a scrypt string made from the password, `$scrypt$ln=14,r=8,p=5$...`. It checks a typed password and signs nobody in by itself.
  - **Release job:** the trusted `release` job of `.github/workflows/preview.yml`. It deploys each labelled PR with the scripts of `main`.
- **Background:**
  - Foundation Terraform declares the Secret Manager ID `mkc-preview-sign-in-password` in project `mokly-508518`, readable by the deploy identity only.
  - On each preview deploy, the release job reads the latest version of that ID and copies a valid verifier into the namespace Secret `preview-sign-in`. When the ID has no version, the deploy writes a warning annotation, clears the verifier, and the preview accepts no password; reviewers then sign in with an email link through `infra/scripts/preview-link.py`.
  - A branch made before the merge still deploys a random 64-hex value from its older scripts; the new API entrypoint ignores that value with a warning, so the API starts without a password until the branch merges `main`.
- **Task:**
  1. Wait for the Foundation workflow to apply the new ID from `main`.
  2. Create the password with `python3 -c 'import secrets; print(secrets.token_urlsafe(24))'` and keep it in the team's password manager.
  3. Make its verifier with `python3 infra/scripts/preview-lifecycle.py preview-verifier` (password on standard input), and add the verifier as the first version of `mkc-preview-sign-in-password`, as `docs/ops/preview.md`, section "Preview Password", gives.
  4. Add the `preview` label to one PR that contains the change. On its Sign in, check that the Password section shows **Continue as preview@mokly.ai**, that the password signs in, and that a wrong password shows "This password isn’t valid.".
  5. Rotate once: make a new password and verifier, add the verifier as a new version, rerun the PR's Preview workflow, and check that only the new password signs in.
- **Impact if no action:** Every preview deploy warns that the store has no verifier, and previews accept no password, so reviewers still need `kubectl` log access to sign in.
- **Needs:** The merged change, operator access to Secret Manager in `mokly-508518`, and a labelled PR.
- **Done when:** A labelled PR signs in with the stored password, refuses a wrong one, and accepts only the new password after one rotation.

# Certificate rotation would stop shipped macOS apps

- **Severity:** High. **Effort:** Small (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-30, from release finding 11, which the open PR #58 (`calummoore/desktop-release-alpha1-plan`) recorded on 2026-10-26 in the deleted `plans/desktop-app-shell.md`.
- **Location:** `docs/ops/secrets.md:226-227`, the `CSC_LINK` and `CSC_KEY_PASSWORD` rows of the desktop release secrets table.
- **Reason:** The fix changes the rotation step on `main`, and the source waits for the user's approval.
- **Checked:** 2026-10-31, at commit `f568853e`. The choice is still open. The `CSC_LINK` rotation still ends with "then revoke the old certificate", and Apple's current guidance confirms the effect.
- **Category:** Docs or spec.

- **Terms:**
  - **Developer ID Application certificate:** Apple's certificate that signs the desktop app's macOS packages, so that macOS lets users install and open them.
  - **`CSC_LINK`:** The GitHub Actions secret that holds the base64 `.p12` export of that certificate for the release workflow.
  - **Revocation:** Apple's withdrawal of a certificate before its expiry date.
- **Background:** The list below gives the facts.
  - The release workflow signs and notarizes the macOS packages of every desktop release with the certificate in `CSC_LINK`. See `docs/protocol/cloud/desktop-distribution.md:8-14` and the macOS signing step of the `release` job in `.github/workflows/desktop-release.yml`.
  - The source recorded that the certificate was created on 2026-10-26 under the individual Apple Developer Program membership `UV85J3PKBX`. It expires on 2027-11-25.
  - The source recorded that releases `0.1.0-alpha.1` and `0.1.0-alpha.2` were signed with it on 2026-10-26, in release runs 40316994987 and 40397608619.
  - Both pre-releases exist. Their public release list does not show which certificate signed each asset.
  - The `CSC_LINK` rotation says: "Export the renewed certificate before expiry, replace the secret, check the next desktop release, then revoke the old certificate". `CSC_KEY_PASSWORD` rotates with it.
  - [Apple's Developer ID guidance](https://developer.apple.com/help/account/certificates/create-developer-id-certificates) confirms that revocation blocks installation and launch of apps signed with that certificate.
  - Apple also confirms that an app signed while its certificate was valid can run after the certificate expires. Updates and new apps need a new valid signing certificate. Read on 2026-10-30 and again on 2026-10-31.
  - The source records only its recommended option A. Option B is new in this item, written from the runbook and Apple's page.
- **Problem:** The last rotation step revokes the certificate that signed every shipped macOS package. Apple then stops those apps from installing and from launching.
- **Impact if no action:** An operator who follows the runbook at the next rotation, before 2027-11-25, stops every installed Mokly macOS app. The apps cannot launch, so their updater cannot deliver a fix.
- **Root question:** How does a certificate rotation keep every shipped macOS app installable and running?
- **Options:**
  - **A.** Change the last step of the `CSC_LINK` rotation to "let the old certificate expire". It changes the rotation step in `docs/ops/secrets.md:226`. Effort: Small.
  - **B.** Do A. Also add a separate step for a compromised key: revoke the old certificate only then, and warn that revocation stops every app it signed. Effort: Small.
- **Left out:** Keep the revoke step. It stops every shipped app at each rotation, which fails the goal.
- **Wider fix:** None found. The other rows of the table revoke keys and tokens, not a certificate that signs shipped packages.
- **Previous examples:** None found.
- **Recommendation:** A. Apple's page confirms that apps signed with a valid certificate keep running after it expires, and that revocation stops them. B also covers a compromised key. The user has chosen neither.
- **Action:** ask the user, because condition 1 holds: A changes the rotation step in force at `docs/ops/secrets.md:226`, and the source waits for the user's approval.

Source: [release finding 11](https://github.com/mokly-ai/mokly-cloud/blob/a8997fb22dab7ce22409b966008cd7f9eb075043/plans/desktop-app-shell.md?plain=1#L738-L743) on the branch of PR #58.

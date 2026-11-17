# Public links require a sign-in

- **Severity:** Low. **Likelihood:** Common. **Effort:** Large. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-02, from the Milestone 3 smoke test of the Mokly 0.18.0 upgrade on the branch `calummoore/mokly-cli-upgrade`.
- **Location:** `ts/app/src/screens/app/project-route.tsx:123`, `ts/app/src/viewer/panels/share-link.tsx:15`, and the "Sharing" section of `docs/protocol/viewer-address-state.md`.
- **Reason:** On 2026-11-03 the user chose D, to let readers who are not signed in use the viewer in the app, and asked for the fix after the merge of the Mokly 0.18.0 upgrade.
- **Category:** Docs or spec.

- **Background:**
  - The API lets anyone read a public project.
  - The app needs a session on every project route.
  - For a public project, Share says "Anyone with the link can view."
- **Problem:** A reader who is not signed in goes to `/sign-in` from a public link.
- **Impact if no action:** A reader without an account must sign up to open a public link, against the Share text.
- **Root question:** Can a reader without an account open a shared public publication?
- **Options:**
  - **A.** Change nothing. Effort: Small.
  - **B.** Change the Share text to say that readers sign in to view. Effort: Small.
  - **C.** Send these readers to the publication's catalogue origin, which serves public files without a session. They lose the cloud controls. Effort: Medium.
  - **D.** Let readers who are not signed in use the viewer in the app. Effort: Large.
- **Left out:** None.
- **Wider fix:** None. This is one product rule, not a class of defect.
- **Previous examples:** None found.
- **Recommendation:** B. It is the smallest change that makes the text match the behaviour. D best fits the public reads that the API allows.
- **Decision:** On 2026-11-03 the user chose D.
- **Action:** fix after merge, apply D, because the user chose it on 2026-11-03 and asked for a follow-up item.

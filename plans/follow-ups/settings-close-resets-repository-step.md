# Closing settings resets the repository step's answers

- **Severity:** Medium (estimate). **Effort:** Medium (estimate). **Confidence:** Medium. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from [PR #77](https://github.com/mokly-ai/mokly-cloud/pull/77), found while fixing review finding 7.
- **Location:** `apps/app/src/settings/dialog-host.tsx:104-130`, `apps/app/src/navigation/address.ts:278-282`, `apps/app/src/screens/account/choose-repository-screen.tsx:61-78` and `apps/app/src/data/use-resource.ts:45-51` and `:105-147`.
- **Reason:** The fix changes how the settings dialog closes or where the repository step keeps its answers, which is outside review finding 7.
- **Checked:** 2026-10-31, at commit `f568853e`. Not verified. The dialog still closes through `history.back()`, and the step still keeps its answers in component state. No browser walk ran at this commit.
- **Category:** Product bug.

- **Terms:**
  - **Repository step:** The setup page `/:workspace/-/new`, where an owner chooses the repository, config path and slug of a new project.
  - **Manage repository access:** The link under the repository select, which opens the GitHub accounts pane over the step for a workspace with several GitHub accounts.
  - **`undoAddress`:** The address helper in `apps/app/src/navigation/address.ts:278-282` that closes the dialog with `history.back()`, so one press of Back leaves the page.
- **Background:** Opening the dialog from the step pushes `?settings=github` as a history entry of its own. Closing undoes that entry with `history.back()`. `docs/protocol/cloud/settings-dialog.md` says that closing returns to the page beneath unchanged. The step keeps its answers in component state.
- **Problem:** A browser walk on commit `2ff6da6a` showed the defect. A reader chose a repository, typed `custom/mokly.config.ts` and a slug, opened the pane with Manage repository access and pressed Escape. The step came back with no repository, `mokly.config.ts` and an empty slug. The suspected cause is that the router rebuilds the page on the `popstate` that `history.back()` raises. PR #77 later made `useResource` keep same-key data during a refresh. That fix covers a different remount cause, so it neither proves nor disproves this reset.
- **Impact if no action:** Each visit to the pane from the step loses the reader's answers. The link is there for readers who are part way through the form.
- **Root question:** How does the page beneath the settings dialog keep the reader's work when the dialog closes?
- **Options:**
  - **A.** Keep the step's answers in the settings draft store of `apps/app/src/settings/dirty.tsx`, keyed by workspace, so a rebuilt step reads them back. It fixes this step only. Other pages beneath the dialog can still be rebuilt. Effort: Medium.
  - **B.** Keep the router from rebuilding the page when a traversal changes only the dialog's query keys. It fixes every page beneath the dialog. It changes the seam between the router and the address module, which `address.ts` documents. Effort: Medium.
  - **C.** Close the dialog by replacing the address instead of going back. No `popstate` fires, so nothing is rebuilt. Back then returns to the dialog's own entry. It changes the history contract of `docs/protocol/cloud/web-product-shell.md`, so it needs the user's approval. Effort: Small.
- **Left out:** None. The three options are the distinct places a fix can live: the page, the router seam and the close.
- **Wider fix:** B, because it keeps every page beneath the dialog mounted.
- **Previous examples:** Review finding 7 of PR #77 broke the same rule through a different cause: a settings write that refreshed the workspace remounted the step.
- **Recommendation:** B. It restores "closing returns to it unchanged" for every page, not only for this step. A is the safer change if the router seam turns out to resist B.
- **Action:** ask the user, because decision condition 4 applies. A is narrow but certain, B is wider but changes the router seam, and C changes the Back behaviour.

History: a browser walk reproduced it on `2ff6da6a` and again with the finding 7 fix.
No account was removed in either walk.
Before the choice, repeat the walk at the current commit. Record the repository,
the config path and the edited slug before and after the pane closes.

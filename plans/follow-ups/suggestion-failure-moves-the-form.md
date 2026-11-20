# A failed address suggestion moves the form

- **Severity:** Low. **Likelihood:** Rare. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-04, from the options check of `plans/loading-states-match-content.md`, on the branch `calummoore/skeleton-sizing-mismatch`.
- **Location:** `apps/app/src/screens/account/create-workspace-screen.tsx:110-126`, `apps/app/src/screens/account/project-address.tsx:58-74`, `docs/mockups/src/screens/product/account/create-workspace-screen.tsx:102-109` and `docs/mockups/src/screens/product/account/choose-repository-screen.tsx:104-111`.
- **Reason:** The change that found it fixes loading states only, and this is the error state of a read, which its requirement draws as a state card.
- **Category:** Product bug.

- **Terms:**
  - **Address suggestion:** The read that proposes a free slug from the workspace name, or from the repository and the config path. The create-workspace form, the repository step and the CLI form show the slug field with the address line under it.
  - **State card:** The shared composition `StateMessage` in `apps/app/src/components/page-parts.tsx`: a glyph tile, a title, an optional line, one action and an optional **Details** disclosure.
- **Background:** When the address suggestion fails, each form inserts a state card under the address line. The card says "Address couldn’t load" and offers one **Try again**, with the request reference in **Details**. `docs/protocol/cloud/product-accounts-and-roles.md` and `docs/protocol/cloud/product-mockups.md` require that text and the one **Try again**. The Workspace pane's GitHub accounts fact shows its own failed read in its own line instead: "Couldn’t load" with a quiet **Try again**.
- **Problem:** The state card is many lines tall. It pushes the form's primary button down when the read fails. The button moves up again when a retry succeeds.
- **Impact if no action:** A failed suggestion moves the form. Only a failed suggestion read causes it.
- **Root question:** How does the form show a failed address suggestion without moving?
- **Options:**
  - **A.** Keep the state card. Effort: Small.
  - **B.** Show "Address couldn’t load" and a quiet **Try again** in the address line, in place of the address, as the GitHub accounts fact does. The reference keeps its **Details** disclosure under the line, so the form grows by that one line only. Change the two mockup drawings first, then the app and the two protocol docs. Effort: Small.
  - **C.** Show the failure as the slug field's own error text, with **Try again** beside the field. A field error then means two things: a refused slug and a failed read. Effort: Small.
- **Left out:** Hide the failure. It breaks the requirement that the form says the address couldn’t load.
- **Wider fix:** None. The rule that a wait draws its loaded layout covers waits only, and each error state is its own layout.
- **Previous examples:** `apps/app/src/settings/panes/workspace-github.tsx:56-68`, the GitHub accounts fact's failed read.
- **Recommendation:** B. It keeps the address line's place and reuses the failure form that the GitHub accounts fact already has.
- **Action:** ask the user, because B changes the drawing and the protocol text of the suggestion failure, and no recorded decision covers that change.

# A component's own render shows no slot content

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-17, from the gap list `plans/follow-ups/mokly-upstream-gaps-to-file.md`, which the Mokly 0.18.0 upgrade of the cloud wrote on 2026-11-02 on the branch `calummoore/mokly-cli-upgrade`. The move of Mokly Cloud into this repository split that list into items.
- **Location:** `docs/protocol/mokly-components.md:84-104` and `:184-193`.
- **Reason:** A fix changes the component authoring contract, which the user decides.

- **Source:** Design.
- **Category:** Docs or spec.
- **Background:**
  - A component declares its slots, such as `children`, by name. A variant can map declared slot names to React nodes in its `slots`, and that content shows on its page, as `docs/protocol/mokly-components.md:84-104` states.
  - The component's own page renders its own props first and then each variant, as `docs/protocol/mokly-components.md:184-188` states. A parent has an empty `suppliedSlots`, as `:190-193` states. So the first render of the page shows no slot content.
  - For a component that draws its content in slots, that first render is an empty frame. The Mokly 0.18.0 upgrade of the cloud found it in the cloud mockups.
- **Problem:** A component whose content lives in slots shows an empty first frame on its own page.
- **Impact if no action:** The page of such a component starts with an empty frame, and readers see its content only in the variants.
- **Root question:** How does a component's own page show the content that the component draws in slots?
- **Options:**
  - **A.** Keep the contract. Authors give such a component a variant with slot content. Effort: Small.
  - **B.** Let a component declare slot content for its own render, in the form of a variant's `slots`. It changes the authoring contract, the `suppliedSlots` of a parent in the read model, and the Changes of each component that uses it. Effort: Large.
  - **C.** Leave out the render of the component's own props when it declares slots and supplies none, and show only the variants. The page then hides the parent's own props. Effort: Medium.
- **Left out:** None.
- **Wider fix:** B. Every component page could then show content.
- **Previous examples:** None found.
- **Recommendation:** A. The variant form already shows slot content, and B costs much for one empty frame.
- **Action:** ask the user, because B and C change the component authoring contract of `docs/protocol/mokly-components.md`.

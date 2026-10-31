# Name the slot owner consistently

- **Severity:** Low. **Effort:** Small (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan: user item 161, W2 decision 2.
- **Location:** `packages/viewer/src/shell/workspace_props.tsx:166`, which
  writes the slot line that `@mokly/ui`'s `PropsPanel` shows.
- **Reason:** A user rule of 2026-10-21 deferred each new review item of
  PR #199 until after its merge, for the user's later choice.

- **Source:** Review.
- **Category:** UX wording (estimate).
- **Terms:**
  - **Slot line:** the line in the Props panel that names a supplied slot
    and the entry or component that supplied its content.
- **Background:** When the user selects a component instance, the Props
  panel lists its supplied slots. `workspace_props.tsx` writes
  `{slot} · Supplied by this page` when the selected entry supplied the
  content, and `{slot} · Supplied by a parent component` otherwise. The
  design mockups named the owner by its title, as in "Supplied by
  Welcome." and "Supplied by Main toolbar.", in
  [`instance_details.tsx`](https://github.com/mokly-ai/mokly/blob/7edabc306d6983c43824e1425782215e44e0d7f0/examples/basic/specs/design/components/parts/instance_details.tsx?plain=1#L78-L85),
  until the shell views plan made them render the shipped `PropsPanel` on
  2026-10-31. No mockup shows a slot line now, because no depicted instance
  supplies a slot.
- **Problem:** The product says "this page" for every entry kind, also for
  a screen, and "a parent component" without naming it.
- **Impact if no action:** A user can misread which entry supplied the
  slot.
- **Root question:** How should the slot line name the entry that supplied
  the content?
- **Options:**
  - **A.** Keep "this page". Effort: Small (estimate).
  - **B.** Name the owner by its title, as the design mockups did. Effort:
    Small (estimate).
  - **C.** Design one shared entry noun first, then use it in every owner
    message. Effort: Large (estimate).
- **Left out:** Using an internal entry kind name leaks implementation
  words into the product.
- **Wider fix:** C. One shared entry noun prevents copy drift across
  screens and components.
- **Previous examples:** The shell already keeps shared copy for each entry
  kind in `packages/viewer/src/shell/entry_wording.ts`.
- **Related:**
  [workspace-evidence-screen-copy.md](./workspace-evidence-screen-copy.md)
  has the same class: "Page" in shell copy that also shows on screens. One
  noun source per entry kind would serve both.
- **Recommendation:** B. It gives the user the specific owner, as the
  earlier design did. C best protects the wording class.
- **Action:** ask the user, because condition 5 holds: the user reserved
  the choice for each open review item of the rebuild.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6189).

# Write failure rule matches shapes, not imports

- **Severity:** Low (estimate). **Effort:** Medium (estimate). **Confidence:** High. **Harder later:** Yes.
- **Kind:** Needs decision.
- **Added:** 2026-10-30, from Milestone F1 of the deleted `plans/mokly-cloud-follow-ups.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** `rules/typescript/write-failure-through-the-fragment.yml:20-43` and `:47-127`, `rules/_tests_/write-failure-through-the-fragment-test.yml:24-43` and `apps/app/src/components/write-failure.tsx:23-38`.
- **Reason:** The fix replaces a lint rule with a stricter import rule, and that change needs the user's approval.
- **Checked:** 2026-10-31, at commit `f568853e`. The choice is still open. The rule still matches literal JSX shapes, and its fixtures still omit the spread and computed `className` forms. No current bypass is known.
- **Category:** Repository rule.

- **Terms:**
  - **`write-failure` fragment:** The component in `apps/app/src/components/write-failure.tsx` that reports a refused write beside its control.
- **Background:** The ast-grep rule `write-failure-through-the-fragment` makes every refused write go through the fragment. It matches the shapes of the code. Three reviews each spent a round on a way to defeat it by moving one attribute. The review of an earlier milestone, 12G round 2, closed the mirror, the `aria-live` variant and the empty link. It left the spread and the computed `className` shapes open. Those review rounds are history. No current bypass is known.
- **Problem:** A shape rule needs a new `invalid:` case for each new way around it.
- **Impact if no action:** A refusal can bypass the fragment with a shape the rule does not know, and each review keeps finding new shapes.
- **Root question:** How does the lint prove that a refused write uses the fragment?
- **Options:**
  - **A.** Keep the shape rule, and add the spread and computed `className` cases. Effort: Small.
  - **B.** Make the cause line a `WriteCause` component that only `write-failure.tsx` may import. Enforce the import with a rule, as `no-inline-use` does for Rust. An import rule alone does not stop hand-written markup that copies the cause line without the import. So B keeps a shape check for hand-written cause markup. Effort: Medium.
- **Left out:** Review by eye only. Three reviews show the cost.
- **Wider fix:** B. A rule about the importing module cannot be defeated by attributes. Hand-written cause markup still needs the shape check.
- **Previous examples:** The three review rounds that found new shapes.
- **Recommendation:** B. It takes the attribute shapes out of the rule's job, although hand-written cause markup still needs the shape check.
- **Action:** ask the user, because condition 3 holds: B adds a stricter lint rule.

Source: [Milestone F1](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/mokly-cloud-follow-ups.md?plain=1#L1117-L1204) of the deleted plan.

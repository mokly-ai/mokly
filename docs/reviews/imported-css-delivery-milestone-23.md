# Imported CSS Delivery Milestone 23 Review

## Scope And Outcome

This review covers [Imported CSS Delivery](../../plans/imported-css-delivery.md)
Milestone 23. It ran on 2026-09-28 after `02a487d` was pushed, using
[the implementation review prompt](../implementation-review-prompt.md) against
`origin/main`. One read-only reviewer examined the changes since `e75fea4`:
`8a47cc5` (Milestone 22) and the `02a487d` bookkeeping. Milestone 22 put a
user decision on Milestone 21 finding 3 into effect: Mokly must not fail Build
for a selector list inside `:global()` or `:local()`, and must deliver what
the CSS Modules plugins used by css-loader and Vite produce. Findings that
remain open in earlier records are not repeated.

The change works for lists with whitespace after each comma:

- All 2,352 whitespace-separated list cases in a scratch matrix build, and
  their output matches the plugins byte for byte. The matrix covered 21
  positions and contexts, `:global` and `:local`, and 8 item shapes.
- The check still rejects reordered, missing, duplicated or extra items, other
  combinators, and a list that is kept or expanded.
- Build output and class maps equal the plugin output. Both alternatives in
  the Styles guide build.
- Of 12 mutations of the change, 10 fail tests. The 2 that survive cannot
  change the result.

The two findings below were reproduced in scratch copies, and the parent
session confirmed both. They were resolved in `7ba5628` by the user's chosen
options; other open findings were not changed.

## Findings

1. **Medium — lists without a space after a comma, or with an empty item,
   still fail Build, and the docs describe the wrong joining rule.**
   - What happens: Milestone 22 taught the check to put one descendant
     combinator between list items. The plugins instead join the items and
     keep only the whitespace that already touched each comma. They also drop
     empty items.
     - `.wrap :global(.x, .y)` becomes `.wrap .x .y`, and Mokly accepts it.
     - `.wrap :global(.x,.y)` becomes `.wrap .x.y`, one compound selector that
       matches one element with both classes. Mokly fails Build.
       `:local(.a,.b)` behaves the same way.
     - `:global(.x, .y,)`, `:global(.x, , .y)` and `:global(, .x)` build in the
       plugins because the empty items disappear. Mokly fails Build for all
       of them.
   - The same plugin version runs in css-loader 7.1.5 and in Vite's
     `postcss-modules` 9.0.1, and neither errors.
   - In the scratch matrix, all 1,008 cases with no whitespace at the comma
     and all 50 cases with empty items fail.
   - Realistic triggers: compactly written CSS, and module CSS that esbuild
     has minified. esbuild's minifier writes `:global(.x,.y)`.
   - The protocol, the Styles guide, the plan Status, the Milestone 21 record
     and the PR draft all say that every list becomes a descendant chain
     joined by one space. The protocol also does not say that a compound
     after the wrapper attaches to the last item.
   - The tests missed this because every new test uses `, ` separators.
   - Impact: the user's decision holds only for lists with a space after each
     comma. Other lists fail with advice that throws scoping away, and the
     docs promise a descendant chain where css-loader and Vite deliver a
     compound selector.
   - Options:
     - A) Make the check follow the plugins' join: add a descendant combinator
       only where whitespace touches the comma, otherwise continue the
       compound, and skip empty items. Keep rejecting joins that fuse two
       names into a new one; for example, `div,span` becomes `divspan`.
       Rewrite the docs with the exact rule and the `.x,.y` example.
     - B) Insert a space after each comma inside `:global()` and `:local()`
       before the plugins run. Every list then becomes a descendant chain,
       but the output differs from css-loader and Vite, and Mokly rewrites
       authored text.
     - C) Keep failing and document that list items need spaces. This
       contradicts the user's decision.
   - Recommended: A, plus a generated test that runs the real plugins across
     positions, separators (none, space, newline, tab, comments), modes,
     contexts and empty items. The test must check that Build accepts every
     output that fuses no names and returns exactly the plugin output. It
     covers the whole class of join differences, including a future plugin
     release that changes the join. Because the decision assumed a descendant
     chain, the user should confirm that a compound result for `.x,.y` is
     acceptable.

   Resolved in `7ba5628`: the verifier follows comma-boundary whitespace,
   compound continuation and empty-item removal. It still rejects newly
   fused names and invalid compounds. An independent plugin matrix covers
   1,792 generated cases plus 224 empty-item cases. One all-comment list can
   leave a hoisted comment or trailing space; the checker ignores that
   selector comment, while an empty `@scope` limit still fails Build.

2. **Low — a comment that touches the inside of a `:global()` or `:local()`
   wrapper fails Build.**
   - What happens: PostCSS removes a selector comment only when whitespace or
     the end of the selector touches it. Inside the wrapper the comment
     touches `(`, `)` or `,`, so the input keeps it. After the plugins remove
     the wrapper, whitespace touches the comment, and the output loses it.
     The check sees this difference and fails Build.
   - Reproductions: `.wrap :global(.x/**/, .y)`, `.wrap :global(/* c */.x, .y)`
     and `.wrap :global(.x, .y/* c */) .z`. The single-item forms, such as
     `.wrap :global(.x/* c */)`, fail in the same way since Milestone 20. A
     comment with whitespace next to it passes.
   - Delivered CSS would not change, because esbuild drops these comments.
     This matches Milestone 21 finding 7.
   - Impact: rare, but such modules fail Build and the message tells the
     author to give up scoping.
   - Options: A) ignore comments inside selectors on both sides of the
     comparison, and say so in the protocol; B) apply PostCSS's
     comment-removal rule to the normalized input before comparing; C)
     document it as a trigger.
   - Recommended: A, with tests at each wrapper boundary for single items and
     lists. It removes the whole class instead of handling one position at a
     time, and it matches the CSS that is delivered.

   Resolved in `7ba5628`: selector comment nodes are ignored on both sides,
   including a comment hoisted before its rule. Meaningful combinators and
   unrelated standalone comments remain checked.

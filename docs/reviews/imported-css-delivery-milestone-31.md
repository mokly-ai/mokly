# Imported CSS Delivery Milestone 31 Review

## Scope And Outcome

This review covers [Imported CSS Delivery](../../plans/imported-css-delivery.md)
Milestone 31. It ran on 2026-09-30 after `52056b9` was pushed, using
[the implementation review prompt](../implementation-review-prompt.md) against
`origin/main`. One read-only reviewer examined the changes since `b3dc8b2`:
`5ae34be` (Milestone 30) and the `52056b9` bookkeeping. Milestone 30 applied
the recommended option A to all three Milestone 29 findings:

- The check decides every combinator with the shared scanner, so whitespace
  that an escape swallows is never a combinator.
- The escape error gives advice that keeps the selector's meaning, and a
  Chrome test checks that advice.
- Missing tests were added, and a seeded escape-and-wrapper fuzz was added.

Findings that remain open in earlier records are not repeated.

The fix works for the cases it targeted:

- No wrong accepts in about 104,000 generated cases, compared with 3 to 13 per
  5,000 before the change. The cases cover plain and nested rules, both
  `@scope` groups, non-hex and escaped-backslash escapes, attribute
  selectors, `:nth-child(of)`, pseudo-elements, namespaces, CR, CRLF and form
  feed, and comments inside combinators.
- The parent session's checks pass. These include 10 seeds of the reviewer's
  earlier fuzz, 50,000 cases with no wrong accepts (the previous build had
  108 in 35,000), the random and escape-heavy Chrome oracles, the list matrix
  and every targeted row from earlier milestones.
- The mechanical advice edit keeps the meaning for 24 further rejected
  spellings in 4 contexts.
- Across 943 real stylesheets, results are unchanged and performance is
  equivalent.

The four findings below were reproduced in scratch copies. The parent session
confirmed finding 1 against builds before and after the change. All four
remain open for the user's decision.

## Findings

1. **Low — valid selectors with a comment right after an escape now fail
   Build, with the wrong advice.**
   - What happens: the check does not read the text that ships. It re-parses
     the scoped output with PostCSS and compares the cleaned selector and
     `@scope` params. PostCSS removes a comment that touches whitespace from
     those cleaned fields. So a delivered `.a\31/**/`, a line break, then `.b`
     is checked as `.a\31`, a line break, `.b`. The new combinator rule then
     treats the line break as swallowed by the escape and sees one element.
     Browsers and esbuild read the real text as "`.b` inside `.a1`". The
     authored side already guards against this PostCSS behaviour; the output
     side does not. Before Milestone 30, the parser's own misreading hid the
     gap.
   - Reproductions: each of these built before the change and shipped CSS
     that Chrome reads as authored. Each now fails with the scoping error:
     - `:global(.icon-\2192/* arrow */)`, a line break, then `.label`;
     - `:global(.a\31/**/)`, a tab, then `.b`;
     - `:global(.a\000031/**/) .b`;
     - `:local(.a\2192/**/)`, a line break, then `.b`;
     - `.a\31/**//**/`, a line break, then `.b`, which uses no wrapper;
     - the same shapes inside `@scope` and nested rules.
   - A biased fuzz finds 28 to 49 new false rejections per 5,000 to 6,000
     cases. None of the 943 real stylesheets hit it.
   - Three statements are wrong for these inputs: the protocol says each
     combinator is checked against the input or output text, the Milestone 27
     note says the check reads escapes in the output the way browsers do, and
     the plan says current valid output keeps building.
   - Impact: working modules fail Build. The advice to move the CSS to a plain
     stylesheet throws away scoping; the real fix is the documented escape
     edit. No wrong CSS ships.
   - Options: A) compare the text that ships by using PostCSS's raw selector
     and params on the output side, and add the reproductions as tests. A
     scratch prototype passed all focused tests and browser specs, left the
     corpus unchanged, found no wrong accepts in 20,000 generated cases, and
     also removed older false rejections such as `:global(.a\31/**/) .b`. B)
     widen the early escape error to reject an escape followed by comments
     that end at whitespace or at a wrapper's `)`, so these cases get the
     escape error and its correct advice. C) document the limitation.
   - Recommended: A. It fixes the root cause, which is that the check reads
     different text from the text that ships. B is a reasonable stopgap.
2. **Low — the new fuzz is about a quarter of the requested size and cannot
   generate the shapes behind finding 1.**
   - What happens: `tests/browser/css_module_escape_fuzz.spec.ts` runs 600
     cases in about 1.3 seconds, against the requested 5 seconds.
     - The early escape error stops 336 of them before they reach the check.
     - Only 12 would fail if the Milestone 30 fix were reverted.
     - Nothing requires a minimum number of accepted rows. A guard that
       rejected every escaped selector would still pass.
   - Its generator never produces:
     - a comment next to an escape;
     - whitespace or a combinator after a wrapper, which is the main
       Milestone 29 shape;
     - nested rules or `@scope`;
     - CR, CRLF or form-feed endings;
     - escapes of characters other than letters and digits.

     Adding comment endings and whitespace after the wrapper makes it fail on
     finding 1.

   - The protocol says a same-meaning rejection is allowed only for the
     trailing-comma case, but the fuzz also allows it for every escape error,
     and the protocol does not describe the fuzz. The Milestone 29 note
     overstates what it pins.
   - Impact: comment-handling bugs, context-specific bugs or a partial revert
     of the fix can pass CI.
   - Options: A) widen the generator to cover these gaps, favour spellings
     that the escape error accepts, size it to about 5 seconds, require a
     minimum of accepted rows and of rows that exercise the Milestone 30
     rule, and describe it in the protocol; B) only raise the case count; C)
     leave as is.
   - Recommended: A, together with finding 1. The widened fuzz fails until
     finding 1 is fixed. The minimum counts stop it from passing without
     testing anything.
3. **Low — the new mutation checklist overstates coverage, and one scanner
   rule has no test.**
   - The reviewer broke 33 rules one at a time. Three breaks have no visible
     effect, because PostCSS removes the relevant comments first. Of the other
     30, the test that the checklist names catches 25:
     - No test catches raising the six-hex-digit limit to seven. That change
       would make the valid `:global(.a\000031b) .c` fail Build.
     - Three join rules are caught only by tests other than the named one.
       Those rules are: comments alone are not whitespace, swallowed
       whitespace does not count, and commas inside brackets do not count.
     - Applying the combinator rule only to the output side fails no test.
       It matters for a backslash followed by a literal tab:
       `:global(.a\` + tab + `.b)` would then fail Build.
   - Impact: a maintainer following the checklist can break the digit limit
     or the join rules unnoticed, contrary to the rule that everything must be
     fully tested.
   - Options: A) add a seventh-digit test and a backslash-tab test, and list
     every test file that pins each rule, or one command that runs all CSS
     Modules suites; B) add the tests only; C) leave as is.
   - Recommended: A. The broader guard, a scripted mutation run, is already
     proposed in open Milestone 21 finding 4.
4. **Low — the README rewrite put 58 lines of unrelated build documentation
   inside the checklist's last bullet.**
   - What happens: the paragraph after the checklist in `src/build/README.md`
     was indented, so Markdown renders it as part of the "Wrapper list joins"
     bullet. It covers metafile paths, `url()` assets, the PostCSS worker,
     package-owned paths, fragment inputs, pending generation, the reserved
     directory and committed Build and Check. No text was lost.
   - Impact: core build documentation looks like part of a test checklist and
     could later be deleted as clutter.
   - Options: A) end the list with a blank line and remove the indentation, or
     move the checklist into its own subsection; B) leave as is.
   - Recommended: A.

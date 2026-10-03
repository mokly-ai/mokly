# Imported CSS Delivery Milestone 27 Review

## Scope And Outcome

This review covers [Imported CSS Delivery](../../plans/imported-css-delivery.md)
Milestone 27. It ran on 2026-09-29 after `d1eb518` was pushed, using
[the implementation review prompt](../implementation-review-prompt.md) against
`origin/main`. One read-only reviewer examined the changes since `cceae33`:
`266164b` (Milestone 26) and the `d1eb518` bookkeeping. Milestone 26 put the
user's decisions on the four Milestone 25 findings into effect:

- The rename-only check counts whitespace only where the author typed it,
  except whitespace moved out of a `:global()` or `:local()` wrapper.
- All-empty wrappers fail Build with a catalogued error.
- A seeded Chrome oracle compares the delivered selector with the authored
  one.
- The docs state the exact rule, and a table-driven Build test backs each
  example.

Findings that remain open in earlier records are not repeated.

The main fix works:

- A parent-session random Chrome oracle of 12,000 selectors without wrappers
  finds no wrong accepts at HEAD, the same result as before Milestone 24.
- The parent session's 19,560-case list matrix and 26 targeted cases for the
  four decisions pass.
- The empty-wrapper error fires in nested pseudo-classes, nested rules,
  `@media` and both `@scope` groups, and names the right wrapper and
  location.
- Across 927 real stylesheets, accept and reject results match `cceae33`, and
  performance does not change materially.

The four findings below were reproduced in scratch copies. The parent session
confirmed findings 1 and 3 against builds before and after the change. The
user approved option A for all four, resolved in `c482bd0`.

## Findings

1. **Medium — escaped names next to a wrapper ship a selector with a changed
   meaning.**
   - What happens: in CSS, a hex escape such as `\31` (the digit 1) consumes
     one following whitespace character as its end. The plugins print an
     escaped name from inside a wrapper followed by one space, and browsers
     read that space as part of the name, not as a combinator. Milestone 26's
     whitespace test (`authoredSpaceBefore` in
     `src/build/styles/module_selector_source.ts`) reads the raw text and
     treats the space as a combinator on both sides, so the check passes.
   - Reproductions: each case builds at HEAD, and Chrome reads the delivered
     selector as a compound where the author wrote a descendant. The builds
     before Milestone 24 and before Milestone 26 stopped all of them.

     | Authored                   | Chrome reads the delivered selector as |
     | -------------------------- | -------------------------------------- |
     | `:global(.a\31) .b`        | `.a1.b`                                |
     | `.x :global(.a\31, .b)`    | `.x .a1.b`                             |
     | `.w:global(.a\31, ):hover` | `.w.a1:hover`                          |
     | `:global(#a\31) .b`        | `#a1.b`                                |
     | `:local(.a\3a) .b`         | a compound                             |

   - The same test also causes false rejections that built before:
     `:global(.a\31 ).b`, `:global(.\31 ).card`, and a no-break space inside a
     wrapper. The JavaScript whitespace class also matches Unicode spaces
     that CSS treats as name characters.
   - Replacing the helper with `return false` still passes all focused tests
     and both oracles, and it makes all five wrong accepts fail Build again.
     So nothing needs the helper except this bug.
   - None of the 927 real stylesheets contain these shapes.
   - Impact: Build silently ships a changed selector, which the check exists
     to prevent. The protocol's "Every meaningful combinator remains" is
     currently false.
   - Options:
     - A) Delete the helper and route every whitespace decision through one
       shared, tested function. It accepts only CSS whitespace (space, tab,
       line feed, carriage return, form feed) that a hex escape did not
       consume. Add regressions for the eight cases above and escaped and
       Unicode rows to the oracle.
     - B) Return to `cceae33`'s token-based spacing, plus a narrow
       trailing-comma origin check.
     - C) Document escaped names at wrapper edges as unsupported.
   - Recommended: A. One shared CSS-whitespace function prevents the whole
     class of text that looks like whitespace but is not CSS whitespace,
     not just these five spellings.

   Resolved in `c482bd0`: a shared forward CSS scanner distinguishes
   escape-consumed CSS whitespace from combinators and Unicode name
   characters in selectors and `@scope` preludes. The wrong accepts now fail
   and the reviewed false rejections now build.

2. **Low — an escape ended by a tab or line break becomes a descendant
   combinator, even without wrappers. This existed before Milestone 26.**
   - What happens: the selector parser treats only a single space as the end
     of an escape, and never after six hex digits. Browsers also accept a tab,
     line feed, carriage return, CRLF or form feed. `.a\31` followed by a line
     break and `.b` is one element in Chrome (`.a1.b`). The parser sees a
     combinator, the scope plugin prints a space after the scoped name, and
     Chrome reads the output as a descendant. The check trusts the parser and
     accepts.
   - Every build since before Milestone 24 accepts it, as do the variants
     with a tab, `\r`, CRLF, `\f`, `.a\3A` and a six-digit escape. The
     parent's random oracle contains no escapes, so it could not see this.
   - Options:
     - A) Fail Build early, with a catalogued and actionable error, when a
       module selector has a hex escape ended by anything other than one
       space, or a six-digit escape followed by whitespace.
     - B) Compare selectors with a tokenizer that follows the CSS
       specification, such as Lightning CSS, which Mokly already uses to
       read CSS.
     - C) Document it.
   - Recommended: A, with oracle rows for these shapes. It is narrow and
     deterministic. B is the broader guard if more disagreements between the
     parser and browsers appear, but it is a larger design change.

   Resolved in `c482bd0`: raw authored selectors and `@scope` preludes now
   reject tabs, line endings and form feeds that end hex escapes, and any
   whitespace after six-digit escapes. The same guard rejects an escape
   followed by a comment and then whitespace before PostCSS erases the
   comment. The diagnostic names the authored file and location.

   Extended in `5ae34be`: the check now also reads escapes in the scoped
   output the way browsers do (Milestone 29 finding 1).

   Corrected in `6a02190`: the output side now reads the shipped text, so
   comments PostCSS removes on re-parse no longer hide escape terminators.

3. **Low — three wrapper spellings now fail Build although the plugins' output
   means what the docs say.**
   - Cases:
     - `.w:global(.x, ,):hover` and `.w:local(.x,\n,):hover`: the plugins
       print `.w.x :hover` and `.w.x\n:hover`, but the check looks only after
       the last comma of the wrapper's empty tail.
     - `.a:is(.b :global(.x, )/*c*/).c`: the comment absorbs the moved
       whitespace, which stays harmlessly inside `:is()`. The check ignores
       the comment and predicts a descendant before `.c`.
     - `.w :global(.x/* a /* b */,.y)`: the comment scan uses the last `/*`,
       lands inside the comment, and counts its inner space.
   - All three built before Milestone 26. A 20,000-case wrapper fuzz finds 30
     failures of the first kind at HEAD and none before. Disabling the comment
     handling in the text scanner changes no test result.
   - Impact: rare but valid module CSS fails Build with a misleading message,
     contrary to the decision that wrapper whitespace counts as the plugins
     print it.
   - Options: A) treat whitespace anywhere in a wrapper's empty tail as moved
     unless a kept comment absorbs it, stop at a comment that follows the
     wrapper inside an enclosing pseudo-class, find comments by a forward
     scan, and test each case; B) document these spellings as unsupported and
     pin the rejections with tests; C) leave as is.
   - Recommended: A, done together with finding 1 so one text scanner serves
     both.

   Resolved in `c482bd0`: whitespace anywhere after the first empty-tail
   comma moves with a CSS Modules wrapper. A kept comment stops that move
   inside another pseudo; the shared forward scan finds comment ends at the
   first `*/`. Nested and chained-wrapper regressions pin plugin output.

4. **Low — the Chrome oracle checks less than it claims, and two records
   overstate the rule.**
   - What happens: Chrome drops 102 of the oracle's 281 cases on both sides,
     so those cases pass whatever Build does. They include all 63 `:host()` and
     `::slotted()` rows, which accept only one compound selector, and the
     trailing-comma rows for `:not()`, `:has()` and `:nth-child(of)`, which
     reject empty items. Only the `:is()` and `:where()` trailing-comma rows
     compare anything. Nothing limits that count.
   - The oracle has no escapes, Unicode spaces, CRLF or repeated trailing
     commas, so findings 1 to 3 all pass it.
   - Its random part generates 160 cases of one shape. It claims that Build
     accepts exactly when the browser reads both selectors the same way.
     That holds only for these narrow shapes. In the parent's 12,000 random
     selectors, Build rejects 486 whose meaning did not change. These are
     trailing commas inside `:is()` that move a space somewhere harmless.
     They were rejected in the same way before Milestone 24, which matches
     the user's choice to reject moved whitespace outside wrappers "as
     before".
   - The Milestone 25 record says a trailing comma in another pseudo-class
     fails Build "when it changes the selector", but it fails even when
     harmless. The Milestone 23 and 25 records also describe the oracle more
     broadly than it works.
   - The example table pins `.card:is(.a,).b` (the space removed), not the
     documented fix of removing the trailing comma (`.card:is(.a ).b`, which
     builds).
   - Impact: the oracle and the records overstate the protection, and future
     regressions of this kind pass CI.
   - Options:
     - A) Shape every row so Chrome parses it, and require a minimum number of
       real comparisons for each pseudo-class family. Add rows for findings 1
       to 3 and for the documented fix. State that the random oracle
       tolerates the known strict rejections, and correct the two records.
     - B) Generate the authored and expected selectors from one structural
       description, with escapes, Unicode spaces, line endings and repeated
       commas.
     - C) Keep it as is.
   - Recommended: A now and B as the broader guard. The reviewer's structural
     fuzz found finding 3's double-comma case at once.

   Resolved in `c482bd0`: the seeded oracle now has 220 Chrome-parseable
   rows, at least ten real comparisons per pseudo family, the reviewed escape
   and wrapper cases, and the documented trailing-comma fix. It permits a
   same-meaning rejection only when explicitly marked as the known strict
   non-wrapper trailing-comma case; zero rows needed that exception. This is
   option A only, not a structural generator.

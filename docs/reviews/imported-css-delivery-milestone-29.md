# Imported CSS Delivery Milestone 29 Review

## Scope And Outcome

This review covers [Imported CSS Delivery](../../plans/imported-css-delivery.md)
Milestone 29. It ran on 2026-09-30 after `5ed9e0e` was pushed, using
[the implementation review prompt](../implementation-review-prompt.md) against
`origin/main`. One read-only reviewer examined the changes since `082927f`:
`c482bd0` (Milestone 28) and the `5ed9e0e` bookkeeping. Milestone 28 applied
the user's option A to all four Milestone 27 findings:

- A shared forward scanner decides CSS whitespace, taking into account
  whitespace that an escape swallows.
- An early error rejects three escape spellings that browsers and the
  selector parser read differently.
- Whitespace in a wrapper's empty tail moves as the plugins print it.
- The Chrome oracle compares only rows that Chrome can parse.

Findings that remain open in earlier records are not repeated.

The fix works for the cases it targeted:

- All 44 of the parent session's targeted rows pass. So do the earlier list
  matrix (19,560 cases) and the 12,000-case random Chrome oracle, which finds
  no wrong accepts.
- A 10,000-case escape-heavy random Chrome oracle without wrappers finds no
  wrong accepts at HEAD. The build before Milestone 24 had 251.
- The oracle's 220 rows are all parseable, with 20 to 35 real comparisons for
  each pseudo-class family. No row needed the strict-rejection exception.
- Across 943 real stylesheets, including Tailwind 1, 2 and 4 output with
  19,552 selector escapes, accept and reject results match `082927f`. The
  escape error never fires, and performance is unchanged.

The three findings below were reproduced in scratch copies. The parent session
confirmed finding 1 in Chrome. The user approved option A for all three;
they were resolved in `5ae34be`.

## Findings

1. **Medium — an escape at the end of a `:global()` or `:local()` item can
   still ship a selector with a changed meaning.**
   - What happens: the early error checks only the spellings that the author
     typed. Removing a wrapper can create the same risky spellings in the
     output. For example, an escape that ended at `)` or `,` can end up
     directly before whitespace. The check reads the output with the selector
     parser, which treats that whitespace as a combinator. Browsers instead
     let the escape swallow it:
     - after a six-digit escape, any whitespace;
     - after a shorter escape, a tab, line feed or form feed.
   - Reproductions, all of which build. Chrome reads each delivered selector
     as one element where the author wrote a descendant:

     | Authored                           | Chrome reads the delivered selector as |
     | ---------------------------------- | -------------------------------------- |
     | `:global(.a\000031) .b`            | `.a1.b`                                |
     | `:global(.a\1f)`, a tab, then `.b` | one element                            |
     | `.x :global(.a\000031, .b)`        | `.x .a1.b`                             |
     | `.w:global(.a\000031, ):hover`     | `.w.a1:hover`                          |
     | `:local(.a\00006a) .b`             | `.aj.b`                                |

   - The same happens in nested rules, both `@scope` groups and inside
     `:is()`. `:local()` is affected only with lowercase hex letters, because
     the scope plugin adds a protective space only after uppercase ones.
   - In a structural fuzz that combines wrappers and escapes, 1,117 of 7,747
     accepted cases were wrong at `082927f`, and 23 of 4,370 are wrong at
     HEAD. Every remaining case has a risky spelling that exists only in the
     output.
   - None of the 943 real stylesheets contain these shapes.
   - The protocol statements that an escape-swallowed whitespace is never a
     combinator and that "Every meaningful combinator remains" are false for
     these inputs. So are the Milestone 27 finding 2 note, the PR draft and
     `src/build/README.md`.
   - Impact: Build silently ships a rule that styles different elements.
   - Options:
     - A) Decide every combinator with the shared scanner on both sides, so
       that whitespace an escape swallowed is never a combinator. Add oracle
       rows for each way the plugins create the problem, and a seeded fuzz
       that combines wrappers and escapes.
     - B) After scoping, run the three escape checks on each delivered
       selector and `@scope` prelude, and report a failure with the existing
       scoping error. A prototype removed all 23 fuzz cases. It adds some
       cautious false rejections, such as `:local(.a\00006A) .b`, whose output
       is correct.
     - C) Also reject an escape that ends a wrapper item, before `)` or `,`.
     - D) Document the limitation.
   - Recommended: A. The root cause is that the check trusts the parser's
     reading of escapes in the output. Reading both sides the way browsers do
     closes today's cases and any future plugin output that puts whitespace
     after an escape, without new false rejections. B is a reasonable
     stopgap. C covers only today's cases.

   Resolved in `5ae34be`: parser-produced and inserted whitespace
   combinators now require unconsumed CSS whitespace on both the authored
   and scoped sides. The reviewed wrong accepts fail Build; two-space and
   uppercase-escape controls still build. A 600-case seeded Chrome fuzz pins
   the plugin-output comparison.

2. **Low — the escape error's advice can change the selector's meaning, and
   the guide note breaks its paragraph.**
   - What happens: the message, the error catalogue and the Styles guide say
     "end a short escape with one space before comments, or remove whitespace
     after a six-digit escape". That advice fails in some cases:
     - `.a\000031  .b` (two spaces) and `.a\000031/**/ .b` both mean `.b`
       inside `.a1`, and Build rejects them. Removing the whitespace builds
       but means one element, and removing one space still fails.
     - What always works is an escape of at most five digits followed by
       exactly one space, then the intended spacing or comment. For example,
       `.a\31  .b` or `.a\31 /**/ .b`.
     - "Before comments" is confusing when there is no comment.
   - The new guide sentence sits between the wrapper-list example and its
     follow-up "To match either class, write …". That sentence now reads as
     part of the escape advice.
   - Impact: a user who follows Mokly's advice can turn "inside" into "same
     element", get the same error again, or move working CSS to a plain
     stylesheet for no reason.
   - Options: A) reword the message, catalogue, protocol and guide to "write
     the escape with at most five hex digits followed by exactly one space,
     then any spacing or comment"; move the guide sentence; and add tests
     that apply the advised edit to each rejected spelling and check that
     Chrome reads the same selector; B) keep the wording and add a guide
     sentence for the descendant case; C) leave as is.
   - Recommended: A. A test that checks the advice keeps the meaning is the
     lasting guard, because the current advice was verified only on
     single-whitespace examples.

   Resolved in `5ae34be`: the error and guide now prescribe a short escape,
   exactly one ending space, then the intended spacing or comment. A
   mechanical-edit test checks 42 rule and `@scope` cases against Chrome,
   and the guide keeps the list example with its follow-up explanation.

3. **Low — several new scanner and error rules are untested.**
   - Mutation testing broke one rule at a time across the 345 focused CSS
     Modules tests and the oracle. No test caught these four:
     - Escaped quotes inside strings. Without that handling,
       `.w :global([x="a\"b"], .y)` and a `@scope` prelude with an escaped
       quote fail Build. The strings test contains no escaped quote.
     - A no-break space treated as the end of an escape. The row meant to
       cover it uses `String.raw`, so it contains the six characters ` `,
       not a no-break space.
     - Which comments the escape error rejects. Loosening the "directly after
       the escape" rule makes `.a\31.b/**/ .c` fail Build.
     - The two inline authored-whitespace checks in
       `module_verify_selector.ts`, which carry over the deleted helper's
       logic. Removing them changes nothing in the tests, the oracle or
       90,000 random wrapper selectors.
   - Impact: regressions here would pass CI, most likely as new false
     rejections, contrary to the rule that everything must be fully tested.
   - Options: A) add the missing tests, delete the two inline checks or add a
     test that shows they are needed, and keep a short mutation checklist
     for these files; B) add the tests only; C) leave as is.
   - Recommended: A. This is the second milestone in which mutation testing
     found untested whitespace logic in these files.

   Resolved in `5ae34be`: tests cover escaped quotes, actual U+00A0, and a
   comment after intervening selector text. The two dead inline whitespace
   checks are removed, and the build README names a test for each scanner,
   guard, tail, combinator and join rule.

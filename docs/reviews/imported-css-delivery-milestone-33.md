# Imported CSS Delivery Milestone 33 Review

## Scope And Outcome

This review covers [Imported CSS Delivery](../../plans/imported-css-delivery.md)
Milestone 33. It ran on 2026-09-30 after `1531516` was pushed, using
[the implementation review prompt](../implementation-review-prompt.md) against
`origin/main`. One read-only reviewer examined the changes since `71c54fc`.

- `fa43083` is a separate, user-approved lockfile-only patch of the
  transitive `brace-expansion` package from 5.0.9 to 5.0.12. It fixes three
  new advisories that blocked `cargo xtask check`.
- `6a02190` (Milestone 32) fixed Milestone 31 finding 1 with option A:
  - The check compares the cleaned input that the plugins processed with the
    exact scoped text that ships.
  - Comments outside `@scope` groups are ignored, which avoids a false
    rejection that the reviewer's prototype had.
  - A parent-found correction merges combinators only when an ignored
    comment separated them, because shipped text such as
    `ul > /* direct */ li` parses as `>`, a comment, then a whitespace
    combinator.
- `1531516` is bookkeeping.

Findings that remain open in earlier records are not repeated.

The fix works:

- **Parent-session rows.** All 43 targeted rows behave as specified. They
  cover:
  - the Milestone 31 finding 1 reproductions in rules, nested rules and both
    `@scope` groups;
  - unchanged and changed `@scope` preludes with comments;
  - 24 cases with comments next to combinators;
  - rows that must still fail Build.
- **Parent-session fuzz and earlier checks.** A comment-heavy random fuzz of
  16,000 selectors without local names finds no wrong accepts in Chrome and
  no change in acceptance against `52056b9`. All earlier parent checks still
  pass.
- **Reviewer fuzz.** A separate reviewer fuzz of 31,500 cases finds no wrong
  accepts and no new false rejections among selectors that Chrome accepts.
  About 1,000 rows are newly accepted, all with the correct meaning.
- **Dependency patch.** It changes only the `brace-expansion` lockfile entry.
  Its integrity hash matches the registry. Version 5.0.12 is the first to
  fix all three advisories, and `npm audit` reports no vulnerabilities. The
  patch also makes the lockfile match `docs/protocol/dependency-security.md`,
  which already named 5.0.12.
- **Real stylesheets.** Across 943 real stylesheets, results are unchanged,
  and performance is unchanged within measurement noise.

The three findings below were reproduced in scratch copies. The parent session
confirmed the new false rejection in finding 2 and the input-side cases in
finding 1. All three remain open for the user's decision.

`origin/main` is now three commits ahead of the merge base, not two. The new
commit, `b4314fe` ("replace collections with navigation paths"), changes
about 1,000 files. About 130 of the files changed on `main` since the merge
base are also changed on this branch. It does not touch `src/build/styles`
or `package-lock.json`. Merging will need the path-by-path mainline
preservation check from `AGENTS.md`.

## Findings

1. **Low — two new rules have no test, so a plausible refactor could break
   valid CSS without failing CI.**
   - The reviewer applied 23 mutations and ran the CSS Modules unit tests and
     Chrome specs. These mutations fail no test, although each one changes
     real results:
     - **Merging only on the output side.** Then
       `.x > /* a *//* b *//* c */ .y` and
       `:global(.x >)/* a *//* b */ .y` fail Build. Both build at HEAD, and
       both failed at `52056b9`. In a run of comments, PostCSS keeps one
       comment next to the space, so the input side needs the merge too.
     - **Using the shipped text for every at-rule, not only `@scope`.** Then
       valid rules such as `@media screen /* c */ and (min-width: 1px)`,
       `@supports (display: grid) /* c */ and (gap: 1px)`,
       `@layer a, /* c */ b;` and `@container card /* c */ (min-width: 1px)`
       fail Build. No test has a comment in at-rule params.
     - **Not resetting the comment flag after a wrapper.** Then
       `.a/**/:global(.x >) .y` changes from rejected to accepted, which the
       protocol says must not happen.
     - **Skipping the `@scope` outside comparison entirely.**
   - Two of the three documented merge cases can never run. The selector
     parser folds whitespace followed by comments into one combinator, so
     only "explicit combinator, comment, whitespace" occurs. None of 400,000
     random selectors produced the other two.
   - The mutation checklist in `src/build/README.md` has no entry for these
     rules. This is related to open Milestone 31 finding 3.
   - Impact: the plan claims tests for the merge on both sides, but the input
     side has none. A refactor for consistency or simplicity would make valid
     modules fail Build without any failing test.
   - Options:
     - A) Add Node rows, and Chrome rows where useful, for:
       - the two comment-run selectors;
       - comments in `@media`, `@supports`, `@layer`, `@container` and
         `@keyframes` params keeping the old comparison;
       - `.a/**/:global(.x >) .y` staying rejected;
       - a changed `@scope` outside text.

       Remove the two unreachable merge branches or document them as
       defensive, and add a checklist entry.

     - B) Add only the comment-run and `@media` rows.
     - C) Leave as is.
   - Recommended: A. The broader guard is the scripted mutation run proposed
     in open Milestone 21 finding 4, which would have caught all of these.
2. **Low — unchanged selectors with a non-hex escape before a comment now
   fail Build, and the protocol overstates what the escape error covers.**
   - What happens: the early escape error handles only hex escapes such as
     `\31`. PostCSS's comment removal can also join tokens after three
     non-hex escapes: a backslash followed by a space, `\,`, and a backslash
     directly before a comment.
     - `::part(a\,/**/b)` and `::part(a\ /**/b)` are valid in Chrome. They
       built before this change and shipped unchanged. They now fail with the
       scoping error, because the check compares the shipped text with the
       cleaned input, whose tokens differ.
     - Two authored-invalid variants also newly fail.
   - An older problem contradicts the new protocol sentence that "the early
     escape guard protects authored syntax whose meaning cleaning would
     change". When such a selector is changed by scoping, the cleaned text
     ships:
     - `.card [data-x=a\ /**/b]`, which Chrome drops as authored, ships as a
       valid rule that matches `data-x="a b"`;
     - `.card .x\,/**/y` ships class `x,y`.

     The build before this change behaves the same.

   - Impact: very small. None of the 943 real stylesheets hit this. But the
     protocol promises more than the code does, and the "move this CSS to a
     plain stylesheet" advice appears for CSS the plugins left unchanged.
   - Options:
     - A) Accept a rule or `@scope` prelude whose shipped text is
       byte-identical to the authored text, and narrow the protocol sentence
       to hex escapes. A reviewer prototype of this fixed all four cases,
       still rejected every must-reject case, and passed the focused tests
       and browser specs.
     - B) Extend the early escape error to any escape directly followed by a
       comment that PostCSS removes, using the existing advice. This also
       closes the older case.
     - C) Only narrow the protocol sentence.
   - Recommended: A. Accepting byte-identical output removes this whole class
     of false rejections for unchanged selectors, whatever disagreement
     between PostCSS and the parser causes them. Add B to close the older
     case too.
3. **Low — the protocol now contradicts itself about `@scope` text outside the
   groups.**
   - What happens: the new sentence says the comparison removes comments
     outside `@scope` groups. Later in the same paragraph, the old sentence
     still says preludes keep the same group structure and "non-group bytes".
   - Impact: a maintainer could change the code to match the old sentence,
     which would bring back the false rejection of unchanged preludes such as
     `@scope ([data-a]) /* c */ to ([data-b])`.
   - Options: A) reword the old sentence to "the same group structure and
     non-group text apart from comments"; B) leave as is.
   - Recommended: A. A wording fix is enough, because a test already pins the
     behaviour.

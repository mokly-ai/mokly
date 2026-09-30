# Imported CSS Delivery Milestone 35 Review

## Scope And Outcome

This review covers [Imported CSS Delivery](../../plans/imported-css-delivery.md)
Milestone 35. It ran on 2026-09-30 after `70a319e9` was pushed, using
[the implementation review prompt](../implementation-review-prompt.md) against
`origin/main` at `0c8245f8`. One read-only reviewer examined `bd1b2aa2..70a319e9`
and read only commits, because the `main` merge was in progress in the working
tree. The commits were `583af0a9` (Milestone 34) and the `70a319e9`
bookkeeping. Milestone 34 applied the user's option A for Milestone 33 finding 2. A rule selector or `@scope` prelude whose shipped text is byte-identical to
its authored text is accepted without further comparison. The protocol now
limits the early escape error to hex escapes and states the remaining non-hex
limitation for changed selectors. Findings that remain open in earlier records
are not repeated.

The change fixes the four rejections it targeted and rejects nothing new:

- Two random runs covered 50,759 unique selectors. Nothing was newly rejected,
  and every newly accepted row was byte-identical.
- Children, declarations, node counts and at-rule names are still compared.
- 6 of the 13 new tests fail on the previous build, so they are genuine
  regression tests.
- The hex-only sentence and the `.card .x\,/**/y` limitation example are
  accurate.

The two findings below were reproduced in scratch copies. The parent session
confirmed finding 1 in Chrome. Both remain open for the user's decision.

## Findings

1. **Low (safety regression) — the byte-identical shortcut can ship class and
   ID selectors that CSS Modules never renamed.**
   - What happens: the plugins read PostCSS's cleaned selector, not the text
     that ships. PostCSS does not treat `\/` as an escape, so in `x\/*` it
     sees a comment starting at `/*`. A browser instead sees an escaped slash
     followed by `*`. Inside the forgiving lists of `:is()` and `:where()`,
     browsers drop the invalid item and keep the rest. So in
     `:is(x\/*, .foo, */ y)` the plugins see only `:is(x\ y)` and rename
     nothing, while browsers read `:is(.foo)`. The shipped text is unchanged,
     so the new shortcut accepts it.
   - Reproduction: a module containing `.card{color:blue}` and
     `:is(x\/*, .foo, */ y){color:red}` builds. The class map contains only
     `card`, and a plain `<div class="foo">` on the page turns red. The same
     happens with `:where(x\/*, #foo, */ y)`, inside a nested rule, as an
     `@scope` root, and with CRLF line endings. Before Milestone 34, Build
     rejected all of these.
   - Of 1,440 generated selectors built around `\/*`, the change newly accepts 360. In 108 of them the shipped CSS contains a class or ID that was never
     renamed or exported, and that Chrome matches.
   - The Chrome oracle removes the module prefix before comparing, so an
     unrenamed class compares as equal. Earlier fuzzes also generated only
     selectors without local names. The Milestone 33 recommendation assumed
     unchanged text is always safe.
   - The protocol, `src/build/README.md` and the code comment call the
     shortcut safe. The Styles guide tells users that classes and IDs are
     scoped.
   - Impact: a CSS Module can silently ship a global rule that styles any
     matching element on the page, while `styles.foo` is undefined. It needs a
     very unusual spelling, but it breaks the check's fail-closed guarantee,
     which held before Milestone 34.
   - Options:
     - A) Use the shortcut only when the shipped text contains no class or ID,
       detected with the shared CSS scanner, and otherwise run the normal
       comparison. The plugins rename every class and ID they see, so
       unchanged text that still contains one shows they missed it. A scratch
       prototype passed all 427 CSS Modules unit tests, kept the four
       Milestone 34 rows and both `@scope` rows building, and rejected all 360
       rows again.
     - B) Make the early escape error also reject an escaped `/` directly
       followed by `*`. This also closes an older case where
       `.card :is(x\/*, .foo, */ y)` ships `.card :is(x\ y)` and silently drops
       `.foo`. That case belongs to the changed-selector limitation that the
       user chose to leave open.
     - C) Keep the behaviour, document it and fix the code comment.
   - Recommended: A, plus a broader test rule. The Chrome oracle and the fuzz
     should require that every class and ID in an accepted rule carries the
     module prefix unless it was authored inside `:global()`. Add seeded `\/*`
     rows for `:is()`, `:where()`, nested rules and `@scope`. A enforces the
     one assumption the shortcut relies on. The oracle rule closes the blind
     spot that let this pass every fuzz so far. B alone fixes only this one
     quirk.
2. **Low — no test pins that the shortcut compares exact bytes rather than
   PostCSS's cleaned text.**
   - What happens: switching the shortcut to PostCSS's cleaned fields looks
     like a natural simplification, but no CSS Modules test fails. The check
     would then accept outputs that change meaning. For example, `div\ p`
     would pass as `div\ /**/p`, `::part(a\ b)` as `::part(a\ /**/b)`, and the
     same pattern in `@scope`. The current code rejects all three. The
     existing "one removed comment" row cannot tell raw text from cleaned
     text, and there is no `@scope` equivalent.
   - Impact: nothing ships wrong today, because the plugins never insert
     comments. But a refactor could weaken the check without any test
     failing.
   - Options: A) add reject rows that call the check directly with two texts
     that differ only by a comment PostCSS removes next to an escape, for a
     rule, a nested rule and both `@scope` groups, and list the test file in
     the mutation checklist; B) add only one rule row and one `@scope` row;
     C) leave as is.
   - Recommended: A. The broader guard remains the scripted mutation run from
     open Milestone 21 finding 4.

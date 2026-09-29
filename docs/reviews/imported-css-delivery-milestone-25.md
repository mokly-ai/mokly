# Imported CSS Delivery Milestone 25 Review

## Scope And Outcome

This review covers [Imported CSS Delivery](../../plans/imported-css-delivery.md)
Milestone 25. It ran on 2026-09-29 after `a9dcb3a` was pushed, using
[the implementation review prompt](../implementation-review-prompt.md) against
`origin/main`. One read-only reviewer examined the changes since `b52b1ef`:
`7ba5628` (Milestone 24) and the `963b7e8` and `a9dcb3a` bookkeeping.
Milestone 24 put the user's option A for both Milestone 23 findings into
effect. The rename-only check now follows the CSS Modules plugins' join for
lists inside `:global()` and `:local()`, and it ignores comments inside
selectors. Findings that remain open in earlier records are not repeated.

The change works for the cases it targeted:

- An independent parent-session matrix of 19,560 list cases passes. It covers
  15 contexts, both wrappers, 8 item shapes, 10 separators and empty-item and
  comment variants. Before the change, 4,472 of these cases failed.
- Three or more items with mixed separators, nested lists, escaped and unicode
  names, and attribute values containing commas or comments all match the
  plugins.
- Across 877 real stylesheets and 32,122 unique selectors, accept and reject
  results are identical before and after the change. Checking and scoping
  times do not change measurably.
- The skipped hoisted comment must appear verbatim in the input selector, so
  it cannot hide a real change.

The four findings below were reproduced in scratch copies. The parent session
confirmed findings 1 and 2 against builds before and after the change. All
four were resolved in `266164b` by the user's chosen options.

## Findings

1. **Medium — a trailing comma with whitespace inside `:is()` or `:where()`
   now ships a selector with a different meaning.**
   - What happens: when the last item in a list is empty, as in `(.a, )`, the
     selector parser attaches the whitespace after the comma to the first node
     after `)`. The plugins print it there.
     `.card:is(.primary, .secondary, ).active` becomes
     `.card:is(.primary, .secondary,) .active`, so `.active` changes from part
     of the same element to a descendant.
   - Milestone 24 reads the parser's recorded whitespace as authored
     whitespace. The check's model of the input therefore contains the same
     false descendant, and the check passes.
   - Evidence:
     - Before the change this failed Build; now it builds. Chrome matches the
       authored selector on the element and the delivered one only on a
       descendant.
     - The same happens in `:where()`, `:not()`, `:has()`, `:nth-child(of)`,
       `:host()`, `::slotted()`, nested rules, `@scope` preludes and inside
       `:global()` items.
     - In 12,000 random selectors without `:global` or `:local`, 1,290
       accepted cases changed meaning. All have this shape, and the build
       before the change rejected every one.
   - Browsers accept a trailing comma inside `:is()` and `:where()`, and
     Prettier keeps it, so nothing warns the author.
   - Related effects with the same cause:
     - `.w:global(.x, ):hover` ships `.x :hover`, which the protocol, guide and
       PR draft say cannot happen. It was already accepted before the change.
     - `.wrap:global(/* c */, /* d */).tail` ships `.wrap .tail`.
     - `.w:global(.a, ):global(.x)` built before the change and now fails.
   - Impact: the rename-only check that the user chose silently ships CSS that
     matches different elements.
   - Options:
     - A) Count whitespace only where the authored text has it, for example by
       checking the character before each node's source position, and stop
       reading whitespace from comments and from recorded trailing spaces.
       Removing only the leading-space check restores the old reject set on
       8,000 random selectors. The source-position check also covers the
       comment and wrapper variants. `.w:global(.x, ):hover` and the
       all-comment wrapper would then fail Build, which departs from the
       plugins and needs the user's agreement.
     - B) Accept the moved whitespace only when it comes out of a `:global()`
       or `:local()` wrapper, and reject it after every other pseudo-class.
     - C) Document the limitation.
   - Recommended: B, with failing tests first for each context above. It keeps
     the user's decision to match the plugins inside `:global()` and
     `:local()` and restores the old rejection everywhere else. A is simpler,
     but it makes some wrapper cases fail that css-loader and Vite accept.
     Finding 3's browser comparison is the broader guard against the check
     and the plugins misreading text in the same way.

   Resolved in `266164b`: authored offsets now govern spacing; only a
   `:global()` or `:local()` trailing comma may move its whitespace outward.
   Nested wrapper-owned whitespace remains accepted, while a trailing comma
   in another pseudo fails Build when it changes the selector.

2. **Low — wrappers whose items are all empty now pass even when removing them
   leaves invalid CSS.**
   - What happens: to accept `:global(,)`, the check drops an all-empty wrapper
     and the combinator next to it, merges consecutive combinators, and does
     not treat the next node as newly attached.
   - Evidence: each case failed Build before the change, now builds, and
     Chrome drops the delivered rule:
     - `[a]:global(,)div` becomes `[a]div`, and `.a:global(,)*` becomes `.a*`,
       although the protocol says a type or universal selector placed by
       wrapper removal is rejected.
     - `:global(,), .b` becomes `, .b`, so browsers drop the whole rule,
       including the valid `.b`.
     - `.a > :global(,) + .b` becomes `.a >  + .b`.
     - `:global(,)` and `:global(/* TODO */)` produce an empty selector.
   - The protocol mentions only an empty `@scope` limit failing. An empty start
     group also fails, and an empty rule selector ships unchanged.
   - Impact: a leftover empty wrapper silently removes a rule, sometimes with
     its valid neighbours. The input is unlikely, but this is a regression.
   - Options: A) fail Build for any all-empty wrapper, as an empty `@scope`
     group already does, and delete the three special cases; B) keep accepting
     them but check what removal leaves: treat the next node as attached, fail
     on an empty selector or item, and compare combinators one to one; C)
     document it.
   - Recommended: A. An all-empty wrapper never means anything, and removing
     the special cases closes the whole class. It changes cases that the new
     tests accept (`.w :global(,)` currently becomes `.w`), so it needs the
     user's agreement. B is the fallback.

   Resolved in `266164b`: all-empty `:global()` and `:local()` wrappers now
   fail before scoping, with the authored rule or `@scope` location.

3. **Low — the "independent" plugin matrix cannot detect the check accepting a
   wrong result.**
   - What happens: the test helper runs Mokly's own plugin loader and `@scope`
     handling, and `scopeModule` returns exactly that plugin output. The CSS
     and class-map equality assertions therefore always hold unless the build
     fails.
   - Evidence: with the check replaced by a no-op, both matrix tests fail only
     at the first hand-written reject case. No assertion on an accepted case
     can fail. The test titles and the Milestone 23 record call the matrix
     independent. It only shows that the check does not reject the listed
     plugin outputs, which is why finding 1 passed it.
   - Impact: a later edit can make the check accept changes in meaning while
     every matrix test stays green, and the record overstates the evidence.
   - Options:
     - A) Add an independent oracle. For accepted cases without wrappers,
       Chrome's parsed selector text for the delivered rule, with the prefix
       removed, must equal the authored one. For wrapper cases, derive the
       expected selector from the documented join rule in the test. Add
       trailing and empty items with whitespace in every pseudo-class
       context, and a seeded random generator.
     - B) Rename it a "no false rejection" test, drop the always-true
       assertions and correct the record.
     - C) Leave it.
   - Recommended: A. The repository already runs Chrome tests, and a scratch
     version of this oracle found finding 1 in seconds.

   Resolved in `266164b`: a seeded Chrome oracle checks 281 cases against
   browser-parsed selectors; the plugin matrix is now named and asserted only
   as no-false-rejection evidence. The oracle records 102 cases Chrome drops
   on both sides separately because neither has selector text to compare.

4. **Low — the PR draft and the Styles guide describe the join rule and its
   safety net too broadly.**
   - The PR draft says newly fused names and invalid compounds fail Build. The
     implemented rule is narrower: fused names, and a type or universal
     selector newly placed after another simple selector. For example,
     `.w :global(::before,.x)` builds as `::before.x`, which Chrome drops. It
     failed before the change. The protocol states the narrow rule correctly.
   - The guide ties the descendant result to a space after the comma, but
     whitespace before the comma or a line break also gives a descendant
     (`.wrap :global(.x ,.y)` becomes `.x .y`). "Empty items are ignored" is
     not true in finding 1's trailing case.
   - Impact: authors get a wrong rule of thumb, and the release text claims a
     guarantee that Build does not give.
   - Options: A) state the implemented rule exactly once findings 1 and 2 are
     decided, and back each documented example with a table-driven Build
     test; B) reject every newly invalid compound, including a pseudo-element
     that is no longer last, so the PR draft becomes true.
   - Recommended: A, and consider B together with finding 1. The protocol page
     is at 245 of its 250 lines, so these fixes probably need the CSS Modules
     verification text moved to its own protocol page.

   Resolved in `266164b`: the protocol, Styles guide and PR draft state the
   authored-whitespace, empty-wrapper and narrow invalid-compound rules.
   Table-driven Build tests pin each documented selector or exact diagnostic.

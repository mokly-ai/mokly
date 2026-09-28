# Imported CSS Delivery Milestone 21 Review

## Scope And Outcome

This review covers [Imported CSS Delivery](../../plans/imported-css-delivery.md)
Milestone 21. It ran on 2026-09-28 after `66d7ee6` was pushed, using
[the implementation review prompt](../implementation-review-prompt.md) against
`origin/main`. Two read-only reviewers examined the changes since `63b1383`:
`9bab3d7` (Milestone 20) and the `66d7ee6` bookkeeping. Milestone 20 fixed
Milestone 19 finding 1 with the user's chosen options: Mokly now localizes
`@scope` start and limit selectors itself (A), and a check compares every
scoped CSS Module with its input and fails Build when anything other than
local names changed (C). One reviewer covered code and runtime behaviour; the
other covered the contract, docs, dependencies and bookkeeping. Findings that
remain open in earlier records are not repeated.

The fix works for the case it targeted:

- `@scope` with class names containing "to" builds and renders like plain CSS
  in Chrome, across about 70 prelude shapes: keyword case, comments, strings,
  escapes, selector lists, `:global(...)`, nesting in rules and conditional
  at-rules, and repeated `@scope`.
- 40 framework stylesheets, 167 local CSS files and Tailwind v4 output give
  byte-identical results before and after the change, and a 316-file sweep
  found no other false positives.
- Removing A fails 28 tests and removing C fails 2.
- The two new direct dependencies install once each, are MIT-licensed, pass
  the audit, package check and six packed-consumer scenarios, and load only
  when a CSS Module is scoped.

One new fact affects open Milestone 19 finding 8 (scoping cost). The check
adds 32–67 % to scoping time per module: bootstrap 197 → 262 ms, primer
387 → 637 ms, a 3.6 MB Tailwind 2.2 build 2.88 → 4.04 s, and 300 generated
modules 1.69 → 2.23–2.34 s. Most selectors change, so nearly all of them are
parsed twice.

The eight findings below were reproduced in scratch copies. The parent session
found findings 1, 5 and 7 and independently confirmed findings 2 and 3. All
eight remain open for the user's decision.

## Findings

1. **Low — the check's error often points to the wrong rule.**
   - What happens: when the scoped output cannot be parsed again, for example
     after the plugin's `:local(auto)` leak, Mokly maps the parse error's line
     to a top-level input node starting on that line, or else to the first
     node.
   - Evidence:
     - In normally formatted CSS, `animation: grow-progress auto linear` on
       line 10 is reported at `1:1`, the first rule.
     - Minified CSS also reports the first rule.
     - Each `composes` on its own line shifts later lines, so the error names
       an innocent rule: `.title` at `5:1` instead of `.bar` on line 6.
     - Even when the line matches, the error names the rule, not the
       declaration.
   - The protocol has no rule for this path, and the tests use single-line CSS
     only.
   - Impact: users are sent to the wrong rule for the most common trigger.
   - Options: A) find the difference in the in-memory scoped tree, whose nodes
     keep the input's source positions, and keep the re-parse only as a final
     check; B) map output offsets back to input nodes; C) drop the location.
   - Recommended: A, with multi-line, minified and `composes` tests that assert
     exact locations. A removes the line-guessing path entirely.
2. **Low — the check fails valid CSS that built before.**
   - What happens: a renamed word is accepted only if it matches a narrow
     letters, digits, `-` and `_` pattern (`module_verify_value.ts:37`), which
     is narrower than CSS identifiers and the plugins' own rule.
     `global(...)` and `local(...)` match only in lower case and only around
     a bare word, and `:global( x )` spacing in keyframe names is not trimmed.
   - Reproductions, all of which built and animated at `63b1383`:
     `@keyframes --spin`, `fade\.in`, `\31 23`, `किरण`, `fade·in` and `🚀`;
     `animation: GLOBAL(spin) 1s`, `LOCAL(fade)` and `global("fade")`; and
     `@keyframes :global( fade )`. Each fails with "scoping would change more
     than local names" and the advice to move the CSS to a plain stylesheet.
   - The protocol never defines "valid identifier word".
   - Impact: working modules fail Build, mostly those with non-Latin, escaped
     or generated animation names. None of the 40 framework stylesheets or 167
     local CSS files hit it.
   - Options: A) one shared CSS identifier check (escapes, leading `--`,
     non-ASCII), case-insensitive wrappers, quoted `global("x")` and trimmed
     wrapper contents, defined in the protocol; B) reuse the plugins'
     identifier rule; C) document the limitation.
   - Recommended: A, plus a differential test: whenever removing the prefix
     from the plugin output gives back the input exactly, the check must
     accept. That test catches every case above and any future mismatch.
3. **Low — the docs overstate what the check guarantees, and its advice is
   sometimes wrong.**
   - What happens: the check compares structure, not which names were renamed.
     Any identifier in any value may gain the prefix, and a class may switch
     between global and local. The docs claim more:
     - The Styles guide says Mokly "checks that scoping changes no other
       authored CSS" and lists "two current cases" that trigger it.
     - `src/build/README.md`, plan Decision 5, the Milestone 19 record and the
       PR draft say any other rewrite fails Build.
     - The protocol says the `auto` rewrite fails Build rather than shipping
       invalid CSS.
   - Evidence:
     - `animation: global(grow-progress) auto linear` passes and ships
       `grow-progress mokly_…_auto linear` with a junk `auto` export. Chrome
       drops the declaration. This extends Milestone 19 finding 2.
     - `--enter-animation: fade-in 200ms` is renamed and accepted, and a test
       pins it, while the protocol says custom properties stay global. This is
       open Milestone 19 finding 4, and the protocol now contradicts itself.
     - There are more triggers than two: finding 2's cases, finding 5, and a
       selector list inside `:global()` or `:local()` such as
       `.wrap :global(.x, .y)`. The plugins turn that list into a descendant
       chain. It used to ship silently broken; it now fails with advice to
       drop scoping, although `.wrap :global(.x), .wrap :global(.y)` keeps it.
     - Moving the `auto` declaration to a plain stylesheet does not fix it on
       its own, because the module still renames the keyframes. The longhand
       `animation-duration: auto` works in a module.
   - Impact: users hit an error the guide says their CSS cannot cause and get
     advice that throws scoping away. Anyone deciding Milestone 19 findings 2
     and 4 gets a false picture of what the check protects.
   - Options: A) rewrite the claims to say exactly what is and is not checked,
     and replace "two current cases" with a maintained list of triggers and
     specific fixes, backed by a table-driven Build test; B) A, plus a
     catalogued error, raised before scoping, telling the author to split a
     selector list inside `:global()` or `:local()`; C) allow prefixed words
     only in `animation`, `animation-name` and keyframe names, decided
     together with Milestone 19 findings 2 and 4.
   - Recommended: B now, and C within the Milestone 19 finding 2 and 4
     decision.
4. **Low — tests do not pin most of the check's rules or the placeholder
   position.**
   - What happens: a reviewer applied 49 single-rule mutations and ran the 13
     CSS Modules test files. 15 of the check's 27 rules can be removed without
     any test failing, for example:
     - a prefix on a non-class selector node, or a leftover `:local(...)`;
     - attribute, quote or namespace changes in selectors;
     - changed function arguments such as `rgb(1,2,3)` becoming `rgb(1,2,4)`;
     - node type, property or at-rule name changes, or extra output nodes;
     - changed `@scope` text outside or inside the groups.
   - Moving the temporary rules after the `@scope` rule breaks
     `@scope (.a) { .x { composes: a } }`, and no test fails. The `to`
     adjacency check in `module_scope.ts:31-37` can never change the result.
   - Impact: a later edit can silently weaken the safety net the user chose,
     and the repository requires full test coverage.
   - Options: A) table-driven reject tests, one per rule in the protocol's
     verification paragraph, plus composition tests in the `@scope` body and
     in nested contexts; B) A, plus a scoped mutation-testing run, for example
     StrykerJS on `module_scope.ts` and `module_verify*.ts`, recorded in the
     plan or run in CI; C) leave as is.
   - Recommended: B. Line coverage cannot show which rules nothing asserts.
5. **Low — a top-level `@scope` with a bare `animation` declaration fails
   Build.**
   - What happens: while `@scope` is hidden, local-by-default treats it as an
     ordinary at-rule and marks a bare declaration such as `animation: spin 1s`
     as `:local(spin)`. postcss-modules-scope renames those markers only
     inside rules, so the marker leaks and the check rejects it. The same
     happens inside a top-level `@media` or `@layer`; inside a style rule it
     works.
   - This is not worse than before: `63b1383` shipped silently broken output,
     and on `origin/main` esbuild produced a bogus nested rule.
   - Impact: bare declarations in `@scope`, which are valid CSS, cannot use
     local animations, and the guide does not list this trigger.
   - Options: A) during hiding, keep bare declarations out of the ordinary
     at-rule path, for example by moving them into a temporary rule and back;
     B) document it as a trigger; C) reject bare animation declarations in
     `@scope` with a specific message.
   - Recommended: A, with tests at the top level and inside `@media` and
     `@layer`.
6. **Low — the condition for removing Mokly's `@scope` handling is wrong.**
   - What happens: the protocol, the Milestone 19 record and the plan
     follow-up say to remove it once the upstream fixes (issues #90 and #68,
     PRs #91 and #69) are released. A reviewer applied both PR patches and
     disabled Mokly's handling:
     - `(:global(.photo) .button)` and similar lists leak `:local(`. This is
       the second bug in #68, which PR #69 does not fix despite saying "Fixes
       #68".
     - Classes named only in a prelude can no longer be composed.
     - `TO` is lowercased and spacing is normalized, which fails the check.
     - With comments between the groups, PR #91 only warns, and `.button`
       silently stays global.
   - Impact: following the plan would bring these failures back. The
     Milestone 20 tests would catch them, so the main cost is a misleading
     plan.
   - Options: A) reword the condition in all three places: remove the handling
     only when upstream releases pass the `@scope` tests with Mokly's handling
     disabled; B) also tell upstream that PR #69 leaves the second bug in #68
     unfixed, which is outward-facing and needs the user's approval; C) make
     the handling permanent.
   - Recommended: A, plus B if the user approves posting upstream.
7. **Low — comments inside selectors, values and `@scope` preludes are
   dropped, contrary to the docs.**
   - What happens: PostCSS moves these comments out of the fields the plugins
     rewrite, so a renamed selector, value or prelude loses them:
     `.a /* c */ .b`, `animation: fade /* c */ 1s` and
     `@scope /* c */ (.a) to /* d */ (.b)`. The check compares the cleaned
     fields and cannot see the loss. The selector and value cases predate
     Milestone 20.
   - The protocol says comments are exact and every prelude character outside
     the groups is preserved. The Styles guide and `src/build/README.md` say
     comments are not rewritten.
   - Impact: docs only. esbuild drops these inline comments from plain and
     module bundles alike, including `/*! … */`, so delivered CSS is the same.
   - Options: A) correct the protocol, guide and README; B) preserve the raw
     selectors and params, which is more code with no delivered benefit.
   - Recommended: A.
8. **Low — wording errors in the plan index and the PR draft.**
   - `plans/README.md` says "as do the Milestone 19 review" (missing "findings
     in"), and "resolves finding 1" does not say which review, right after a
     sentence that cites Milestone 17 finding numbers.
   - The ignored PR draft calls a malformed prelude "unsupported" and says it
     fails with plain-stylesheet guidance. The error actually says "use an
     optional (start) and/or to (limit)".
   - Options: A) fix the plan index now and the draft when the Milestone 19
     finding 3 commit override is written; B) leave them.
   - Recommended: A.

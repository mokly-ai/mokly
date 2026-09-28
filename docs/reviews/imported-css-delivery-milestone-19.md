# Imported CSS Delivery Milestone 19 Review

## Scope And Outcome

This review covers [Imported CSS Delivery](../../plans/imported-css-delivery.md)
Milestone 19. It ran on 2026-09-28 after `5bd3f56` was pushed, using
[the implementation review prompt](../implementation-review-prompt.md) against
`origin/main`. Two read-only reviewers examined the changes since `b7179d2`:
`3aa7d67` (Milestone 18), which replaced Lightning CSS scoping of CSS Modules
with the rename-only PostCSS CSS Modules plugins that css-loader and Vite use,
and the `5bd3f56` bookkeeping. One reviewer covered code and runtime behaviour;
the other covered the contract, docs, dependencies and bookkeeping. Findings
that remain open in earlier records are not repeated, except where this change
adds new facts (finding 3).

The change works for the cases it targeted:

- Plain and module stylesheets are byte-identical apart from scoped names
  across the tested feature matrix, including fallbacks, vendor prefixes,
  `:dir()`, `light-dark()`, conditional `@import`s and `image-set()`. 62 real
  CSS files also matched.
- Re-printing module CSS through Lightning CSS fails 13 of 18 equivalence
  scenarios, and the Chrome computed-style test catches target-driven rewrites.
- Scoped names are identical across working directories and through a
  symlinked repository root, and the graph and stylesheet passes share one
  result.
- Licences match the docs, `npm run dependencies:check` reports no
  vulnerabilities, the package check and packed-consumer smokes pass, and a
  consumer with conflicting plugin versions still gets Mokly's own copies.
- The example Welcome screen renders correctly in Chrome in both colour schemes
  and both viewports.

The nine findings below were reproduced in scratch copies. The parent session
independently confirmed findings 1, 2, 6 and 7 and the animation, custom
property, view-transition and composition rules in finding 4. Finding 1 is
resolved in `9bab3d7`; finding 2 is partly mitigated, and the other findings
remain open for the user's decision.

Findings 1, 2 and 4 share one cause. The plugins find names with text
heuristics instead of a CSS parser. Milestone 20 now verifies that their
output changed only documented local names; unresolved semantic cases remain
in findings 2 and 4.

## Findings

1. **Medium — `@scope` rules in CSS Modules are silently broken.**
   - What happens: both plugins split the `@scope (...)` prelude on the letters
     "to" wherever they appear, so class names such as `.button`, `.tooltip`,
     `.bottom`, `.photo`, `.toast` or `.custom` are cut apart.
   - Reproductions (Build and Chrome 153):
     - `@scope (.button) {…}` becomes `@scope (.mokly_…_bu) to () {…}`, and the
       class map gains a junk `bu` key. Chrome drops the whole block; the plain
       copy works.
     - `@scope (.tooltip) to (.footer)` becomes
       `@scope () to (ltip) to (.mokly_…_footer)`.
     - `@scope (:global(.photo))` fails Build with "unsupported CSS Modules
       syntax" at `1:1`.
   - The pre-change build (`b7179d2`) handled all three. Both plugins are at
     their latest releases, and Vite has the same bug. No test uses `@scope` in
     a module.
   - Impact: renaming a stylesheet to `.module.css` silently deletes its
     `@scope` styling, which breaks the documented promise that plain and
     module CSS differ only in scoped names.
   - Options:
     - A) Handle `@scope` in Mokly: hide the at-rule from the plugins and
       localize its selectors with the same names, for example by running each
       prelude selector through the plugins as a temporary rule so rule and
       `@scope` selectors follow one set of localization rules.
     - B) Reject `@scope` in modules with a catalogued error.
     - C) Add a rename-only check after scoping: the output must equal the
       input once scoped-name prefixes and the documented `:global`, `:local`,
       `composes` and `global()` removals are undone. Any other difference
       fails Build with the file and location.
     - D) Fix the plugins upstream and adopt the release.
   - Recommended: A plus C, with plain-versus-module and Chrome parity
     scenarios whose `@scope` selectors contain "to". A restores what worked
     before; C turns every future plugin rewrite into a Build failure instead
     of broken CSS. D is a useful non-blocking follow-up.

   Resolved in `9bab3d7`: Mokly localizes `@scope` preludes outside the plugins
   (A) and verifies rename-only output (C). Remove Mokly's temporary handling
   after fixed releases for [local-by-default #90](https://github.com/css-modules/postcss-modules-local-by-default/issues/90)
   ([PR #91](https://github.com/css-modules/postcss-modules-local-by-default/pull/91))
   and [scope #68](https://github.com/css-modules/postcss-modules-scope/issues/68)
   ([PR #69](https://github.com/css-modules/postcss-modules-scope/pull/69)).

2. **Medium — several valid animation forms lose their animation in CSS
   Modules.**
   - What happens: the plugin guesses which word in an `animation` value is the
     name, applies the shorthand's keyword rules to `animation-name` as well,
     and pastes the prefix onto quoted keyframe names.
   - Reproductions (Build and Chrome 153):
     - The scroll-driven `animation: grow-progress auto linear` is delivered as
       `animation: mokly_…_grow-progress :local(auto) linear`. The declaration
       is invalid, so no animation runs, and internal `:local()` syntax ships
       in the CSS.
     - `animation-name: ease` (also `paused`, `both`, `infinite`, `forwards`
       and similar names) stays bare while `@keyframes ease` is renamed.
     - `@keyframes "pulse"` becomes the invalid `@keyframes mokly_…_"pulse"`,
       and the class map gains a `"pulse"` key. Changes' rule parser then
       reports the whole stylesheet as unresolved.
   - The pre-change build handled all three.
   - Impact: animations, including scroll-driven ones, vanish silently.
   - Options:
     - A) Handle `animation` and `animation-name` in Mokly: in the longhand
       every identifier or string is a name; the shorthand keeps css-loader's
       keyword counting plus `auto` and strings; honour `global()` and
       `local()`; always generate valid identifiers; leave custom properties
       alone (see finding 4).
     - B) Fail Build when `:local(` or `:global(` survives, or a generated name
       is not a valid identifier. This catches the first and third cases only.
     - C) The rename-only check from finding 1, plus a check that every
       `animation-name` naming a local `@keyframes` was renamed.
     - D) Document the limitations.
   - Recommended: A plus C, with a parity scenario for each form.

   Partly mitigated in `9bab3d7`: the scroll-driven shorthand using `auto`
   and quoted `@keyframes "pulse"` now fail Build with plain-stylesheet
   guidance. `animation-name: ease` still passes silently; this finding stays
   open.

3. **Low, but must be handled before merge — the release notes would state a
   false and incomplete breaking change.** This extends Milestone 17 finding 10.
   - What happens: `main` squash-merges with every commit message in the body,
     so the `BREAKING CHANGE:` footer in `0ce4f20` reaches release-please. Its
     sentence saying CSS Modules use consumer Browserslist targets or fixed
     defaults has been false since `3aa7d67`.
   - `3aa7d67` also adds breaks compared with `origin/main`, where esbuild
     built the class maps (confirmed with esbuild 0.28.1):
     - a forward same-file `composes` now fails Build;
     - authored `@value`, `:import(...)`, `:export` and `@icss-*` rules now
       fail Build;
     - `@counter-style` and container names are no longer renamed or exported.
   - The ignored PR draft acknowledges the false sentence but has no override,
     and its "delivered as authored" line is contradicted by findings 1 and 2.
     It still omits two items from Milestone 17 finding 10: a local `@import`
     after rules now fails Build, and derived-mode repositories must Git-ignore
     `mokly-generated/`.
   - Impact: the published changelog would describe Browserslist behaviour that
     does not exist and miss breaks users will hit.
   - Options:
     - A) When the PR is opened, put one corrected
       `feat!: deliver imported CSS across Mokly` message between
       `BEGIN_COMMIT_OVERRIDE` and `END_COMMIT_OVERRIDE` in the PR body. Its
       `BREAKING CHANGE:` footer is written against `origin/main`, lists every
       item above and has no Browserslist sentence. Add a required pre-merge
       plan TODO, because the draft is Git-ignored.
     - B) Edit the squash message in the merge dialog. This leaves no record
       and is easy to forget.
     - C) Amend `0ce4f20` and force-push. This breaks the many review-record
       references to that commit.
     - D) Add a follow-up footer. It cannot retract the false sentence.
   - Recommended: A, which also resolves Milestone 17 finding 10, plus a PR
     checklist step that audits user-visible changes against `origin/main`
     rather than branch history.

   Milestone 20 adds another break relative to `origin/main`: a CSS Module
   that cannot be scoped without changing other authored CSS now fails Build
   (including the two animation forms above). Finding 3 remains open; no
   commit override or new breaking-change footer was added in `9bab3d7`.

4. **Low — the CSS Modules contract misstates rules the plugins now apply.**
   The protocol and the Styles guide differ from the code:
   - Every name in an `animation` or `animation-name` value is renamed and
     exported, even without a local `@keyframes`. A module using a global
     keyframe from the renderer or Tailwind (`animation: spin 1s`) silently
     breaks. Writing `global(spin)` keeps it global, but that is not
     documented, and Milestone 18 removed the sentence saying undefined names
     are localized.
   - Custom properties whose names end in `animation` or `animation-name` have
     their values renamed: `--enter-animation: fade-in 200ms` becomes
     `mokly_…_fade-in` and adds a junk `fade-in` export.
   - `::view-transition-group(*.card)` is scoped while
     `view-transition-class: card` stays global, so the two never match. The
     `*:global(.card)` workaround is not documented.
   - The protocol says composition cycles are impossible, but
     `.a{} .b{composes:a} .a{composes:b}` builds and exports
     `a: "…a …b …a"`. The old cycle error was deleted.
   - Not written down: what "defined earlier" means, that `composes` works
     inside `@media` but not inside nested rules, that a composed value is a
     snapshot, and that `@icss-import` and `@icss-export` are rejected.
   - Impact: an implementer following the protocol would produce different
     class maps, and users get no warning about the global-keyframe pitfall.
   - Options: A) specify each rule in the protocol, put the user-facing parts
     and the `global()` workarounds in the guide, and pin each rule with a
     table-driven test whose cases copy the protocol text; B) change the
     behaviour to match the current text, diverging from css-loader; C) name
     the pinned plugin versions as the normative definition.
   - Recommended: A, written after findings 1 and 2 are decided, because
     Mokly-owned animation handling changes some of these rules. The
     table-driven test makes a plugin upgrade that changes behaviour fail CI.
5. **Low — CSS Module errors point to the wrong line, give the wrong reason,
   or change format.**
   - `:global .a, .b {}` or `.a:global .b {}` on line 2 reports
     `…:1:1: unsupported CSS Modules syntax`, although the plugin's error
     carries the real position.
   - `.x { .y { composes: a } }` says `composes` requires a single local class;
     the real cause is the nesting.
   - An unclosed block reports `card.module.css:2:1: Unclosed block` without
     consumer PostCSS but `card.module.css: 2:1: Unclosed block` with it, and
     the error catalogue files the second as a plain CSS or transformer error.
   - Impact: authors are sent to the wrong line with no explanation, and the
     catalogue is not exact.
   - Options: A) one shared location formatter for every CSS error path, the
     plugin's position before a `1:1` fallback, catalogued plain-language
     messages for known plugin errors (mixed global and local selectors,
     missing whitespace, nested composition), and table-driven tests asserting
     message and location with and without PostCSS; B) only relabel catalogue
     rows and drop the fake `1:1`; C) leave as is.
   - Recommended: A. The shared formatter stops the two error paths drifting
     apart again.
6. **Low — whether a CSS Module builds depends on the working directory.**
   - What happens: `scopeModule` parses without `map: false`, so PostCSS
     follows a `sourceMappingURL` comment and reads the map file relative to
     the process working directory.
   - Reproduction: a module ending in `/*# sourceMappingURL=fixture.map */`,
     with an unsupported map file beside it, fails with "unsupported CSS
     Modules syntax" at `1:1` when Build runs from the repository root and
     succeeds from `/`. The same file as plain CSS always builds. A bad inline
     map fails everywhere. Passing `map: false` fixes every case.
   - Impact: results depend on where Build runs, and Mokly reads a file it
     neither inventories nor watches, then reports a misleading error.
   - Options: A) pass `map: false`; B) A, plus one internal helper for Mokly's
     own PostCSS parse and process calls that always disables source-map
     loading, with tests for a sibling map, a bad inline map and a changed
     working directory.
   - Recommended: B, so no future internal PostCSS call can forget the option.
7. **Low — every command, including `--help`, loads the Lightning CSS native
   package, contrary to the protocol.**
   - What happens: the protocol says the CLI does not load Lightning CSS
     eagerly, but `src/review/css/lightning.ts` requires it as soon as it is
     imported, and the CLI imports it at startup. With the native package
     hidden, `mokly --help` exits 1.
   - `tests/cli_module_boundaries.test.ts` only watches ESM resolution, so it
     cannot see `createRequire` loads. The eager load predates this branch, but
     the claim was written on it and restated in `3aa7d67`. The CSS Modules
     plugins really are loaded lazily.
   - Impact: every command depends on the optional native package, the
     protocol is wrong, and the test gives false confidence.
   - Options: A) correct the sentence; B) load Lightning CSS lazily, as
     `src/build/styles/lightning.ts` does, and extend the boundary test to
     catch CommonJS loads of Lightning CSS, the CSS Modules plugins and other
     lazily loaded packages.
   - Recommended: B. The extended test protects every package that Mokly loads
     through `createRequire`.
8. **Low — CSS Module scoping is about five times slower per rule and repeats
   on every rebuild.**
   - Measurements: about 75 µs per rule against 13 µs with Lightning CSS; a
     full compile of 300 modules with 40 rules each takes 2.0–2.4 s against
     1.4–1.5 s. About 45 % of scoping time is selector cloning inside the
     plugins. The cache lasts one graph load, so every watched rebuild rescopes
     unchanged modules, and no scale test exists.
   - Impact: slower Build and Serve rebuilds for catalogues with many modules.
   - Options: A) cache results for the whole process, keyed by relative path
     and a SHA-256 of the processed text, with a test that recompiling
     unchanged modules does no scoping (counted with a mock, not timed);
     B) write a lighter Mokly-owned scoper; C) accept the cost and add a scale
     test.
   - Recommended: A. `scopeModule` depends only on those two inputs, so the
     cache is safe.
9. **Low — two older review notes still name the removed `image-set()`
   restorer as the fix.** In the [main review record](./imported-css-delivery.md),
   the resolution notes for final-review finding 4 (`b197b0c`) and Milestone 12
   finding 1 (`d474975`) describe a restore pass that `3aa7d67` removed; only
   the Milestone 14 record says it was superseded. Options: A) add the same
   "Superseded in `3aa7d67`" note to both; B) leave them and add a plan caveat.
   Recommended: A, matching the convention in the Milestone 14 record.

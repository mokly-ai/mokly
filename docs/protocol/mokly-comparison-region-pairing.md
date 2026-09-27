# Comparison Region Pairing

## Delivery Status

The [comparison pane scroll alignment plan](../../plans/comparison-pane-scroll-alignment.md)
delivered this pairing in Milestone 7. It decides which inner scroll region of
another version follows a region the reader scrolls, under the
[comparison scrolling contract](./mokly-comparison-scrolling.md#inner-scroll-regions),
which defines regions, their axes, and how a pair is written. The runtime
implements it in `packages/viewer/src/shell/comparison_region_identity.ts`,
`comparison_region_match.ts`, and `comparison_region_mirror.ts`.

## Counterpart Algorithm

For each source region and other pane document, cache one counterpart or no
match. On the region's first scroll after measurement, apply the rules below
in order and stop at the first unambiguous result. Keep that result until the
next measurement. An accepted match reserves the target and records the reverse
association so one target cannot serve two source regions. A target already
reserved for another source, or already found to have no counterpart in the
source's document, is ineligible, so a pairing never depends on which version
the reader scrolled first. Switching Scroll together on also resolves unmatched
regions as the
[Scroll together contract](./mokly-comparison-scroll-together.md#realignment)
describes.

`data-mokly-scroll="off"` on the source prevents matching. A target carrying
that exact value is ineligible under every rule, as is a target that does not
scroll on every axis the source scrolls on. Otherwise apply:

1. **Authored name.** If the source has a valid `data-mokly-scroll` value,
   select the one region with the exact same value in the other document. The
   value grammar is `^[a-z0-9]+(?:-[a-z0-9]+)*$`, the public id grammar, with
   `off` reserved as above. Matching is case-sensitive. Whitespace, an empty
   value, or any other malformed value acts as no name. If either document has
   more than one region with that name, the name is ambiguous and this rule is
   skipped. Attributes on non-region elements are ignored and do not make a
   duplicate. If only one version carries the name, continue to rule 2. The
   build does not reserve, validate, or transform this attribute; its existing
   use on viewer-shell history regions is in a separate document scope.
2. **HTML id.** If the source has a nonempty `id`, select the region with the
   exact same id only when that id belongs to exactly one region in each
   document. Duplicate region ids make this rule ambiguous, so continue.
3. **Role and accessible name.** Form the `(role, name)` key below. Select the
   candidate with the same key only when that key occurs on exactly one region
   in each document; otherwise continue.
4. **Scored fallback.** Score every remaining eligible candidate. Select the
   highest only when its score is at least `0.45` and either it has no runner-up
   or it leads the runner-up by at least `0.15`. A tie or smaller lead is no
   match.

Duplicate and uniqueness counts include every region with the identity, even
one that is off, axis-incompatible, or already reserved. The selected element
must separately be eligible; otherwise skip that rule. This conservative rule
follows the invariant that a wrong pair is worse than no pair. Class names and
DOM-tree positions are never matching inputs.

## Role And Accessible Name

The exact supported roles are `main`, `navigation`, `complementary`, `region`,
`dialog`, `log`, `feed`, `list`, `listbox`, `grid`, `table`, `tabpanel`, and
`tree`. A `role` attribute with at least one ASCII-whitespace-separated token
uses its first token, ASCII-lowercased, only when that token is in this list; an
unsupported explicit role has no role key. An absent, empty, or whitespace-only
`role` falls back to the implicit role: `main` maps to `main`, `nav` to
`navigation`, `aside` to `complementary`, `dialog` to `dialog`, `ol`, `ul`, and
`menu` to `list`, and `table` to `table`. A `section` maps to `region` only when
the name algorithm below is nonempty. Other elements have no implicit role.

When `aria-label` is present, its trimmed value with every run of JavaScript
`\s` whitespace collapsed to one space is the accessible name, including when
that result is empty. Otherwise split `aria-labelledby` on ASCII whitespace,
resolve each id in order within the same document, join each target's
`textContent` with one space, then trim and collapse whitespace the same way.
Missing targets contribute no text. An empty name is valid for another role,
so one unnamed `main` can pair with one unnamed `main`; uniqueness still
applies in both documents. Name equality is exact after this normalization.

## Scored Fallback

For source `s` and candidate `c`, calculate:

```text
score = min(1, 0.55 * overlap(s, c) + 0.45 * text(s, c) + nameBonus)
nameBonus = 0.10 when s.localName === c.localName, otherwise 0
```

`overlap` is intersection-over-union of the two axis-aligned border boxes.
Convert each `getBoundingClientRect()` to document coordinates by adding that
document scrolling element's current `scrollLeft` and `scrollTop`; a zero-area
union scores zero.

A text fingerprint is a set of words. Read every descendant `h1`-`h6` and
element whose first normalized role token is `heading` in tree order, followed
by the region's own `textContent`. Lowercase each with `toLowerCase()` and
tokenize it into Unicode runs of `\p{L}` or `\p{N}`; the region's own text
contributes only its first 200 runs, counted before short runs are dropped.
Then discard tokens shorter than two Unicode code points and deduplicate.
`textContent` joins adjacent elements' text without a separator, so words on
either side of an element boundary can form one token; both versions read their
markup the same way. `text` is the Jaccard index, intersection size divided by
union size; two empty sets score zero.

Comparisons with the minimum and the margin allow a `1e-9` tolerance, so a
boundary such as `0.45 - 0.30` counts as the full `0.15` despite binary
floating point.

| Situation                                               | Governing values                       | Result                                |
| ------------------------------------------------------- | -------------------------------------- | ------------------------------------- |
| Same unique authored name; ids disagree                 | Rule 1                                 | Pair by authored name                 |
| Authored name duplicated; same unique id                | Rule 1 skipped, rule 2 unique          | Pair by id                            |
| Name only on source, no ids, unique equal role/name     | Rules 1-2 unavailable                  | Pair by role/name                     |
| Either proposed side is `off`                           | Excluded before matching               | Do not pair                           |
| Source scrolls on x and y; candidate on y only          | Candidate fails the axis rule          | Do not select that candidate          |
| Same place, rewritten text, different element names     | overlap `0.90`, text `0`: `0.495`      | Pair if runner-up is at most `0.345`  |
| Moved, identical text, different element names          | overlap `0`, text `1`: `0.45`          | Pair if runner-up is at most `0.30`   |
| Two candidates fall within the margin                   | best `0.64`, runner-up `0.53`          | Do not pair; lead is only `0.11`      |
| Weak overlap and text, even with the element-name bonus | overlap `<0.20`, text `<0.20`: `<0.30` | Do not pair; below the `0.45` minimum |

Because every eligible candidate is scored, a region whose identity would pair
it with another source by rules 1 to 3 still competes in a source's fallback
until it is reserved; the minimum and margin keep such a competitor from being
selected unless it clearly wins.

## Acceptance

`packages/viewer/tests/comparison_region_identity.test.ts` proves the name
grammar, roles, accessible names, and fingerprints;
`comparison_region_match.test.ts` proves every rule in order, uniqueness
counts, ineligible picks, and each row of the table above; and
`comparison_region_mirror.test.ts` proves caching, reservations, the reverse
pair, and matching afresh after a measurement. In the browser,
`tests/browser/comparison_regions.spec.ts` pairs an app shell's panels by
authored name, id, landmark and label, and text alone, and leaves an ambiguous,
an `off`, and a new panel unpaired.

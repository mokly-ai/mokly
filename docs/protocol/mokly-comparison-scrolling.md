# Comparison Scrolling

## Delivery Status

The [comparison pane scroll alignment plan](../../plans/comparison-pane-scroll-alignment.md)
delivered the page-scrolling rules in Milestone 4. Milestone 5 defines the
approved inner-region, key, anchor, and reader-control target below; Milestone 6
will depict it and Milestone 7 will implement and prove it. Until then, the
runtime retains the plan's recorded inner-region limitation.

This contract owns every scroll interaction in the Before and Current panes
defined by the [pane presentation contract](./mokly-comparison-panes.md).
Removed previews keep their independent in-frame scrolling and are unchanged.

## Page Scroller

Each comparison frame stays exactly the size of its device viewport. Viewport
units, `position: fixed`, and `position: sticky` therefore resolve as in
Current, and a document's size never depends on its measured size. The chrome
viewport is the only page-level scroll container for its panes; inner regions
defined below remain scrollable in their own right. Frames carry
`scrolling="no"` and are scrolled only by the viewer.

A sticky box at the viewport's top-left, exactly its width and height, holds
the device-sized frames. A spacer after that box extends each viewport to the
section's largest document range. Its height is the largest
`scrollHeight - clientHeight`; its width is the viewport width plus the largest
`scrollWidth - clientWidth`. Side by side gives both spacers this pair maximum,
so their ranges match. The viewport sets `overflow-anchor: none`.

The viewer measures a document when it commits, one animation frame after its
predecessor's window hides and before slow resources finish, and again on its
`load`. After parsing, a parent-realm `ResizeObserver` watches the root and body;
captured resource loads, font completion, and `<details>` toggles also schedule
measurement on the next animation frame. Measurement updates every spacer and
reapplies the current page offset. No frame dimension depends on the result, so
measurement cannot feed back into the document. Every measurement also
discards all positive and negative inner-region matches for that section.

## Page Writes And Echoes

With Scroll together on, every chrome-viewport scroll writes its `scrollLeft`
and `scrollTop` to every layer document in that section in the same handler.
Side by side first mirrors its two chrome viewports in both directions. The
off behavior is defined under [Reader Control](#reader-control). Every page
write uses `scrollTo({ behavior: "instant", left, top })`, regardless of CSS `scroll-behavior`.

A shorter or narrower document clamps at its own range. Its frame is translated
back by the unmet x and y remainder, without changing the snapshot document, so
content before its end stays aligned. The revealed surface uses the document
canvas color: the computed root background, or the body background when the
root is transparent, over the selected scheme's opaque screen background.

A document scroll the viewer did not make, including find in page, focus,
selection autoscroll, or fragment behavior, is written back to its chrome
viewport first and then applied under the current Scroll together mode. Loops
are value-based, never timer-based: after a write, the controller records the
offset at which each scroller actually settled; an event reporting exactly
that x/y pair is the write's echo and is ignored. A different value is a new source scroll.

## Inner Scroll Regions

An inner scroll region is an `Element`, other than the document's
`scrollingElement`, whose computed `overflow-x` or `overflow-y` is exactly
`auto` or `scroll`. Its x range is `max(0, scrollWidth - clientWidth)` and its y
range is `max(0, scrollHeight - clientHeight)`. A region is scrollable on an
axis only when that axis has one of those overflow values and a positive range.

When a region scrolls for any reason, the viewer resolves one counterpart in
every other version of the same section. A candidate must be scrollable on
every axis on which the source region has a positive range. A source with both
x and y range therefore cannot pair with a y-only candidate; a y-only source
may pair with a candidate that also has x range. Both offsets are still written together.

## Counterpart Algorithm

For each source region and other pane document, cache one counterpart or no
match. On the region's first scroll after measurement, apply the rules below
in order and stop at the first unambiguous result. Keep that result until the
next measurement. An accepted match reserves the target and records the reverse
association so one target cannot serve two source regions. A target already
reserved for another source is ineligible. Switching Scroll together on also
resolves unmatched regions as described under [Reader Control](#reader-control).

`data-mokly-scroll="off"` on the source prevents matching. A target carrying
that exact value is ineligible under every rule. Otherwise apply:

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

### Role And Accessible Name

The exact supported roles are `main`, `navigation`, `complementary`, `region`,
`dialog`, `log`, `feed`, `list`, `listbox`, `grid`, `table`, `tabpanel`, and
`tree`. A nonempty `role` attribute uses its first ASCII-whitespace-separated
token, ASCII-lowercased, only when that token is in this list; an unsupported
explicit role has no role key. Without one, map `main` to `main`, `nav` to
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

### Scored Fallback

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
by the first 200 words of the region's own `textContent`. Lowercase with
`toLowerCase()`, tokenize with Unicode runs `\p{L}` or `\p{N}`, discard tokens
shorter than two Unicode code points, and deduplicate. `text` is the Jaccard
index, intersection size divided by union size; two empty sets score zero.

| Situation                                               | Governing values                       | Result                                |
| ------------------------------------------------------- | -------------------------------------- | ------------------------------------- |
| Same unique authored name; ids disagree                 | Rule 1                                 | Pair by authored name                 |
| Authored name duplicated; same unique id                | Rule 1 skipped, rule 2 unique          | Pair by id                            |
| Name only on source, no ids, unique equal role/name     | Rules 1-2 unavailable                  | Pair by role/name                     |
| Either proposed side is `off`                           | Excluded before matching               | Do not pair                           |
| Source has x/y range; candidate has y range only        | Candidate fails axis rule              | Do not select that candidate          |
| Same place, rewritten text, different element names     | overlap `0.90`, text `0`: `0.495`      | Pair if runner-up is at most `0.345`  |
| Moved, identical text, different element names          | overlap `0`, text `1`: `0.45`          | Pair if runner-up is at most `0.30`   |
| Two candidates fall within the margin                   | best `0.64`, runner-up `0.53`          | Do not pair; lead is only `0.11`      |
| Weak overlap and text, even with the element-name bonus | overlap `<0.20`, text `<0.20`: `<0.30` | Do not pair; below the `0.45` minimum |

## Region Writes And Echoes

One capturing `scroll` listener per pane document observes nested regions. With
Scroll together on, the source event handler writes both source offsets to
every accepted counterpart with `scrollTo({ behavior: "instant", left, top })`.
Read back and record each settled pair; the browser clamps a shorter region to
its own x/y range. Never resize, translate, restyle, or move snapshot elements to
compensate, so versions may differ visibly past a shorter region's end.

The per-element echo rule is the page rule: an event equal to that element's
last settled programmatic value is ignored; either coordinate differing makes
it a new source. Nested regions match and mirror independently. A horizontal
scroll writes x and y in the same handler just like a vertical scroll. A region
with no counterpart scrolls alone without error.

These rules apply to Side by side in both directions, every layer in Overlay
and Difference, the mobile and desktop sections independently when Both is
shown, and component comparisons. Regions never pair across viewport sections.

## Scroll Keys

Do not handle an already prevented or composing key event, a key carrying
Control, Meta, or Alt, any scroll key from `input`, `textarea`, `select`, or
editable content, or Space from a `button` or `summary`. Those cases retain
their delivered browser behavior.

For another scroll key, choose the starting node in this order: the focused
element when it is not the document root or body; otherwise the last connected
Element targeted by `pointerdown` in that pane document; otherwise none. Walk
from that element through its ancestors, inclusive, and choose the nearest
inner region that can still move in the key's direction:

| Keys                               | Direction test                  |
| ---------------------------------- | ------------------------------- |
| Space, PageDown, ArrowDown, End    | `scrollTop < vertical range`    |
| Shift+Space, PageUp, ArrowUp, Home | `scrollTop > 0`                 |
| ArrowRight                         | `scrollLeft < horizontal range` |
| ArrowLeft                          | `scrollLeft > 0`                |

For a right-to-left region, replace the table's horizontal tests: ArrowRight
can move when `scrollLeft < 0`, and ArrowLeft when `scrollLeft > -horizontal range`.

When such a region exists, do not prevent the key and do not move a page
viewport; the browser scrolls that region and its scroll event drives region
mirroring. When none exists, prevent the key and move the applicable chrome
viewport: a page is 87.5% of its visible height, an arrow is 40 CSS pixels,
Home is zero, End is the range end, and every result is clamped. The page write
then follows the current Scroll together mode.

## Anchors

The read-only guard still cancels a same-document anchor and never applies
`:target`. If its target is inside inner regions, collect its strict ancestor
regions and process them innermost first. At each step recompute the target
border box. The region's visible box starts at its border rect plus
`clientLeft`/`clientTop` and extends by `clientWidth`/`clientHeight`. If the
target starts before that box, or is larger than it, add the start-edge
difference to the region offset; otherwise, if it ends after the box, add the
end-edge difference; otherwise leave that axis unchanged. Scroll instantly and
mirror the settled offsets when Scroll together is on before processing the
next ancestor.

After the regions, move the source section's page viewport to the target's
current document position and apply that page offset under the current mode.
Horizontal page movement uses the same nearest-edge rule; vertical movement
aligns the target's top. With Scroll together on, every enclosing counterpart
follows before the page viewport moves.

## Reader Control

The comparison toolbar places a native `input type="checkbox"` with
`role="switch"` immediately after the comparison-mode group and before
Refresh. Its visible label, accessible name, and product copy are all
**Scroll together**. It is visible in Side by side, Overlay, and Difference,
including loading or failure states, and absent in Current. It is on by default.

Standalone Serve and export store `on` or `off` under the origin-local key
`mokly:comparison-scroll-together`; missing, invalid, or unreadable means on, and a failed write leaves the in-memory choice active.
Embedded viewers never access browser storage: each mounted viewer keeps the
choice across routes, comparisons, and source replacement for that mount. It
resets to on after the viewer root remounts; independent roots have independent choices.

- In Side by side, on mirrors page viewports and paired regions; off leaves
  each version's page and regions independent. Each viewport still drives and clamps only its own document.
- In Overlay and Difference, on mirrors paired regions. Off stops region
  mirroring, but the page still has one structural offset because both layers
  remain in one chrome and its lower layer has no separate page scrollbar.
- Current has one version, so the hidden preference has no behavioral effect.

Changing the switch applies to the open comparison without refetching,
re-presenting, or reloading a pane. Turning it off performs no write and leaves
every page and region exactly where it settled. Matching and last-scroll
tracking continue while off, but counterpart writes are suppressed.

Track one last-scrolled version, Before or Current, per open comparison. A
non-echo page, document, or region offset change owns it; Side by side assigns
its viewport to its sole version, and a key, anchor, wheel, touch, focus, find,
or selection action beginning in a stacked pane assigns that pane. Dragging a
stack's one shared scrollbar has no version and leaves the owner unchanged.
Viewer writes, echoes, measurement reapplication, clamping, and switch-on
realignment never change it. Initialize it to Current, or Before when Current
does not exist, so the no-scroll case is deterministic.

Turning the switch on uses that version as authority. For each viewport
section independently, copy its page offset to every other version, then visit
all of its inner regions in document order, resolve any match not cached since
the last measurement with the normal algorithm, and copy both settled offsets
to every counterpart. This includes zero offsets, so a counterpart is reset
when the authoritative region is at its start. When Both is shown, the chosen
version is shared but mobile and desktop offsets are never copied to each
other. A missing authoritative version in one section falls back to the
version that exists there.

## Acceptance

The existing page cases remain proved by the three
`tests/browser/comparison_alignment*.spec.ts` suites and controller unit tests
under `packages/viewer/tests/`. Milestone 7 must make the old app-shell failure
pass and add `tests/browser/comparison_regions.spec.ts` plus focused unit
coverage for:

- every pairing rule in order, duplicate and runner-up ambiguity, axis
  eligibility, `off`, non-region/invalid/one-sided authored names, and match
  invalidation;
- Overlay, Difference, Side by side in both directions, Both, and component
  regions, including nested, horizontal, unmatched, and shorter regions;
- wheel, touch, browser-originated scroll, every listed key from focus and the
  last pointer target, editable/Space-owned keys, anchors, echoes, and instant
  two-axis writes under smooth-scroll CSS;
- switch placement, default, and semantics in every mode, no pane reload,
  preserved positions when disabled, deterministic authority on re-enable, storage in
  Serve/export/an embedded session, and unchanged removed-preview scrolling.

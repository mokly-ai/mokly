# Self URLs mark a moved page changed

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-25, from the branch
  `calummoore/storybook-asset-follow-ups-cibm`, review round 1, check of
  finding 2.
- **Location:** `crates/mokly-compare/src/material_urls.rs:8-16`,
  `crates/mokly-model/src/routes.rs:51-59`, and
  `docs/protocol/mokly-moves.md:76-77`.
- **Reason:** The check found the problem in code that the branch did not
  change, and the fix changes a rule of the move contract.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Changes:** the Mokly view that lists the differences between the
    working catalogue and its base commit.
  - **Canonical form:** the normalized tree that Changes compares to decide
    whether a view changed, under
    `docs/protocol/mokly-comparison.md#materiality`.
  - **Identical-content signal:** the move pass that pairs a removed and an
    added entry when their canonical forms are equal, under
    `docs/protocol/mokly-moves.md#signals`.
  - **Unmarked link:** an `<a href>` that is not a logical catalogue link of
    `docs/protocol/mokly-navigation.md#logical-catalogue-links`, so Mokly
    keeps its URL as written.
  - **Self URL:** a URL that resolves to the document that holds it, such as
    `index.html#top` or `?tab=2` in the page `home/index.html`.
- **Background:**
  - `url` in `crates/mokly-compare/src/material_urls.rs:8-16` gives the
    canonical value of a local URL. It resolves the URL against the route of
    the composed document with `local_target` in
    `crates/mokly-graph/src/urls.rs:43`. Then it writes the resolved route,
    or its alias, with the query and the fragment of the URL.
  - `resolve` in `crates/mokly-model/src/routes.rs:51-59` returns the route
    of the document itself for an empty path. So `?tab=2` and
    `index.html#top` in `static/mokly-generated/home/index.html` both resolve
    to that route.
  - The `href` of an unmarked link is a URL position of the shared table,
    `kind` in `crates/mokly-graph/src/reference_positions.rs`, so it goes
    through `url`. A logical catalogue link compares by its logical
    destination instead, in `attributes` of
    `crates/mokly-compare/src/material.rs:109-124`.
  - When the page moves to `start/index.html`, the same unchanged link gets
    the value `static/mokly-generated/start/index.html#top`.
  - The resource aliases of a paired comparison map closure resources with
    equal bytes, in `aliases` of
    `crates/mokly-compare/src/comparison_resources.rs:62`. The route of the
    document itself is not such a resource.
  - The identical-content signal compares the canonical form of each move
    candidate at its own route, in
    `crates/mokly-compare/src/rendered_moves.rs`.
  - `docs/protocol/mokly-moves.md#normalisation` says: "Resource references
    compare by their resolved catalogue route, with query and fragment
    retained. Relative spelling and directory depth are not material."
- **Problem:** A self URL gets the route of its own document as its canonical
  value. After a move, the unchanged link has another value, so the canonical
  forms of the two sides differ.
- **Impact if no action:** Changes lists the moved view as changed. Or the
  identical-content signal does not pair the move, so the entry shows as one
  added and one removed entry, unless another signal pairs it.
- **Root question:** How does a URL that names its own document compare
  across a move?
- **Options:**
  - **A.** Keep the behaviour, and state in
    `docs/protocol/mokly-moves.md#normalisation` that a self URL compares by
    the route of its document, so a move changes it. Effort: Small.
  - **B.** Add the two routes of each paired document to the resource
    aliases of its paired comparison. The moved view then compares equal.
    The identical-content signal still sees two values, so such a move pairs
    only through a declaration or another signal. Effort: Small.
  - **C.** Give each self URL one fixed canonical value with its query and
    fragment, such as `self:#top`. Both sides and every move candidate then
    get the same value. State the rule in
    `docs/protocol/mokly-moves.md#normalisation`. Add a regression test: a
    page with an unmarked `<a href="index.html#top">` moves, stays unchanged,
    and pairs as identical content. Effort: Small.
- **Left out:**
  - Map every URL that names a catalogue document through the move pairs:
    it answers a wider question, how unmarked links to other moved entries
    compare, and it changes which views Changes lists.
- **Wider fix:** C. Every self URL then has one value, so no move can change
  it.
- **Previous examples:** None found.
- **Related:**
  - [srcdoc-material-urls-respelled.md](./srcdoc-material-urls-respelled.md):
    the same code. Both make a moved view differ in the canonical form. A
    self URL inside a `srcdoc` value gets the rule of this item once option
    B of that item applies.
- **Recommendation:** C. It fixes the paired comparison and the
  identical-content signal with one small rule.
- **Action:** ask the user, because C changes the normalisation rule of
  `docs/protocol/mokly-moves.md`, which compares each resource reference by
  its resolved catalogue route, and no user decision covers a self URL.

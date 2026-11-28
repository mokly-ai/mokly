# Renderer CSS disables cold parallel compilation

- **Severity:** Medium. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-28, from review round 1 of the branch
  `calummoore/storybook-track-e-storybook-folders-87sk`, finding 204.
- **Location:** `crates/mokly-render/src/bundle_styles.rs:158`, where
  `prepare_roots` compiles the renderer and each preview to get their
  closures, and `crates/mokly-render/src/bundle_styles.rs:225`, where
  `prepare` then asks for the class maps of the other roots.
  `crates/mokly-render/src/stylesheet_class_maps.rs:31`, the check that
  allows a cold batch. `crates/mokly-render/src/stylesheet_commit.rs:37`,
  where each compiled root enters the stylesheet stores.
- **Reason:** The fix changes the shared scheduling of stylesheet preparation
  and changes no published output, so it can land in a later branch.

- **Source:** Review.
- **Category:** Performance.
- **Terms:**
  - **Class-map preparation:** The step that compiles the stylesheet roots of
    a generation, so that the class maps of its CSS Modules exist before
    Mokly evaluates JavaScript.
  - **Cold build:** A build that starts with empty stylesheet caches.
  - **Root:** A delivery root: a module or stylesheet that gets its own
    stylesheet bundle, such as the renderer, a preview file, or an entry
    module.
  - **Closure:** The stylesheets of a root's bundle, with every nested
    `@import`.
- **Background:**
  - Class-map preparation compiles cold plain-CSS roots in bounded parallel
    chunks of up to four. It does this only when both stylesheet stores are
    empty and no head store is live. Maps, records, and dependency usage
    still follow root order. `crates/mokly-render/README.md` states this
    rule, and commit `8ce9a1ee8` added it.
  - The section "Roots, Collection And Deduplication" of
    `docs/protocol/mokly-imported-styles.md` says that each preview or entry
    root drops every file of the renderer's closure before it is bundled, at
    every depth of its `@import` tree. Each stories file root also drops
    every file of its preview's closure.
  - Commit `12c42135c` made preparation compile and store the renderer and
    each preview first, to get their closures, before it asks for the class
    maps of the other roots.
- **Problem:** After the renderer or a preview compiles, the stylesheet stores
  are no longer empty, so the batch check fails. Every remaining entry
  stylesheet then compiles serially. The renderer alone causes this, also in
  a catalogue without Storybook.
- **Impact if no action:** A cold build with global renderer CSS loses the
  parallel work across independent entry stylesheets.
- **Root question:** How can cold builds compile independent stylesheets in
  parallel while respecting exclusions?
- **Options:**
  - **A.** Keep a cold batch allowed across the prerequisite compilations.
    Batch the untouched roots after the renderer and the previews have given
    their exclusions. Effort: Medium.
  - **B.** Prepare in separate batches, each after its prerequisites:
    - Prepare the renderer, then the independent previews, then the
      independent entries. Carry the exclusions of each batch, and reuse its
      compiled results.
    - Make the batch check per root: no record and no miss reason for any key
      of the batch, and no live head store. A check that allows the renderer
      and preview records by name must know this detail, so it stays a
      direct fix.
    - Test the concurrency through `prepare` with renderer CSS, with the
      existing ordered worker test pattern. The current class-map tests call
      `class_maps` directly, so they cannot see a caller that fills the store
      first.
    - Effort: Medium.
  - **C.** Use one dependency-aware work queue for class-map preparation and
    graph delivery. Keep the ordered results and the current cache and
    cancellation rules. Effort: Large.
  - **D.** Get the renderer and preview closures from a walk that only reads
    and resolves their `@import` trees:
    - The walk uses the reference parser, the resolver, and the exclusion
      rule of the CSS compiler. It stores no record.
    - Every root then has its exclusions before it compiles. The existing
      cold batch, with its check unchanged, compiles the renderer, the
      previews, and the entries together.
    - Add a concurrency test through `prepare` with renderer CSS.
    - Cost: each preparation reads and resolves the prerequisite stylesheets
      again, also when their records are current. A second closure path must
      agree with the compiler. PostCSS and Vite roots keep the compiled
      closure, because plugins can add imports, and these roots never batch.
    - Choose D when the renderer's own compile is a large part of a cold
      build, because only D compiles the renderer inside the batch.
    - Effort: Medium.
- **Left out:**
  - Use direct imports only, to avoid the prerequisite work. It breaks the
    protocol rule that removes the closure at every depth.
  - Compile the entries without exclusions, then remove the renderer's files
    from their output. The protocol forbids pruning by emitted text.
  - Compile the entries at once with direct-file exclusions, then compile
    again each entry that reaches a nested prerequisite file. It wastes
    compiles, and it stores records under exclusions that they were not
    compiled with.
  - Keep serial preparation and document it. It fails the goal.
- **Wider fix:** B, with a batch check per root. Each batch then depends on
  finished prerequisites instead of on a globally empty cache.
- **Previous examples:** Commit `8ce9a1ee8` added bounded parallel compilation
  for independent startup stylesheets.
- **Related:** `plans/follow-ups/stylesheet-delivery-record.md`: the same code.
  The batches carry the drop sets of the earlier roots. If that item adds a
  delivery record, the batches must carry the record.
- **Recommendation:** B. It keeps one source for the closure, the compiled
  record, and it makes the stage order explicit.
- **Action:** fix after merge, apply B, because the fix reaches shared
  scheduling and can land later without a change to published output.

# Fallback keys still depend on checkout folders

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-01, from review round 1, finding 1, of the branch
  `conductor/rust-rebuild-133-folder-keys`. The final call split the
  finding: that branch applied option D, and this item holds option A.
- **Location:** `crates/mokly-graph/src/render_inputs.rs:131`,
  `crates/mokly-render/src/graph.rs:126`,
  `packages/mokly/src/sidecar/bundle-recipe.ts:109`,
  `crates/mokly-graph/src/graph.rs:268`,
  `crates/mokly-render/src/side.rs:87`, `docs/protocol/mokly-sidecar.md:89`,
  and `docs/protocol/mokly-shell-delivery.md:78`.
- **Reason:** A linked preview or renderer is a rare setup, and option A
  changes graph identity code outside the diff of the branch that found it.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Document key:** `documentKey`, the input hash of one catalogue document
    in the index, so it also changes the `deploymentId` of a build.
  - **Render input key:** the key of one entry module over its imports, the
    renderer or preview, and the side's bundle environment.
  - **Fallback key:** the whole-bundle key that a module without its own
    render input key uses.
  - **Generation id:** the sidecar's id of one evaluated JavaScript bundle,
    which a render request names to select its side's bundle.
  - **Storybook preview:** the shared setup module `.storybook/preview.*`
    that every story renders with.
- **Background:**
  - Item 133 of the Rust rebuild made document keys independent of the
    checkout folder. On 2026-10-28 the coordinator chose its option B,
    refined, for Cal: write every absolute path in the render environment
    digest relative to the working repository root, or by its base cache
    identity. The root `package.json` stays an input, under decision 3 B of
    PR #227 of 2026-10-27: each key holds the resolution files on the
    directory chains of its closure modules.
  - Commit `337a645c` applied that choice in
    `crates/mokly-render/src/render_environment.rs`. It changed only the
    bundle environment, at line 120, and not the fallback key.
  - `docs/protocol/mokly-shell-delivery.md:78` states the requirement. The
    folder of the checkout is not an input of `documentKey`. Two checkouts
    of one commit with equal installed dependencies give equal document
    keys, and their builds give the same `deploymentId`. The status line of
    that page links this item.
  - `RenderKeys::build` in `crates/mokly-graph/src/render_inputs.rs` gives
    each entry module its own render input key. Lines 101 to 108 and 131 to
    135 skip a stories file when a preview exists that the module graph does
    not name. They skip every other entry module when the graph does not
    name the configured renderer. These modules use the fallback key, as
    `docs/protocol/mokly-watch.md:80-82` requires.
  - `PREVIEWS`, at `render_inputs.rs:17`, lists only `.storybook/preview.*`
    names. The module graph names each module by its real path. When
    `.storybook` is a symbolic link to an in-repository folder, such as
    `storybook`, the graph names `storybook/preview.tsx`, so the preview is
    unnamed. The real-sidecar test
    `an_edit_to_a_linked_preview_moves_only_the_story_keys`, at
    `crates/mokly-render/tests/integration/key_fallback_tests.rs:50`, builds
    this setup.
  - A renderer configured through a symbolic-link directory, such as
    `link/renderer.tsx`, is also unnamed, as
    `plans/follow-ups/linked-renderer-stylesheet-root.md` describes. Then
    every entry module that is not a stories file uses the fallback key.
  - `crates/mokly-render/src/graph.rs:126` to line 134 builds the fallback
    key from `generation.id`, the class maps digest, and the binding table.
    Line 145 passes it to `RenderKeys::build`.
  - `generationId`, at `packages/mokly/src/sidecar/compiled.ts:24`, hashes
    the compilation identity and the evaluation digest. The compilation
    identity, at `packages/mokly/src/sidecar/bundle-recipe.ts:107` to line
    120, hashes `params.sourceRoot`, the dependency roots, and the
    repository roots. These are physical paths.
  - The live generation key, at `crates/mokly-graph/src/graph.rs:267` to
    line 269, also hashes `RenderKeys::fallback`. Decision 5 A of PR #227,
    2026-10-27, keeps the bundle fingerprint in the live generation, so that
    the shell and the Changes identity keep their behaviour. Only Serve has
    a live generation. A static build has no `live` field.
  - The side identity, at `crates/mokly-render/src/side.rs:87` to line 93,
    is `head` for the head and the base commit for a base. Neither depends
    on the folder. `docs/protocol/mokly-sidecar.md:89-90` says that the
    whole-bundle key contains the generation id, so it never matches across
    sides. Render input keys hold no side marker. The decision on that page
    is that equal inputs share render cache entries across sides.
  - The two-folder probe of 2026-11-01 built `examples/basic` with
    `build --no-changes`. 0 of 594 key records differed, and the two
    `deploymentId` values were equal. That catalogue has no linked preview
    or renderer.
  - The checkout-equality test
    `equal_catalogues_in_two_checkout_folders_share_render_input_keys`, at
    `crates/mokly-render/tests/integration/render_key_tests.rs:58`, uses the
    `tests/fixtures/render-keys` fixture with an ordinary `.storybook`
    folder. So no test covers the linked case.
  - The review found the problem by a read of the code. Nobody reproduced
    it at run time.
- **Problem:** A module that uses the fallback key gets a document key that
  holds the generation id, and that id hashes the physical source root. Two
  checkouts of one commit with a linked preview therefore publish different
  story document keys and different `deploymentId` values. A linked renderer
  does the same for every other JavaScript document.
- **Impact if no action:** Equivalent checkouts with a linked preview or a
  linked renderer keep different document keys and `deploymentId` values.
  The folder rule of `docs/protocol/mokly-shell-delivery.md` stays
  unimplemented for them, and the page keeps its status line.
- **Root question:** How does every published document key, and so the
  `deploymentId`, leave out the checkout folder, also when the module graph
  does not name the renderer or the preview, while each key still moves with
  every input that can change the render?
- **Options:**
  - **A.** Give every fallback consumer one folder-independent content key
    in Rust. Keep all module and manifest inputs, the normalized
    installation identities, the class maps, and the bindings. Keep the
    generation ids for worker isolation. Extend the checkout-equality test
    with the linked-preview setup of `key_fallback_tests.rs:50`. Align the
    fallback sentence of `crates/mokly-render/README.md:66` to line 69.
    Remove the status line of `docs/protocol/mokly-shell-delivery.md`.
    Effort: Medium. The finding check added three conditions:
    - Change only the whole-bundle key that document and fragment keys use.
      The live generation at `crates/mokly-graph/src/graph.rs:268` keeps the
      bundle fingerprint, under decision 5 A of PR #227.
    - Keep a folder-independent side identity in the new key: `head`, or the
      base commit, from `crates/mokly-render/src/side.rs:87-93`. Without it,
      equal content can match across sides. That is a behaviour change that
      needs the user.
    - Rewrite `docs/protocol/mokly-sidecar.md:89-90`. It says that the
      whole-bundle key contains the generation id and so never matches
      across sides.
  - **B.** Make the sidecar's compilation identity folder-independent, with
    a separate identity for each live evaluation. Update its consumers, its
    tests, and its identity contract. This reaches more cache and worker
    lifetime code. It also revisits option C of item 133, a
    folder-independent bundle identity. Effort: Large.
  - **C.** Name a linked renderer or preview by the module that the graph
    holds. The sidecar reports the module-graph names of the renderer and
    the selected preview from `packages/mokly/src/sidecar/bundle-entry.ts`.
    `RenderKeys::build` keys their closures under those names. This needs a
    new bundle result field on both sides of the sidecar boundary, new text
    for `docs/protocol/mokly-watch.md:80-82`, and new fallback tests. The
    fallback key stays folder-dependent for any later unnamed case. Effort:
    Medium.
  - **D.** Defer the fix. In the branch that found it, add this item and one
    status line below the title of `docs/protocol/mokly-shell-delivery.md`
    that links it. The page keeps the folder rule as the intended behaviour.
    Text only. It pairs with A, B, or C. That branch applied D on
    2026-11-01. Effort: Small.
- **Left out:**
  - Remove the fallback. It breaks the rule of
    `docs/protocol/mokly-watch.md:80-82`, and the keys would miss inputs
    that can change the render.
  - Narrow the folder rule of `docs/protocol/mokly-shell-delivery.md`. It
    fails the goal of item 133. The rule stays as the intended behaviour,
    with the status line that D gives.
  - Warn about a linked `.storybook`. The keys stay folder-dependent.
  - Publish a separate `documentKey` beside the node key in
    `crates/mokly-graph/src/planning.rs`. It needs the same content key as
    A, and it can drift from the node key.
- **Wider fix:** A. Build it so that `RenderKeys::build` derives the
  whole-bundle key from the folder-independent fields of `RenderInputs`,
  not from a `NodeKey` that the caller passes in. One content key for every
  fallback consumer then separates the published identity from the
  physical worker identity.
- **Previous examples:** Commit `9ce75853`, PR #227, separated ordinary
  document keys from the bundle identity. Commit `c92c1a7f`, PR #235, kept
  the whole-bundle fallback for linked previews and added the real-sidecar
  test above. Commit `337a645c` made the bundle environment
  folder-independent. No later commit removes the folder from the fallback
  key.
- **Related:**
  - [linked-renderer-stylesheet-root.md](./linked-renderer-stylesheet-root.md)
    has the same cause for a linked renderer: the module graph names the
    real path, not the configured link path. Its option C gives configured
    module paths one resolved form, which would remove the renderer trigger
    of this fallback. It covers neither the linked preview nor the folder in
    the fallback key, so the two items stay apart.
- **Recommendation:** A, with the three conditions. It is the only Medium
  option that removes the folder from the fallback key for every trigger. B
  is wider but Large, and C leaves any later unnamed case folder-dependent.
- **Action:** fix after merge, apply A, because the linked setup is rare
  and A changes graph identity code outside the diff of item 133.

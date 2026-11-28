# A repeat bundle can reset story setup

- **Severity:** Low. **Likelihood:** Rare. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-28, from review round 1 of the branch
  `calummoore/storybook-track-e-storybook-folders-87sk`, finding 103.
- **Location:** `packages/mokly/src/sidecar/session.ts:144`, where the session
  stores each `bundle` result under its generation ID.
  `packages/mokly/src/sidecar/compiled.ts:159`, the candidate loop of
  `reuse`, and line 196, where it restores a new object for the requested ID.
  `packages/mokly/src/sidecar/story-setup.ts:20`, where the active setup is
  compared with the story's generation by object identity.
- **Reason:** No render fails, because the pool sends the preparation again,
  so only one extra evaluation and one extra setup remain.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Generation:** A compiled program in the sidecar with its evaluated
    definitions, story records, and render state, named by an ID.
  - **Evaluation digest:** A value of the `bundle` request that tells apart
    two evaluations of one compilation, for example when its CSS class maps
    change.
  - **`beforeAll`:** The preview hook that sets up the stories of a Storybook
    folder. It can return a cleanup function.
  - **Pool:** The core's set of sidecar processes. It sends `cssModules`,
    `describe`, and `bindings` to a process before a render that needs them.
- **Background:**
  - One compilation can stay live in one sidecar under two generation IDs,
    with two evaluation digests. Equal IDs have equal code and class maps,
    under the section "Bundling" of `docs/protocol/mokly-sidecar.md`, so a
    held evaluated state stays valid for a repeat request.
  - `docs/protocol/mokly-sidecar-restored-reuse.md` lets a `bundle` result
    return an ID that the process already holds.
  - The section "Setup Before Render" of
    `docs/protocol/mokly-storybook-setup.md` says that a sidecar runs the
    `beforeAll` hook of each folder once for each generation. It runs the
    hook again only after the setup of another generation or folder replaced
    it.
  - The sidecar keeps one active setup. It compares the generation of that
    setup with the story's generation by object identity.
  - `reuse` walks the live generations in a fixed order and accepts the first
    one whose recorded inputs are current. When the accepted generation has
    another ID than the request, `reuse` restores a new object for the
    requested ID, with empty story records. The session then stores that
    object under its ID, also when the process already holds a live object
    with that ID.
  - After each `bundle` reply, the pool clears its record of the maps, the
    description, and the bindings of that generation. Before the next
    render, it sends `cssModules`, `describe`, and `bindings` again, in
    `crates/mokly-sidecar/src/pool_requests.rs`. So the new object gets its
    story records back.
  - On 2026-11-28 the branch that found this item changed which candidate
    `reuse` accepts, with one record of the selected preview files. Apply
    the fix of this item after those checks.
- **Problem:** With live generations `g1` and `g2` of one compilation, a
  repeat `bundle` request for `g2` can accept `g1` first. The session then
  replaces the live `g2` with a new object. The next story render of `g2`
  runs the cleanup of the active setup and the `beforeAll` hook again, for
  the same generation and folder.
- **Impact if no action:** A repeat request evaluates the generation again and
  repeats the side effects of the `beforeAll` hook, against the setup rule.
  The folder setup test, "Storybook setup cleans up and runs the next hook
  when stories alternate folders" in `tests/sidecar_storybook_folders.test.ts`,
  repeats a bundle with only one live generation, so it misses this case.
- **Root question:** How does a `bundle` result that names a generation ID
  that the process already holds keep the evaluated state of that generation?
- **Options:**
  - **A.** Prefer a candidate with the same evaluation digest within each
    class of reuse evidence, so that the live `g2` wins in this case. Exercise
    two live evaluations in the folder setup test. Cost: another bundle path
    that returns a held ID can still replace the live object. Effort: Small.
  - **B.** After `reuse` accepts a recipe, find the live object by the
    requested ID. Create a new evaluated state only for a new ID, and keep
    the source of the accepted recipe for the reply. Effort: Medium.
  - **C.** Make the session the one owner of each live ID:
    - When a `bundle` result names an ID that the process holds, the session
      keeps the held generation with its evaluated state, its setup, and its
      setup failures. It ends the restored state and sends the reply from the
      new result.
    - `reuse` gives back only the accepted recipe and its source. The session
      creates a new evaluated state only for a new ID.
    - This also covers a fresh esbuild compile that returns a held ID. With
      complete evidence, the identity leaves out the random runtime key.
    - Add a case to the folder setup test that repeats the second of two live
      evaluations. Check that its `trace.txt` file, which each hook and each
      cleanup appends to, gets no new line, and that a story renders without
      a new `describe`.
    - Cost: after a fresh compile, the held object keeps older but equivalent
      code than the recipe in the reply.
    - Effort: Small.
- **Left out:**
  - Key only the setup by ID. A replaced object has new module instances. A
    setup that the ID skips leaves the new preview module without its
    `beforeAll` state, and the story records are still lost.
  - A protocol error for a repeat request. The restored reuse contract allows
    that request.
  - Change the order of the core's requests. The restored reuse contract lets
    a `bundle` result return a held ID, so the sidecar must keep its setup
    rule for every request order.
  - Change the pool. It already sends the preparation again after each
    bundle reply, and it cannot see which object the session keeps.
- **Wider fix:** C. One owner for the state of each live ID makes the
  candidate order and the bundle path irrelevant.
- **Previous examples:** Commit `249fa1aa5` set how reuse replies keep the
  selected restored source. The evaluation-only reuse test in
  `tests/sidecar_generation_reuse.test.ts` exercises distinct live IDs.
- **Recommendation:** C. It keeps the one-owner rule of B in the step that
  installs every bundle result, so it also covers results that do not come
  from reuse, and it costs less than B.
- **Action:** fix after merge, apply C, because the product bug is Low and
  Rare: the pool prepares the generation again, so no render fails.

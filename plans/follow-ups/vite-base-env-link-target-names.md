# Base env records match link target names

- **Severity:** Medium. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-25, from round 2 of the implementation review of the
  branch `calummoore/storybook-track-d-finish-nkpi`: two new problems that
  the finding check of finding 141 found. One fix covers both.
- **Location:** `crates/mokly-compare/src/base_vite_env.rs:60`,
  `crates/mokly-compare/src/base_vite_env.rs:77`,
  `crates/mokly-compare/src/base_vite_env.rs:129`,
  `crates/mokly-render/src/bundle_inputs.rs:30`, and
  `packages/mokly/src/sidecar/vite-context.ts:82`.
- **Reason:** The cost is extra base preparations and larger requests, not
  wrong output, and `plans/follow-ups/base-link-target-batch-reads.md`
  changes the same function.

- **Source:** Review.
- **Category:** Performance.
- **Terms:**
  - **Vite adapter:** The optional compile path that compiles JavaScript and
    transforms stylesheets through the project's own Vite setup.
  - **Base env record:** The data that the binary sends to the base sidecar
    for the env precedence rules: the committed links, the tree paths that
    the base commit holds, and the paths that the Git index holds.
  - **Kept base:** A prepared base side that Serve keeps while its freshness
    checks pass.
- **Background:**
  - The base side applies precedence rules to the final target of each env
    candidate, under lines 94 to 97 of
    `docs/protocol/mokly-vite-adapter-inputs.md`. For these rules, the
    sidecar must know whether the base commit and the Git index hold the
    final target.
  - `setup_sources`, at `crates/mokly-compare/src/base_vite_env.rs:30`, reads
    every committed link. `target_names`, at line 77, collects the four
    dotenv names and the file name of every link target. The record then
    lists every tree entry and every index path with one of these names, at
    line 60 to line 71. Each index pattern matches the name in any
    directory, at line 94.
  - The freshness check of a kept base samples the index with the same
    patterns and compares the list, at line 129.
  - Each base `bundle` and `transformViteCss` request carries the record, at
    `crates/mokly-render/src/bundle_inputs.rs:30`. The sidecar also
    stringifies it into its setup key, at
    `packages/mokly/src/sidecar/vite-context.ts:82`.
  - The env candidate paths cannot be exact in Rust, because only the
    sidecar knows the resolved `envDir`. The final target of a file link is
    exact, because the pinned tree holds each link.
- **Problem:**
  - A link target name acts as a pattern for every directory. So a staged
    add or removal of any path with that name releases a kept Serve base,
    also a path that no link reaches. In this repository, the link
    `CLAUDE.md` to `AGENTS.md` makes each staged `AGENTS.md` release it.
  - One link to a common name, such as `index.ts`, makes each base Vite
    request carry every `index.ts` path of the tree.
- **Impact if no action:** Serve prepares the base again after unrelated
  staged changes, and the base requests and setup keys grow with the tree.
- **Root question:** Which tree and index paths must the base env record
  hold, so that it matches only the paths that an env candidate can reach?
- **Options:**
  - **A.** Resolve each committed file link to the exact repository path of
    its final target in Rust, through the pinned tree. Record those exact
    paths and the four dotenv names. Sample the index with exact pathspecs
    for the targets. Test a staged unrelated file that has the name of a link
    target, and a link chain. Effort: Medium.
  - **B.** Keep the record, but let the base sidecar report the exact paths
    whose membership it used. The freshness check then samples only those
    paths. Cost: the requests and the setup keys still carry every matching
    path. Effort: Medium.
- **Left out:**
  - Ask the binary for each final target during the setup. It fails the
    goal, because the binary rejects a request from the sidecar, at
    `crates/mokly-sidecar/src/wire.rs:88`.
  - Keep only the link targets whose names start with `.env`. It fails the
    goal, because a link at any component of the candidate path, such as a
    linked `envDir`, can lead to the final target.
- **Wider fix:** A. Exact target paths give the request, the setup key, and
  the freshness check the same small set, whatever names the tree holds.
- **Previous examples:** None found.
- **Related:** `plans/follow-ups/base-link-target-batch-reads.md`: the same
  function. Its batch reader reads the same link blobs, and its options keep
  every committed link available, which A also needs.
- **Recommendation:** A. It fixes both symptoms with one exact set of paths.
- **Action:** fix after merge, apply A, because the cost is extra base work,
  not wrong output, and the batch read item changes the same function.

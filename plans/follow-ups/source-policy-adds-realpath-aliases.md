# Source protection relies on aliases from each producer

- **Severity:** High. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-28, from review round 1 of the branch
  `calummoore/storybook-track-e-storybook-folders-87sk`, the wider fix C of
  finding 1.
- **Location:** `crates/mokly-graph/src/policy.rs:56`, where
  `FilePolicy::new` builds the source policy from the listed sources, and
  `crates/mokly-catalogue/src/protection.rs:100`, where
  `SourcePolicy::denial` checks a requested path and its resolved target.
- **Reason:** The branch that found it fixed the one producer that dropped an
  alias, and this change moves the alias rule into the shared file policy,
  which every producer uses, outside the diff of that branch.

- **Source:** Review.
- **Category:** Security.
- **Terms:**
  - **Source inventory:** The private list of authored inputs that Serve, a
    static build, and Changes never serve or publish.
  - **Producer:** Code that adds paths to the source inventory, such as the
    validation of configured inputs or the discovery of a Storybook root.
  - **Realpath alias:** The in-repository path that a symbolic link resolves
    to. It differs from the written path of the link.
  - **`main.*`:** The Storybook configuration file of a Storybook folder.
    Mokly runs it with Storybook's loader before discovery.
- **Background:**
  - The section "Protected Inputs" of
    `docs/protocol/mokly-source-protection.md` applies each protection rule
    to the requested path and to its resolved repository-relative target.
  - The section "Complete Source Inventory" of the same page keeps both the
    logical path and an in-repository realpath alias of a source when they
    differ.
  - A public read projects the requested path, and `SourcePolicy::denial`
    checks both names. That check finds a listed input only under a name
    that a producer listed.
  - `FilePolicy::new` adds the projected identities of the output directory
    and of the package roots to its private list. It adds no identity for a
    listed source.
  - So each producer must list the realpath alias of each source itself.
    The configured inputs do this: `ProjectedInput::sources` at
    `crates/mokly-catalogue/src/config_inputs.rs:34` returns the written path
    and the projected identity.
  - On 2026-11-28 a review found a producer that did not. The files that the
    load of a Storybook `main.*` reads entered the inventory under their
    written paths only, at `crates/mokly-catalogue/src/storybook_roots.rs:186`.
    A read with `fs.promises.readFile` through a symbolic link then left the
    link target public under its own path.
  - The branch that found that defect fixed the producer. The Storybook
    worker records the resolved name of each read, and the core projects
    each present input as a fallback.
  - The base side needs no alias. `GitTree::project` at
    `crates/mokly-compare/src/git_tree.rs:83` returns a link entry under its
    own path, and the Git reader rejects a link.
- **Problem:** Nothing in the file policy protects the target of a source that
  a producer lists only under its written path. The next producer, or a new
  read API in an existing producer, can leave a target public again.
- **Impact if no action:** Serve can serve such a target, and a static build
  or a publication can copy it, although the source protection contract
  protects it.
- **Root question:** How does Mokly keep every in-repository path of a
  protected source private, whichever producer lists the source?
- **Options:**
  - **A.** Add the aliases centrally in `FilePolicy::new`:
    - On the working side, project each listed source, and add its
      in-repository identity when it differs from the listed path.
    - A producer that lists only a written path then stays protected.
    - Test a listed link whose target a public read requests under its own
      path.
    - Cost: one tree projection for each source in each generation. The
      projection runs after the read, so it cannot see a target that the
      read used before a link changed.
    - It serves protection only. Serve still watches only the names that the
      producer lists.
    - Effort: Medium.
  - **B.** Give the source inventory one input type that carries the written
    path and the resolved identity, and make every producer register that
    type. A producer that gives a written path alone then fails to compile.
    Each producer takes the identity from its own read where it can. Cost:
    every producer and its tests change, and a producer that cannot observe
    its read must still project. Effort: Large.
- **Left out:**
  - Reject every symbolic link in the inventory. In-repository links stay
    supported configuration inputs under the source protection contract, and
    a new rejection needs the user.
  - Protect file objects instead of paths. Base-side Git blobs have no file
    identity, and both sides must apply the same rules.
  - A test that checks every producer for this class. A test for a class of
    defect needs the user's approval.
- **Wider fix:** A. One projection at the policy boundary covers every
  producer, also a producer that does not exist yet.
- **Previous examples:** Commit `4614c4a90` kept both names for the renderer
  and the PostCSS module. `plans/follow-ups/vite-env-link-target-watch.md`
  records that Serve misses edits to the target of a linked dotenv file. A
  covers protection only, so it does not fix that item.
- **Recommendation:** A. It protects every producer with one change at the
  boundary that all public reads use.
- **Action:** fix after merge, apply A, because it changes the shared file
  policy outside the diff of the branch that found it, and it serves every
  producer.

# Make JavaScript document keys location-independent

- **Severity:** Medium. **Effort:** Medium.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan:
  user item 133, from decision 1 of integration batch 19, widened by batch 21.
- **Location:** `packages/mokly/src/sidecar/compiled.ts:18-32`, the
  per-entry key inputs in `crates/mokly-graph/src/render_inputs.rs`, and
  `packages/mokly/src/sidecar/bundle.ts`.
- **Reason:** On 2026-10-21 the user deferred the open review items until
  after the merge and kept each choice for a later decision.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Document key:** the content id of one rendered document. It decides
    cache reuse and the deployment identity of a published catalogue.
  - **Bundle identity:** the hash of one JavaScript compilation in the
    sidecar, which the generation id contains.
- **Background:**
  - On 2026-10-21 the plan recorded the inputs of the bundle identity in
    `bundle.ts`. They were the absolute source, dependency, and repository
    roots, and every parent `package.json` of each bundled module. That
    identity fed every JavaScript document key.
  - Measured then: builds of one commit from two folders differed in 545
    keys and in the deployment identity. A devDependency edit in the root
    `package.json` re-keyed all 223 JavaScript-rendered entries.
  - PR #227, merged on 2026-10-28, changed the keys. Fragment and document
    keys now use a per-entry render input key without the root path. The key
    is built from module digests, the module graph, class maps, and
    bindings. Each key keeps the selected installation's directories, the
    resolved runtime package paths, and the resolution files on the
    directory chains of its modules.
  - The generation id still contains the real source root, as the comment at
    `compiled.ts:18-23` says.
  - Nobody measured the two cases above again after PR #227.
- **Problem:** JavaScript document keys depended on the checkout folder and
  on unrelated root manifest edits. Parts of that dependence may remain
  through the installation paths and the manifests on module chains.
- **Impact if no action:** Published identity can change without a render
  input change. Cache reuse and deployment identity then depend on where
  the repository is checked out.
- **Root question:** How do JavaScript document keys depend only on what can
  change a render?
- **Options:**
  - **A.** Document that absolute roots and all ancestor manifests are
    render inputs. Effort: Small (estimate).
  - **B.** Keep them in the compiled-code cache key. Compute the published
    document keys from folder-independent data: module digests by
    repository path, class maps, and bindings. Effort: Medium.
  - **C.** Make the bundle identity itself folder-independent. Effort:
    Large.
- **Left out:** Drop package metadata from every key. It can reuse compiled
  code across incompatible resolution settings.
- **Wider fix:** C. A folder-independent bundle identity removes the class
  at its source.
- **Previous examples:** PR #227 moved fragment and document keys off the
  root path, which covers much of B.
- **Recommendation:** B. It fixes published identity and keeps conservative
  compiled-code reuse. First measure the two cases on the current code,
  because PR #227 changed the keys. C best protects every bundle consumer.
- **Action:** ask the user, because condition 5 holds: on 2026-10-21 the
  user deferred the open review items past the merge to decide each one
  later.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6063).

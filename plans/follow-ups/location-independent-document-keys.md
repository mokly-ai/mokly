# Make JavaScript document keys location-independent

- **Severity:** Medium. **Likelihood:** Common (estimate). **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan:
  user item 133, from decision 1 of integration batch 19, widened by batch 21.
- **Location:** `packages/mokly/src/sidecar/compiled.ts:18-32`, the
  per-entry key inputs in `crates/mokly-graph/src/render_inputs.rs`, and
  `packages/mokly/src/sidecar/bundle.ts`.
- **Reason:** On 2026-10-28 the coordinator chose option B, refined, for
  the user. Only its implementation waits.

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
  - On 2026-10-27, for PR #227, the user chose that each `package.json` or
    `tsconfig.json` on a closure module's directory chain is a render input,
    as `docs/protocol/mokly-watch.md:70-78` states. So a root manifest edit
    that moves these keys follows a decided rule. The user also chose that
    each key keeps the installation directories and the resolved runtime
    package paths.
  - The generation id still contains the real source root, as the comment at
    `compiled.ts:18-23` says.
  - Nobody measured the two cases above again after PR #227.
  - Measured again on 2026-10-28, after PR #227: builds of `examples/basic`
    from two folders of one commit differed in 549 of 594 document keys and
    in the deployment identity. Only entries that render without JavaScript
    kept equal keys. A one-line devDependency edit in the root
    `package.json` moved the same 549 keys.
  - The cause of the folder part: `crates/mokly-render/src/render_environment.rs`
    hashes physical absolute paths into the render environment of each
    side. They are the repository roots, the dependency roots, the resolved
    runtime package paths in `peers`, and the roots in `moduleResolution`,
    which hold a tier-two base's install root.
  - On 2026-10-28 the coordinator chose option B, refined, for the user.
    Write each absolute path of the environment digest relative to the
    working repository root, or by its path below the comparison cache
    namespace, whose folder name is a hash of the repository path. Keep the
    root `package.json` half, because the user's choice of 2026-10-27 makes
    each manifest on a module chain a render input. The head and a
    tier-two base keep different environments.
- **Problem:** JavaScript document keys depended on the checkout folder and
  on unrelated root manifest edits. The manifest part is now a decided
  render input. The folder part may remain through the installation
  directories and runtime package paths.
- **Impact if no action:** Published identity can change without a render
  input change. Cache reuse and deployment identity then depend on where
  the repository is checked out.
- **Root question:** How do JavaScript document keys depend only on what can
  change a render?
- **Options:**
  - **A.** Document that absolute roots and all ancestor manifests are
    render inputs. The watch contract already states the manifest half.
    Effort: Small (estimate).
  - **B.** Keep them in the compiled-code cache key. Compute the published
    document keys from folder-independent data: module digests by
    repository path, class maps, and bindings. Dropping the manifests or the
    installation paths from published keys changes the user's choices of
    2026-10-27, which needs the user. Effort: Medium.
  - **C.** Make the bundle identity itself folder-independent. Effort:
    Large.
- **Left out:** Drop package metadata from every key. It can reuse compiled
  code across incompatible resolution settings.
- **Wider fix:** C. A folder-independent bundle identity removes the class
  at its source.
- **Previous examples:** PR #227 moved fragment and document keys off the
  root path, which covers much of B.
- **Recommendation:** B, refined as the Background says. It removes the
  folder dependence and keeps the user's choices of 2026-10-27.
- **Action:** fix after merge, apply B, refined, because the user's choice
  of 2026-10-28 settles it and only the implementation remains.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6063).

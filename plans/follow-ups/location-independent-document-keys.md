# Make JavaScript document keys location-independent

- **Severity:** Medium. **Effort:** Medium.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** See the affected paths in the task below.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

## Task

Resolve user item 133 (integration batch 19 decision 1, widened by
batch 21): JavaScript document keys depend on the checkout folder and
the root manifest. `packages/mokly/src/sidecar/bundle.ts` hashes the
absolute source, dependency, and repository roots, and every parent
`package.json` of each bundled module, into the bundle identity, which
feeds every JavaScript document key. Builds of one commit from two
folders differ in 545 keys and in the deployment identity. A
devDependency edit in the root `package.json` re-keys all 223
JavaScript-rendered entries. Severity Medium, effort Medium. Options:
A, document that these are render inputs, effort not recorded; B, keep
them in the compiled-code cache key, and compute the published
document keys from folder-independent data: module digests by
repository path, class maps, and bindings, Medium; C, make the bundle
identity itself folder-independent, Large. Recommended: B.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6063).

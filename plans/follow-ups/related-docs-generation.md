# Write relatedDocs references into catalogue output

- **Severity:** Medium. **Effort:** Medium.
- **Kind:** Fix after merge.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** Catalogue and document producers.
- **Reason:** The review found this problem outside the change that it reviewed.

The [catalogue delivery contract](../../docs/protocol/mokly-catalogue-delivery.md)
and the [documents contract](../../docs/protocol/mokly-documents.md) define
`relatedDocs` references, but no producer writes them.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6434).

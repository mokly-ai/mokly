# A page opens in the error state on a host that strips `.html`

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Small. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-23, from the branch
  `calummoore/canvas-redesign-m11-canvas-stage-in-knaz`.
- **Location:** `packages/frame/src/adapters/same_origin_identity.ts:111`
  (`normalizedHtmlPath`), `tests/same_origin_identity.test.ts:82`,
  `tests/static_host_paths.test.ts`,
  `docs/protocol/mokly-frame-adapter-same-origin.md:10-12`
- **Reason:** Milestone 11 found it, and the first suggested fix breaks a
  rule that a test keeps, so it needs its own analysis.

- **Source:** Implementation.
- **Category:** Product bug.
- **Terms:**
  - **Document authentication:** the same-origin adapter's check that a
    loaded frame document is the resource it assigned.
- **Background:** `mokly-frame-adapter-same-origin.md` says that a loaded
  document keeps its exact origin, query and path, and that "a provider may
  canonicalize a final `.html` suffix to the otherwise identical extensionless
  path; no other path redirect is accepted". `normalizedHtmlPath` treats
  `/dir/`, `/dir` and `/dir/index.html` as one path. A test asserts that
  `/dir/index` is not the directory form.
- **Problem:** Milestone 11 saw a page or Markdown document open in the error
  state on a host that strips `.html`. Such a host serves `/dir/index.html` as
  `/dir/index`, so when the viewer assigns the directory form, the loaded
  path does not match. The suggested fix, removing a trailing `/index`, makes
  the existing test fail, because that test keeps the rule that only the
  `.html` suffix may change.
- **Impact if no action:** On such hosts, pages and documents do not open in
  the viewer.
- **Root question:** Which paths does document authentication accept from a
  host that strips `.html` and also serves directory indexes?
- **Options:**
  - **A.** Accept `/dir/index` as the directory form too, change the rule
    sentence and the test. Effort: Small.
  - **B.** Make the viewer assign the exact `index.html` path, so the host's
    only change is the stripped suffix, which the rule already accepts.
    Effort: Small.
  - **C.** Change nothing, and name the limit in the hosting guide. Effort:
    Small.
- **Left out:** Accepting any redirect, because authentication then proves
  nothing about the document.
- **Wider fix:** B, because the viewer then never relies on directory forms.
- **Previous examples:** None found.
- **Recommendation:** B, after a reproduction on such a host. It keeps the
  rule and removes the mismatch at its source.
- **Action:** ask the user, because A changes a requirement in force and the
  cause needs a reproduction first.

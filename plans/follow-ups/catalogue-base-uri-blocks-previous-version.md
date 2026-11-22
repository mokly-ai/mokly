# The catalogue CSP blocks the base of a previous version

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Small. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-22, from the branch
  `calummoore/canvas-redesign-m19-geist-in-markdown-7brr`.
- **Location:** `crates/mkc-catalogue-server/src/response.rs:208`, the
  catalogue CSP; `docs/protocol/cloud/catalogue-delivery.md:13`, its
  requirement; `packages/viewer/src/previews/presentation_document.ts:23-30`,
  the code that adds a `base` element to a previous version.
- **Reason:** Milestone 19 found it outside its scope. The fix relaxes a
  security header, so it needs Cal.

- **Source:** Implementation.
- **Category:** Security.
- **Terms:**
  - **Catalogue origin:** the sandbox domain that serves a publication's
    files in Mokly Cloud.
  - **Previous version:** the base-branch copy of a removed or changed entry,
    which the viewer shows from a comparison generation.
- **Background:**
  - The viewer shows a previous version as a document that it rewrites. It
    removes each `base` element and adds its own, so that the relative
    addresses of the copy resolve against the generation folder.
  - The catalogue origin sends `base-uri 'none'` in its CSP. That blocks every
    `base` element, also one with a same-origin address.
  - The app's embedded viewer is not affected. Fonts still load, because
    Milestone 19 gave each generation its own font copies.
- **Problem:** In a publication's own viewer on the catalogue origin, the
  browser ignores the viewer's `base` element. Relative addresses in a
  previous version then resolve against the wrong folder. Milestone 19
  inferred this for images and did not test an image.
- **Impact if no action:** Relative images and links in a previous version
  probably break in the publication's own viewer.
- **Root question:** How does a previous version on the catalogue origin
  resolve its relative addresses?
- **Options:**
  - **A.** Allow `base-uri 'self'` in the catalogue CSP and its requirement.
    It relaxes the header to same-origin bases only. Effort: Small.
  - **B.** Rewrite the relative addresses of a previous version when the
    viewer prepares it, so it needs no `base` element. Effort: Medium.
  - **C.** Change nothing, and document the limit. Effort: Small.
- **Left out:** Serving previous versions from their original folders,
  because a generation keeps its own copies by design.
- **Wider fix:** B, because it removes the need for a `base` element on every
  host.
- **Previous examples:** None found.
- **Recommendation:** A. A same-origin base keeps the sandbox isolation, and
  the change is one directive. B best protects every host.
- **Action:** ask the user, because A relaxes a security header. First add a
  browser test with a relative image in a previous version, to confirm the
  break.
- **Answer:** Cal chose **B** on 2026-11-22. Milestone 21 of the Canvas redesign
  plan does the work and deletes this item.

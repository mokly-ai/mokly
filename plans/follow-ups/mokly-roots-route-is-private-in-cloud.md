# Cloud rejects assets of extra dependency roots

- **Severity:** High. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-25, from the options check of track E decision 1 on the
  branch `calummoore/storybook-track-e-storybook-folders-87sk`.
- **Location:** `crates/mokly-css/src/paths.rs:7-18`, the portable route
  check, which accepts the `node_modules/.mokly-roots/{index}/` prefix.
  `crates/mkc-mokly-contract/src/paths.rs:79-90`, `private`, which marks every
  path segment that starts with a dot as private.
  `crates/mkc-mokly-contract/src/bundle_validation.rs:61`, which rejects an
  upload that holds a private file. The route in the test
  `crates/mokly-render/tests/integration/dependency_tests.rs:140`.
- **Reason:** The branch that found the problem changes Storybook folders,
  and this route belongs to extra dependency roots and to Mokly Cloud.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Extra dependency root:** an installation folder outside the source
    root whose packages a catalogue imports. Mokly names the files of such a
    root under `node_modules/.mokly-roots/{index}/`.
  - **Asset route:** the path under `static/mokly-generated/assets/` where
    Mokly delivers an image, a font, or another file that CSS or JavaScript
    imports.
  - **Private file:** a file that Mokly Cloud refuses to publish, such as a
    source map or a file in a dot folder.
- **Background:**
  - Mokly writes the asset of a package in an extra dependency root at a
    route such as `assets/node_modules/.mokly-roots/1/fixture-theme/icon.svg`.
  - The route check of the core accepts that one dot segment, because Mokly
    chooses it.
  - Mokly Cloud's upload check marks each path segment that starts with a
    dot as private. The upload of a build that holds such an asset then
    fails with `PrivateFile`.
  - Track E decision 1 in `plans/storybook-support.md` asks how routes of
    dot folders, such as `.storybook`, are written. Its option F writes each
    leading-dot segment in a form that starts with a letter.
- **Problem:** A static build whose CSS or JavaScript imports an asset from
  a package in an extra dependency root works in Serve and in `build`, but
  Mokly Cloud rejects its upload.
- **Impact if no action:** Such a catalogue cannot publish to Mokly Cloud,
  and the error names a private file that the user did not write.
- **Root question:** How does an asset of an extra dependency root reach a
  route that every Mokly host accepts?
- **Options:**
  - **A.** Rename the segment to a form without a dot, such as
    `node_modules/mokly-roots/{index}/`, with a check that no real package
    uses that name. Every such route changes once. Effort: Small.
  - **B.** Let Mokly Cloud accept the `.mokly-roots` segment under
    `assets/node_modules/` only. This narrows the private-file rule of the
    cloud. Effort: Small.
  - **C.** Apply option F of track E decision 1 to this segment too, so that
    one rule writes every leading-dot segment of a route. Effort: Medium.
- **Left out:** Copy such assets into the source root: they would then lose
  their stable dependency names on both sides of a comparison.
- **Wider fix:** C, because one route rule then covers every dot segment.
- **Previous examples:** None found.
- **Related:** Track E decision 1, the route of a preview in a dot folder.
  Its answer decides whether C applies.
- **Recommendation:** C when the user chooses F for track E decision 1, else
  A. One rule for every leading-dot segment keeps the core and the cloud in
  line.
- **Action:** ask the user, because no option is clearly best before the
  answer to track E decision 1.

# Factory helper exports become stories

- **Severity:** High. **Likelihood:** Common. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-24, from the implementation review of pull request
  #492, branch `conductor/storybook-support-b-story-reading`, finding 1 of
  round 1.
- **Location:** `packages/mokly/src/sidecar/story-reader.ts:43-44`, where
  the reader finds the first factory story and takes the meta from it, and
  `packages/mokly/src/sidecar/story-reader.ts:59-77`, the `compose` closure
  that copies every export of the module and calls `composeStories`.
- **Reason:** The orchestrator merged pull request #492 before its review
  findings were fixed, and asked for each open finding as an item.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **CSF Factories:** the Storybook story format in which a stories file
    has no default export. Its stories are `meta.story()` exports of a meta
    from `preview.meta()`.
  - **Story reader:** the sidecar module
    `packages/mokly/src/sidecar/story-reader.ts`. It turns each stories
    module into the stories that `describe` lists and that renders compose.
- **Background:**
  - `docs/protocol/mokly-storybook.md` defines a factories file's stories as
    its `meta.story()` exports, and says that Mokly takes the meta and the
    preview of such a file from its stories.
  - A factories file can also export plain helper data, such as
    `export const SampleData = { label: "Sample" }`. Storybook's own preview,
    through `processCSFFile`, and its indexer both keep only the
    `meta.story()` exports, so Storybook shows no story for a helper.
  - The reader finds a factory file by the first export that Storybook's
    `isStory` accepts. Then its `compose` closure passes every export of the
    module to Storybook's portable `composeStories`, helpers included.
  - Portable `composeStories` takes the meta from the first factory story
    in export key order. For a plain export, it finds no meta.
  - Description and every story render call the same `compose` closure.
- **Problem:** Read-only probes against the sidecar build of commit
  `472f624d` showed two failures:
  - A helper export that sorts before the first story stops `describe`
    with `bundle-failed: Cannot destructure property 'includeStories' of
'undefined'`. The core shows that as `build-invalid`, with no partial
    output.
  - A helper object and a helper function that sort after the story become
    the variants "Sample Data" and "Sample Label".
  - The same `includeStories` error now stops `describe` for a stories file
    that is not a factories file and has no default export. Before track B
    changed the reader, such a file got an empty meta.
- **Impact if no action:** A valid Storybook file blocks the whole catalogue
  build, or Mokly publishes pages for data that is not a story.
- **Root question:** How does Mokly take from each stories file exactly the
  stories that Storybook's own preview takes?
- **Options:**
  - **A.** Filter the exports in the one `compose` closure: pass the default
    export and only the exports that `isStory` accepts in a factories file,
    and give a module without a default export and without a factory story
    an empty meta, as before. Description and rendering both use that
    closure, so one filter fixes both symptoms. Storybook's composition still
    applies the meta's `includeStories` and `excludeStories`, as the track B
    design call of 2026-11-18 says. Test a helper that sorts before the
    story, one that sorts after it, and a file with no default export.
    Effort: Small.
  - **B.** Select one list of eligible exports before description and
    rendering, with a Mokly copy of Storybook's include and exclude rules,
    and compose only those stories. It fixes no case that A leaves. Effort:
    Medium.
  - **C.** Get the story list from Storybook's own preview code: build one
    `StoryStore` from the consumer's `storybook/preview-api` with an empty
    index, run its `processCSFFileWithCache` on the module with a fixed
    title, map each returned story back to its export by identity, and
    compose only those exports. A probe on Storybook 10.6.2 returned only
    `Primary` for a factories file and for a CSF 3 file with helpers,
    exclusions, and a `.test()` child. Risk: `processCSFFileWithCache` is an
    undocumented member, so one Storybook refactor can fail every stories
    file. Effort: Medium.
  - **D.** Get the story names from Storybook's indexer, `loadCsf` from
    `storybook/internal/csf-tools`, on the source text that the reader
    already parses for export order. Risk: a second parser, indexer errors
    such as `BadMetaError` become new build errors that need a user
    decision, and the static list can differ from the module. Effort:
    Large.
- **Left out:** An upstream Storybook fix alone fails the goal for the
  versions that consumers have installed. A warning, a rejection, or a
  guide rule against helper exports fails the goal, because Storybook
  accepts such files, and a warning fails `--strict`.
- **Wider fix:** C. Storybook's own preview decides, so the selection still
  matches when Storybook changes its rule.
- **Previous examples:** None found.
- **Recommendation:** A. One filter in the shared closure fixes both
  symptoms with the least code, and a probe showed that it drops helpers on
  both sides of the story and keeps `excludeStories`. C protects the
  codebase best, but it depends on an undocumented Storybook member.
- **Action:** fix after merge, apply A, because the pull request merged
  before its review findings were fixed.

# Guides omit what Vite image imports give

- **Severity:** Medium. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-25, from round 2 of the implementation review of the
  branch `calummoore/storybook-track-d-finish-nkpi`: a new problem that the
  finding checks of findings 113 and 142 found.
- **Location:** `docs/guides/authoring/vite.md:45`,
  `docs/guides/authoring/styles.md:86`,
  `crates/mokly-html/src/url_safety.rs:21`, and
  `crates/mokly-html/src/url_safety.rs:37`.
- **Reason:** The guides ship with the released package, and their text
  changes again when Mokly delivers these imports under the adapter.

- **Source:** Review.
- **Category:** Docs or spec.
- **Terms:**
  - **Vite adapter:** The optional compile path that compiles JavaScript and
    transforms stylesheets through the project's own Vite setup.
  - **Asset token:** A string that Mokly replaces with the URL of a
    delivered file when it composes a document.
  - **URL policy:** The rule that checks each URL of a rendered document,
    under `docs/protocol/mokly-document-safety.md`.
- **Background:**
  - Without the adapter, a JavaScript image import gives an asset token, and
    Mokly delivers the file, under `docs/protocol/mokly-imported-assets.md`.
    Under the adapter, that delivery is not available yet. The status line of
    that page says so.
  - Under the adapter, an image import gives Vite's development URL: a
    root-absolute path, or a `data:` URL for a small SVG
    (`node_modules/vite/dist/node/chunks/node.js:32534` and line 32635).
  - The URL policy rejects both in `src` and `href`, with
    `unsafe rendered document: src on <img> is not an allowed URL`
    (`crates/mokly-html/src/url_safety.rs:21` and line 37,
    `docs/protocol/mokly-document-safety.md:63`).
  - `docs/guides/authoring/styles.md:86` says that the asset delivery applies
    only without the adapter. `docs/guides/authoring/vite.md:45` to line 51
    lists what the setup supplies. Neither guide says what an image import
    gives under the adapter.
  - A stylesheet `url()` still delivers its asset under the adapter, under
    `docs/guides/authoring/vite.md:110`.
  - Guides describe the released product and carry no status line.
- **Problem:** A Vite user who imports an image meets the gap only as a build
  error that does not name the adapter.
- **Impact if no action:** Authors can spend time on an error whose cause the
  guides do not explain.
- **Root question:** How do the guides tell a Vite user what an image import
  gives under the adapter, and how to show an image until Mokly delivers it?
- **Options:**
  - **A.** Add two sentences to `docs/guides/authoring/vite.md` and one to
    `docs/guides/authoring/styles.md:86`. Under the adapter, a JavaScript
    image import gives Vite's development URL, which Mokly does not deliver,
    and a build that puts it in `src` or `href` fails. Until Mokly delivers
    it, show the image through a stylesheet `url()`. Remove the sentences
    when Mokly delivers these imports. Effort: Small.
  - **B.** Change nothing until Mokly delivers these imports under the
    adapter. Cost: users meet the unexplained build error until then. Effort:
    Small.
  - **C.** Give a build warning for each JavaScript import of an asset type
    under the adapter, until the delivery exists. Cost: a new warning code, a
    row in `docs/protocol/mokly-build-warnings.md`, and a test. `--strict`
    counts the warning, so it needs the user's approval. Effort: Medium.
- **Left out:** A status line in a guide. Guides carry no status line under
  the repository rules.
- **Wider fix:** None. Each guide sentence states the current product, and
  the `documentation` skill already covers that rule.
- **Previous examples:** The track D merge `10dd68935` scoped the styles
  guide to builds without the adapter.
- **Recommendation:** A. It explains the error and gives a working way to
  show an image, at Small effort.
- **Action:** fix after merge, apply A, because the guides ship with the
  released package, and the sentences go when Mokly delivers these imports
  under the adapter.

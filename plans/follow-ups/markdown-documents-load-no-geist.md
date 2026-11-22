# Markdown documents name Geist but load no font

- **Severity:** Medium. **Effort:** Large. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-22, from the branch
  `calummoore/canvas-redesign-m17-canvas-default-in-77ix`.
- **Location:** `docs/protocol/mokly-viewer-palette.md:57-61`, the
  requirement; `crates/mokly-html/src/document_palette.css:16-19`, the
  generated font stacks of the documents; `crates/mokly-html/src/document.css:7`
  and `:72`, the rules that read them;
  `packages/ui/scripts/palette-roles.mjs:176-184`, the document roles of the
  generator; `crates/mokly-graph/src/urls.rs:43-61`, the closure check of a
  `url()` reference; `docs/protocol/cloud/catalogue-delivery.md:13`, the
  catalogue CSP.
- **Reason:** The work waits for Cal's choice between a changed requirement
  and a font delivery that the closure check rejects today.

- **Source:** Implementation.
- **Category:** Docs or spec.
- **Terms:**
  - **Markdown documents:** the HTML pages that the `mokly-html` crate renders
    from the catalogue's Markdown files. Each one is a complete page with one
    inlined stylesheet and no script.
  - **Palette module:** `packages/ui/src/palette/palette.ts`, exported as
    `@mokly/ui/palette`. `npm run palette:generate` writes the `@mokly/ui`
    theme and `crates/mokly-html/src/document_palette.css` from it.
  - **Referenced closure:** the files that the documents of a generation
    reference. Serve, `build` and publish compute and check it, as
    `docs/protocol/mokly-public-closure.md` ("Referenced Closure") says.
- **Background:**
  - `docs/protocol/mokly-viewer-palette.md` ("Canvas Palette") says: "The
    `sans` stack is
    `"Geist", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`,
    and the `mono` stack is
    `"Geist Mono", ui-monospace, "SFMono-Regular", Menlo, monospace`. Each
    consumer that draws in Canvas self-hosts Geist and Geist Mono under the SIL
    Open Font License. No page loads a font from a third-party host."
  - The palette module generates the colours and the font stacks of the
    Markdown documents. The documents name both stacks and hold no
    `@font-face` rule, so they load no font file.
  - `origin/main` had the same gap with Inter. Its Markdown style named
    `"Inter"` first and loaded no font file, while the shell loaded Inter.
  - The shell shows each Markdown document in its own frame. The document is
    a separate page, so the `@font-face` rules of the shell's stylesheet do
    not reach it.
  - The viewer delivers `Geist-Variable.woff2` (69,488 bytes) and
    `GeistMono-Variable.woff2` (71,212 bytes), with `Geist-OFL.txt`. Serve and
    the static build serve them under `/mokly-viewer/fonts/`, and the
    standalone shell stylesheet reads them at that root-relative address. The
    cloud catalogue origin serves `/mokly-viewer/fonts/**` from the
    publication, as `docs/protocol/cloud/catalogue-hosting.md` says.
- **Problem:** The Markdown documents draw in Canvas but do not self-host Geist
  and Geist Mono, so they do not meet the requirement. A reader who does not
  have Geist installed sees the documents in the system faces, inside a shell
  that sets Geist.
- **Impact if no action:** The documents show other faces than the shell around
  them and than the Canvas design screen `design/canvas/stage/document`. The
  palette page keeps a status-line part for the gap.
- **Root question:** Which faces does a Markdown document show to a reader who
  does not have Geist installed?
- **Options:**
  - **A.** Change the requirement: the Markdown documents name the Geist stacks
    and load no font file, so a reader without Geist sees the system faces.
    Change `docs/protocol/mokly-viewer-palette.md` and
    `docs/protocol/mokly-documents.md` to say so. This changes a requirement in
    force. Effort: Small.
  - **C.** Each document loads the viewer's two Geist files from a
    document-relative address, in every delivery. The option must meet these
    facts:
    - The deliveries are Serve, the static build and the cloud catalogue
      origin. The catalogue HTML has the CSP `font-src 'self'`, so the faces
      must come from the same origin.
    - `docs/protocol/mokly-export-public-files.md:117-118` says: "Static
      delivery supports HTTP(S) deployment at the origin root. Subpath hosting
      ... are outside this contract." Outside the contract, a reader may still
      host the build under a sub-path. A document-relative address keeps
      working there, and a root-relative address does not.
    - A current document lives at `static/mokly-generated/{path}/index.html`
      or `index.dark.html`. A previous version of a removed document lives at
      `mokly-viewer/diffs/generations/{generation}/snapshots/before/mokly-generated/{path}/index.html`,
      under `docs/protocol/mokly-artifact-paths.md` and
      `docs/protocol/mokly-removed-previews.md`. So the relative address is
      different for each path and for each version.
    - Every build checks each CSS `url()` of a composed document, as part of
      the referenced closure. `local_target` in `crates/mokly-graph/src/urls.rs`
      resolves a relative reference against the document's route. It fails the
      document with `build-invalid` and the reason "unsafe or escaping URL"
      when the result is not under `static/`, or when the reference is
      root-absolute. This does not depend on `--strict`.
    - `/mokly-viewer/fonts/` is outside `static/`. So C also needs one of two
      changes: a closure rule that admits the viewer's own fonts, or a copy of
      the faces under `static/mokly-generated/` in each delivery. Either change
      adds a requirement to the referenced closure.
    - Effort: Large.
  - **D.** Put both faces inside each document as `data:` URLs. Each document
    grows by about 190 KB of base64 text, also each dark document. The closure
    check skips `data:` references, but the catalogue CSP `font-src 'self'`
    blocks `data:` fonts, so the cloud also needs a CSP change. Effort:
    Medium.
- **Left out:** B, a status-line part of the palette page that links this
  item, because it is in force and it records the gap without an answer. A face
  from a third-party host, because the palette page forbids it. System faces
  in the stacks of the documents, because the palette module generates every
  Canvas stack, and A gives the same faces with the palette's stacks.
- **Wider fix:** None. The `documentation` skill already keeps a requirement
  and its code in one change, and the Markdown documents are the one Canvas
  page that loads no face.
- **Previous examples:** `origin/main` named `"Inter"` in the Markdown style
  and loaded no font file, while the viewer delivered `InterVariable.woff2` to
  the shell.
- **Recommendation:** C. On 2026-11-20 Cal chose one Canvas look on every
  surface, generated from one open-source palette source in `@mokly/ui`, with
  a drift check (decision 1, option D), and the documents are part of that
  look.
- **Action:** ask the user, because option A changes a requirement in force
  with no recorded decision, and option C adds a closure rule that no
  requirement covers yet.
- **Done when:** The Markdown documents meet the chosen option, and the
  status-line part of `docs/protocol/mokly-viewer-palette.md` that links this
  item is gone.

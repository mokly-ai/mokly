# Two Vite setups can load one module twice

- **Severity:** Medium. **Effort:** Medium. **Confidence:** High. **Harder later:** Yes.
- **Kind:** Fix after merge.
- **Added:** 2026-11-20, from the spike for decision 18 of the Storybook
  support plan, on branch `conductor/storybook-support-j-spike-for-decision-18`,
  pull request #349, item 8 of its report.
- **Location:** None. The Vite adapter is not built yet.
- **Reason:** The code that compiles with several Vite setups does not exist
  yet. The milestone of the Storybook support plan that adds that code applies
  this answer.

- **Source:** Review.
- **Category:** Docs or spec.
- **Terms:**
  - **Vite adapter:** an optional compile path of the render sidecar's
    `bundle` request. It compiles a catalogue with the project's own Vite
    setup.
  - **Setup:** the Vite configuration that compiles a file. With Storybook,
    each Storybook folder has its own merged setup.
  - **Owner:** the setup that compiles a file. A file belongs to the deepest
    Storybook folder whose parent directory holds it.
  - **Module runner:** Vite's runtime that evaluates compiled modules in
    Node.
- **Background:**
  - The render sidecar compiles a catalogue's JavaScript into one module
    graph for each comparison side, as the
    [bundling contract](../../docs/protocol/mokly-sidecar.md#bundling) says.
    Mokly matches registered components by identity, so each module must
    load once.
  - On 2026-11-19 the user chose how the Vite adapter compiles a catalogue
    whose roots name several Storybook folders. Each file compiles with the
    setup of its owner. One module runner evaluates every module once, so
    each module keeps one identity.
  - Each import resolves in the setup that compiled the importing file. Each
    setup keeps its own aliases, resolve conditions, and `resolve.dedupe`.
    Vite applies `resolve.dedupe` from the root of each server.
  - So two setups can resolve one import, such as a workspace package name,
    to two different files. Two files are two modules, each with its own
    state.
  - A spike on 2026-11-19 with Vite 8.3.8 showed this. Two packages, `ui`
    and `app`, each had a Storybook folder. A shared workspace package
    created a React context. The `ui` setup aliased the shared package's
    name to another file of that package.
    - With one setup for each folder, the `ui` modules got the aliased
      file, and the `app` modules got the package entry. The `app` component
      provided the context through one file, and the `ui` component read it
      from the other file. So the `ui` component rendered the default value
      `alt-default` in place of the provided value `cross-package`.
    - With one setup for every file, every importer got the same file, and
      the `ui` component rendered `cross-package`.
  - The same split happens for a virtual module id that two setups serve.
    The module of each setup is a separate module.
  - The design of the adapter accepts this limit for now. Identity holds for
    each resolved file with its query, and a virtual id gives one module for
    each setup that resolves it.
- **Problem:** When two setups resolve one import to different files, the
  module loads twice. State that the module holds, such as a React context,
  a store, or a style registry, splits without a warning.
- **Impact if no action:** A catalogue renders a wrong value, and nothing
  tells the user why.
- **Root question:** How does a catalogue with several Storybook setups keep
  one module, or show the split, when two setups resolve one import to
  different files?
- **Options:**
  - **A.** Keep the limit. The guide states it, and users align their setups
    by hand. Effort: Small.
  - **B.** Warn when two setups resolve one import specifier to different
    files. The warning names the specifier, both files, and both setups. It
    fails `--strict`. Effort: Medium.
  - **C.** Resolve each workspace package name in the setup that owns the
    package, for every importer. Importers then lose their own aliases for
    that package. Splits from resolve conditions, `resolve.dedupe`, and
    installed packages stay. Effort: Medium.
- **Left out:** One resolution for each import on each side, where the first
  resolution wins: an unrelated import would then change the file that every
  importer gets. A module graph for each Storybook folder: the user did not
  choose it on 2026-11-19, because it gives a module two identities.
- **Wider fix:** B, because it reports every split, whatever setting causes
  it. C prevents the split only for workspace package names.
- **Previous examples:** None found.
- **Recommendation:** B. It shows every split, from aliases, conditions, or
  `resolve.dedupe`, and it keeps the resolution of each setup. C is the
  structural fix for workspace packages, but it overrides a setup's own
  alias.
- **Answer:** The user chose option B on 2026-11-25. Mokly warns when two setups
  resolve one import specifier to different files. The warning names the
  specifier, both files, and both setups, and it fails `--strict`.
- **Action:** fix after merge, apply B, because the user approved the new
  warning on 2026-11-25, and the code that it checks does not exist yet.

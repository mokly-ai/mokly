# Share PostCSS configuration inputs across records

- **Severity:** Low. **Effort:** Large. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-10-29, from PR #242, found by the step B integration fixture of the stylesheet bundle performance plan. Updated on 2026-11-26 with the wider fix, option E, of finding 83 of round 1 of the review of branch `calummoore/mokly-source-package-override-jkum`.
- **Location:** `collect` in `crates/mokly-render/src/postcss_inventory.rs`, the `Record` and `ContextEvidence` types in `crates/mokly-render/src/stylesheet_record.rs`, and the "Dependency Retention" section of `docs/protocol/mokly-imported-styles-postcss.md`.
- **Reason:** PR #242 shared only the module evidence of a PostCSS context, and the configuration's own files are a separate class of input.

- **Source:** Implementation.
- **Category:** Performance.
- **Terms:**
  - **PostCSS context:** one consumer PostCSS child process with its own plugin state, used for all stylesheets of one preparation attempt.
  - **Stylesheet record:** the cached bundle of one stylesheet root with the stamp of its inputs, in `crates/mokly-render/src/stylesheet_record.rs`.
  - **Module evidence:** the read evidence of the installed modules that a PostCSS context loads, such as plugins under `node_modules`.
  - **Configuration inputs:** the files that the PostCSS configuration loads from the repository, outside `node_modules`, such as the configuration file, local plugins, and their helpers.
  - **Shared context entry:** a `ContextEvidence` value that holds the private read evidence of one PostCSS context. The records of the context share it, and the cache charges it once.
- **Background:**
  - The stylesheet cache keeps one record for each stylesheet root, under a 64 MiB bound.
  - On 2026-10-27 the user chose to keep one copy of a context's module evidence, charged once and checked once for each attempt. A larger bound was rejected. The "Dependency Retention" section of `docs/protocol/mokly-imported-styles-postcss.md` states this decision.
  - PR #242 implemented that choice and merged on 2026-10-29. Its integration fixture has 64 roots and a PostCSS configuration that loads 1,000 installed modules. So 64 copies of the module evidence would exceed the bound.
  - The configuration inputs are still inputs of each record. The worker reports them as plugin dependencies of each stylesheet. Each record keeps its own copy of their contents, dependency digests, plugin input entries, and read evidence. `collect` gathers these inputs.
  - Each input gets an entry for its reported path and one for its link target, because a base can need either path.
  - The review of 2026-11-26 found about 2.4 KB of entries for each configuration input in each record, on `origin/main`.
  - Until 2026-11-26 the worker also sent a cumulative `bundledImports` list with each stylesheet, and each record kept a copy. The review branch replaced that list with a tag on the plugin input entry of each file that a PostCSS bundle reached. The `ignored-module` warning reads that tag.
- **Problem:** Each record of a context keeps its own inventory of the same configuration inputs, and the cache charges each copy.
- **Impact if no action:** A configuration that loads many such files can fill the bound again. For 400 records and 500 configuration inputs, the copies already pass 64 MiB on `origin/main`. The store then clears its records, and every root bundles again.
- **Root question:** How do the records of one PostCSS context share the inventory of its configuration inputs?
- **Options:**
  - **A.** Keep the entries on each record, but store each distinct set of configuration input entries once, under its digest, and charge it once. The evidence of a context grows with each request, so overlapping sets still take space. Effort: Medium.
  - **C.** Send a versioned reference to the inventory of the context with each worker response. Keep one shared stream of additions across the worker protocol and the cache. Effort: Large.
  - **E.** Move the inventory of the configuration inputs into the shared context entry, as PR #242 did for the module evidence. Effort: Large.
    - Each record keeps only the reports of its own stylesheet.
    - Check the stamp of the configuration inputs once for each attempt.
    - Restore the entries and their tags when the cache delivers a bundle, so the inventory, the watch, and the warning still get them.
- **Left out:** A larger cache bound, because the user rejected it on 2026-10-27.
- **Wider fix:** E. It reuses the sharing and charging of the shared context entry as the inventory grows.
- **Previous examples:**
  - Commit `ee7d8ea73` of PR #242 moved the module evidence of a context into shared context entries after copies filled the same cache.
  - On 2026-11-26 the review branch replaced the repeated `bundledImports` list with a tag on the existing entries.
  - `plans/follow-ups/postcss-request-order-varies.md` records that the cumulative evidence of a context depends on the order of requests.
- **Related:** [stylesheet-cache-across-restarts.md](./stylesheet-cache-across-restarts.md): same data. A stored record format would copy these inputs too.
- **Recommendation:** E. It keeps one copy of each configuration input for each context, as the decision of 2026-10-27 does for the module evidence.
- **Action:** fix after merge, apply E, because the change reaches the worker evidence and the record format, and the problem predates the review branch of 2026-11-26.
- **Done when:**
  - The records of one PostCSS context share one copy of the configuration inputs.
  - The smallest test that fails without the change passes. For example, two roots whose configuration loads the same local file share one copy of its inputs, charged once.
  - A one-time check with about 1,000 local plugin files keeps every record within the 64 MiB bound. Its output is saved under `.context/`.
  - A second preparation with no change bundles nothing.

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/ee7d8ea739bd103aacd001f8e75e5aa144929348/plans/stylesheet-bundle-performance.md?plain=1#L642).

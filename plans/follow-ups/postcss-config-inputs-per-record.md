# Share PostCSS configuration inputs across records

- **Severity:** Low (estimate). **Effort:** Medium. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Post-merge task.
- **Added:** 2026-10-29, from PR #242, found by the step B integration
  fixture of the stylesheet bundle performance plan.
- **Location:** `crates/mokly-render/src/postcss_inventory.rs:21` and
  `crates/mokly-render/src/stylesheet_record.rs:32`.
- **Reason:** PR #242 shares only the module evidence of a PostCSS context.
  The configuration's own files are a separate class of input.

- **Terms:**
  - **PostCSS context:** one consumer PostCSS child process with its own
    plugin state, used for all stylesheets of one preparation attempt.
  - **Stylesheet record:** the cached bundle of one stylesheet root with the
    stamp of its inputs, in `crates/mokly-render/src/stylesheet_record.rs`.
  - **Module evidence:** the read evidence of the installed modules that a
    PostCSS context loads, such as plugins under `node_modules`.
- **Background:**
  - The stylesheet cache keeps one record for each stylesheet root, under a
    64 MiB bound.
  - On 2026-10-27 the user chose to keep one copy of a context's module
    evidence, charged once and checked once for each attempt. A larger
    bound was rejected.
  - PR #242 implemented that choice and merged on 2026-10-29. Its
    integration fixture has 64 roots and a PostCSS configuration that loads
    1,000 installed modules, so 64 copies of the module evidence would
    exceed the bound.
  - The files that the PostCSS configuration loads from the repository,
    outside `node_modules`, are still inputs of each record. Each record
    keeps its own copy of their contents, dependency digests, plugin input
    entries, and read evidence. `collect` in
    `crates/mokly-render/src/postcss_inventory.rs:21` gathers these inputs.
- **Task:**
  1. Share these configuration inputs across the records of a context, like
     the module evidence.
  2. Check their stamp once for each attempt.
  3. Add the smallest test that fails without the change. For example, two
     roots whose configuration loads the same local file share one copy of
     its inputs, charged once. Check the scale once with about 1,000 local
     plugin files, and save the output under `.context/`.
- **Impact if no action:** A configuration that loads many such files can
  fill the bound again. The store then clears its records, and every root
  bundles again.
- **Needs:** Nothing. The task needs no deployed change and no credentials.
- **Done when:** The records of one PostCSS context share one copy of the
  configuration inputs. A one-time check with about 1,000 local files keeps
  every record within the 64 MiB bound. A second preparation with no change
  bundles nothing.

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/ee7d8ea739bd103aacd001f8e75e5aa144929348/plans/stylesheet-bundle-performance.md?plain=1#L642).

# Share PostCSS configuration inputs across records

- **Severity:** Low. **Effort:** Medium.
- **Kind:** Post-merge task.
- **Added:** 2026-10-29, from PR #242, found by the step B integration
  fixture of the stylesheet bundle performance plan.
- **Location:** `crates/mokly-render/src/postcss_inventory.rs` and
  `crates/mokly-render/src/stylesheet_record.rs`.
- **Reason:** Step B shares only the module evidence of a PostCSS context.
  The configuration's own files are a separate class of input.

The stylesheet cache keeps one record for each stylesheet root, under a
64 MiB bound. PR #242 keeps one copy of each PostCSS context's module
evidence for all records of the context. The files that the PostCSS
configuration loads from the repository, outside `node_modules`, are still
inputs of each record. Each record keeps its own copy of their contents,
dependency digests, plugin input entries, and read evidence. A
configuration that loads many such files can fill the bound again, and the
store then clears its records.

The task: share these configuration inputs across the records of a
context, like the module evidence, with one stamp check for each attempt.
A fixture with about 1,000 local plugin files shows the problem. The task
needs no deployed change or credentials.

# Protocol Scope And Formats

These documents define Mokly's implemented pre-release contract unless a
Delivery Status names an approved active-plan target. The [path contract](./mokly-paths.md) defines the
path-based formats: every entry is identified by a path derived from its file,
Markdown files are documents, and moves are paired with their baseline.

## Delivery Status

The generated tree, file-derived paths, component stylesheets and uniform CSS
evidence are implemented under the combined manifest v10, catalogue v6 and
review v7. [Documentation policy](./documentation-policy.md#delivery-status)
records the earlier delivery items. The [implementation plans](../../plans/)
record active work.

The [scalable analysis plan](../../plans/scalable-inline-style-analysis.md)
records the delivered parse reuse, bounded caches, style-only comparison,
fingerprints and inline evidence. Performance acceptance is deferred under
Decision 13 (2026-10-06). The separate inline Details block remains an active
mockup and UI target in that plan.

## Graceful Handling

For duplicate CSS, configured-link placement or overlap, stylesheet owners and
the three removed inputs in [Build Warnings](./mokly-build-warnings.md#record), continue with safe, unambiguous output. Use the more specific
input. Warn when an authored input is discarded. Confinement, source protection
and retained-input validation still apply. Other unknown fields, folder JSON
and document front matter keep their owning rules. [Build Warnings](./mokly-build-warnings.md)
owns reporting. These warnings succeed normally; strict Build, Check, export
and publish fail before writes or uploads. Serve refuses strict mode.

## Supported Formats

The [catalogue format table](./mokly-catalogue.md#supported-formats) lists the
manifest and comparison versions for both catalogue kinds.

Current output uses manifest v10, review result v7 and public read model v6.
The catalogue contract owns their metadata, move fields and current-reader
rules.

The [complete format inventory](./mokly-format-versions.md) also defines
bootstrap, inspector, capability, cache and transport versions. Readers reject
unsupported versions before content or path interpretation.

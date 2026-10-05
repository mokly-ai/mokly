# Source Protection Acceptance

Continuation of [mokly-source-protection](./mokly-source-protection.md).

## Acceptance

Add tests before implementation for abandoned reserved files, removing their
last import, config/renderer/transformer/helper imports that no root glob
matches, entry modules co-located beside product components, tree-shaken
inputs, local workspace packages, and arbitrary helper filenames.
Test missing/stale inventories, logical and realpath aliases, symlink escapes,
mixed source/asset roles, reserved output routes, and rejected protected links.
Cover outside config, entry, renderer, transformer, page-helper, and raw-template
imports, while proving installed dependencies outside the root still load.

Exercise the same fixtures through GET/HEAD `/static`, resource validation,
current and historical Review reads, and both publication options. Verify that
CSS, fonts, images, and public scripts still work. Test watcher reclassification
after dependency changes and prove default publication validation uses no Git.
Cover internal manifests, their symlink aliases, generated links/resources,
ordinary public JSON, compatible v8 baselines, and incompatible-name sentinels.
Cover every shipped exclusion at root and nested paths, mixed case, dot-directories,
consumer extensions, alias matches in either direction, and excluded generated
routes/references. Prove excluded README edits create no public content evidence,
real imported inputs still rebuild, and ordinary CSS, images, HTML and JSON remain
public when no rule protects them.

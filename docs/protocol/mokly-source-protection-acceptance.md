# Source Protection Acceptance

Continuation of [source protection](./mokly-source-protection.md).

## Acceptance

Add tests before implementation for abandoned reserved files, removing their
last import, config/renderer/helper imports that no root glob
matches, entry modules co-located beside product components, tree-shaken
inputs, local workspace packages, and arbitrary helper filenames.
Test missing/stale inventories, logical and realpath aliases, symlink escapes,
mixed source/asset roles, reserved output routes, and rejected protected links.
Cover outside config, entry, renderer, page-helper, and raw-template
imports, while proving installed dependencies outside the root still load.

Exercise the same fixtures through GET/HEAD `/static`, resource validation,
current and historical Review reads, and both publication options. Verify that
CSS, fonts, images, and public scripts still work. Test watcher reclassification
after dependency changes and prove default repository preview validation uses no Git.
Cover internal manifests, their symlink aliases, generated links/resources,
ordinary public JSON, v9 internal reads and earlier-envelope rejection.
Cover unreferenced files at root and nested paths, aliases in either direction,
missing and protected closure references, and `mokly-generated/` escapes. Prove
unreferenced README edits create no public content evidence, real imported
inputs still rebuild, and referenced CSS and images remain public when no
source-protection rule denies them.

Component-declared CSS passes the same public-file and resource checks.
Reject symbolic links at every component of declared CSS and renderer-link
paths, including confined file and directory links. Valid repeated file
declarations and body-link reuse remain supported.
Renderer CSS owner records are ignored only after those checks. Non-CSS owners
and document-style ranges retain their validation and attribution.

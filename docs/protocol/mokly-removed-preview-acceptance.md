# Removed Preview Acceptance

This document owns the acceptance coverage for
[Removed Content Previews](./mokly-removed-previews.md).

Regressions cover removed screens through selected and complete comparison
paths in both output modes, removed pages and documents with deleted assets
and changed baseline CSS, paired moved entries that produce no preview, path
traversal and symlinks, current same-path files, malformed
and mixed selections, incompatible baselines, coalescing, refresh,
invalidation, cancellation, shutdown, idle recovery, both frame adapters,
read-only enforcement, static delivery without renewal traffic, current-only
delivery with zero historical work, and the strict v4 catalogue reader.
Embedded viewer coverage proves both adapters keep plain external and relative
links inert.

Presentation coverage accepts a final URL that only drops the `.html` suffix;
rejects other redirects, origin changes, non-HTML and oversized documents;
removes meta refresh; folds the first consumer base into the effective base;
preserves doctypes while quirks and standards documents both render in
no-quirks mode; owns same-document anchor scrolling; restores presentation
after frame navigation; and loads historical resources in an embedded host
with a strict Content Security Policy. Presentation-follower tests prove the
commit-time guard, including comparison panes with slow resources.

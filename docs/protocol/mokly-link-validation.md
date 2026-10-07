# Final Logical Link Validation

The [navigation contract](./mokly-navigation.md) owns logical links, markers
and Browse behavior. Build and on-demand rendering use the same final checks.

After child-control adaptation and logical-link rewriting, retain each
reference's source route, target entry path and optional fragment. Index anchors
from the final generated documents. Check each fragment across all required
destination views. A missing or renamed anchor fails with its referring route.

Authored reserved markers and duplicate navigation attributes fail validation.
A document with an activatable logical link cannot contain `<base href>`.
`<base target>` remains supported. Package markers never grant source or
resource access; targets must belong to the accepted generation or the checked
[public closure](./mokly-public-closure.md).

No consumer transformer runs between rewriting and final validation. Pages
return complete portable documents; configured renderers supply screen and
component views. Generated documents carry only the plain notice, which grants
no ownership. [Markdown documents](./mokly-documents.md) also pass the final
allowlist in `documents/safety.ts` after link rewriting. That check preserves
the owned document template and rejects unsafe body markup.

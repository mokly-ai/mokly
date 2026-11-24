# Runtime Sidecar Pool

This page supplements the [runtime contract](./mokly-runtime.md) with the
rules of its sidecar pool.

## Sidecar Pool

A sidecar starts when the catalogue uses any of these inputs:

- A JavaScript entry or registered JavaScript component.
- A Storybook stories file.
- A configured renderer module.
- A stylesheet processed by a consumer PostCSS module.

HTML, YAML, and Markdown alone start no sidecar. The
[sidecar contract](./mokly-sidecar.md) defines pool size, deadlines, recycling,
and failure codes. The core selects renders, cache keys, invalidation, and
document composition. A sidecar failure fails only the request that needs it,
with its typed code. Other routes and shutdown stay available.

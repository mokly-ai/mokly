# Deployment and security

This page belongs to the [`@mokly/viewer` README](../../README.md). It explains how to host the catalogue files for the viewer.

The catalogue is static files. `mokly build` writes the shell stub, the index,
the deployment file, one detail per entry, the documents, the comparison generation, the shell
bundle, styles, and fonts into one output directory. Deploy that directory at
the root of an HTTP(S) origin with correct MIME types, `index.html` directory
indexes, query-insensitive file lookup, and no SPA fallback; the host runs no
process. The viewer derives every file from an entry's path: shell pages at
`/view/<path>/`, rendered views and documents under
`/static/mokly-generated/`, the index at `/mokly-viewer/index.json`, the
deployment file at `/mokly-viewer/deployment.json`, and the details under
`/mokly-viewer/entries/`. The
[static delivery contract](../../../../docs/protocol/mokly-export-delivery.md) and the
[viewer namespace](../../../../docs/protocol/mokly-viewer-namespace.md#public-paths)
define the complete path, header, sandbox, and CSP requirements.

- **Same origin:** no CORS configuration is needed. Omit `frameAdapter` or pass
  `sameOriginAdapter()` explicitly. Frames keep the sandbox `allow-same-origin`,
  and consumer scripts stay disabled.
- **Cross origin:** configure `postMessageAdapter` with the catalogue's exact,
  real origin; an opaque `null` origin is rejected. Send
  `Access-Control-Allow-Origin: <exact app origin>` and
  `X-Content-Type-Options: nosniff` on GET, HEAD, and error responses for every
  [public path](../../../../docs/protocol/mokly-viewer-namespace.md#public-paths)
  of the catalogue. Use
  `Vary: Origin` when you select the allowed origin dynamically. The viewer uses
  no wildcard CORS and no credentials; it fetches with `credentials: "omit"`.
  Frames use `sandbox="allow-same-origin allow-scripts"`, so the published
  inspector at `mokly-viewer/client/inspector.js` runs inside current
  documents, and the host must ignore the `mokly-host` query parameter for file
  lookup.
- **Caching:** the deployment file, index, and details of one deployment never change. Serve
  them with revalidation, `Cache-Control: no-cache` or an equivalent validator
  policy, so the next navigation sees a new deployment. A comparison generation
  is immutable at its content-addressed path. A deployment file with another
  `deploymentId`, or a detail whose `detailId` is not listed by the index, makes
  the embedded viewer emit one `onError` and the standalone shell reload the
  page. An embedded viewer checks the deployment file only when it fetched the
  index from a URL. It checks with each detail request of an in-shell navigation
  and before comparison or removed-entry requests. An object index does not
  request the file. The standalone shell keeps the check for static catalogues.
  It does not request the file on the first load. A missing or unreadable file
  changes nothing.
- **Content Security Policy:** removed previews and comparison panes render in
  viewer-owned, script-disabled `srcdoc` frames. A restrictive policy must
  allow the catalogue origin for the documented resource types and the inline
  styles of those documents; this grants no script execution.
- **Serve:** `mokly serve` binds `127.0.0.1`, sends no
  `Access-Control-Allow-Origin` header on any route, and answers the live
  descriptor, the event stream, and the control routes to its same-origin shell
  only. The static output contains none of them.

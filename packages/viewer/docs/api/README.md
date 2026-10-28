# API reference

This page belongs to the [`@mokly/viewer` README](../../README.md). It lists the props, the handle methods, and the package entry points.

## `<MoklyViewer>`

| Prop                                 | Purpose                                                                                                            |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `index`                              | The catalogue index v8 as an object, or its absolute HTTP(S) URL                                                   |
| `detail`                             | Function from an entry path and an optional snapshot id to one entry detail v3, its URL, or a promise of either    |
| `baseUrl`                            | Required origin root for an object `index`; invalid for a URL `index`                                              |
| `frameAdapter`                       | Preview transport; defaults to `sameOriginAdapter()`                                                               |
| `theme`                              | Interface appearance, independent of preview selection; defaults to `"auto"`                                       |
| `defaultSelection`                   | Partial initial selection for uncontrolled mode                                                                    |
| `selection`                          | Complete host-owned `ViewerSelection`                                                                              |
| `onSelectionChange`                  | Receives viewer selection proposals                                                                                |
| `slots`                              | Host content for `topBarStart`, `topBarEnd`, `railStart`, `railEnd`, `sidePanel`, `stageOverlay`, and `emptyState` |
| `markers`                            | Host-owned content anchored to component instances                                                                 |
| `onMarkerChange`                     | Reports each marker as visible, hidden, or unavailable                                                             |
| `onScreenNavigate`                   | Reports committed navigation for host routing                                                                      |
| `onInstanceHover`, `onInstanceClick` | Reports interaction with inspectable component instances                                                           |
| `onPickStart`, `onPickEnd`           | Reports the instance-picking lifecycle                                                                             |
| `onError`                            | Reports safe errors with code `catalogue`, `version`, `selection`, `frame`, `comparison`, or `markers`             |
| `ref`                                | Exposes the `MoklyViewerHandle` methods below                                                                      |

`sidePanel` takes `{ content, width }`, and `stageOverlay` takes
`{ content, pointerEvents }`, where the host chooses `"none"` or `"auto"`.
`emptyState` replaces only the home body when no entry is selected.

## `MoklyViewerHandle`

| Method                          | Purpose                                                              |
| ------------------------------- | -------------------------------------------------------------------- |
| `select(partial)`               | Merge a partial selection into the current state                     |
| `highlightInstance(instance)`   | Highlight one exact instance; pass `null` to clear                   |
| `highlightInstances(instances)` | Atomically highlight several instances; pass an empty array to clear |
| `scrollToInstance(instance)`    | Bring an exact instance into view                                    |
| `startPick()`                   | Start component picking after the current view is inspectable        |
| `cancelPick()`                  | Idempotently cancel active or pending picking                        |

Highlighting, scrolling, and picking are asynchronous because preview frames
can be loading. Await their promises and handle rejection. The
[viewer contract](../../../../docs/protocol/mokly-viewer.md) defines the exact event
order, cancellation, and evidence refresh.

## Package entry points

| Import                     | Purpose                                                                                                                      |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `@mokly/viewer`            | `MoklyViewer`, its types, the frame adapters, `resolveInstance`, and the readers of the catalogue index and the entry detail |
| `@mokly/viewer/styles.css` | The scoped stylesheet of an embedded root; import it once                                                                    |
| `@mokly/viewer/browser`    | Mounts the standalone Browse shell into the stub that `mokly serve` and `mokly build` deliver                                |
| `@mokly/viewer/data`       | Pure path functions, directory names, the path grammar, and the prop schema validators, with no React dependency             |

React applications need only the root entry and the stylesheet. Do not import
`@mokly/viewer/browser` in an application-owned React root: it mounts the
standalone shell into the stub's `data-mokly-shell` element, and Serve and
`build` deliver it as `/mokly-viewer/client/shell.js` with React bundled in.

The readers validate an index or a detail that a host reads itself. Each reader
accepts exactly one format number and rejects every other with a typed
`MoklyVersionError` whose diagnostic reads
`Unsupported Mokly <boundary> version <version>; this viewer supports version <supported>.`
The embedded viewer reports the same failure through `onError` with code
`version`. The
[format version inventory](../../../../docs/protocol/mokly-format-versions.md#version-inventory)
lists every boundary.

`@mokly/viewer/data` exports the path functions and the directory names
`GENERATED_DIRECTORY` and `VIEWER_DIRECTORY` of the
[artifact path contract](../../../../docs/protocol/mokly-artifact-paths.md), the
grammar functions `isPathSegment`, `isEntryPath`, and `isWindowsDeviceName` of
the [path contract](../../../../docs/protocol/mokly-paths.md), the link grammar
functions `isLinkPath` and `isLogicalFragment` of the
[authoring links](../../../../docs/protocol/mokly-authoring.md#links), and the
profile validators `validatePropSchema` and `validateProps` of the
[entry props contract](../../../../docs/protocol/mokly-entry-props.md#prop-schema-profile),
which generate no code; it has no React dependency.

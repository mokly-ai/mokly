---
title: "Export files"
description: "The files an export writes, the marker that lists them and the headers a host serves them with."
section: "reference"
order: 1
---

## Layout

`mokly export` and `mokly publish` write one directory of static files. Paths
are relative to its root:

| Path                                | Contents                                                       |
| ----------------------------------- | -------------------------------------------------------------- |
| `index.html`                        | The catalogue home                                             |
| `404.html`                          | The catalogue's not-found page                                 |
| `view/<route>`                      | The catalogue page for each entry                              |
| `id/<id>/index.html`                | The same page, addressed by the entry's id                     |
| `static/`                           | Your rendered screens and pages with the files they use        |
| `__mokly/catalogue.json`            | The entries, collections and changes the viewer reads          |
| `__mokly/diffs/__generations/<id>/` | The comparison with your base: `review.json` and its snapshots |
| Other files under `__mokly/`        | The catalogue's scripts, styles and fonts                      |
| `.mokly-export-artifact`            | The ownership marker described below                           |
| `mokly-upload.json`                 | The upload manifest, written only by `mokly publish`           |

Catalogue pages keep their `.html` suffix. An export has exactly one comparison
directory under `__mokly/diffs/__generations/`, and a catalogue published with
`--no-changes` has none. The source manifest a build writes beside your
generated files is never part of an export.

## The ownership marker

`.mokly-export-artifact` is UTF-8 JSON that lists every other file in the
export. A shortened example:

```json
{
  "schemaVersion": 1,
  "files": ["404.html", "index.html", "view/account/home.html"]
}
```

- `schemaVersion` is the number `1`.
- `files` holds one path for each regular file except the marker itself.
  Directories are implicit, and order carries no meaning.
- Each path is relative and slash-separated, with no empty, `.` or `..`
  segment, and no backslash, colon or NUL character. Unicode is allowed.
- No two paths are equal after lowercasing with JavaScript's `toLowerCase()`,
  without Unicode normalization: `A.html` and `a.html` collide, while `ß.html`
  and `ss.html` do not.
- Readers ignore fields they do not recognise, and those fields never add to
  the list.

The marker records which files the export owns, so a later export into the same
directory replaces only those. A receiver uses it to confirm that an upload is
complete. It describes the files; it does not prove where they came from.

The package ships marker test cases at
`node_modules/@mokly/mokly/docs/protocol/fixtures/export-ownership-v1.json`.
Each item in its `cases` array has a `name`, a `document` to parse and a
`valid` flag saying whether that document is a well-formed marker.

## Serving an export

Serve the directory as the document root of an HTTP(S) origin of its own:

- Serve each file at its path with its correct MIME type, and `index.html` for
  a directory, so `/id/<id>/` opens the entry's page.
- Serve directories whose names begin with an underscore, including
  `__mokly/`.
- Look files up without the query string; catalogue addresses carry queries
  such as `?fragment=summary`.
- Answer other requests with your normal not-found response. `404.html` can be
  the error document.
- No rewrite rule, single-page fallback, server function or Mokly process is
  needed.
- Hosts that remove `.html` from addresses work when their redirects keep the
  query string.

Deploy atomically, or as an immutable deployment, so a reader never loads files
from two exports.

## Caching headers

| Files                  | Headers                                                         |
| ---------------------- | --------------------------------------------------------------- |
| Under `__mokly/diffs/` | `Cache-Control: no-store` and `X-Content-Type-Options: nosniff` |
| Everything else        | Revalidate before reuse, for example `Cache-Control: no-cache`  |

A comparison's directory under `__mokly/diffs/__generations/` is named after
its content, so a changed comparison gets a new directory. Keeping earlier
directories for a while lets a tab opened before a deployment keep loading its
comparisons; once they are gone, that tab shows a comparison error until it
reloads.

## Embedding from another origin

An application that embeds the catalogue with `@mokly/viewer` from a different
origin reads these files across origins:

- `__mokly/catalogue.json` and `__mokly/shell.css`;
- everything under `static/`, `__mokly/client/` and `__mokly/fonts/`; and
- everything under `__mokly/diffs/__generations/`.

Send these headers on every response for those files, including `HEAD`
requests and errors:

```http
Access-Control-Allow-Origin: https://app.example.com
X-Content-Type-Options: nosniff
```

Name the embedding application's exact origin rather than `*`, and add
`Vary: Origin` when you choose the allowed origin per request. The viewer sends
no cookies or credentials, so no credential headers are needed, and a
catalogue on the same origin as its viewer needs no cross-origin headers. The
viewer's own configuration for a separate origin is in the `@mokly/viewer`
package README.

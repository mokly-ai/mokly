# The app's HTML checks count commented links

- **Severity:** Low. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-24, from the review of the branch `calummoore/favicons-app-icons-new-logo-jbsc`: the wider fix of finding 3, and the check's problem outside the scope.
- **Location:** `packages/app/scripts/document-paths.mjs` (`localDocumentReferences`), `packages/app/scripts/verify-web-build.mjs` (the viewer stylesheet count and the script entry), `packages/app/package.json`.
- **Reason:** The fix makes `build:web` fail on a commented-out link, which is a stricter build check that the user must approve.
- **Category:** Test.

- **Terms:**
  - **Export verifier:** `packages/app/scripts/verify-web-build.mjs`, which `npm run verify:web` and the web build run on the exported `dist/index.html`.
  - **parse5:** The HTML parser in the root devDependencies. `tests/helpers/html.ts` wraps it with `documentElements` and `attribute`.
- **Background:** The app's static export links its stylesheets, its script entry and its favicon from `index.html`. The export verifier checks that the document links the viewer stylesheet `/mokly-viewer/styles.css` exactly once, and it finds the script entry with a regular expression. `document-paths.mjs` collects every `href` and `src` value with a regular expression over the text. On 2026-11-24 the favicon logic test `packages/app/src/_tests_/favicon.test.ts` moved from a regular expression to the parse5 helper, because a commented-out icon link still passed it.
- **Problem:** The export verifier counts `href` text, not elements. A commented-out viewer stylesheet link, or one inside `<template>` or `<noscript>`, still passes the "exactly once" check, although the browser loads no stylesheet. A check on `dist/index.html` with the link commented out passed.
- **Impact if no action:** An edit that disables the viewer stylesheet link can pass the web build, and the hosted viewer then renders without its styles.
- **Root question:** How do the app's HTML checks see only the elements that a browser acts on?
- **Options:**
  - **A.** Make `document-paths.mjs` parse the HTML with parse5 and make it the app's one HTML reader. The export verifier reads the viewer stylesheet link and the script entry through it, and the favicon test can use it too. Add `parse5` to `packages/app/package.json` devDependencies. Effort: Medium.
  - **B.** Strip HTML comments before the regular expressions run. Links inside `<template>` or `<noscript>` still count. Effort: Small.
  - **C.** Check the served document in the app's browser suite. It tests at a higher level than the lowest level that fails. Effort: Medium.
- **Left out:** None.
- **Wider fix:** A. One parser for every HTML check in the app removes the wrong case for all of them.
- **Previous examples:** `tests/helpers/html.ts` already parses documents so that markup inside JSON scripts does not match.
- **Recommendation:** A. It removes the false pass for every check in the app with one shared reader.
- **Action:** ask the user, because the recommended option makes the web build fail on a document that passes today, which is a stricter build check.

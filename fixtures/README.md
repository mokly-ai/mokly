# Shared Test Fixtures

This directory owns synthetic inputs shared by Rust tests and running-API
smokes. Publication tests and API smoke maintainers jointly maintain these
fixtures; consumers reference this source directly and must not copy it into
crate-private test trees or product code.

`viewer-share-url.txt` is the canonical path-based URL used by the API share
projection test and the app URL-reader test. Both tests read this file
directly. It selects `Product/Welcome_1`, mobile, and dark without a grant.
Both tests use this path to check authored case and nested-path encoding.

`desktop-origin.json` holds the privileged desktop origin. The `mkc-domain`
test pins `client_origins::DESKTOP_ORIGIN` to it. The API and catalogue origin
integration smokes read it too, and so does the web app through
[`desktop-fixture.ts`](../packages/app/src/_tests_/desktop-fixture.ts): its logic
tests pin `isDesktopShell()` to the origin, and its browser tests request
links with it. The Electron shell's origin test reads the same fixture from
`packages/desktop/src/_tests_/contracts.test.ts`. Consumers read the fixture directly.

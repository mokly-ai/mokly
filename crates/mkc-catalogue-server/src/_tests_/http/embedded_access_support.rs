//! In-memory catalogue files and requests for the embedded access route.

use std::collections::BTreeMap;

use axum::http::request::Builder;
use mkc_domain::blob::BlobHash;
use mkc_publications::access::CatalogueAccessMock;
use mkc_publications::error::Error;
use unimock::{MockFn, Unimock, matching};

use crate::catalogue::PublishedCatalogue;
use crate::test_support::{ID, indexed_catalogue};

pub(super) const START_PATH: &str = "mokly-viewer/client/access-start.html";
pub(super) const WORKER_PATH: &str = "mokly-viewer/client/access-worker.js";
pub(super) const START_BYTES: &[u8] = b"<html><script>/* published start page */</script></html>";
pub(super) const WORKER_BYTES: &[u8] = b"/* published worker */";
pub(super) const PRIVATE_FILES: &[(&str, &[u8])] = &[
    ("index.html", b"home"),
    ("mokly-viewer/index.json", b"{}"),
    ("static/screen.html", b"<p>Private screen</p>"),
    ("mokly-viewer/client/access-start.html.bak", START_BYTES),
    ("mokly-viewer/client/Access-Worker.js", WORKER_BYTES),
    ("404.html", b"not found"),
];

pub(super) fn embedded_catalogue(access: Unimock) -> PublishedCatalogue {
    indexed_catalogue(access, embedded_files(), false)
}

pub(super) fn embedded_files() -> BTreeMap<String, Vec<u8>> {
    let mut files = PRIVATE_FILES
        .iter()
        .map(|&(path, bytes)| (path.to_owned(), bytes.to_vec()))
        .collect::<BTreeMap<_, _>>();
    files.insert(START_PATH.into(), START_BYTES.to_vec());
    files.insert(WORKER_PATH.into(), WORKER_BYTES.to_vec());
    files
}

pub(super) fn anonymous_private() -> Unimock {
    Unimock::new(
        CatalogueAccessMock::authorize
            .each_call(matching!(&ID, None, _))
            .answers(&|_, _, _, _| Err(Error::Unauthorized)),
    )
}

pub(super) fn blob_url(path: &str, bytes: &[u8]) -> String {
    format!("/__blobs/{}/{path}", BlobHash::digest(bytes))
}

pub(super) fn iframe(request: Builder) -> Builder {
    request
        .header("Sec-Fetch-Mode", "navigate")
        .header("Sec-Fetch-Dest", "iframe")
}

//! Catalogue fixtures backed by exact in-memory query and storage expectations.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use std::collections::BTreeMap;
use std::io;
use std::sync::Arc;

use bytes::Bytes;
use futures_util::{StreamExt, future, stream};
use mkc_domain::blob::{BlobHash, BlobKey};
use mkc_domain::ids::{OrganizationId, ProjectId, PublicationId};
use mkc_domain::values::Visibility;
use mkc_file_store_interface::store::FileStoreMock;
use mkc_file_store_interface::stream::{BlobBody, BlobStream};
use mkc_publications::access::{CatalogueAccessMock, CatalogueContext};
use mkc_publications::locations::Locations;
use mkc_publications::transaction::{QueryWork, TransactionsMock};
use mkc_store_interface::blob::{BlobsMock, PublicationFile};
use mkc_store_interface::project::Project;
use mkc_store_interface::publication::{Publication, PublicationState};
use mkc_store_interface::publication_changes::Changes;
use unimock::{MockFn, Unimock, matching};
use uuid::Uuid;

use crate::catalogue::{PublishedCatalogue, Request};

pub(crate) const ID: PublicationId = PublicationId(Uuid::from_u128(7));

pub(crate) fn body(bytes: impl Into<Bytes>) -> BlobBody {
    Box::pin(stream::once(future::ready(Ok(bytes.into()))))
}

pub(crate) async fn read_body(mut body: BlobBody) -> io::Result<Vec<u8>> {
    let mut output = Vec::new();
    while let Some(bytes) = body.next().await {
        output.extend_from_slice(&bytes?);
    }
    Ok(output)
}

pub(crate) fn locations() -> Locations {
    Locations {
        app_origin: "https://app.example.com".into(),
        catalogue_domain: "br-main.preview.example.net".into(),
        catalogue_scheme: "https".into(),
        catalogue_port: None,
    }
}

pub(crate) fn publication() -> Publication {
    let now = "2026-09-16T12:00:00Z".parse().unwrap();
    Publication {
        id: ID,
        project_id: ProjectId(Uuid::from_u128(8)),
        metadata: None,
        state: PublicationState::Ready,
        failure: None,
        changes: Some(Changes::NoComparison),
        created_at: now,
        deadline: now,
        expired_at: None,
        build_id: None,
        build_failure_event_id: None,
    }
}

pub(crate) fn request(path: &str) -> Request {
    Request {
        host: locations().authority(ID),
        path: path.into(),
        query: None,
        cookie: None,
        range: None,
        if_range: false,
        if_none_match: None,
        head: false,
    }
}

pub(crate) fn catalogue(private: bool, head_or_redirect: bool) -> PublishedCatalogue {
    catalogue_with_clear_cookie(private, head_or_redirect, false)
}

pub(crate) fn catalogue_with_clear_cookie(
    private: bool,
    head_or_redirect: bool,
    expire_cookie: bool,
) -> PublishedCatalogue {
    let paths = [
        "index.html",
        "404.html",
        "view/a.html",
        "view/legacy.htm",
        "id/a/index.html",
        "nested/path/index.html",
        "static/screen.html",
        "static/app.js",
        "static/a.css",
        "static/font.woff2",
        "static/unknown",
        "static/%2f.png",
        "mokly-viewer/catalogue.json",
        "mokly-viewer/diffs/generations/abc/review.json",
        "mokly-viewer/diffs/generations/abc/snapshots/before/mokly-generated/Product/Screen_1/index.desktop.html",
        "view/Product/Screen_1/index.html",
        "static/mokly-generated/Product/Screen_1/index.desktop.html",
        "__mokly",
        "__Mokly/index.html",
        "__mokly/catalogue.json",
        "__mokly-allowed/index.html",
        "__mokly/diffs/__generations/abc/review.json",
        "__mokly/diffs/__generations/abc/before/a.html",
    ];
    let files: BTreeMap<_, _> = paths
        .into_iter()
        .map(|path| (path.to_owned(), path.as_bytes().to_vec()))
        .collect();
    let objects: BTreeMap<_, _> = files
        .values()
        .map(|bytes| (BlobHash::digest(bytes).to_string(), bytes.clone()))
        .collect();
    let queries = Unimock::new(
        BlobsMock::publication_file
            .each_call(matching!(&ID, _))
            .answers_arc(Arc::new(move |_, _, path| {
                Ok(files.get(path).map(|bytes| PublicationFile {
                    publication_id: ID,
                    project_id: publication().project_id,
                    path: path.into(),
                    key: BlobKey {
                        hash: BlobHash::digest(bytes),
                        incarnation: Uuid::from_u128(9),
                    },
                    content_type: match path.rsplit('.').next() {
                        Some("html" | "htm") => "text/html",
                        Some("css") => "text/css",
                        Some("js") => "text/javascript",
                        Some("woff2") => "font/woff2",
                        Some("json") => "application/json",
                        _ => "application/octet-stream",
                    }
                    .into(),
                    size: bytes.len() as i64,
                }))
            })),
    );
    let storage = if head_or_redirect {
        Unimock::new(())
    } else {
        Unimock::new(
            FileStoreMock::open
                .each_call(matching!(_, None))
                .answers_arc(Arc::new(move |_, key, _| {
                    let Some(bytes) = objects.get(key.hash.as_str()).cloned() else {
                        return Ok(None);
                    };
                    Ok(Some(BlobStream::full(
                        key,
                        bytes.len() as u64,
                        body(bytes),
                    )?))
                })),
        )
    };
    PublishedCatalogue {
        access: Arc::new(Unimock::new(
            CatalogueAccessMock::authorize
                .each_call(matching!(&ID, _, _))
                .answers_arc(Arc::new(move |_, _, _, clear_cookie| {
                    *clear_cookie = expire_cookie;
                    Ok(CatalogueContext {
                        publication: publication(),
                        project: Project {
                            id: publication().project_id,
                            organization_id: OrganizationId(Uuid::from_u128(10)),
                            name: "Project".into(),
                            slug: "project".parse().unwrap(),
                            repository: "mokly-ai/mokly-cloud".into(),
                            config_path: "mokly.config.ts".into(),
                            visibility: if private {
                                Visibility::Private
                            } else {
                                Visibility::Public
                            },
                            require_approval: false,
                            automatic_builds: false,
                            version: 1,
                        },
                    })
                })),
        )),
        transactions: Arc::new(Unimock::new(
            TransactionsMock::run
                .each_call(matching!(true, _))
                .answers_arc(Arc::new(move |_, _, work: &mut QueryWork<'_>| {
                    work(&mut queries.clone())
                })),
        )),
        files: Arc::new(storage),
        cache: None,
        locations: locations(),
    }
}

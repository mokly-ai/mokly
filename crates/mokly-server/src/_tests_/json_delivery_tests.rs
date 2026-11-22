//! JSON route negotiation preserves canonical bytes and shares gzip output.

use std::io::Read;
use std::sync::Arc;

use axum::body::Bytes;
use axum::http::header::{CONTENT_ENCODING, CONTENT_LENGTH, CONTENT_TYPE, VARY};
use axum::http::{HeaderMap, Method, StatusCode};
use flate2::read::GzDecoder;
use mokly_model::namespace::viewer;
use mokly_model::{readers, routes};
use unimock::{MockFn, Unimock, matching};

use crate::backend::PreviewDocument;
use crate::clock::ClockMock;
use crate::comparison_store::{Comparisons, MemoryComparisons};
use crate::comparison_support::{accepted, files};
use crate::delivery_support::{application, body, request, router};
use crate::preview::{MemoryPreviews, PreviewStore};
use crate::publication::{PublicationWriter, Publications, SharedPublication};
use crate::publication_support::snapshot;
use crate::revision_file::RevisionFile;
use crate::snapshot::{encode, encode_index};

fn publications() -> Arc<SharedPublication> {
    let mut state = snapshot(1, Arc::new(Unimock::new(())));
    let state = Arc::get_mut(&mut state).unwrap();
    state.files.insert(
        viewer("index.json"),
        RevisionFile::new(encode_index(&state.index)),
    );
    Arc::make_mut(&mut state.generation)
        .assets
        .insert(viewer("live.json"), encode(&["live"]));
    Arc::new(SharedPublication::new(state.at_revision(1)))
}

fn decode(bytes: &Bytes) -> Vec<u8> {
    let mut identity = Vec::new();
    GzDecoder::new(bytes.as_ref())
        .read_to_end(&mut identity)
        .unwrap();
    identity
}

fn encoding(headers: &HeaderMap) -> Option<&str> {
    headers
        .get(CONTENT_ENCODING)
        .map(|value| value.to_str().unwrap())
}

#[tokio::test]
async fn publication_json_negotiates_gzip_and_preserves_head_headers() {
    let router = router(application(publications()));
    for file in ["index.json", "entries/screen-0.json", "live.json"] {
        let path = format!("/{}", viewer(file));
        let identity = body(request(&router, Method::GET, &path, &[]).await).await;
        for (accepted, encoded) in [
            (vec![], false),
            (vec![("accept-encoding", "GZip;q=0, *;q=1")], false),
            (vec![("accept-encoding", "br, gzip;q=0.000")], false),
            (vec![("accept-encoding", "br, GZip;Q=0.125")], true),
            (vec![("accept-encoding", "br, *;q=0.5")], true),
            (
                vec![("accept-encoding", "*"), ("accept-encoding", "GZIP;q=0")],
                false,
            ),
        ] {
            let get = request(&router, Method::GET, &path, &accepted).await;
            assert_eq!(get.status(), StatusCode::OK);
            let headers = get.headers().clone();
            assert_eq!(
                encoding(&headers),
                encoded.then_some("gzip"),
                "{path} with {accepted:?}"
            );
            assert_eq!(
                headers.get(VARY).map(|v| v.to_str().unwrap()),
                Some("Accept-Encoding")
            );
            assert_eq!(headers[CONTENT_TYPE], "application/json; charset=utf-8");
            assert_eq!(headers["x-content-type-options"], "nosniff");
            let get = body(get).await;
            assert_eq!(headers[CONTENT_LENGTH], get.len().to_string());
            let decoded = if encoded { decode(&get) } else { get.to_vec() };
            assert_eq!(decoded, identity);
            let head = request(&router, Method::HEAD, &path, &accepted).await;
            assert_eq!(head.status(), StatusCode::OK);
            assert_eq!(head.headers(), &headers);
            assert_eq!(body(head).await, Bytes::new());
        }
    }
    let error = request(
        &router,
        Method::GET,
        "/mokly-viewer/entries/missing.json",
        &[("accept-encoding", "gzip")],
    )
    .await;
    assert_eq!(error.status(), StatusCode::NOT_FOUND);
    assert_eq!(encoding(error.headers()), None);
}

#[tokio::test]
async fn concurrent_gzip_requests_share_one_body_per_publication() {
    let publications = publications();
    let router = router(application(publications.clone()));
    let index = format!("/{}", viewer("index.json"));
    let live = format!("/{}", viewer("live.json"));
    let encoded = async |path: &str| {
        body(request(&router, Method::GET, path, &[("accept-encoding", "gzip")]).await).await
    };
    let (one, two) = tokio::join!(encoded(&index), encoded(&index));
    assert!(
        std::ptr::eq(one.as_ptr(), two.as_ptr()),
        "concurrent requests must share the compressed index allocation"
    );
    assert_eq!(
        readers::index(std::str::from_utf8(&decode(&one)).unwrap())
            .unwrap()
            .revision,
        1
    );
    let first_live = encoded(&live).await;
    assert!(publications.replace(publications.current().at_revision(2)));
    let new_index = encoded(&index).await;
    assert_eq!(
        readers::index(std::str::from_utf8(&decode(&new_index)).unwrap())
            .unwrap()
            .revision,
        2
    );
    let second_live = encoded(&live).await;
    assert_eq!(decode(&first_live), decode(&second_live));
    assert!(!std::ptr::eq(first_live.as_ptr(), second_live.as_ptr()));
}

#[tokio::test]
async fn historical_json_reuses_gzip_bytes_in_its_comparison_generation() {
    let publications = publications();
    let comparisons = Arc::new(MemoryComparisons::new(
        Arc::new(Unimock::new(
            ClockMock::milliseconds.each_call(matching!()).returns(0u64),
        )),
        Arc::new(Unimock::new(())),
        Arc::new(Unimock::new(())),
        publications.clone(),
        Arc::new(Unimock::new(())),
    ));
    let accepted = accepted(Arc::new(Unimock::new(())), Arc::new(Unimock::new(())));
    let path = format!(
        "/{}entries/sample.json",
        routes::comparison_generation(&accepted.id)
    );
    comparisons.install(accepted, files()).unwrap();
    let mut app = application(publications);
    app.comparisons = Some(comparisons);
    let router = router(app);
    let fetch =
        || async { request(&router, Method::GET, &path, &[("accept-encoding", "gzip")]).await };
    let response = fetch().await;
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(encoding(response.headers()), Some("gzip"));
    assert_eq!(response.headers()[VARY], "Accept-Encoding");
    let first = body(response).await;
    let second = body(fetch().await).await;
    assert_eq!(decode(&first), b"{}");
    assert!(std::ptr::eq(first.as_ptr(), second.as_ptr()));
}

#[tokio::test]
async fn preview_json_get_and_head_negotiate_gzip() {
    let previews = Arc::new(MemoryPreviews::new(
        Arc::new(Unimock::new(
            ClockMock::milliseconds.each_call(matching!()).returns(0u64),
        )),
        "test-secret".into(),
    ));
    let path = "static/data.json";
    let preview = previews
        .insert(
            PreviewDocument {
                files: [(path.into(), encode(&["preview"]))].into(),
                document: "document.html".into(),
                usage: crate::publication_support::ready(),
            },
            &Default::default(),
            1,
        )
        .unwrap();
    let path = format!(
        "/{}",
        viewer(&format!("components/renders/{}/{path}", preview.render_id))
    );
    let mut app = application(publications());
    app.previews = previews;
    let router = router(app);
    let fetch =
        async |method| request(&router, method, &path, &[("accept-encoding", "gzip")]).await;
    let response = fetch(Method::GET).await;
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(encoding(response.headers()), Some("gzip"));
    assert_eq!(response.headers()["cache-control"], "no-store");
    let headers = response.headers().clone();
    let compressed = body(response).await;
    assert_eq!(decode(&compressed), encode(&["preview"]).bytes);
    assert_eq!(headers[CONTENT_LENGTH], compressed.len().to_string());
    let head = fetch(Method::HEAD).await;
    assert_eq!(head.status(), StatusCode::OK);
    assert_eq!(head.headers(), &headers);
    assert_eq!(body(head).await, Bytes::new());
}

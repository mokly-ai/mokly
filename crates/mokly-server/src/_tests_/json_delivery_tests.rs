//! JSON route negotiation preserves canonical bytes and shares gzip output.

use std::io::Read;
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::task::{Context, Poll, Waker};

use axum::body::Bytes;
use axum::http::header::{CONTENT_ENCODING, CONTENT_LENGTH, CONTENT_TYPE, VARY};
use axum::http::{HeaderMap, Method, StatusCode};
use flate2::read::GzDecoder;
use mokly_model::namespace::viewer;
use mokly_model::{readers, routes};
use tokio::sync::oneshot;
use unimock::{MockFn, Unimock, matching};

use crate::backend::PreviewDocument;
use crate::clock::ClockMock;
use crate::comparison_store::{Comparisons, MemoryComparisons};
use crate::comparison_support::{accepted, files};
use crate::delivery_support::{application, body, request, router};
use crate::json_delivery::{Gzip, JsonBody};
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
async fn overlapping_and_later_gzip_callers_start_one_encode() {
    let starts = Arc::new(AtomicUsize::new(0));
    let counted = {
        let starts = starts.clone();
        move || {
            starts.fetch_add(1, Ordering::SeqCst);
            JsonBody::Whole(Bytes::from_static(b"{}")).compress()
        }
    };
    let slot = Gzip::default();
    assert_eq!(starts.load(Ordering::SeqCst), 0);
    let (started, entered) = oneshot::channel();
    let (release, blocked) = oneshot::channel();
    let first = slot.get({
        let starts = starts.clone();
        move || {
            starts.fetch_add(1, Ordering::SeqCst);
            started.send(()).unwrap();
            blocked.blocking_recv().unwrap();
            JsonBody::Whole(Bytes::from_static(b"{}")).compress()
        }
    });
    let second = async {
        entered.await.unwrap();
        let mut caller = std::pin::pin!(slot.get(counted.clone()));
        let state = caller
            .as_mut()
            .poll(&mut Context::from_waker(Waker::noop()));
        release.send(()).unwrap();
        match state {
            Poll::Pending => caller.await,
            Poll::Ready(result) => result,
        }
    };
    let (first, second) = tokio::join!(first, second);
    let first = first.unwrap();
    let second = second.unwrap();
    assert!(std::ptr::eq(first.as_ptr(), second.as_ptr()));
    assert_eq!(decode(&first), b"{}");
    assert_eq!(starts.load(Ordering::SeqCst), 1, "overlapping callers");
    let later = slot.get(counted).await.unwrap();
    assert!(std::ptr::eq(first.as_ptr(), later.as_ptr()));
    assert_eq!(decode(&later), b"{}");
    assert_eq!(starts.load(Ordering::SeqCst), 1, "later caller");
}

#[tokio::test]
async fn historical_json_encodes_separately_for_each_request() {
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
    let second = fetch().await;
    assert_eq!(second.status(), StatusCode::OK);
    assert_eq!(encoding(second.headers()), Some("gzip"));
    assert_eq!(second.headers()[VARY], "Accept-Encoding");
    let second = body(second).await;
    assert_eq!(decode(&first), b"{}");
    assert_eq!(decode(&second), b"{}");
    assert!(
        !std::ptr::eq(first.as_ptr(), second.as_ptr()),
        "the comparison store reused a compressed allocation across requests"
    );
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
